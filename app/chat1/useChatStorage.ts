import { useEffect, useState, useCallback, useMemo } from "react";
import { Message } from "./types";


class ChatDB {
    private dbName = 'StyleAiChat';
    private dbVersion = 1;
    public storeName = 'chat';
    private db: IDBDatabase | null = null;
    public sessionId: string = "";

    async init(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error('Failed to open database');
                reject(new Error('Failed to open database'));
            };

            request.onsuccess = (event) => {
                this.db = (event.target as IDBOpenDBRequest).result;
                console.log('[ChatDB] Database initialized successfully');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                // 创建消息存储
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                    console.log('[ChatDB] Object store created:', this.storeName);
                }
            };
        });
    }

    async addMessage(message: Message): Promise<void> {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);

            const request = store.put(message);

            request.onsuccess = () => {
                console.log('[ChatDB] Message added successfully');
                resolve();
            };
            request.onerror = () => {
                console.error('[ChatDB] Failed to add message');
                reject(new Error('Failed to add message'));
            };
        });
    }

    async getAllMessages(): Promise<Message[]> {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onsuccess = () => {
                const messages = request.result as Message[];
                // 将时间戳字符串转换回Date对象
                const messagesWithDates = messages.map(msg => ({
                    ...msg,
                    timestamp: new Date(msg.timestamp)
                }));
                
                // 按时间戳排序：最早的消息在前面（正常时间顺序）
                const sortedMessages = messagesWithDates.sort((a, b) => {
                    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
                });
                
                console.log('[ChatDB] Retrieved messages:', sortedMessages.length);
                resolve(sortedMessages);
            };

            request.onerror = () => {
                console.error('[ChatDB] Failed to get messages');
                reject(new Error('Failed to get messages'));
            };
        });
    }

    async clearAllMessages(): Promise<void> {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error('Failed to clear messages'));
        });
    }

    async deleteMessage(id: string): Promise<void> {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error('Failed to delete message'));
        });
    }

    async getMessageCount(): Promise<number> {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.count();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(new Error('Failed to get message count'));
        });
    }
}


export default function useChatStorage(sessionId: string) {
    const [chatDB, setChatDB] = useState<ChatDB>();
    const db = useMemo(() => {
        const db = new ChatDB();
        
        // 等待数据库初始化完成
        db.init();
        return db;
    }, [sessionId]);
    // 初始化数据库
    useEffect(() => {
        const initDatabase = async () => {
            try {
                console.log('[useChatStorage] Initializing database for sessionId:', sessionId);
                // 确保数据库已打开
                const db = new ChatDB();
                // db.sessionId = sessionId;
                // db.storeName = sessionId + "-chat";
                
                // 等待数据库初始化完成
                await db.init();
                console.log('[useChatStorage] Database initialized, setting chatDB state');
                setChatDB(db);
            } catch (err) {
                console.error('数据库初始化失败:', err);
            }
        };
        
        if (sessionId) {
            initDatabase();
        }
    }, [sessionId]);

    const addMessageToDB = useCallback(async (message: Message) => {
        if(message.id === "start-generation") {
           return;
        }
        if (chatDB) {
            await chatDB.addMessage(message);
        }
    }, [chatDB]);

    const getAllMessagesFromDB = useCallback(async () => {
        if (db) {
            try {
                const messages = await db.getAllMessages();
                console.log('[useChatStorage] Retrieved messages from DB:', messages.length);
                return messages;
            } catch (error) {
                console.error('[useChatStorage] Failed to get messages:', error);
                return [];
            }
        }
        return [];
    }, [chatDB]);

    const deleteMessageFromDB = useCallback(async (id: string) => {
        if (chatDB) {
            try {
                await chatDB.deleteMessage(id);
                console.log('[useChatStorage] Message deleted:', id);
            } catch (error) {
                console.error('[useChatStorage] Failed to delete message:', error);
            }
        }
    }, [chatDB]);

    const handleMessageToDB = useCallback(async (action: string, message?: Message): Promise<any> => {
        console.log('[useChatStorage] Action:', action, 'Message:', message?.id, 'chatDB exists:', !!chatDB);
        
        switch (action) {
            case 'add':
                if (message) {
                    await addMessageToDB(message);
                }
                break;
            case 'delete':
                if (message) {
                    await deleteMessageFromDB(message.id);
                }
                break;
            case 'getAll':
                return await getAllMessagesFromDB();
            default:
                break;
        }
    }, [addMessageToDB, deleteMessageFromDB, getAllMessagesFromDB, chatDB]);

    return handleMessageToDB;
}

