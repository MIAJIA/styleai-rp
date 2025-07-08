"use client"

import type React from "react"


import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import IOSTabBar from "../components/ios-tab-bar"
import ImageModal from "../components/image-modal"
import {
  ArrowLeft,
  Loader2,
  Upload,
} from "lucide-react"

// Import types and constants from separate files
import type { ChatMessage, ChatModeData, ChatStep } from "./types"
import { generateUniqueId } from "./utils"
import { ChatBubble, StatusIndicator, ChatInput, DebugPanel } from "./components"
import { useImageHandling } from "./hooks/useImageHandling"
import { useSessionManagement } from "./hooks/useSessionManagement"
import { useChat } from "./hooks/useChat"
import { useGeneration } from "./hooks/useGeneration"

export default function ChatPage() {
  const router = useRouter()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const {
    stagedImage,
    setStagedImage,
    isImageProcessing,
    handleImageUploadClick,
    handleImageSelect,
    clearStagedImage,
  } = useImageHandling()
  const sessionId = useSessionManagement()

  // State related to the page UI itself
  const [chatData, setChatData] = useState<ChatModeData | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [modalImage, setModalImage] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDebugExpanded, setIsDebugExpanded] = useState(false)
  const [hasAutoStarted, setHasAutoStarted] = useState(false) // Tracks if guided-mode generation has started

  // Core state management is now delegated to hooks
  const [currentStep, setCurrentStep] = useState<ChatStep>("suggestion")

  const { messages, setMessages, isLoading, handleSendMessage: sendChatMessage, addMessage } = useChat({
    sessionId,
    stagedImage,
    setStagedImage,
  })

  // This function is needed by useGeneration but defined here as it modifies 'messages' state from useChat
  const replaceLastLoadingMessage = useCallback(
    (message: Omit<ChatMessage, "id" | "timestamp">) => {
      setMessages((prevMessages) => {
        const newMessages = [...prevMessages]
        let loadingMessageIndex = -1
        for (let i = newMessages.length - 1; i >= 0; i--) {
          if (newMessages[i].type === "loading" && !newMessages[i].metadata?.isImagePlaceholder) {
            loadingMessageIndex = i
            break
          }
        }
        if (loadingMessageIndex !== -1) {
          newMessages[loadingMessageIndex] = { ...message, id: generateUniqueId(), timestamp: new Date() }
        } else {
          newMessages.push({ ...message, id: generateUniqueId(), timestamp: new Date() })
        }
        return newMessages
      })
    },
    [setMessages],
  )

  // 🪝 [REFACTOR] Most of this logic now lives in useGeneration. This component only needs to handle the display part.
  const displaySuggestionSequentially = useCallback(
    async (suggestion: any) => {
      if (!suggestion || !suggestion.outfit_suggestion) {
        addMessage({
          type: "text",
          role: "ai",
          content: "I couldn't come up with a specific outfit suggestion, but I'll generate an image based on the overall style idea!",
        })
        return
      }

      const welcomeContent = "✨ I've analyzed your style! Here's a personalized outfit idea for you. I'm creating a visual preview now!"
      replaceLastLoadingMessage({
        role: "ai",
        type: "text",
        content: welcomeContent,
      })

      await new Promise((resolve) => setTimeout(resolve, 800))

      const outfit = suggestion.outfit_suggestion

      // Helper function to format the structured item data into markdown
      const formatItems = (items: any) => {
        if (!items) return ""
        const sections: string[] = []

        if (items.tops && items.tops.length > 0) {
          const topItems = items.tops
            .map((item: any) => {
              const details = [item.style_details, item.wearing_details, item.effect_description]
                .filter(Boolean)
                .join("，")
              return `- *${item.item_name}:* ${details}`
            })
            .join("\n")
          sections.push(`**Tops:**\n${topItems}`)
        }

        if (items.bottoms) {
          const details = [
            items.bottoms.style_details,
            items.bottoms.wearing_details,
            items.bottoms.effect_description,
          ]
            .filter(Boolean)
            .join("，")
          sections.push(`**Bottoms:**\n- *${items.bottoms.item_name}:* ${details}`)
        }

        if (items.shoes) {
          const details = [
            items.shoes.style_details,
            items.shoes.wearing_details,
            items.shoes.effect_description,
          ]
            .filter(Boolean)
            .join("，")
          sections.push(`**Shoes:**\n- *${items.shoes.item_name}:* ${details}`)
        }

        if (items.bag) {
          const details = [
            items.bag.style_details,
            items.bag.wearing_details,
            items.bag.effect_description,
          ]
            .filter(Boolean)
            .join("，")
          sections.push(`**Bag:**\n- *${items.bag.item_name}:* ${details}`)
        }

        if (items.accessories && items.accessories.length > 0) {
          const accessoryItems = items.accessories
            .map((item: any) => {
              const details = [item.style_details, item.wearing_details, item.effect_description]
                .filter(Boolean)
                .join("，")
              return `- *${item.item_name}:* ${details}`
            })
            .join("\n")
          sections.push(`**Accessories:**\n${accessoryItems}`)
        }

        if (items.hairstyle) {
          sections.push(`**Hairstyle:**\n- *${items.hairstyle.style_name}:* ${items.hairstyle.description}`)
        }

        if (items.layering_description) {
          sections.push(`**Layering:**\n${items.layering_description}`)
        }

        return sections.join("\n\n")
      }

      const formattedItems = formatItems(outfit.items)
      const messageContent = `### ${outfit.outfit_title}\n\n${outfit.style_summary}\n\n---\n\n${formattedItems}`

      addMessage({
        type: "text",
        role: "ai",
        content: messageContent,
        metadata: { waitingForImage: true },
      })

      addMessage({
        type: "loading" as const,
        role: "ai" as const,
        loadingText: `Creating visual preview...`,
        metadata: { isImagePlaceholder: true },
      })

      setCurrentStep("generating")
    },
    [addMessage, replaceLastLoadingMessage, setCurrentStep],
  )

  const displayImageResults = useCallback(
    async (imageUrls: string[]) => {
      if (!imageUrls || imageUrls.length === 0) {
        console.warn("[displayImageResults] No image URLs to display.")
        return
      }

      setMessages((prevMessages) => {
        // Remove all loading placeholders
        const messagesWithoutPlaceholders = prevMessages.filter(
          (msg) => !(msg.type === "loading" && msg.metadata?.isImagePlaceholder),
        )

        // Add the new image messages
        const imageMessages: ChatMessage[] = imageUrls.map((url, i) => ({
          id: generateUniqueId(),
          type: "image",
          role: "ai",
          imageUrl: url,
          content: imageUrls.length === 1 ? "Your personalized style preview" : `Visual preview ${i + 1}`,
          timestamp: new Date(),
          metadata: { isOutfitPreview: true },
        }))

        return [...messagesWithoutPlaceholders, ...imageMessages]
      })
    },
    [setMessages],
  )

  // 🪝 [REFACTOR] All generation logic is now in the useGeneration hook.
  const { isGenerating, jobId, generationStatusText, pollingError, startGeneration } = useGeneration({
    chatData,
    addMessage,
    replaceLastLoadingMessage,
    displaySuggestionSequentially,
    displayImageResults,
    setCurrentStep,
  })

  // Define finalPrompt based on chatData
  const finalPrompt = chatData?.customPrompt || "No custom prompt provided"

  // This orchestration layer remains in the main component
  const handleSendMessage = async (message: string) => {
    if (message.trim() === "" && !stagedImage) return

    // Check for generation-related quick replies
    if (message === "不喜欢这套搭配") {
      addMessage({ type: "text", role: "user", content: message })
      return
    }
    if (message === "继续生成最终效果") {
      addMessage({ type: "text", role: "user", content: message })
      addMessage({
        type: "text",
        role: "ai",
        content: "OK! I'll continue to generate the final try-on effect for you, please wait...",
        agentInfo: { id: "style", name: "Styling Assistant", emoji: "👗" },
      })
      return
    }
    if (message === "重新生成场景" || message === "换个风格试试") {
      addMessage({ type: "text", role: "user", content: message })
      addMessage({
        type: "text",
        role: "ai",
        content:
          "OK! I've stopped the current generation. You can return to the homepage to re-upload your photos, or tell me what style you want.",
        agentInfo: { id: "style", name: "Styling Assistant", emoji: "👗" },
        metadata: { suggestions: ["返回首页重新开始"] },
      })
      return
    }

    // Default to free chat
    await sendChatMessage(message)
  }

  const handleImageClick = useCallback((imageUrl: string) => {
    setModalImage(imageUrl)
    setIsModalOpen(true)
  }, [])

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setModalImage(null)
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // This effect now handles all client-side initialization
  useEffect(() => {
    if (isInitialized) {
      return
    }

    // The rest of the initialization logic remains the same...
    try {
      const storedData = sessionStorage.getItem("chatModeData")
      const storedDataForLog = storedData ? JSON.parse(storedData) : null
      if (storedDataForLog?.userProfile?.fullBodyPhoto) {
        storedDataForLog.userProfile.fullBodyPhoto = "***"
      }
      console.log("[CHAT DEBUG] Raw sessionStorage data:", storedDataForLog)

      if (storedData) {
        const parsedData = JSON.parse(storedData)
        setChatData(parsedData)

        const initialMessages: ChatMessage[] = []
        let idCounter = 0
        const createMessage = (message: Omit<ChatMessage, "id" | "timestamp">): ChatMessage => ({
          ...message,
          id: `msg-${Date.now()}-${++idCounter}`,
          timestamp: new Date(),
        })
        initialMessages.push(
          createMessage({
            type: "text",
            role: "ai",
            content: `👋 Hello! I'm your professional AI styling consultant!

💬 **You can:**
• Say "Help me try on" or "Generate styling effect" to start image generation
• Ask me any styling-related questions
• Discuss color matching, style analysis, and other topics

🎨 **Smart Generation**: When you mention try-on, styling, generation, and other keywords, I'll automatically create exclusive styling effect images for you!

What would you like to know about?`,
            metadata: {
              suggestions: [
                "Help me try on this outfit",
                "Analyze my styling style",
                "Recommend styling suggestions",
                "Color matching tips",
              ],
            },
          }),
        )
        setMessages(initialMessages)
      } else {
        const defaultMessage: ChatMessage = {
          id: `msg-${Date.now()}-1`,
          type: "text",
          role: "ai",
          content: `👋 Hello! I'm your professional AI styling consultant!

💬 **I can help you with:**
• Analyzing styling and color matching
• Providing outfit advice for different occasions
• Answering fashion styling questions
• Recommending fashion items and styling tips

🎨 **Want to generate styling effect images?**
Please first return to the homepage to upload your photos and clothing you want to try on, then come back and tell me "Help me try on"!

Let's start chatting about styling now~`,
          timestamp: new Date(),
          metadata: {
            suggestions: [
              "Return to homepage to upload photos",
              "Styling analysis",
              "Color matching principles",
              "Occasion outfit advice",
            ],
          },
        }
        setMessages([defaultMessage])
      }
    } catch (error) {
      console.error("[CHAT DEBUG] Error reading chat data:", error)
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}-1`,
        type: "text",
        role: "ai",
        content: "Hello! I'm your personal AI stylist ✨\n\nFeel free to ask me anything about fashion and styling!",
        timestamp: new Date(),
      }
      setMessages([errorMessage])
    }

    setIsInitialized(true)
  }, [isInitialized, setMessages]) // setMessages is from useChat

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF6EC7]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50 pb-20">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-gray-200">
        <div className="flex items-center justify-between px-4 py-3">
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="p-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-playfair text-lg font-bold text-gray-800">AI Stylist</h1>
          <div className="w-9" />
        </div>
      </header>

      <StatusIndicator
        isGenerating={isGenerating}
        isLoading={isLoading}
        isImageProcessing={isImageProcessing}
        generationStatusText={generationStatusText}
      />

      <div className="flex-1 px-4 py-6 space-y-4">
        <div className="max-w-2xl mx-auto">
          {messages.map((message) => (
            <ChatBubble
              key={message.id}
              message={message}
              onImageClick={handleImageClick}
              sessionId={sessionId}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>

        <ChatInput
          stagedImage={stagedImage}
          isImageProcessing={isImageProcessing}
          handleSendMessage={handleSendMessage}
          handleImageSelect={handleImageSelect}
          clearStagedImage={clearStagedImage}
          handleImageUploadClick={handleImageUploadClick}
        />

        <DebugPanel
          sessionId={sessionId}
          isLoading={isLoading}
          isGenerating={isGenerating}
          currentStep={currentStep}
          hasAutoStarted={hasAutoStarted}
          jobId={jobId} // Pass jobId to show polling status
          chatData={chatData}
          messagesLength={messages.length}
          pollingError={pollingError}
          finalPrompt={finalPrompt}
        />

        {!isGenerating && currentStep === "suggestion" && chatData && !hasAutoStarted && (
          <div className="max-w-2xl mx-auto mt-8">
            <div className="bg-white/80 rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-sm text-gray-600 mb-4 text-center">Ready to generate your personalized style?</p>
              <Button
                onClick={() => {
                  startGeneration()
                  setHasAutoStarted(true)
                }}
                className="w-full bg-[#FF6EC7] hover:bg-[#FF6EC7]/90"
              >
                Generate My Style
              </Button>
            </div>
          </div>
        )}

        {!chatData && messages.length >= 1 && (
          <div className="max-w-2xl mx-auto mt-8">
            <div className="bg-white/80 rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-sm text-gray-600 mb-4 text-center">
                Want to generate styling effects? Upload your photos first!
              </p>
              <Button onClick={() => router.push("/")} variant="outline" className="w-full">
                <Upload className="w-4 h-4 mr-2" />
                Go to Homepage
              </Button>
            </div>
          </div>
        )}
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
