"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import {
    Send,
    Edit,
    Trash2,
    User,
    Bot,
    ArrowLeft,
    Plus,
    Heart,
    ThumbsUp,
    ThumbsDown,
    Share,
    Copy,
    Download,
    Link
} from "lucide-react"
import { ChatModeData } from "../chat/types"
import { useRouter } from "next/navigation"
import { ButtonAction, Message } from "./types"
import { useGeneration } from "./useGeneration"
import Image from "next/image"
import UserInfo from "../components/userInfo"
import IOSTabBar from "../components/ios-tab-bar"
import ImageModal from "../components/image-modal"
import { useSessionManagement } from "../chat/hooks/useSessionManagement"



export default function ChatPage() {
    const [messages, setMessages] = useState<Message[]>([])
    const router = useRouter()
    const [newMessage, setNewMessage] = useState('')
    const [editContent, setEditContent] = useState('')
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const [chatData, setChatData] = useState<ChatModeData | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const sessionId = useSessionManagement()
    const [modalImage, setModalImage] = useState<string | null>(null)

    useEffect(() => {
        const rawData = sessionStorage.getItem("chatModeData")
        console.log("[ChatPage | useEffect] 🎯 Raw sessionStorage data:", rawData)
        if (rawData) {
            try {
                const data = JSON.parse(rawData)

                // create dataForLog. do not show selfiePreview in the console log, replace it with "***"
                const dataForLog = { ...data }
                if (dataForLog.selfiePreview) {
                    dataForLog.selfiePreview = "***"
                }
                console.log("[ChatPage | useEffect] ✅ Parsed chatData:", dataForLog)
                setChatData(data)
                const initialMessage: Message = {
                    id: 'start-generation',
                    content: "Welcome! I see you've provided your images and occasion. Ready to see your personalized style?",
                    sender: 'ai',
                    timestamp: new Date(),
                    // imageUrls: [
                    //   '/casual-outfit.png',
                    //   '/elegant-outfit.png'
                    // ],
                    buttons: [
                        {
                            id: 'btn1',
                            label: 'Start Generation',
                            type: 'default',
                            action: 'Start-Generation',
                        }
                    ]
                }
                addMessage(initialMessage)
            } catch (error) {
                // Handle error, maybe redirect or show a message
            }
        } else {
            router.push("/") // Redirect if no data
        }
    }, [router, setMessages]) // removed dependency on addMessage

    const addMessage = (message: Message) => {
        setMessages(prev => {
            // 检查是否已存在相同 ID 的消息
            const existingIndex = prev.findIndex(msg => msg.id === message.id)

            // 检查消息内容是否为空
            const isEmptyMessage = !message.content || message.content.trim() === ''

            if (existingIndex !== -1) {
                // 如果存在相同 ID 的消息
                if (isEmptyMessage) {
                    // 如果新消息为空，则删除该消息
                    return prev.filter((_, index) => index !== existingIndex)
                } else {
                    // 如果新消息不为空，则替换该消息
                    const newMessages = [...prev]
                    newMessages[existingIndex] = message
                    return newMessages
                }
            } else {
                // 如果不存在相同 ID 的消息
                if (isEmptyMessage) {
                    // 如果新消息为空，则不添加
                    return prev
                } else {
                    // 如果新消息不为空，则追加新消息
                    return [...prev, message]
                }
            }
        })
    }

    // 专门用于更新消息的函数
    const updateMessage = (messageId: string, updates: Partial<Message>) => {
        setMessages(prev =>
            prev.map(msg =>
                msg.id === messageId
                    ? { ...msg, ...updates }
                    : msg
            )
        )
    }
    // Fix: Ensure chatData is not null before passing to useGeneration
    const { handleButtonAction } = useGeneration(
        chatData as ChatModeData, // Type assertion to satisfy type checker; make sure chatData is not null before this is called in useGeneration
        addMessage,
        router
    );

    // Auto scroll to bottom when new messages are added
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // Focus input when component mounts
    useEffect(() => {
        inputRef.current?.focus()
    }, [])

    const generateId = () => {
        return Date.now().toString() + Math.random().toString(36).substr(2, 9)
    }

    const handleSendMessage1 = (content?: string) => {
        const messageContent = content || newMessage
        if (!messageContent.trim()) return

        const userMessage: Message = {
            id: generateId(),
            content: messageContent.trim(),
            sender: 'user',
            timestamp: new Date()
        }

        setMessages(prev => [...prev, userMessage])
        if (!content) {
            setNewMessage('')
        }
    }
    // This orchestration layer remains in the main component
    const handleSendMessage = async (message: string) => {
        if (message.trim() === "") return
        const userMessage: Message = {
            id: generateId(),
            content: message,
            sender: 'user',
            timestamp: new Date()
        }
        addMessage(userMessage)
        // Check for generation-related quick replies
        if (message.startsWith("Show me option")) {
            const index = parseInt(message.split(" ")[3], 10) - 1;
            if (!isNaN(index)) {
                console.log(`[ChatPage] User clicked quick reply to see option ${index + 1}`);
                // Note: selectSuggestion function is not available in this context
                // You may need to implement this functionality or remove this check
            }
            setNewMessage('') // Clear input after sending
            return;
        }

        if (message === "不喜欢这套搭配") {
            setNewMessage('') // Clear input after sending
            return
        }

        if (message === "继续生成最终效果") {
            const aiMessage: Message = {
                id: generateId(),
                content: "OK! I'll continue to generate the final try-on effect for you, please wait...",
                sender: 'ai',
                timestamp: new Date()
            }
            addMessage(aiMessage)
            setNewMessage('') // Clear input after sending
            return
        }

        if (message === "重新生成场景" || message === "换个风格试试") {
            const aiMessage: Message = {
                id: generateId(),
                content: "OK! I've stopped the current generation. You can return to the homepage to re-upload your photos, or tell me what style you want.",
                sender: 'ai',
                timestamp: new Date()
            }
            addMessage(aiMessage)
            setNewMessage('') // Clear input after sending
            return
        }

        // For regular messages, use the existing handleSendMessage1 function
        handleSendMessage1(message)
        setNewMessage('') // Clear input after sending
    }
    const addMessageWithImages = (content: string, imageUrls: string[], sender: 'user' | 'ai' = 'ai') => {
        const message: Message = {
            id: generateId(),
            content,
            sender,
            timestamp: new Date(),
            imageUrls
        }
        setMessages(prev => [...prev, message])
    }

    const getButtonIcon = (iconName?: string) => {
        switch (iconName) {
            case 'heart': return <Heart className="w-4 h-4" />
            case 'thumbsUp': return <ThumbsUp className="w-4 h-4" />
            case 'thumbsDown': return <ThumbsDown className="w-4 h-4" />
            case 'share': return <Share className="w-4 h-4" />
            case 'copy': return <Copy className="w-4 h-4" />
            case 'download': return <Download className="w-4 h-4" />
            case 'link': return <Link className="w-4 h-4" />
            default: return null
        }
    }

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSendMessage(newMessage)
        }
    }


    const handleCloseModal = () => {
        setIsModalOpen(false)
        setModalImage(null)
    }
    const handleOpenModal = (imageUrl: string) => {
        setModalImage(imageUrl)
        setIsModalOpen(true)
    }


    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        })
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50 pb-20">
            <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-gray-200">
                <div className="flex items-center px-4 h-12 justify-between">
                    <Button variant="ghost" size="sm" onClick={() => router.back()} className="p-2">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <h1 className="text-lg font-semibold flex-1 text-left">AI Stylist</h1>
                    <div className="w-10 flex justify-end" />
                    <UserInfo />
                </div>
            </header>

            {/* Messages Container */}
            <div className="flex-1 px-4 py-6 space-y-4 max-w-4xl mx-auto">
                <div className="space-y-4">
                    {messages.map((message) => (
                        <div
                            key={message.id}
                            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'} max-w-[90%] `}
                        >
                            <Card className={`max-w-sm lg:max-w-lg xl:max-w-xl 2xl:max-w-2xl p-4 ${message.sender === 'user'
                                ? 'bg-blue-500 text-white'
                                : 'bg-white border border-gray-200'
                                }`}>
                                <div className="flex items-start gap-3">
                                    <Avatar className="w-8 h-8">
                                        {message.sender === 'user' ? (
                                            <User className="w-4 h-4" />
                                        ) : (
                                            <Bot className="w-4 h-4" />
                                        )}
                                    </Avatar>

                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-sm font-medium">
                                                {message.sender === 'user' ? 'You' : 'AI Assistant'}
                                            </span>
                                            <span className={`text-xs ${message.sender === 'user' ? 'text-blue-100' : 'text-gray-500'
                                                }`}>
                                                {formatTime(message.timestamp)}
                                            </span>
                                        </div>

                                        <p className={`text-sm ${message.sender === 'user' ? 'text-white' : 'text-gray-700'
                                            }`} style={{ whiteSpace: 'pre-wrap' }}>
                                            {message.content}
                                        </p>

                                        {/* Message images */}
                                        {message.imageUrls && message.imageUrls.length > 0 && (
                                            <div className="mt-3">
                                                <div className={`grid gap-2 ${message.imageUrls.length === 1
                                                    ? 'grid-cols-1'
                                                    : 'grid-cols-2'
                                                    }`}>
                                                    {message.imageUrls.map((imageUrl, index) => (
                                                        <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                                                            <Image
                                                                onClick={() => handleOpenModal(imageUrl)}
                                                                src={imageUrl}
                                                                alt={`Message image ${index + 1}`}
                                                                fill
                                                                className="object-cover"
                                                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                                                onError={(e) => {
                                                                    // Handle image loading errors
                                                                    const target = e.target as HTMLImageElement;
                                                                    target.style.display = 'none';
                                                                }}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Message buttons */}
                                        {message.buttons && message.buttons.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mt-3">
                                                {message.buttons.map((button) => (
                                                    <Button
                                                        key={button.id}
                                                        variant={button.type}
                                                        size="sm"
                                                        className="text-xs"
                                                        onClick={() => handleButtonAction(button, message)}
                                                    >
                                                        {getButtonIcon(button.icon)}
                                                        {button.label}
                                                    </Button>
                                                ))}
                                            </div>
                                        )}

                                        {/* Like/Dislike counters */}
                                        {message.metadata && ((message.metadata.likes || 0) > 0 || (message.metadata.dislikes || 0) > 0) && (
                                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                                {(message.metadata.likes || 0) > 0 && (
                                                    <span className="flex items-center gap-1">
                                                        <ThumbsUp className="w-3 h-3" />
                                                        {message.metadata.likes}
                                                    </span>
                                                )}
                                                {(message.metadata.dislikes || 0) > 0 && (
                                                    <span className="flex items-center gap-1">
                                                        <ThumbsDown className="w-3 h-3" />
                                                        {message.metadata.dislikes}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input Area */}
            <div className="sticky bottom-0 bg-white/80 backdrop-blur-lg border-t border-gray-200 p-4">
                <div className="max-w-4xl mx-auto">
                    <div className="flex gap-2">
                        <Textarea
                            ref={inputRef}
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Type your message..."
                            className="flex-1 min-h-[44px] max-h-32 resize-none"
                            rows={1}
                        />
                        <Button
                            onClick={() => handleSendMessage(newMessage)}
                            disabled={!newMessage.trim()}
                            className="px-4"
                        >
                            <Send className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </div>

            <ImageModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                imageUrl={modalImage || ""}
                sessionId={sessionId}
            />

            <IOSTabBar />
        </div>
    )
}