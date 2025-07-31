"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
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
    Link,
    Loader2,
    ImageIcon
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
import { useChat } from "./useChat"



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
    
    // Image upload state
    const [stagedImage, setStagedImage] = useState<string | null>(null)
    const [isImageProcessing, setIsImageProcessing] = useState(false)
    const imageInputRef = useRef<HTMLInputElement>(null)

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

    const { handleFreeChat } = useChat({
        sessionId,
        stagedImage,
        setStagedImage,
        addMessage
      })
    // 
    // tration layer remains in the main component
    const handleSendMessage = async (message: string) => {
        if (message.trim() === "") return
        let imageUrls: string[] = []
        if (stagedImage) {
            imageUrls = [stagedImage]
        }
        const userMessage: Message = {
            id: generateId(),
            content: message,
            sender: 'user',
            timestamp: new Date(),
            imageUrls: imageUrls
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
        // 清空用户对话框
        setNewMessage('') // Clear input after sending
        handleFreeChat(message)

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

    // Image upload handlers
    const handleImageUploadClick = () => {
        imageInputRef.current?.click()
    }

    const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        console.log(`[ChatPage] Image selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`)

        if (!file.type.startsWith("image/")) {
            alert("Please select an image file")
            return
        }

        if (file.size > 50 * 1024 * 1024) {
            alert("Image too large (>50MB), please select a smaller image")
            return
        }

        setIsImageProcessing(true)

        try {
            let compressionResult
            if (file.size > 10 * 1024 * 1024) {
                console.log("[ChatPage] Using aggressive compression for large file")
                compressionResult = await import("@/lib/image-compression").then((m) => m.compressForChat(file))
            } else {
                console.log("[ChatPage] Using standard compression")
                compressionResult = await import("@/lib/image-compression").then((m) => m.compressForChat(file))
            }

            console.log(
                `[ChatPage] Image compression complete: ${(file.size / 1024).toFixed(1)}KB → ${(
                    compressionResult.compressedSize / 1024
                ).toFixed(1)}KB (reduced ${(compressionResult.compressionRatio * 100).toFixed(1)}%)`,
            )

            setStagedImage(compressionResult.dataUrl)
        } catch (error) {
            console.error("[ChatPage] Image compression failed:", error)
            if (file.size < 5 * 1024 * 1024) {
                console.log("[ChatPage] Compression failed, using original image")
                const reader = new FileReader()
                reader.onloadend = () => {
                    setStagedImage(reader.result as string)
                }
                reader.readAsDataURL(file)
            } else {
                alert("Image processing failed, please try again or select a smaller image")
            }
        } finally {
            setIsImageProcessing(false)
        }

        event.target.value = ""
    }

    const clearStagedImage = () => {
        setStagedImage(null)
    }


    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        })
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50">
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
            <div className="flex-1 px-4 py-6 space-y-4 max-w-4xl mx-auto pb-32">
                <div className="space-y-4">
                    {messages.map((message) => (
                        <div
                            key={message.id}
                            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start' }  md-4`}
                        >
                            <Card className={`max-w-sm lg:max-w-lg xl:max-w-xl 2xl:max-w-2xl p-4 ${message.sender === 'user'
                                ? 'bg-blue-500 text-white'
                                : 'bg-white border border-gray-200'
                                }`}>
                                <div className={`flex items-start gap-3 ${message.sender === 'user' ? 'flex-row-reverse' : ''}`}>
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
                                                            {imageUrl === "wait" ? (
                                                                // Loading state for "wait" URL
                                                                <div className="flex items-center justify-center h-full bg-gradient-to-br from-gray-50 to-gray-100">
                                                                    <div className="flex flex-col items-center gap-2">
                                                                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                                                                        <span className="text-xs text-gray-500">Generating image...</span>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <Image
                                                                    onClick={() => handleOpenModal(imageUrl)}
                                                                    src={imageUrl}
                                                                    alt={`Message image ${index + 1}`}
                                                                    fill
                                                                    className="object-cover object-top"
                                                                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                                                    onError={(e) => {
                                                                        // Handle image loading errors
                                                                        const target = e.target as HTMLImageElement;
                                                                        target.style.display = 'none';
                                                                    }}
                                                                />
                                                            )}
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
            <div className="fixed bottom-14 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-gray-200 p-4 z-20">
                <div className="max-w-4xl mx-auto">
                    {/* Staged image preview */}
                    {stagedImage && (
                        <div className="mb-2 relative w-24 h-24">
                            <img
                                src={stagedImage}
                                alt="Preview"
                                className="w-full h-full object-cover rounded-lg"
                            />
                            <button
                                onClick={clearStagedImage}
                                className="absolute -top-2 -right-2 bg-gray-700 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs shadow-lg"
                                aria-label="Remove image"
                            >
                                X
                            </button>
                        </div>
                    )}

                    {/* Image processing indicator */}
                    {isImageProcessing && (
                        <div className="mb-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                                <span className="text-sm text-blue-700">正在优化图片...</span>
                            </div>
                        </div>
                    )}

                    <div className="flex gap-2">
                        {/* Hidden file input */}
                        <input
                            type="file"
                            ref={imageInputRef}
                            onChange={handleImageSelect}
                            className="hidden"
                            accept="image/*"
                        />
                        
                        {/* Image upload button */}
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={handleImageUploadClick}
                            disabled={isImageProcessing}
                            aria-label="Upload image"
                            className="flex-shrink-0"
                        >
                            {isImageProcessing ? (
                                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                            ) : (
                                <ImageIcon className="w-5 h-5 text-gray-500" />
                            )}
                        </Button>

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
                            className="px-4 flex-shrink-0"
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