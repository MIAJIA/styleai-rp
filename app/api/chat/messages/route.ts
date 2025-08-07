import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { Message } from '@/app/chat1/types';

// 聊天消息的KV存储键生成函数
function getChatMessageKey(sessionId: string, messageId: string): string {
    return `chat:message:${sessionId}:${messageId}`;
}

function getChatMessagesListKey(sessionId: string): string {
    return `chat:messages:${sessionId}`;
}

// 分布式锁相关函数
function getLockKey(sessionId: string): string {
    return `chat:lock:${sessionId}`;
}

async function acquireLock(sessionId: string, lockTimeout: number = 10): Promise<boolean> {
    const lockKey = getLockKey(sessionId);
    const lockValue = `locked_${Date.now()}_${Math.random()}`;
    
    try {
        // 使用简单的检查-设置模式
        const existingLock = await kv.get(lockKey);
        if (existingLock) {
            console.log(`[Chat API] Lock already exists for session ${sessionId}`);
            return false;
        }
        
        // 设置锁，带过期时间
        await kv.set(lockKey, lockValue, { ex: lockTimeout });
        
        // 再次检查确保锁设置成功
        const verifyLock = await kv.get(lockKey);
        if (verifyLock === lockValue) {
            console.log(`[Chat API] Lock acquired successfully for session ${sessionId}`);
            return true;
        } else {
            console.log(`[Chat API] Lock acquisition failed for session ${sessionId}`);
            return false;
        }
    } catch (error) {
        console.error('[Chat API] Failed to acquire lock:', error);
        return false;
    }
}

async function releaseLock(sessionId: string): Promise<void> {
    const lockKey = getLockKey(sessionId);
    try {
        await kv.del(lockKey);
    } catch (error) {
        console.error('[Chat API] Failed to release lock:', error);
    }
}

// 清理对象中的 null 和 undefined 值（Redis 不支持这些值）
function cleanObjectForRedis(obj: any): any {
    if (obj === null || obj === undefined) {
        return undefined;
    }

    if (Array.isArray(obj)) {
        const cleanArray = obj.map(cleanObjectForRedis).filter(item => item !== undefined);
        return cleanArray.length > 0 ? cleanArray : undefined;
    }

    if (typeof obj === 'object') {
        const cleanObject: Record<string, any> = {};
        Object.entries(obj).forEach(([key, value]) => {
            const cleanValue = cleanObjectForRedis(value);
            if (cleanValue !== undefined) {
                cleanObject[key] = cleanValue;
            }
        });
        return Object.keys(cleanObject).length > 0 ? cleanObject : undefined;
    }

    return obj;
}

// GET - 获取会话的所有消息
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get('sessionId');

        if (!sessionId) {
            return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
        }

        const messagesListKey = getChatMessagesListKey(sessionId);
        const messageIds = await kv.lrange(messagesListKey, 0, -1);

        if (!messageIds || messageIds.length === 0) {
            return NextResponse.json({ messages: [] });
        }

        const messages: Message[] = [];
        
        // 按时间顺序获取消息（从最早到最新）
        for (let i = messageIds.length - 1; i >= 0; i--) {
            const messageId = messageIds[i];
            const messageKey = getChatMessageKey(sessionId, messageId);
            const messageData = await kv.get(messageKey);
            
            if (messageData) {
                // 将ISO字符串转换回Date对象
                const messageDataTyped = messageData as any;
                
                // 处理时间戳
                let timestamp: Date;
                try {
                    if (messageDataTyped.timestamp) {
                        timestamp = new Date(messageDataTyped.timestamp);
                        // 验证日期是否有效
                        if (isNaN(timestamp.getTime())) {
                            timestamp = new Date();
                        }
                    } else {
                        timestamp = new Date();
                    }
                } catch (error) {
                    console.error('[Chat API] Error processing timestamp for message:', messageDataTyped.id, error);
                    timestamp = new Date();
                }

                const message: Message = {
                    ...messageDataTyped,
                    timestamp
                };
                messages.push(message);
            }
        }

        console.log(`[Chat API] Retrieved ${messages.length} messages for session ${sessionId}`);
        return NextResponse.json({ messages });
    } catch (error) {
        console.error('[Chat API] Error getting messages:', error);
        return NextResponse.json({ error: 'Failed to get messages' }, { status: 500 });
    }
}

