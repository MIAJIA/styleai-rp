'use client';

import { useState } from 'react';
import { Message } from '../chat1/types';
import useChatStorage from '../chat1/useChatStorage';

export default function TestChatKVPage() {
    const [sessionId, setSessionId] = useState('test-session-123');
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    const handleMessageToKV = useChatStorage(sessionId);

    const addTestMessage = async () => {
        if (!inputMessage.trim()) return;
        
        setIsLoading(true);
        try {
            const newMessage: Message = {
                id: `msg-${Date.now()}`,
                content: inputMessage,
                sender: 'user',
                timestamp: new Date(),
                isSaveDB: true
            };

            await handleMessageToKV('add', newMessage);
            setInputMessage('');
            
            // 重新加载消息
            await loadMessages();
        } catch (error) {
            console.error('Failed to add message:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const addTestMessageWithStringTimestamp = async () => {
        setIsLoading(true);
        try {
            const newMessage = {
                id: `msg-${Date.now()}`,
                content: 'Test message with string timestamp',
                sender: 'user' as const,
                timestamp: new Date().toISOString(), // 字符串时间戳
                isSaveDB: true
            };

            await handleMessageToKV('add', newMessage);
            
            // 重新加载消息
            await loadMessages();
        } catch (error) {
            console.error('Failed to add message with string timestamp:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const addTestMessageWithNumberTimestamp = async () => {
        setIsLoading(true);
        try {
            const newMessage = {
                id: `msg-${Date.now()}`,
                content: 'Test message with number timestamp',
                sender: 'user' as const,
                timestamp: Date.now(), // 数字时间戳
                isSaveDB: true
            };

            await handleMessageToKV('add', newMessage);
            
            // 重新加载消息
            await loadMessages();
        } catch (error) {
            console.error('Failed to add message with number timestamp:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadMessages = async () => {
        setIsLoading(true);
        try {
            const loadedMessages = await handleMessageToKV('getAll');
            setMessages(loadedMessages || []);
        } catch (error) {
            console.error('Failed to load messages:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const clearMessages = async () => {
        setIsLoading(true);
        try {
            await handleMessageToKV('clear');
            setMessages([]);
        } catch (error) {
            console.error('Failed to clear messages:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const deleteMessage = async (messageId: string) => {
        setIsLoading(true);
        try {
            await handleMessageToKV('delete', { id: messageId } as Message);
            await loadMessages();
        } catch (error) {
            console.error('Failed to delete message:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="container mx-auto p-6 max-w-4xl">
            <h1 className="text-3xl font-bold mb-6">Chat KV Storage Test</h1>
            
            <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Session ID:</label>
                <input
                    type="text"
                    value={sessionId}
                    onChange={(e) => setSessionId(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded"
                />
            </div>

            <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Add Message:</label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        placeholder="Enter message content..."
                        className="flex-1 p-2 border border-gray-300 rounded"
                        onKeyPress={(e) => e.key === 'Enter' && addTestMessage()}
                    />
                    <button
                        onClick={addTestMessage}
                        disabled={isLoading || !inputMessage.trim()}
                        className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
                    >
                        Add
                    </button>
                </div>
            </div>

            <div className="mb-6 flex gap-2">
                <button
                    onClick={loadMessages}
                    disabled={isLoading}
                    className="px-4 py-2 bg-green-500 text-white rounded disabled:bg-gray-300"
                >
                    Load Messages
                </button>
                <button
                    onClick={clearMessages}
                    disabled={isLoading}
                    className="px-4 py-2 bg-red-500 text-white rounded disabled:bg-gray-300"
                >
                    Clear All
                </button>
            </div>

            <div className="mb-6 flex gap-2">
                <button
                    onClick={addTestMessageWithStringTimestamp}
                    disabled={isLoading}
                    className="px-4 py-2 bg-yellow-500 text-white rounded disabled:bg-gray-300"
                >
                    Test String Timestamp
                </button>
                <button
                    onClick={addTestMessageWithNumberTimestamp}
                    disabled={isLoading}
                    className="px-4 py-2 bg-purple-500 text-white rounded disabled:bg-gray-300"
                >
                    Test Number Timestamp
                </button>
            </div>

            {isLoading && (
                <div className="mb-4 text-blue-500">Loading...</div>
            )}

            <div className="mb-4">
                <h2 className="text-xl font-semibold mb-2">Messages ({messages.length})</h2>
                {messages.length === 0 ? (
                    <p className="text-gray-500">No messages found</p>
                ) : (
                    <div className="space-y-2">
                        {messages.map((message) => (
                            <div
                                key={message.id}
                                className="p-3 border border-gray-200 rounded flex justify-between items-start"
                            >
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`font-medium ${
                                            message.sender === 'user' ? 'text-blue-600' : 'text-green-600'
                                        }`}>
                                            {message.sender}
                                        </span>
                                        <span className="text-sm text-gray-500">
                                            {message.timestamp.toLocaleString()}
                                        </span>
                                    </div>
                                    <p className="text-gray-700">{message.content}</p>
                                </div>
                                <button
                                    onClick={() => deleteMessage(message.id)}
                                    disabled={isLoading}
                                    className="ml-2 px-2 py-1 bg-red-500 text-white text-sm rounded disabled:bg-gray-300"
                                >
                                    Delete
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="mt-8 p-4 bg-gray-100 rounded">
                <h3 className="font-semibold mb-2">API Endpoints:</h3>
                <ul className="text-sm space-y-1">
                    <li><strong>GET</strong> /api/chat/messages?sessionId={sessionId}</li>
                    <li><strong>POST</strong> /api/chat/messages (with sessionId and message)</li>
                    <li><strong>DELETE</strong> /api/chat/messages?sessionId={sessionId}&messageId=xxx</li>
                    <li><strong>PUT</strong> /api/chat/messages (with sessionId and action: 'clear')</li>
                </ul>
            </div>
        </div>
    );
}
