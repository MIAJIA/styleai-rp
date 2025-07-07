"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import IOSTabBar from "../components/ios-tab-bar"
import ImageModal from "../components/image-modal"
import ImageVoteButtons from "@/components/image-vote-buttons"
import { ProductGrid, parseProductsFromText, type ProductInfo } from "../components/product-card"
import { loadCompleteOnboardingData } from "@/lib/onboarding-storage"
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Send,
  Upload,
  ImageIcon,
  User,
} from "lucide-react"
import ReactMarkdown from "react-markdown"

// Import types and constants from separate files
import type { ChatMessage, ChatModeData, ChatStep } from "./types"
import { styles, stylePrompts } from "./constants"

// ============================================================================
// 🔧 REFACTOR PLAN - Chat页面重构计划标记 (当前1912行 → 目标<600行)
// ============================================================================
//
// 📋 Phase 1: 基础重构 (不破坏现有功能)
// ✅ Step 1: 拆出类型定义 → app/chat/types.ts (约50行) - 已完成
// ✅ Step 2: 拆出常量配置 → app/chat/constants.ts (约80行) - 已完成
// Step 3: 拆出工具函数 → app/chat/utils.ts (约100行)
//   ✅ 位置: 下方 - createChatMessage, generateUniqueId, getOccasionName 等
//
// 📦 Phase 2: 组件拆分 (约350行)
// Step 4: 拆出UI组件 → app/chat/components/
//   ✅ QuickReplyButtons.tsx, AIAvatar.tsx, ChatBubble.tsx 等
//
// 🪝 Phase 3: Hooks抽取 (约600行)
// Step 5: 拆出自定义Hooks → app/chat/hooks/
//   ✅ useSessionManagement, useImageHandling, usePolling, useGeneration, useChat
//
// 🏗️ Phase 4: 主组件精简 (约200-300行)
// Step 6: 精简主组件 → page.tsx
//   ✅ 保留: 页面布局、路由逻辑、组件组合
//   ✅ 移除: 所有业务逻辑到hooks，所有UI细节到components
//
// ============================================================================

// Component to render quick reply buttons
// 🧩 [REFACTOR] Step 4: 将此组件移动到 app/chat/components/QuickReplyButtons.tsx
function QuickReplyButtons({
  suggestions,
  onSelect,
}: {
  suggestions: string[]
  onSelect: (suggestion: string) => void
}) {
  if (!suggestions || suggestions.length === 0) {
    return null
  }

  return (
    <div className="max-w-2xl mx-auto mt-2 mb-4 px-4">
      <div className="flex flex-wrap gap-2">
        {suggestions.map((text, index) => (
          <Button
            key={index}
            variant="outline"
            size="sm"
            className="rounded-full bg-white/80 backdrop-blur-lg"
            onClick={() => onSelect(text)}
          >
            {text}
          </Button>
        ))}
      </div>
    </div>
  )
}


// Helper for creating chat messages
// 🔧 [REFACTOR] Step 3: 将此工具函数移动到 app/chat/utils.ts
const createChatMessage = (
  type: "text" | "image" | "loading" | "generation-request" | "products",
  role: "ai" | "user",
  content?: string,
  imageUrl?: string,
  loadingText?: string,
  metadata?: ChatMessage["metadata"],
  products?: ProductInfo[],
): ChatMessage => ({
  id: `msg-${Date.now()}-${Math.random()}`,
  type,
  role,
  content,
  imageUrl,
  loadingText,
  metadata,
  products,
  timestamp: new Date(),
})

// AI Avatar component
// 🧩 [REFACTOR] Step 4: 将此组件移动到 app/chat/components/AIAvatar.tsx
function AIAvatar() {
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-orange-300 flex items-center justify-center shadow-md flex-shrink-0">
      <Sparkles className="w-5 h-5 text-white" />
    </div>
  )
}