// POST - 添加新消息
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { sessionId, message } = body;

        if (!sessionId || !message) {
            return NextResponse.json({ error: 'Session ID and message are required' }, { status: 400 });
        }

        // 验证消息格式
        if (!message.id || !message.content || !message.sender) {
            return NextResponse.json({ error: 'Invalid message format' }, { status: 400 });
        }

        // 处理时间戳
        let timestamp: string;
        try {
            if (message.timestamp instanceof Date) {
                timestamp = message.timestamp.toISOString();
            } else if (typeof message.timestamp === 'string') {
                timestamp = message.timestamp;
            } else if (typeof message.timestamp === 'number') {
                timestamp = new Date(message.timestamp).toISOString();
            } else {
                timestamp = new Date().toISOString();
            }
        } catch (error) {
            console.error('[Chat API] Error processing timestamp:', error);
            timestamp = new Date().toISOString();
        }

        // 清理消息对象，移除 null 和 undefined 值
        const cleanMessage = cleanObjectForRedis({
            ...message,
            timestamp
        });

        if (!cleanMessage) {
            return NextResponse.json({ error: 'Unable to clean message object for Redis storage' }, { status: 400 });
        }

        // 使用分布式锁确保原子性操作
        let lockAcquired = false;
        let messageExists = false;
        
        try {
            // 尝试获取锁
            lockAcquired = await acquireLock(sessionId, 6000); // 10秒超时
            
            if (!lockAcquired) {
                console.log(`[Chat API] Failed to acquire lock for session ${sessionId}, retrying...`);
                // 等待一小段时间后重试
                await new Promise(resolve => setTimeout(resolve, 100));
                lockAcquired = await acquireLock(sessionId, 1000);
                
                if (!lockAcquired) {
                    console.error(`[Chat API] Failed to acquire lock after retry for session ${sessionId}`);
                    return NextResponse.json({ error: 'Service temporarily unavailable, please try again' }, { status: 503 });
                }
            }
            
            console.log(`[Chat API] Lock acquired for session ${sessionId}`);
            
            // 保存消息到KV
            const messageKey = getChatMessageKey(sessionId, message.id);
            console.log(`[Chat API] Message ${messageKey}`);
            await kv.del(messageKey);
            await kv.set(messageKey, cleanMessage);

            // 在锁保护下检查并添加消息ID到列表
            const messagesListKey = getChatMessagesListKey(sessionId);
            const existingMessageIds = await kv.lrange(messagesListKey, 0, -1);
            messageExists = existingMessageIds.includes(message.id);
            
            if (!messageExists) {
                // 如果消息不存在，则添加到列表开头
                await kv.lpush(messagesListKey, message.id);
                console.log(`[Chat API] Message ${message.id} added to list for session ${sessionId}`);
            } else {
                console.log(`[Chat API] Message ${message.id} already exists in list, skipping add to list`);
            }

            // 限制消息列表长度（保留最近的1000条消息）
            await kv.ltrim(messagesListKey, 0, 999);

            console.log(`[Chat API] Message ${message.id} ${messageExists ? 'updated' : 'added'} successfully for session ${sessionId}`);
            return NextResponse.json({ success: true, action: messageExists ? 'updated' : 'added' });
            
        } finally {
            // 确保锁被释放
            if (lockAcquired) {
                await releaseLock(sessionId);
                console.log(`[Chat API] Lock released for session ${sessionId}`);
            }
        }
    } catch (error) {
        console.error('[Chat API] Error adding message:', error);
        return NextResponse.json({ error: 'Failed to add message' }, { status: 500 });
    }
}

