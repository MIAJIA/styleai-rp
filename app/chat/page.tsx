"use client"

import React from "react"


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
import type { ChatMessage, ChatModeData, ChatStep, QuickReplyAction } from "./types"
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
      // Support backward compatibility: use explanation if available, fallback to style_summary for old data
      const outfitDescription = outfit.explanation || outfit.style_summary || "A stylish outfit designed for you."

      // 🔍 NEW: Only show main description first, with option to expand details
      const messageContent = `### ${outfit.outfit_title}\n\n${outfitDescription}`

      addMessage({
        type: "text",
        role: "ai",
        content: messageContent,
        metadata: {
          waitingForImage: true,
          outfitDetails: formattedItems, // Store details for later expansion
          isCollapsed: true,
        },
      })

      // Add quick reply button to show details
      if (formattedItems && formattedItems.trim()) {
        addMessage({
          type: "quick-reply",
          role: "ai",
          content: "", // No additional content needed
          actions: [
            {
              id: `show-details-${Date.now()}`,
              label: "👗 Show Outfit Details",
              type: "show-details",
            },
          ],
        })
      }

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

      console.log(`[displayImageResults] 📸 Displaying ${imageUrls.length} image(s):`, imageUrls.map(url => url.substring(0, 100) + '...'));

      setMessages((prevMessages) => {
        // Remove all loading placeholders
        const messagesWithoutPlaceholders = prevMessages.filter(
          (msg) => !(msg.type === "loading" && msg.metadata?.isImagePlaceholder),
        )

        // 🔍 FIX: 优化图片消息创建，确保立即显示
        const imageMessages: ChatMessage[] = imageUrls.map((url, i) => ({
          id: generateUniqueId(),
          type: "image",
          role: "ai",
          imageUrl: url,
          content: imageUrls.length === 1 ? "Your personalized style preview" : `Visual preview ${i + 1}`,
          timestamp: new Date(),
          metadata: { isOutfitPreview: true },
        }))

        const newMessages = [...messagesWithoutPlaceholders, ...imageMessages];
        console.log(`[displayImageResults] 📸 Added ${imageMessages.length} image messages, total messages: ${newMessages.length}`);

        return newMessages;
      })

      // 🔍 FIX: 确保图片预加载，减少显示延迟
      try {
        const imagePromises = imageUrls.map(url => {
          return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
              console.log(`[displayImageResults] 📸 Image preloaded: ${url.substring(0, 100)}...`);
              resolve(url);
            };
            img.onerror = () => {
              console.warn(`[displayImageResults] ⚠️ Failed to preload image: ${url.substring(0, 100)}...`);
              resolve(url); // 即使失败也继续，不阻塞显示
            };
            img.src = url;
          });
        });

        // 不等待所有图片加载完成，只是启动预加载过程
        Promise.all(imagePromises).then(() => {
          console.log(`[displayImageResults] 📸 All images preloaded successfully`);
        }).catch(err => {
          console.warn(`[displayImageResults] ⚠️ Some images failed to preload:`, err);
        });
      } catch (error) {
        console.warn(`[displayImageResults] ⚠️ Image preloading error:`, error);
      }
    },
    [setMessages],
  )

  // 🪝 [REFACTOR] All generation logic is now in the useGeneration hook.
  const {
    isGenerating,
    jobId,
    pollingError,
    startGeneration,
    restartGeneration,
    // --- New props from the refactored hook ---
    status: jobStatus,
    suggestions,
    currentSuggestionIndex,
    selectSuggestion
  } = useGeneration({
    chatData,
    addMessage,
    replaceLastLoadingMessage,
    displaySuggestionSequentially,
    displayImageResults,
    setCurrentStep,
    setMessages
  })

  // Define finalPrompt based on chatData
  const finalPrompt = chatData?.customPrompt || "No custom prompt provided"

  const handleQuickReplyAction = useCallback(
    (action: QuickReplyAction) => {
      if (action.type === "start-generation" || action.type === "retry-start-generation") {
        console.log("[ChatPage] User clicked 'Start Generation' quick reply.")

        // Replace the quick reply with a user message for context
        setMessages(prev => {
          const newMessages = [...prev]
          const qrIndex = newMessages.findIndex(m => m.actions?.some(a => a.id === action.id))
          if (qrIndex !== -1) {
            newMessages[qrIndex] = {
              id: newMessages[qrIndex].id,
              role: "user",
              type: "text",
              content: action.label,
              timestamp: new Date(),
            }
          }
          return newMessages
        })

        if (startGeneration) {
          // Clear any existing error messages and start fresh
          setMessages(prev => prev.filter(m => 
            !m.content?.includes("Opps... something went wrong") && 
            !m.content?.includes("Polling failed")
          ))
          
          if (action.type === "start-generation") {
            // Delay startGeneration slightly to allow state to update
            setTimeout(() => startGeneration(), 50)
          } else if (action.type === "retry-start-generation") {
            restartGeneration()
          }
        }
      } else if (action.type === "show-details") {
        console.log("[ChatPage] User clicked 'Show Details' quick reply.")

        // Find the message with outfit details
        setMessages(prev => {
          const newMessages = [...prev]

          // Replace the quick reply with a user message
          const qrIndex = newMessages.findIndex(m => m.actions?.some(a => a.id === action.id))
          if (qrIndex !== -1) {
            newMessages[qrIndex] = {
              id: newMessages[qrIndex].id,
              role: "user",
              type: "text",
              content: action.label,
              timestamp: new Date(),
            }
          }

          // Find the message with outfitDetails and display them
          const detailsMessageIndex = newMessages.findIndex(m =>
            m.metadata?.outfitDetails && m.metadata?.isCollapsed
          )

          if (detailsMessageIndex !== -1 && newMessages[detailsMessageIndex].metadata?.outfitDetails) {
            const outfitDetails = newMessages[detailsMessageIndex].metadata.outfitDetails

            // Add the detailed information as a new AI message
            const detailsMessage = {
              id: `details-${Date.now()}`,
              role: "ai" as const,
              type: "text" as const,
              content: `**Outfit Details:**\n\n${outfitDetails}`,
              timestamp: new Date(),
            }
            newMessages.push(detailsMessage)

            // Update the original message to mark it as expanded
            newMessages[detailsMessageIndex] = {
              ...newMessages[detailsMessageIndex],
              metadata: {
                ...newMessages[detailsMessageIndex].metadata,
                isCollapsed: false,
              }
            }
          }

          return newMessages
        })
      }
    },
    [setMessages, startGeneration, restartGeneration],
  )

  // This orchestration layer remains in the main component
  const handleSendMessage = async (message: string) => {
    if (message.trim() === "" && !stagedImage) return

    // Check for generation-related quick replies
    if (message.startsWith("Show me option")) {
      const index = parseInt(message.split(" ")[3], 10) - 1;
      if (!isNaN(index) && selectSuggestion) {
        console.log(`[ChatPage] User clicked quick reply to see option ${index + 1}`);
        selectSuggestion(index);
      }
      return;
    }

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

    await sendChatMessage(message)
  }

  const handleOpenModal = (imageUrl: string) => {
    setModalImage(imageUrl)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setModalImage(null)
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  // Effect to scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Effect for initializing chat data from sessionStorage
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
        const createMessage = (message: Omit<ChatMessage, "id" | "timestamp">): ChatMessage => ({
          ...message,
          id: generateUniqueId(),
          timestamp: new Date(),
        })

        const initialMessages: ChatMessage[] = [
          createMessage({
            type: "quick-reply",
            role: "ai",
            content: "Welcome! I see you've provided your images and occasion. Ready to see your personalized style?",
            actions: [
              {
                id: "start-generation-btn",
                label: "Start Generation",
                type: "start-generation",
              },
            ],
          }),
        ]

        if (data.generationMode === "guided") {
          // In guided mode, we don't start automatically
        }

        setMessages(initialMessages)
      } catch (error) {
        console.error("[ChatPage | useEffect] 💥 Failed to parse chatData from sessionStorage:", error)
        // Handle error, maybe redirect or show a message
      }
    } else {
      console.warn("[ChatPage | useEffect] No chatModeData found in sessionStorage. Redirecting to home.")
      router.push("/") // Redirect if no data
    }
    setIsInitialized(true)
  }, [router, setMessages]) // removed dependency on addMessage

  // LOGGING EFFECT: Log props from useGeneration whenever they change
  useEffect(() => {
    console.log('[ChatPage | LOG] 🩺 Generation State Update:', {
      isGenerating,
      jobId,
      jobStatus,
      pollingError,
      suggestionsCount: suggestions.length,
      currentSuggestionIndex,
    })
  }, [isGenerating, jobId, jobStatus, pollingError, suggestions, currentSuggestionIndex])

  if (!isInitialized) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        <p className="mt-2 text-gray-500">Initializing Chat...</p>
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
        generationStatusText={jobStatus || "Designing... This may take 1 minutes. "}
      />

      <div className="flex-1 px-4 py-6 space-y-4">
        <div className="max-w-2xl mx-auto">
          {messages.map((message) => (
            <ChatBubble
              key={message.id}
              message={message}
              onImageClick={handleOpenModal}
              onQuickReplyAction={handleQuickReplyAction}
              sessionId={sessionId}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* ============== [NEW] Multi-Suggestion UI ============== */}
        {suggestions &&
          suggestions.length > 0 &&
          (chatData?.generationMode === 'simple-scene') && (
            <div className="p-4 border-t bg-gray-50">
              <h3 className="text-sm font-semibold mb-2 text-center text-gray-600">Style Options</h3>
              <div className="flex justify-center items-center space-x-2">
                {suggestions.map((suggestion, index) => {
                  const buttonLabels = ["Classic", "Trendy", "Edge"];
                  return (
                    <Button
                      key={suggestion.index}
                      variant={index === currentSuggestionIndex ? "default" : "outline"}
                      size="sm"
                      onClick={() => selectSuggestion && selectSuggestion(index)}
                      disabled={suggestion.status === 'generating_images' || suggestion.status === 'failed'}
                    >
                      {suggestion.status === 'generating_images' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <span>{buttonLabels[index] || `Option ${index + 1}`}</span>
                    </Button>
                  );
                })}
              </div>
              <div className="mt-2 text-center text-xs text-gray-500">
                {suggestions[currentSuggestionIndex] && `Status: ${suggestions[currentSuggestionIndex].status}`}
              </div>
            </div>
          )}
        {/* ====================================================== */}

        <div className="p-4 border-t">
          <ChatInput
            stagedImage={stagedImage}
            isImageProcessing={isImageProcessing}
            handleSendMessage={handleSendMessage}
            handleImageSelect={handleImageSelect}
            clearStagedImage={clearStagedImage}
            handleImageUploadClick={handleImageUploadClick}
          />
          <input type="file" id="image-upload" className="hidden" onChange={handleImageSelect} accept="image/*" />
        </div>

        <DebugPanel
          sessionId={sessionId || "none"}
          isLoading={isLoading}
          isGenerating={isGenerating}
          currentStep={currentStep}
          hasAutoStarted={hasAutoStarted}
          jobId={jobId}
          chatData={chatData}
          messagesLength={messages.length}
          pollingError={pollingError}
          finalPrompt={finalPrompt}
        />

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