// Enhanced Chat Bubble component with generation support
// 🧩 [REFACTOR] Step 4: 将此组件移动到 app/chat/components/ChatBubble.tsx (约120行)
function ChatBubble({
  message,
  onImageClick,
  sessionId,
}: {
  message: ChatMessage
  onImageClick: (imageUrl: string) => void
  sessionId?: string
}) {
  const isAI = message.role === "ai"
  const isUser = message.role === "user"

  console.log(`[ChatBubble] Rendering message with sessionId: ${sessionId}, hasImage: ${!!message.imageUrl}`);

  // Debug logging for product messages
  if (message.type === "products" || (message.products && message.products.length > 0)) {
    console.log("[ChatBubble] Rendering message with products:", {
      messageId: message.id,
      messageType: message.type,
      hasProducts: !!message.products,
      productCount: message.products?.length || 0,
      products: message.products?.map(p => ({ id: p.id, name: p.name.substring(0, 20) + '...' })) || []
    });
  }

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div className={`flex ${isUser ? "flex-row-reverse" : "flex-row"} items-start max-w-[80%]`}>
        {/* AI Avatar */}
        {isAI && (
          <div className="flex-shrink-0 mr-2">
            <AIAvatar />
            {message.agentInfo && (
              <div className="text-xs text-gray-500 mt-1 text-center">
                <span>{message.agentInfo.emoji}</span>
                <span className="ml-1">{message.agentInfo.name}</span>
              </div>
            )}
          </div>
        )}
        <div
          className={`
            px-4 py-3 rounded-2xl max-w-[80%] flex flex-col
            ${isAI ? "bg-white shadow-sm border border-gray-100" : "bg-[#FF6EC7] text-white"}
          `}
        >
          {isAI && message.agentInfo && (
            <div className="text-xs text-gray-500 mb-1 font-semibold">{message.agentInfo.name}</div>
          )}

          {/* Render text content if it exists */}
          {message.content && (
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )}

          {/* Render image if it exists, with a margin if text is also present */}
          {message.imageUrl && (
            <div className={message.content ? "mt-2" : ""}>
              <div className="relative group">
                <img
                  src={message.imageUrl || "/placeholder.svg"}
                  alt={isAI ? "Generated image" : "Uploaded image"}
                  width={300}
                  height={400}
                  className="rounded-lg cursor-pointer"
                  onClick={() => message.imageUrl && onImageClick(message.imageUrl)}
                />

                {/* Vote buttons overlay - only show for AI generated images */}
                {isAI && message.imageUrl && (
                  <div className="absolute top-2 right-2">
                    <ImageVoteButtons
                      imageUrl={message.imageUrl}
                      sessionId={sessionId}
                      size="sm"
                      variant="overlay"
                      className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                      onVoteChange={(voteType) => {
                        console.log(`[ChatBubble] Image vote changed: ${voteType} for ${message.imageUrl?.substring(0, 50)}...`);
                        console.log(`[ChatBubble] SessionId used: ${sessionId}`);
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Render products if they exist */}
          {message.products && message.products.length > 0 && (
            <div className={message.content ? "mt-3" : ""}>
              <ProductGrid products={message.products} />
            </div>
          )}

          {message.type === "loading" && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-150"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-300"></div>
              {message.loadingText && <span className="text-sm text-gray-600">{message.loadingText}</span>}
            </div>
          )}

          {message.type === "generation-request" && (
            <div className="space-y-2">
              <p className="text-sm leading-relaxed">{message.content}</p>
              {message.metadata?.generationData && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {message.metadata.generationData.selfiePreview && (
                    <img
                      src={message.metadata.generationData.selfiePreview || "/placeholder.svg"}
                      alt="Selfie"
                      className="w-full h-20 object-cover rounded-lg"
                    />
                  )}
                  {message.metadata.generationData.clothingPreview && (
                    <img
                      src={message.metadata.generationData.clothingPreview || "/placeholder.svg"}
                      alt="Clothing"
                      className="w-full h-20 object-cover rounded-lg"
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// 🏗️ [REFACTOR] Step 6: 主页面组件 - 精简为约200-300行
// 保留: 页面布局、路由逻辑、组件组合
// 移除: 所有业务逻辑到hooks，所有UI细节到components
export default function ChatPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [stagedImage, setStagedImage] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState<boolean>(false)
  const [currentStep, setCurrentStep] = useState<ChatStep>("suggestion")
  const [messageIdCounter, setMessageIdCounter] = useState(0)
  const [chatData, setChatData] = useState<ChatModeData | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [hasProcessedCompletion, setHasProcessedCompletion] = useState(false)
  const processedStatusesRef = useRef<Set<string>>(new Set())
  const [pollingIntervalId, setPollingIntervalId] = useState<NodeJS.Timeout | null>(null)
  const [isDisplayingSuggestion, setIsDisplayingSuggestion] = useState(false)
  const [intermediateImageDisplayed, setIntermediateImageDisplayed] = useState(false)
  const [isShowingWaitingTips, setIsShowingWaitingTips] = useState(false)
  const isShowingWaitingTipsRef = useRef(false)

  const [jobId, setJobId] = useState<string | null>(null)
  const [pollingError, setPollingError] = useState<string | null>(null)

  const [modalImage, setModalImage] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Debug panel state - collapsed by default
  const [isDebugExpanded, setIsDebugExpanded] = useState(false)

  // Track if auto-generation has been triggered to prevent multiple calls
  const [hasAutoStarted, setHasAutoStarted] = useState(false)

  const [generationStatusText, setGenerationStatusText] = useState<string | null>(null);

  const hasDisplayedIntermediateImages = useRef(false);

  // Re-enable state variables that are still in use by other parts of the component
  const [userInput, setUserInput] = useState("")
  const [sessionId, setSessionId] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)

  const [isImageProcessing, setIsImageProcessing] = useState(false)

  const [displayedIntermediateImages, setDisplayedIntermediateImages] = useState(false);
  const isGeneratingRef = useRef(false)
  const pollingIntervalIdRef = useRef<NodeJS.Timeout | null>(null)
  const hasProcessedCompletionRef = useRef(false)

  // Define finalPrompt based on chatData
  const finalPrompt = chatData?.customPrompt || "No custom prompt provided";

  // Log the finalPrompt to verify its content and length
  console.log('[DEBUG] Final Prompt:', finalPrompt, 'Length:', finalPrompt.length);

  // Handle cancellation of generation
  const handleCancelGeneration = async () => {
    console.log(`[CANCEL DEBUG] 🚀 handleCancelGeneration called`);
    console.log(`[CANCEL DEBUG] - Current jobId: ${jobId}`);
    console.log(`[CANCEL DEBUG] - Current isGenerating: ${isGenerating}`);
    console.log(`[CANCEL DEBUG] - Current currentStep: ${currentStep}`);

    if (!jobId) {
      console.warn('[CANCEL] No jobId available for cancellation');
      return;
    }

    try {
      console.log(`[CANCEL] Attempting to cancel job: ${jobId}`);

      const response = await fetch('/api/generation/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobId }),
      });

      console.log(`[CANCEL DEBUG] Cancel API response status: ${response.status}`);

      if (!response.ok) {
        const errorData = await response.json();
        console.error(`[CANCEL DEBUG] Cancel API error:`, errorData);
        throw new Error(errorData.error || 'Failed to cancel job');
      }

      const result = await response.json();
      console.log(`[CANCEL] Job cancelled successfully:`, result);

      // Update UI to reflect cancellation
      setIsGenerating(false);
      setGenerationStatusText(null);
      setCurrentStep("complete");

      console.log(`[CANCEL DEBUG] UI state updated after cancellation`);

      // Add a message to inform user about cancellation
      addMessage({
        type: "text",
        role: "ai",
        content: "OK! I've stopped the current generation. If you want to try other styles, just let me know!",
        agentInfo: {
          id: "style",
          name: "Styling Assistant",
          emoji: "👗",
        },
        metadata: {
          suggestions: [
            "重新生成搭配",
            "尝试不同风格",
            "换个场合搭配",
            "给我其他建议"
          ],
        },
      });

      console.log(`[CANCEL DEBUG] Cancellation message added`);

      // Clear any polling intervals
      if (pollingIntervalId) {
        console.log(`[CANCEL DEBUG] Clearing polling interval`);
        clearInterval(pollingIntervalId);
        setPollingIntervalId(null);
      }

    } catch (error) {
      console.error('[CANCEL] Error cancelling job:', error);
      addMessage({
        type: "text",
        role: "ai",
        content: `取消生成时出现错误: ${error instanceof Error ? error.message : '未知错误'}`,
      });
    }
  };

  // --- START: Image Handling Functions ---
  // 🪝 [REFACTOR] Step 5: 将以下图片处理逻辑移动到 app/chat/hooks/useImageHandling.ts
  const handleImageUploadClick = () => {
    imageInputRef.current?.click()
  }

  const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    console.log(`[ChatPage] Image selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`)

    // File type check
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file")
      return
    }

    // File size warning
    if (file.size > 50 * 1024 * 1024) {
      // >50MB
      alert("Image too large (>50MB), please select a smaller image")
      return
    }

    setIsImageProcessing(true)

    try {
      // Choose compression strategy based on file size
      let compressionResult
      if (file.size > 10 * 1024 * 1024) {
        // >10MB
        console.log("[ChatPage] Using aggressive compression for large file")
        compressionResult = await import("@/lib/image-compression").then((m) => m.compressForChat(file))
      } else if (file.size > 5 * 1024 * 1024) {
        // >5MB
        console.log("[ChatPage] Using standard compression for medium file")
        compressionResult = await import("@/lib/image-compression").then((m) => m.compressForChat(file))
      } else {
        console.log("[ChatPage] Using standard compression for small file")
        compressionResult = await import("@/lib/image-compression").then((m) => m.compressForChat(file))
      }

      console.log(
        `[ChatPage] Image compression complete: ${(file.size / 1024).toFixed(1)}KB → ${(compressionResult.compressedSize / 1024).toFixed(1)}KB (reduced ${(compressionResult.compressionRatio * 100).toFixed(1)}%)`,
      )

      setStagedImage(compressionResult.dataUrl)

      // Show compression result to user
      if (compressionResult.compressionRatio > 0.5) {
        console.log(
          `[ChatPage] Image optimized: size reduced ${(compressionResult.compressionRatio * 100).toFixed(1)}%, improved transmission speed`,
        )
      }
    } catch (error) {
      console.error("[ChatPage] Image compression failed:", error)

      // Fallback: for small images, still allow using original
      if (file.size < 5 * 1024 * 1024) {
        // <5MB
        console.log("[ChatPage] Compression failed, using original image")
        const reader = new FileReader()
        reader.onloadend = () => {
          const result = reader.result as string
          console.log("[ChatPage] Original image Data URL length:", result.length)
          setStagedImage(result)
        }
        reader.readAsDataURL(file)
      } else {
        alert("Image processing failed, please try again or select a smaller image")
      }
    } finally {
      setIsImageProcessing(false)
    }

    // Reset file input to allow selecting the same file again
    event.target.value = ""
  }

  const clearStagedImage = () => {
    setStagedImage(null)
  }
  // --- END: Image Handling Functions ---

  const handleImageClick = (imageUrl: string) => {
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

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // This effect now handles all client-side initialization
  useEffect(() => {
    if (isInitialized) {
      return
    }

    // 1. Ensure a session ID exists on the client
    let currentSessionId = localStorage.getItem("chat_session_id")
    if (!currentSessionId) {
      currentSessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      localStorage.setItem("chat_session_id", currentSessionId)
    }

    // Set the sessionId state
    setSessionId(currentSessionId)
    console.log("[ChatPage] Session ID initialized:", currentSessionId)

    // The rest of the initialization logic remains the same...
    try {
      const storedData = sessionStorage.getItem("chatModeData")
      console.log("[CHAT DEBUG] Raw sessionStorage data:", storedData)

      if (storedData) {
        const parsedData = JSON.parse(storedData)
        console.log("[CHAT DEBUG] Parsed chat data:", parsedData)
        console.log("[CHAT DEBUG] Parsed customPrompt:", parsedData.customPrompt)
        setChatData(parsedData)

        // Initialize with unified welcome message
        const initialMessages: ChatMessage[] = []
        let idCounter = 0

        const createMessage = (message: Omit<ChatMessage, "id" | "timestamp">): ChatMessage => ({
          ...message,
          id: `msg-${Date.now()}-${++idCounter}`,
          timestamp: new Date(),
        })

        // Welcome message for unified mode
        initialMessages.push(
          createMessage({
            type: "text",
            role: "ai",
            content: `👋 Hello! I'm your professional AI styling consultant!

I see you've already prepared your photos and clothing, that's great!

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
        setMessageIdCounter(idCounter)
      } else {
        console.log("[CHAT DEBUG] No sessionStorage data found, showing default message")
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
        setMessageIdCounter(1)
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
      setMessageIdCounter(1)
    }

    setIsInitialized(true)
  }, [isInitialized]) // Dependency array ensures it runs once

  // 🔧 [REFACTOR] Step 3: 将以下工具函数移动到 app/chat/utils.ts
  const generateUniqueId = () => {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  const addMessage = (message: Omit<ChatMessage, "id" | "timestamp">) => {
    setMessages((prev) => [...prev, { ...message, id: generateUniqueId(), timestamp: new Date() }])
  }

  // 1. Re-create the missing helper function
  const replaceLastLoadingMessage = (message: Omit<ChatMessage, "id" | "timestamp">) => {
    setMessages((prevMessages) => {
      const newMessages = [...prevMessages]
      // Find the last loading message that is NOT an image placeholder
      let loadingMessageIndex = -1;
      for (let i = newMessages.length - 1; i >= 0; i--) {
        if (newMessages[i].type === "loading" && !newMessages[i].metadata?.isImagePlaceholder) {
          loadingMessageIndex = i;
          break;
        }
      }

      console.log(`[REPLACE_LOADING DEBUG] Looking for non-placeholder loading message, found at index: ${loadingMessageIndex}`);

      if (loadingMessageIndex !== -1) {
        // Replace the existing loading message
        console.log(`[REPLACE_LOADING DEBUG] Replacing loading message at index ${loadingMessageIndex}`);
        newMessages[loadingMessageIndex] = {
          ...message,
          id: generateUniqueId(),
          timestamp: new Date(),
        }
      } else {
        // Add new message if no non-placeholder loading message found
        console.log(`[REPLACE_LOADING DEBUG] No non-placeholder loading message found, adding new message`);
        newMessages.push({
          ...message,
          id: generateUniqueId(),
          timestamp: new Date(),
        })
      }

      return newMessages
    })
  }

  // 🪝 [REFACTOR] Step 5: 将以下聊天消息处理逻辑移动到 app/chat/hooks/useChat.ts
  const handleSendMessage = async (message: string) => {
    console.log(`[ChatPage] handleSendMessage called. Message: "${message}", Has Staged Image: ${!!stagedImage}`)
    if (message.trim() === "" && !stagedImage) return

    // Check if this is a cancel request
    if (message === "不喜欢这套搭配") {
      console.log(`[QUICK_REPLY] Cancel request detected: ${message}`);

      // Add user message first
      addMessage({
        type: "text",
        role: "user",
        content: message,
      });

      // Handle cancellation
      await handleCancelGeneration();
      return;
    }

    // Check for other generation-related quick replies
    if (message === "继续生成最终效果") {
      console.log(`[QUICK_REPLY] Continue generation request: ${message}`);

      addMessage({
        type: "text",
        role: "user",
        content: message,
      });

      addMessage({
        type: "text",
        role: "ai",
        content: "OK! I'll continue to generate the final try-on effect for you, please wait...",
        agentInfo: {
          id: "style",
          name: "Styling Assistant",
          emoji: "👗",
        },
      });
      return;
    }

    if (message === "重新生成场景" || message === "换个风格试试") {
      console.log(`[QUICK_REPLY] Regeneration request: ${message}`);

      addMessage({
        type: "text",
        role: "user",
        content: message,
      });

      // Cancel current generation and suggest restart
      if (jobId) {
        await handleCancelGeneration();
      }

      addMessage({
        type: "text",
        role: "ai",
        content: "OK! I've stopped the current generation. You can return to the homepage to re-upload your photos, or tell me what style you want.",
        agentInfo: {
          id: "style",
          name: "Styling Assistant",
          emoji: "👗",
        },
        metadata: {
          suggestions: [
            "返回首页重新开始",
          ],
        },
      });
      return;
    }

    // The backend `ChatAgent` is now responsible for context.
    // The frontend only needs to send the newly uploaded image.
    const imageUrlForThisMessage = stagedImage ?? undefined;

    // Add user message to UI immediately, only showing the explicitly staged image
    addMessage({
      type: "text",
      role: "user",
      content: message,
      imageUrl: imageUrlForThisMessage,
    })

    // Clear the staged image immediately after sending it
    setStagedImage(null)

    // Show loading indicator
    addMessage({
      type: "loading",
      role: "ai",
      loadingText: "Hold on—I'm putting together a killer look just for you!",
    })

    // Pass the user's text and the (optional) new image to the chat handler
    await handleFreeChat(message, imageUrlForThisMessage)
  }

  const handleFreeChat = async (message: string, imageUrl?: string | null) => {
    const sessionId = localStorage.getItem("chat_session_id")
    if (!sessionId) {
      console.error("[ChatPage] Session ID is missing. Aborting API call.")
      // 3. Use the recreated function for error handling
      replaceLastLoadingMessage({
        type: "text",
        role: "ai",
        content: "Sorry, the session has expired. Please refresh the page and try again.",
      })
      return
    }

    const requestBody = { message, sessionId, imageUrl }
    console.log("[ChatPage] Sending request to /api/chat/simple with body:", {
      message: requestBody.message,
      sessionId: requestBody.sessionId,
      imageUrl: requestBody.imageUrl ? `DataURL of length ${requestBody.imageUrl.length}` : "null",
    })

    try {
      const response = await fetch("/api/chat/simple", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody), // Send imageUrl to API
      })

      const data = await response.json()
      console.log("[ChatPage] Received response from API:", data)

      // 🔍 Add detailed agentInfo debug logs
      console.log("🤖 [AGENT DEBUG] API returned agentInfo:", data.agentInfo)
      console.log("🤖 [AGENT DEBUG] agentInfo type:", typeof data.agentInfo)
      console.log("🤖 [AGENT DEBUG] agentInfo content:", JSON.stringify(data.agentInfo, null, 2))

      if (data.agentInfo) {
        console.log("✅ [AGENT DEBUG] agentInfo exists:", {
          id: data.agentInfo.id,
          name: data.agentInfo.name,
          emoji: data.agentInfo.emoji,
        })
      } else {
        console.warn("❌ [AGENT DEBUG] agentInfo does not exist or is empty")
      }

      if (!response.ok) {
        throw new Error(data.error || "API request failed")
      }

      // Ensure response text is a string to prevent errors
      const responseText = data.response || '';

      // Check if the response contains product information
      let products: ProductInfo[] = [];

      // First, try to parse products from the API response if it contains search results
      if (data.searchResults) {
        console.log("[ChatPage] Found searchResults in API response:", data.searchResults);
        products = data.searchResults.items?.map((item: any) => ({
          id: item.id || `product-${Date.now()}`,
          name: item.name || 'Product',
          price: item.price || 'Price not available',
          description: item.description || '',
          link: item.link || '#',
          imageUrl: item.imageUrl || '/placeholder-product.jpg',
          source: item.source // Add the source field
        })) || [];
      }

      // Fallback: try to parse from text response
      if (products.length === 0) {
        products = parseProductsFromText(responseText);
      }

      console.log("[ChatPage] Final parsed products:", products);

      if (products.length > 0) {
        // If products are found, create a message with only products (no text content)
        replaceLastLoadingMessage({
          type: "products",
          role: "ai",
          content: undefined, // Don't show text content when products are present
          products: products,
          agentInfo: data.agentInfo,
          metadata: {
            suggestions: data.quickReplies || [],
          },
        });
      } else {
        // Use the recreated function to display the AI response
        replaceLastLoadingMessage({
          type: "text",
          role: "ai",
          content: responseText,
          agentInfo: data.agentInfo,
          metadata: {
            suggestions: data.quickReplies || [],
          },
        });
      }

      // 🔍 Add debug log after message addition
      console.log("📝 [AGENT DEBUG] Message added, agentInfo should display:", data.agentInfo)
    } catch (error: any) {
      console.error("[ChatPage] Free chat API error:", error)
      replaceLastLoadingMessage({
        type: "text",
        role: "ai",
        content: `Sorry, something went wrong: ${error.message}`,
      })
    }
  }

  const generateSmartSuggestions = (aiResponse: string): string[] => {
    const suggestions: string[] = []

    if (aiResponse.includes("color") || aiResponse.includes("matching")) {
      suggestions.push("Different occasion styling")
    }
    if (aiResponse.includes("occasion") || aiResponse.includes("date") || aiResponse.includes("work")) {
      suggestions.push("Different occasion styling")
    }
    if (aiResponse.includes("style") || aiResponse.includes("style analysis")) {
      suggestions.push("Style analysis")
    }
    if (aiResponse.includes("styling") || aiResponse.includes("styling suggestions")) {
      suggestions.push("Styling suggestions")
    }

    // Add some general suggestions
    suggestions.push("Fashion trends", "Shopping advice")

    return suggestions.slice(0, 4) // Limit to 4 suggestions
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (userInput.trim()) {
        handleSendMessage(userInput)
      }
    }
  }

  const displayWaitingTips = async () => {
    const tips = [
      "💡 Just a sec, I'm brewing up some style magic for you...",
      "🎨 Hold tight, your personalized fashion advice is on the way...",
      "✨ Almost there, just adding the final touches to your look...",
      "🌟 Hang in there, your style transformation is nearly complete...",
    ]

    // Merge tips and generation steps
    const allTips = [
      ...tips,
      "🎯 Analyzing style elements, just like old times...",
      "🔄 Processing image generation, remember that time we tried that crazy hat?",
      "🎨 Applying styling effects, because you deserve the best...",
      "✅ Finalizing your look, can't wait for you to see it!",
    ]

    // Show tips or generation steps
    for (let i = 0; i < allTips.length && isGenerating; i++) {
      await new Promise((resolve) => setTimeout(resolve, 3000))
      if (isGenerating) {
        setMessages((prev) => {
          const newMessages = [...prev]
          const lastMessage = newMessages[newMessages.length - 1]
          if (lastMessage && lastMessage.type === "loading") {
            lastMessage.loadingText = allTips[i]
          }
          return newMessages
        })
      }
    }
  }

  const displaySuggestionSequentially = async (suggestion: any) => {
    const suggestionStartTime = Date.now()
    console.log(`[PERF] 💭 SUGGESTION DISPLAY STARTED at ${new Date().toISOString()}`)
    console.log("[SUGGESTION DEBUG] Received suggestion object:", JSON.stringify(suggestion, null, 2));

    if (!suggestion || !suggestion.outfit_suggestion) {
      console.warn("[SUGGESTION DEBUG] No valid suggestion object or outfit_suggestion found.")
      addMessage({
        type: "text",
        role: "ai",
        content: "I couldn't come up with a specific outfit suggestion this time, but I'll generate an image based on the overall style idea!",
        agentInfo: {
          id: "style",
          name: "Styling Assistant",
          emoji: "👗",
        },
      })
    } else {
      console.log("[SUGGESTION DEBUG] Starting displaySuggestionSequentially with single outfit format")
      setIsDisplayingSuggestion(true)

      const formatItems = (items: any) => {
        if (!items) return "";
        const sections: string[] = [];

        if (items.tops && items.tops.length > 0) {
          const topItems = items.tops.map((item: any) => {
            const details = [item.style_details, item.wearing_details, item.effect_description].filter(Boolean).join('，');
            return `- *${item.item_name}:* ${details}`;
          }).join('\n');
          sections.push(`**Tops:**\n${topItems}`);
        }

        if (items.bottoms) {
          const details = [items.bottoms.style_details, items.bottoms.wearing_details, items.bottoms.effect_description].filter(Boolean).join('，');
          sections.push(`**Bottoms:**\n- *${items.bottoms.item_name}:* ${details}`);
        }

        if (items.shoes) {
          const details = [items.shoes.style_details, items.shoes.wearing_details, items.shoes.effect_description].filter(Boolean).join('，');
          sections.push(`**Shoes:**\n- *${items.shoes.item_name}:* ${details}`);
        }

        if (items.bag) {
          const details = [items.bag.style_details, items.bag.wearing_details, items.bag.effect_description].filter(Boolean).join('，');
          sections.push(`**Bag:**\n- *${items.bag.item_name}:* ${details}`);
        }

        if (items.accessories && items.accessories.length > 0) {
          const accessoryItems = items.accessories.map((item: any) => {
            const details = [item.style_details, item.wearing_details, item.effect_description].filter(Boolean).join('，');
            return `- *${item.item_name}:* ${details}`;
          }).join('\n');
          sections.push(`**Accessories:**\n${accessoryItems}`);
        }

        if (items.hairstyle) {
          sections.push(`**Hairstyle:**\n- *${items.hairstyle.style_name}:* ${items.hairstyle.description}`);
        }

        if (items.layering_description) {
          sections.push(`**Layering:**\n${items.layering_description}`);
        }

        return sections.join('\n\n');
      };

      setMessages((prev) => {
        const newMessages = [...prev]
        const loadingMessageIndex = newMessages.map((m) => m.type).lastIndexOf("loading")

        const welcomeContent =
          "✨ I've analyzed your style! Here's a personalized outfit idea for you. I'm creating a visual preview now!"

        if (loadingMessageIndex !== -1) {
          newMessages[loadingMessageIndex] = {
            id: generateUniqueId(),
            role: "ai",
            type: "text",
            content: welcomeContent,
            timestamp: new Date(),
          }
          return newMessages
        } else {
          return [
            ...newMessages,
            {
              id: generateUniqueId(),
              role: "ai",
              type: "text",
              content: welcomeContent,
              timestamp: new Date(),
            },
          ]
        }
      })

      await new Promise((resolve) => setTimeout(resolve, 800))

      const outfit = suggestion.outfit_suggestion
      const bubbleStartTime = Date.now()
      console.log(`[PERF] 💭 Displaying outfit suggestion: ${outfit.outfit_title}`)

      const formattedItems = formatItems(outfit.items)
      const messageContent = `### ${outfit.outfit_title}\n\n${outfit.style_summary}\n\n---\n\n${formattedItems}`

      const messageId = generateUniqueId();

      addMessage({
        type: "text",
        role: "ai",
        content: messageContent,
        agentInfo: {
          id: "style",
          name: "Styling Assistant",
          emoji: "👗",
        },
        metadata: {
          waitingForImage: true, // Flag to indicate image is coming
        }
      })

      // Add image placeholder for the outfit
      console.log(`[SUGGESTION DEBUG] Adding placeholder for outfit visualization`);
      const placeholderMessage = {
        type: "loading" as const,
        role: "ai" as const,
        loadingText: `Creating visual preview...`,
        metadata: {
          imageIndex: 0,
          isImagePlaceholder: true,
        }
      };
      console.log(`[SUGGESTION DEBUG] Placeholder message:`, placeholderMessage);
      console.log(`[SUGGESTION DEBUG] Placeholder details: imageIndex=${placeholderMessage.metadata.imageIndex}, isImagePlaceholder=${placeholderMessage.metadata.isImagePlaceholder}`);
      addMessage(placeholderMessage)

      const bubbleEndTime = Date.now()
      console.log(`[PERF] 💭 Outfit with placeholders displayed in ${bubbleEndTime - bubbleStartTime}ms`)

      // Store suggestion data for later image updates
      localStorage.setItem('currentSuggestion', JSON.stringify({
        outfit: suggestion.outfit_suggestion,
        messageId: messageId,
        timestamp: Date.now()
      }));

      // Debug: Check messages state after adding placeholder
      setTimeout(() => {
        console.log(`[SUGGESTION DEBUG] Messages after placeholder should be added - checking in 100ms`);
        setMessages(currentMessages => {
          const placeholders = currentMessages.filter(msg => msg.type === "loading" && msg.metadata?.isImagePlaceholder);
          console.log(`[SUGGESTION DEBUG] Current placeholder count: ${placeholders.length}`);
          console.log(`[SUGGESTION DEBUG] Current placeholders:`, placeholders.map(msg => ({
            id: msg.id,
            imageIndex: msg.metadata?.imageIndex,
            isImagePlaceholder: msg.metadata?.isImagePlaceholder
          })));
          return currentMessages; // No changes, just checking
        });
      }, 100);
    }

    const suggestionEndTime = Date.now()
    console.log(`[PERF] 💭 SUGGESTION DISPLAY COMPLETED: Total time ${suggestionEndTime - suggestionStartTime}ms`)
    console.log("[SUGGESTION DEBUG] Suggestion with placeholders displayed, backend generating images in parallel")

    // Images will be filled in as they complete via polling
    setCurrentStep("generating")
  }

  // Handle image generation results
  const displayImageResults = async (imageUrls: string[]) => {
    console.log(`[PERF] 🎨 IMAGES RECEIVED: ${imageUrls.length} generated image(s)`);

    if (!imageUrls || imageUrls.length === 0) {
      console.warn("[IMAGE DISPLAY] No image results to display");
      return;
    }

    // Debug: Log current messages before processing
    console.log("[IMAGE DISPLAY DEBUG] Current messages before processing:", messages.map(msg => ({
      id: msg.id,
      type: msg.type,
      hasImageUrl: !!msg.imageUrl,
      metadata: msg.metadata
    })));

    // Debug: Log all available placeholders at the start
    const initialPlaceholders = messages.filter(msg => msg.type === "loading" && msg.metadata?.isImagePlaceholder);
    console.log(`[IMAGE DISPLAY DEBUG] Initial placeholders count: ${initialPlaceholders.length}`);
    console.log(`[IMAGE DISPLAY DEBUG] Initial placeholders details:`, initialPlaceholders.map(msg => ({
      id: msg.id,
      imageIndex: msg.metadata?.imageIndex,
      loadingText: msg.loadingText
    })));

    // Process all images in a single setMessages call to avoid race conditions
    setMessages(prevMessages => {
      console.log(`[IMAGE DISPLAY DEBUG] PROCESSING ALL IMAGES - Starting with ${prevMessages.length} messages`);

      let newMessages = [...prevMessages];

      // Debug: Log all loading messages at the start of processing
      const allLoadingMessages = newMessages.filter(msg => msg.type === "loading");
      console.log(`[IMAGE DISPLAY DEBUG] All loading messages at start:`, allLoadingMessages.map(msg => ({
        id: msg.id,
        isImagePlaceholder: msg.metadata?.isImagePlaceholder,
        imageIndex: msg.metadata?.imageIndex,
        loadingText: msg.loadingText
      })));

      // Process each image
      for (let i = 0; i < imageUrls.length; i++) {
        const imageUrl = imageUrls[i];

        console.log(`[IMAGE DISPLAY] Processing image ${i + 1}: ${imageUrl.substring(0, 100) + '...'}`)

        // Find the FIRST available loading placeholder, regardless of index
        const placeholderIndex = newMessages.findIndex(msg =>
          msg.type === "loading" && msg.metadata?.isImagePlaceholder === true
        );

        console.log(`[IMAGE DISPLAY DEBUG] Found first available placeholder for image ${i}: at index ${placeholderIndex}`);

        if (placeholderIndex !== -1) {
          console.log(`[IMAGE DISPLAY DEBUG] Found placeholder at index ${placeholderIndex}, replacing with image: ${imageUrl.substring(0, 100)}...`);

          // Replace with the image
          const newImageMessage = {
            id: generateUniqueId(),
            type: "image" as const,
            role: "ai" as const,
            imageUrl: imageUrl,
            content: imageUrls.length === 1 ? "Your personalized style preview" : `Visual preview ${i + 1}`,
            timestamp: new Date(),
            metadata: {
              imageIndex: i,
              isOutfitPreview: true
            }
          };

          console.log(`[IMAGE DISPLAY DEBUG] Creating new image message:`, {
            id: newImageMessage.id,
            type: newImageMessage.type,
            hasImageUrl: !!newImageMessage.imageUrl,
            imageUrlLength: newImageMessage.imageUrl?.length,
            imageUrlPreview: newImageMessage.imageUrl?.substring(0, 100) + '...'
          });

          newMessages[placeholderIndex] = newImageMessage;
          console.log(`[IMAGE DISPLAY] Updated image ${i + 1}`);
        } else {
          console.warn(`[IMAGE DISPLAY] Could not find any more placeholders for image ${i + 1}. Appending to the end.`);
          // Improved fallback: Add image at the end with clear indication
          console.log(`[IMAGE DISPLAY] Adding image at the end as fallback for image ${i + 1}`);
          newMessages.push({
            id: generateUniqueId(),
            type: "image" as const,
            role: "ai" as const,
            imageUrl: imageUrl,
            content: `🎨 ${imageUrls.length === 1 ? "Your personalized style preview" : `Visual preview ${i + 1}`} (generated successfully)`,
            timestamp: new Date(),
            metadata: {
              imageIndex: i,
              isOutfitPreview: true,
              isFallback: true
            }
          });
        }
      }

      // Final debug: Log all messages after processing
      const finalPlaceholders = newMessages.filter(msg => msg.type === "loading" && msg.metadata?.isImagePlaceholder);
      console.log(`[IMAGE DISPLAY DEBUG] Final placeholders count after all updates: ${finalPlaceholders.length}`);

      const finalImages = newMessages.filter(msg => msg.type === "image" && msg.metadata?.isOutfitPreview);
      console.log(`[IMAGE DISPLAY DEBUG] Final images count: ${finalImages.length}`);

      console.log(`[IMAGE DISPLAY DEBUG] PROCESSING COMPLETE - Final message count: ${newMessages.length}`);
      return newMessages;
    });

    console.log(`[PERF] 🎨 IMAGES DISPLAY COMPLETED`);
  }

  const getOccasionName = (occasionId: string) => {
    const style = styles.find((s) => s.id === occasionId)
    return style ? style.name : "Unknown Occasion"
  }

  const getFileFromPreview = async (previewUrl: string, defaultName: string): Promise<File | null> => {
    if (!previewUrl) return null
    try {
      const response = await fetch(previewUrl)
      const blob = await response.blob()
      const fileType = blob.type || "image/jpeg"
      const fileName = defaultName
      return new File([blob], fileName, { type: fileType })
    } catch (error) {
      console.error("Error converting preview to file:", error)
      return null
    }
  }

  const startGeneration = async () => {
    const startTime = Date.now()
    console.log(`[PERF] 🚀 GENERATION STARTED at ${new Date().toISOString()}`)

    if (!chatData) {
      addMessage({
        type: "text",
        role: "ai",
        content: "Error: Chat data is missing. Please start over.",
      })
      return
    }

    // Debug chatData and customPrompt
    console.log("[CHAT DEBUG] Current chatData:", chatData)
    console.log("[CHAT DEBUG] Current customPrompt:", chatData.customPrompt)
    console.log("[CHAT DEBUG] CustomPrompt type:", typeof chatData.customPrompt)
    console.log("[CHAT DEBUG] CustomPrompt length:", chatData.customPrompt?.length || 0)

    setIsGenerating(true)
    setCurrentStep("generating")
    setGenerationStatusText("Kicking off the magic... ✨");
    setPollingError(null)
    processedStatusesRef.current.clear()
    setIntermediateImageDisplayed(false)
    setHasProcessedCompletion(false)
    hasDisplayedIntermediateImages.current = false;
    setIsShowingWaitingTips(false)
    isShowingWaitingTipsRef.current = false

    addMessage({
      type: "loading",
      role: "ai",
      loadingText: "Hold on—I'm putting together a killer look just for you!",
    })

    try {
      // Phase 1: Image File Preparation
      const filePreparationStart = Date.now()
      console.log(`[PERF] 📁 Phase 1: Starting image file preparation at ${new Date().toISOString()}`)

      const selfieFile = await getFileFromPreview(chatData.selfiePreview, "user_selfie.jpg")
      const clothingFile = await getFileFromPreview(chatData.clothingPreview, "user_clothing.jpg")

      if (!selfieFile || !clothingFile) {
        throw new Error("Could not prepare image files for upload.")
      }

      const filePreparationEnd = Date.now()
      const filePreparationTime = filePreparationEnd - filePreparationStart
      console.log(`[PERF] 📁 Phase 1 COMPLETED: File preparation took ${filePreparationTime}ms`)

      // Phase 2: FormData Assembly & API Request
      const apiRequestStart = Date.now()
      console.log(`[PERF] 🌐 Phase 2: Starting API request preparation at ${new Date().toISOString()}`)

      const formData = new FormData()
      formData.append("human_image", selfieFile)
      formData.append("garment_image", clothingFile)
      formData.append("occasion", chatData.occasion)
      formData.append("generation_mode", chatData.generationMode)

      // Load and append user profile for personalization
      try {
        const onboardingData = loadCompleteOnboardingData();
        if (onboardingData) {
          formData.append("user_profile", JSON.stringify(onboardingData));
          const onboardingDataForLog = { ...onboardingData };
          if (onboardingDataForLog?.fullBodyPhoto) {
            onboardingDataForLog.fullBodyPhoto = '***';
          }
          console.log("[CHAT DEBUG] Appending user_profile to FormData:", JSON.stringify(onboardingDataForLog, null, 2));
        } else {
          console.log("[CHAT DEBUG] No user_profile data found to append.");
        }
      } catch (error) {
        console.error("[CHAT DEBUG] Error loading onboarding data:", error);
      }

      // Add custom prompt if provided
      if (chatData.customPrompt && chatData.customPrompt.trim()) {
        formData.append("custom_prompt", chatData.customPrompt.trim());
        console.log("[CHAT DEBUG] Appending custom_prompt to FormData:", chatData.customPrompt.trim());
      } else {
        console.log("[CHAT DEBUG] No custom prompt to append. chatData.customPrompt:", chatData.customPrompt);
        console.log("[CHAT DEBUG] Custom prompt check - exists?", !!chatData.customPrompt);
        console.log("[CHAT DEBUG] Custom prompt check - trimmed?", chatData.customPrompt?.trim());
      }

      if (stylePrompts[chatData.occasion as keyof typeof stylePrompts]) {
        formData.append("style_prompt", stylePrompts[chatData.occasion as keyof typeof stylePrompts])
      } else {
        console.warn(`No style prompt found for occasion: ${chatData.occasion}`)
      }

      console.log(`[PERF] 🌐 Phase 2: Sending API request to /api/generation/start`)
      const response = await fetch("/api/generation/start", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to start the generation job.")
      }

      const data = await response.json()
      const newJobId = data.jobId // Capture new job ID
      setJobId(newJobId) // Set state

      const apiRequestEnd = Date.now()
      const apiRequestTime = apiRequestEnd - apiRequestStart
      const totalInitTime = apiRequestEnd - startTime

      console.log(`[PERF] 🌐 Phase 2 COMPLETED: API request took ${apiRequestTime}ms`)
      console.log(
        `[PERF] ⚡ INITIALIZATION COMPLETE: Total init time ${totalInitTime}ms (File prep: ${filePreparationTime}ms + API: ${apiRequestTime}ms)`,
      )

      // 1. Call startPolling directly instead of relying on useEffect
      console.log(`[PERF] 🔄 Calling startPolling directly for Job ID: ${newJobId}`)
      startPolling(newJobId)

      // Restore the proper, multi-step loading messages
      replaceLastLoadingMessage({
        type: "text",
        role: "ai",
        content:
          "Great! Your request has been sent. I'm starting the design process now. This might take a minute or two.",
      })
      addMessage({
        type: "loading",
        role: "ai",
        loadingText: "Let me set the scene—you're gonna look amazing in this!",
      })

      replaceLastLoadingMessage({
        role: "ai",
        type: "loading",
        loadingText: "One sec—just adding a bit more sparkle to your fit!",
      })

      addMessage({
        type: "loading",
        role: "ai",
        loadingText: "Let me set the scene—you're gonna look amazing in this!",
      })

      replaceLastLoadingMessage({
        type: "text",
        role: "ai",
        content: "🎉 Your styling masterpiece is ready! Here's what I've got for you, my friend:",
      })
    } catch (error) {
      const errorTime = Date.now()
      const totalErrorTime = errorTime - startTime
      console.error(`[PERF] ❌ GENERATION FAILED after ${totalErrorTime}ms:`, error)

      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred."
      replaceLastLoadingMessage({
        type: "text",
        role: "ai",
        content: `Sorry, something went wrong: ${errorMessage}`,
      })
      setIsGenerating(false)
      setGenerationStatusText(null);
      setCurrentStep("error")
    }
  }

  const showCompletion = async (imageUrls: string[]) => {
    console.log("[POLLING] Generation completed successfully!")
    await displayImageResults(imageUrls);
  }

  const startPolling = (jobId: string) => {
    console.log(`[POLLING] Starting polling for jobId: ${jobId}`);
    setJobId(jobId);
    setCurrentStep("generating");

    const intervalId = setInterval(async () => {
      try {
        const response = await fetch(`/api/generation/status?jobId=${jobId}`);
        if (!response.ok) {
          throw new Error(`Polling failed with status: ${response.status}`);
        }
        const job = await response.json();

        // --- DEBUG LOG ---
        // do not change userProfile, only update the log, do not need to log the fullbodyphoto in userProfile
        const jobForLog = { ...job };
        if (jobForLog?.fullBodyPhoto) {
          jobForLog.fullBodyPhoto = '***';
        }
        console.log("[POLLING] Received job status:", JSON.stringify(jobForLog, null, 2));

        // Update loading message
        if (job.statusMessage) {
          setGenerationStatusText(job.statusMessage);
        }

        // Check for intermediate styled images
        if (job.status === 'stylization_completed' && job.processImages?.styledImages?.length > 0 && !hasDisplayedIntermediateImages.current) {
          console.log("[POLLING] Stylization completed. Displaying intermediate images.");
          console.log(`[POLLING DEBUG] Styled images found:`, {
            status: job.status,
            styledImagesCount: job.processImages.styledImages.length,
            styledImages: job.processImages.styledImages,
            hasDisplayedIntermediateImages: hasDisplayedIntermediateImages.current
          });

          hasDisplayedIntermediateImages.current = true; // Prevent re-rendering

          // Add a message indicating that these are intermediate results
          addMessage({
            role: 'ai',
            type: 'text',
            // translate to english
            content: "✨ This is a preview of the initial scene for you, with final details being processed...",
          });

          // Display the styled images (without cancel buttons now)
          job.processImages.styledImages.forEach((imageUrl: string, index: number) => {
            const messageData = {
              role: 'ai' as const,
              type: 'image' as const,
              imageUrl: imageUrl,
              content: `In this vibe, here's how we'd wear it~ ${index + 1}`,
              metadata: {
                isStyledImage: true,
                imageIndex: index,
              }
            };

            console.log(`[POLLING DEBUG] Adding styled image ${index + 1}:`, {
              imageUrl: imageUrl.substring(0, 100) + '...',
              content: messageData.content,
              metadata: messageData.metadata,
              isFirstImage: index === 0
            });

            addMessage(messageData);
          });

          // Add Quick Reply options after showing styled images
          addMessage({
            role: 'ai',
            type: 'text',
            content: "🤔 how do you enjoy this vibe？",
            agentInfo: {
              id: "style",
              name: "Styling Assistant",
              emoji: "👗",
            },
            metadata: {
              suggestions: [
                "不喜欢这套搭配",
                "继续生成最终效果",
                // "重新生成场景",
                "换个风格试试"
              ],
            },
          });

          console.log(`[POLLING DEBUG] ✅ All ${job.processImages.styledImages.length} styled images added to messages with Quick Reply options`);
        }

        if (job.status === 'suggestion_generated' && !processedStatusesRef.current.has('suggestion_generated')) {
          console.log("[POLLING] Suggestion generated. Displaying text suggestion.");
          await displaySuggestionSequentially(job.suggestion);
          processedStatusesRef.current.add('suggestion_generated');
        }

        if (job.status === "succeed" || job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
          clearInterval(intervalId);
          setJobId(null);
          setIsGenerating(false);
          setGenerationStatusText(null);

          if (job.status === "cancelled") {
            console.log("[POLLING] Job was cancelled by user");
            // Don't add any additional messages as the cancel handler already added one
            setCurrentStep("complete");
            return;
          }

          if ((job.status === "succeed" || job.status === "completed") && job.result?.imageUrls?.length > 0) {
            console.log("[POLLING] Job finished successfully. Preparing to display results.");

            // Clean up any stale loading messages before showing final results.
            setMessages(prev => prev.filter(msg => msg.type !== 'loading'));
            await new Promise(resolve => setTimeout(resolve, 50)); // Allow state to update

            // Defensive check: If intermediate images exist but were not shown, display them first.
            if (job.processImages?.styledImages?.length > 0 && !hasDisplayedIntermediateImages.current) {
              console.log("[POLLING] Intermediate images were not displayed, showing them now before the final result.");
              hasDisplayedIntermediateImages.current = true;

              addMessage({
                role: 'ai',
                type: 'text',
                content: "✨ This is a preview of the initial scene for you, with final details being processed...",
              });

              job.processImages.styledImages.forEach((imageUrl: string) => {
                addMessage({
                  role: 'ai',
                  type: 'image',
                  imageUrl: imageUrl,
                });
              });

              // Wait a bit before showing the final image for a better user experience
              await new Promise(resolve => setTimeout(resolve, 1500));
            }

            // Add final completion text
            addMessage({
              role: 'ai',
              type: 'text',
              content: "🎉 Your styling masterpiece is ready! Here's your personalized result:",
            });

            console.log("[POLLING] Displaying final results.");
            await showCompletion(job.result.imageUrls);
          } else {
            console.error("[POLLING] Job failed or has no image results.", job.error);
            replaceLastLoadingMessage({
              role: 'ai',
              type: 'text',
              content: `出错了: ${job.error || '未知错误'}`
            });
            setCurrentStep("error");
          }
        }
      } catch (error) {
        console.error("Error during polling:", error);
        clearInterval(intervalId);
        setJobId(null);
        setIsGenerating(false);
        setGenerationStatusText(null);
        replaceLastLoadingMessage({
          role: 'ai',
          type: 'text',
          content: "Opps... something went wrong. Please try again later."
        });
        setCurrentStep("error");
      }
    }, 5000); // Poll every 5 seconds
  };

  // 2. Prevent rendering on server and initial client render to avoid hydration mismatch
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

      {/* Scenes generated, proceeding with virtual try-on.../ Creating visual preview... */}

      {/* Status indicator for ongoing processes */}
      {(isGenerating || isLoading || isImageProcessing) && (
        <div className="sticky top-16 z-20 px-4 py-2 bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50">
          <div className="max-w-2xl mx-auto">
            <div className="bg-white/95 backdrop-blur-lg rounded-2xl p-3 shadow-lg border border-gray-200">
              <div className="flex items-center gap-3">
                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                <span className="text-sm text-gray-600 font-medium">
                  {(() => {
                    if (isImageProcessing) return "Optimizing your image so it looks fab and loads fast…";
                    if (isGenerating) {
                      const status = generationStatusText || "Making your styling magic happen—stay tuned!";
                      const prompt = "While you wait, feel free to ask me anything else!";
                      return (
                        <span>
                          {status}
                          <span className="text-gray-500 font-normal italic mt-1 block">{prompt}</span>
                        </span>
                      );
                    }
                    if (isLoading) {
                      const status = "Thinking through your look—this one's gonna be good…";
                      const prompt = "We can keep chatting while I think.";
                      return (
                        <span>
                          {status}
                          <span className="text-gray-500 font-normal italic mt-1 block">{prompt}</span>
                        </span>
                      );
                    }
                    return null;
                  })()}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Fix hydration error by rendering page shell and showing loader inside content area */}
      <div className="flex-1 px-4 py-6 space-y-4">
        {!isInitialized ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-[#FF6EC7]" />
          </div>
        ) : (
          <div className="max-w-2xl mx-auto">
            {messages.map((message) => {
              console.log(`[MAIN RENDER] Message ${message.id} rendering:`, {
                messageType: message.type,
                hasImageUrl: !!message.imageUrl,
                isStyledImage: message.metadata?.isStyledImage,
              });

              return (
                <ChatBubble
                  key={message.id}
                  message={message}
                  onImageClick={handleImageClick}
                  sessionId={sessionId}
                />
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Quick Replies - Render after the last message if it's from AI */}
        {messages.length > 0 &&
          messages[messages.length - 1].role === 'ai' &&
          messages[messages.length - 1].metadata?.suggestions && (
            <QuickReplyButtons
              suggestions={messages[messages.length - 1].metadata!.suggestions!}
              onSelect={handleSendMessage}
            />
          )}

        {/* Chat Input Area */}
        <footer className="p-4 bg-white border-t border-gray-200">
          <div className="max-w-2xl mx-auto">
            {/* Staged image preview */}
            {stagedImage && (
              <div className="mb-2 relative w-24 h-24">
                <img
                  src={stagedImage || "/placeholder.svg"}
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

            <form
              onSubmit={(e) => {
                e.preventDefault()
                const message = (e.target as HTMLFormElement).message.value
                if (!message.trim() && !stagedImage) return
                handleSendMessage(message)
                  ; (e.target as HTMLFormElement).reset()
              }}
              className="flex items-center gap-2"
            >
              <input type="file" ref={imageInputRef} onChange={handleImageSelect} className="hidden" accept="image/*" />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleImageUploadClick}
                disabled={isImageProcessing}
                aria-label="Upload image"
              >
                {isImageProcessing ? (
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                ) : (
                  <ImageIcon className="w-5 h-5 text-gray-500" />
                )}
              </Button>
              <input
                name="message"
                placeholder="Talk to your personal stylist..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-[#FF6EC7] text-sm"
                autoComplete="off"
              />
              <Button
                type="submit"
                className="bg-[#FF6EC7] hover:bg-[#ff5bb0] rounded-full"
                size="icon"
                aria-label="Send message"
              >
                <Send className="w-5 h-5 text-white" />
              </Button>
            </form>
          </div>
        </footer>

        {/* Debug panel */}
        {
          // process.env.NODE_ENV === "development"  XXX TODO: remove this
          true // XXX TODO: remove this
          && (
            <div className="max-w-2xl mx-auto mt-4">
              <div
                className="bg-gray-100 rounded-lg cursor-pointer select-none"
                onClick={() => setIsDebugExpanded(!isDebugExpanded)}
              >
                <div className="flex items-center justify-between p-3 border-b border-gray-200">
                  <h3 className="font-bold text-sm text-gray-700">Debug Info</h3>
                  {isDebugExpanded ? (
                    <ChevronUp className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  )}
                </div>
              </div>

              {isDebugExpanded && (
                <div className="bg-gray-100 rounded-b-lg p-4 text-xs space-y-1">
                  <div className="font-semibold text-gray-800 mb-2">🎯 Unified Chat States:</div>
                  <div>sessionId: {sessionId}</div>
                  <div>
                    isLoading: <span className="font-bold">{String(isLoading)}</span>
                  </div>
                  <div className="font-semibold text-gray-800 mt-3 mb-2">📊 Generation States:</div>
                  <div>
                    isGenerating: <span className="font-bold">{String(isGenerating)}</span>
                  </div>
                  <div>
                    currentStep: <span className="font-bold">{String(currentStep)}</span>
                  </div>
                  <div>hasAutoStarted: {String(hasAutoStarted)}</div>
                  <div>pollingActive: {pollingIntervalId ? "yes" : "no"}</div>
                  <div className="font-semibold text-gray-800 mt-3 mb-2">💾 Data States:</div>
                  <div>chatData: {chatData ? "exists" : "null"}</div>
                  <div>messages.length: {String(messages.length)}</div>
                  <div>pollingError: {pollingError || "none"}</div>
                  <div className="font-semibold text-gray-800 mt-3 mb-2">💡 Final Prompt:</div>
                  <div>{finalPrompt}</div>
                </div>
              )}
            </div>
          )}

        {/* Generation button for guided mode (when chat data exists but no auto-start) */}
        {!isGenerating && currentStep === "suggestion" && chatData && messages.length > 0 && !hasAutoStarted && (
          <div className="max-w-2xl mx-auto mt-8">
            <div className="bg-white/80 rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-sm text-gray-600 mb-4 text-center">Ready to generate your personalized style?</p>
              <Button
                onClick={() => {
                  console.log("[CHAT DEBUG] Start generation button clicked")
                  startGeneration()
                }}
                className="w-full bg-[#FF6EC7] hover:bg-[#FF6EC7]/90"
              >
                Generate My Style
              </Button>
            </div>
          </div>
        )}

        {/* Return to homepage button when no chat data */}
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

      {/* Image Modal */}
      <ImageModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        imageUrl={modalImage || ""}
        sessionId={sessionId}
      />

      {/* iOS Tab Bar */}
      <IOSTabBar />
    </div>
  )
}