// DELETE - 删除消息
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get('sessionId');
        const messageId = searchParams.get('messageId');

        if (!sessionId || !messageId) {
            return NextResponse.json({ error: 'Session ID and message ID are required' }, { status: 400 });
        }

        // 使用分布式锁确保原子性操作
        let lockAcquired = false;
        
        try {
            // 尝试获取锁
            lockAcquired = await acquireLock(sessionId, 1000);
            
            if (!lockAcquired) {
                console.log(`[Chat API] Failed to acquire lock for session ${sessionId}, retrying...`);
                await new Promise(resolve => setTimeout(resolve, 100));
                lockAcquired = await acquireLock(sessionId, 1000);
                
                if (!lockAcquired) {
                    console.error(`[Chat API] Failed to acquire lock after retry for session ${sessionId}`);
                    return NextResponse.json({ error: 'Service temporarily unavailable, please try again' }, { status: 503 });
                }
            }
            
            console.log(`[Chat API] Lock acquired for session ${sessionId}`);
            
            // 删除消息
            const messageKey = getChatMessageKey(sessionId, messageId);
            await kv.del(messageKey);

            // 从消息列表中移除
            const messagesListKey = getChatMessagesListKey(sessionId);
            await kv.lrem(messagesListKey, 0, messageId);

            console.log(`[Chat API] Message ${messageId} deleted successfully for session ${sessionId}`);
            return NextResponse.json({ success: true });
            
        } finally {
            // 确保锁被释放
            if (lockAcquired) {
                await releaseLock(sessionId);
                console.log(`[Chat API] Lock released for session ${sessionId}`);
            }
        }
    } catch (error) {
        console.error('[Chat API] Error deleting message:', error);
        return NextResponse.json({ error: 'Failed to delete message' }, { status: 500 });
    }
}

// PUT - 清空会话的所有消息
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { sessionId, action } = body;

        if (!sessionId || action !== 'clear') {
            return NextResponse.json({ error: 'Session ID and clear action are required' }, { status: 400 });
        }

        // 使用分布式锁确保原子性操作
        let lockAcquired = false;
        
        try {
            // 尝试获取锁
            lockAcquired = await acquireLock(sessionId, 1000);
            
            if (!lockAcquired) {
                console.log(`[Chat API] Failed to acquire lock for session ${sessionId}, retrying...`);
                await new Promise(resolve => setTimeout(resolve, 100));
                lockAcquired = await acquireLock(sessionId, 1000);
                
                if (!lockAcquired) {
                    console.error(`[Chat API] Failed to acquire lock after retry for session ${sessionId}`);
                    return NextResponse.json({ error: 'Service temporarily unavailable, please try again' }, { status: 503 });
                }
            }
            
            console.log(`[Chat API] Lock acquired for session ${sessionId}`);
            
            const messagesListKey = getChatMessagesListKey(sessionId);
            const messageIds = await kv.lrange(messagesListKey, 0, -1);

            if (messageIds && messageIds.length > 0) {
                // 删除所有消息
                const deletePromises = messageIds.map(messageId => {
                    const messageKey = getChatMessageKey(sessionId, messageId);
                    return kv.del(messageKey);
                });
                await Promise.all(deletePromises);
            }

            // 清空消息列表
            await kv.del(messagesListKey);

            console.log(`[Chat API] All messages cleared for session ${sessionId}`);
            return NextResponse.json({ success: true });
            
        } finally {
            // 确保锁被释放
            if (lockAcquired) {
                await releaseLock(sessionId);
                console.log(`[Chat API] Lock released for session ${sessionId}`);
            }
        }
    } catch (error) {
        console.error('[Chat API] Error clearing messages:', error);
        return NextResponse.json({ error: 'Failed to clear messages' }, { status: 500 });
    }
}
