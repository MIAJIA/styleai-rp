import { useEffect, useState, useCallback } from "react";
import { Message } from "./types";

class ChatKVStorage {
    private sessionId: string;

    constructor(sessionId: string) {
        this.sessionId = sessionId;
    }

    async addMessage(message: Message): Promise<void> {
        try {
            const response = await fetch('/api/chat/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sessionId: this.sessionId,
                    message
                })
            });

            if (!response.ok) {
                // throw new Error(`Failed to add message: ${response.statusText}`);
            }

            console.log('[ChatKVStorage] Message added successfully:', message.id);
        } catch (error) {
            console.error('[ChatKVStorage] Failed to add message:', error);
            throw error;
        }
    }

    async getAllMessages(): Promise<Message[]> {
        try {
            const response = await fetch(`/api/chat/messages?sessionId=${this.sessionId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to get messages: ${response.statusText}`);
            }

            const data = await response.json();
            const messages = data.messages || [];

            // 将JSON中的时间字符串转换为Date对象
            const processedMessages = messages.map((message: any) => ({
                ...message,
                timestamp: message.timestamp ? new Date(message.timestamp) : new Date()
            }));

            console.log('[ChatKVStorage] Retrieved messages:', processedMessages.length);
            return processedMessages;
        } catch (error) {
            console.error('[ChatKVStorage] Failed to get messages:', error);
            throw error;
        }
    }

    async deleteMessage(messageId: string): Promise<void> {
        try {
            const response = await fetch(`/api/chat/messages?sessionId=${this.sessionId}&messageId=${messageId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to delete message: ${response.statusText}`);
            }

            console.log('[ChatKVStorage] Message deleted:', messageId);
        } catch (error) {
            console.error('[ChatKVStorage] Failed to delete message:', error);
            throw error;
        }
    }

    async clearAllMessages(): Promise<void> {
        try {
            const response = await fetch('/api/chat/messages', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sessionId: this.sessionId,
                    action: 'clear'
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to clear messages: ${response.statusText}`);
            }

            console.log('[ChatKVStorage] All messages cleared');
        } catch (error) {
            console.error('[ChatKVStorage] Failed to clear messages:', error);
            throw error;
        }
    }

    async getMessageCount(): Promise<number> {
        try {
            const messages = await this.getAllMessages();
            return messages.length;
        } catch (error) {
            console.error('[ChatKVStorage] Failed to get message count:', error);
            return 0;
        }
    }
}

export default function useChatStorage(sessionId: string) {
    const [chatStorage, setChatStorage] = useState<ChatKVStorage>();

    // 初始化KV存储
    useEffect(() => {
        if (sessionId) {
            console.log('[useChatStorage] Initializing KV storage for sessionId:', sessionId);
            const storage = new ChatKVStorage(sessionId);
            setChatStorage(storage);
        }
    }, [sessionId]);

    const addMessageToKV = useCallback(async (message: Message) => {
        if (message.isSaveDB && chatStorage) {
            try {
                await chatStorage.addMessage(message);
            } catch (error) {
                console.error('[useChatStorage] Failed to add message to KV:', error);
                // 可以在这里添加降级到localStorage的逻辑
            }
        }
    }, [chatStorage]);

    const getAllMessagesFromKV = useCallback(async () => {
        if (chatStorage) {
            try {
                const messages = await chatStorage.getAllMessages();
                console.log('[useChatStorage] Retrieved messages from KV:', messages.length);
                return messages;
            } catch (error) {
                console.error('[useChatStorage] Failed to get messages from KV:', error);
                return [];
            }
        }
        return [];
    }, [chatStorage]);

    const deleteMessageFromKV = useCallback(async (id: string) => {
        if (chatStorage) {
            try {
                await chatStorage.deleteMessage(id);
                console.log('[useChatStorage] Message deleted from KV:', id);
            } catch (error) {
                console.error('[useChatStorage] Failed to delete message from KV:', error);
            }
        }
    }, [chatStorage]);

    const handleMessageToKV = useCallback(async (action: string, message?: Message): Promise<any> => {
        console.log('[useChatStorage] Action:', action, 'Message:', message?.id, 'chatStorage exists:', !!chatStorage);
        
        switch (action) {
            case 'add':
                if (message && message.isSaveDB) {
                    await addMessageToKV(message);
                }
                break;
            case 'delete':
                if (message && message.isSaveDB) {
                    await deleteMessageFromKV(message.id);
                }
                break;
            case 'getAll':
                return await getAllMessagesFromKV();
            case 'clear':
                if (chatStorage) {
                    await chatStorage.clearAllMessages();
                }
                break;
            case 'count':
                if (chatStorage) {
                    return await chatStorage.getMessageCount();
                }
                return 0;
            default:
                break;
        }
    }, [addMessageToKV, deleteMessageFromKV, getAllMessagesFromKV, chatStorage]);

    return handleMessageToKV;
}

