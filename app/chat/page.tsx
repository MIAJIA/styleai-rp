"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import IOSTabBar from "../components/ios-tab-bar"
import ImageModal from "../components/image-modal"
import ImageVoteButtons from "@/components/image-vote-buttons"
import { ProductGrid, parseProductsFromText, type ProductInfo } from "../components/product-card"
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  BookOpen,
  Footprints,
  Coffee,
  Mic,
  Palmtree,
  PartyPopper,
  Heart,
  ChevronDown,
  ChevronUp,
  Send,
  Upload,
  ImageIcon,
  User,
} from "lucide-react"

// Enhanced Chat message type definition with generation support
type ChatMessage = {
  id: string
  type: "text" | "image" | "loading" | "generation-request" | "products"
  role: "ai" | "user"
  content?: string
  imageUrl?: string
  loadingText?: string
  timestamp: Date
  products?: ProductInfo[] // Add products field
  agentInfo?: {
    id: string
    name: string
    emoji: string
  }
  metadata?: {
    // Generation-related data
    generationData?: {
      selfiePreview?: string
      clothingPreview?: string
      occasion?: string
      generationMode?: string
    }
    // Suggestions for quick replies
    suggestions?: string[]
    isGenerationTrigger?: boolean
  }
}

// Data type for generation requests
type ChatModeData = {
  selfiePreview: string
  clothingPreview: string
  occasion: string
  generationMode: "tryon-only" | "simple-scene" | "advanced-scene"
  selectedPersona: object | null
  selfieFile: any
  clothingFile: any
  timestamp: number
}

type ChatStep = "suggestion" | "generating" | "complete" | "error"

const styles = [
  { id: "fashion-magazine", name: "Magazine", icon: BookOpen },
  { id: "running-outdoors", name: "Outdoors", icon: Footprints },
  { id: "coffee-shop", name: "Coffee", icon: Coffee },
  { id: "music-show", name: "Music Show", icon: Mic },
  { id: "date-night", name: "Date Night", icon: Heart },
  { id: "beach-day", name: "Beach Day", icon: Palmtree },
  { id: "casual-chic", name: "Casual Chic", icon: Sparkles },
  { id: "party-glam", name: "Party Glam", icon: PartyPopper },
]

const stylePrompts = {
  "fashion-magazine":
    "standing in a semi-surreal environment blending organic shapes and architectural elements. The background features dreamlike washes of indigo and burnt orange, with subtle floating geometric motifs inspired by Ukiyo-e clouds. Lighting combines soft studio strobes with atmospheric glow, creating dimensional shadows. Composition balances realistic human proportions with slightly exaggerated fabric movement, evoking a living oil painting. Texture details: fine wool fibers visible, slight film grain. Style fusion: Richard Avedon's fashion realism + Egon Schiele's expressive lines + niji's color vibrancy (but photorealistic), 4k resolution.",
  "running-outdoors":
    "A vibrant, sun-drenched hillside with lush greenery under a clear blue sky, capturing an adventure lifestyle mood. The scene is bathed in soft, natural light, creating a sense of cinematic realism. Shot with the professional quality of a Canon EOS R5, emphasizing realistic textures and high definition, 4k resolution.",
  "coffee-shop":
    "A cozy, sunlit coffee shop with the warm aroma of freshly ground beans. The person is sitting at a rustic wooden table by a large window, holding a ceramic mug. The background shows soft, blurred details of a barista and an espresso machine. The style should be intimate and warm, with natural light creating soft shadows, reminiscent of a lifestyle magazine photograph, 4k resolution.",
  "casual-chic":
    "trendy Brooklyn street with colorful murals, chic coffee shop with exposed brick walls, urban rooftop garden with city views, stylish boutique district, contemporary art gallery setting, natural daylight with artistic shadows, street style fashion photography, 4k resolution",
  "music-show":
    "Group idol style, performing on stage, spotlight and dreamy lighting, high-definition portrait, soft glow and bokeh, dynamic hair movement, glamorous makeup, K-pop inspired outfit (shiny, fashionable), expressive pose, cinematic stage background, lens flare, fantasy concert vibe, ethereal lighting, 4k resolution.",
  "date-night":
    "A realistic romantic evening on a backyard patio--string lights overhead, wine glasses, laughing mid-conversation with friend. Subtle body language, soft bokeh lights, hint of connection. Created using: Sony Alpha A7R IV, cinematic lighting, shallow depth of field, natural expressions, sunset color grading Shot in kodak gold 200 with a canon EOS R6, 4k resolution.",
  "beach-day":
    "On the beach, soft sunlight, gentle waves in the background, highly detailed, lifelike textures, natural lighting, vivid colors, 4k resolution",
  "party-glam":
    "opulent ballroom with crystal chandeliers, luxurious velvet curtains and gold accents, dramatic spotlight effects with rich jewel tones, champagne bar with marble countertops, exclusive VIP lounge atmosphere, professional event photography with glamorous lighting, 4k resolution",
}

// Helper for creating chat messages
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
function AIAvatar() {
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-orange-300 flex items-center justify-center shadow-md flex-shrink-0">
      <Sparkles className="w-5 h-5 text-white" />
    </div>
  )
}

// Enhanced Chat Bubble component with generation support
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
          {message.content && <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>}

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

  // Re-enable state variables that are still in use by other parts of the component
  const [userInput, setUserInput] = useState("")
  const [sessionId, setSessionId] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)

  const [isImageProcessing, setIsImageProcessing] = useState(false)

  // --- START: Image Handling Functions ---
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
      // Use traditional method to find the last loading message
      const loadingMessageIndex = newMessages.map((m) => m.type).lastIndexOf("loading")

      if (loadingMessageIndex !== -1) {
        // Replace the existing loading message
        newMessages[loadingMessageIndex] = {
          ...message,
          id: generateUniqueId(),
          timestamp: new Date(),
        }
      } else {
        // Add new message if no loading message found
        newMessages.push({
          ...message,
          id: generateUniqueId(),
          timestamp: new Date(),
        })
      }

      return newMessages
    })
  }

  const handleSendMessage = async (message: string) => {
    console.log(`[ChatPage] handleSendMessage called. Message: "${message}", Has Staged Image: ${!!stagedImage}`)
    if (message.trim() === "" && !stagedImage) return

    // Add user message to UI immediately, including the staged image
    addMessage({
      type: "text",
      role: "user",
      content: message,
      imageUrl: stagedImage ?? undefined, // 2. Fix type error (null -> undefined)
    })

    const imageToSend = stagedImage
    // Clear the staged image immediately after capturing it
    setStagedImage(null)

    // Show loading indicator
    addMessage({
      type: "loading",
      role: "ai",
      loadingText: "Just a moment, I'm cooking up something stylish for you...",
    })

    // Pass the captured image to the chat handler
    await handleFreeChat(message, imageToSend)
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
          imageUrl: item.imageUrl || '/placeholder-product.jpg'
        })) || [];
      }

      // Fallback: try to parse from text response
      if (products.length === 0) {
        products = parseProductsFromText(data.response);
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
            suggestions: generateSmartSuggestions(data.response),
          },
        });
      } else {
        // Use the recreated function to display the AI response
        replaceLastLoadingMessage({
          type: "text",
          role: "ai",
          content: data.response,
          agentInfo: data.agentInfo,
          metadata: {
            suggestions: generateSmartSuggestions(data.response),
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

    if (!suggestion || !suggestion.outfit_suggestions || suggestion.outfit_suggestions.length === 0) {
      console.warn("[SUGGESTION DEBUG] No valid suggestion object or outfit_suggestions found.")
      addMessage({
        type: "text",
        role: "ai",
        content: "I couldn't come up with any specific outfit suggestions this time, but I'll generate an image based on the overall style idea!",
        agentInfo: {
          id: "style",
          name: "Styling Assistant",
          emoji: "👗",
        },
      })
    } else {
      console.log("[SUGGESTION DEBUG] Starting displaySuggestionSequentially with new format")
      setIsDisplayingSuggestion(true)

      const formatItems = (items: any) => {
        if (!items) return ""
        let formatted = ""

        if (items.tops && items.tops.length > 0) {
          formatted += `**Tops:**\n`
          items.tops.forEach((item: any) => {
            formatted += `- *${item.item_name}:* ${item.description}\n`
          })
        }
        if (items.bottoms) {
          formatted += `**Bottoms:**\n- *${items.bottoms.item_name}:* ${items.bottoms.description}\n`
        }
        if (items.shoes) {
          formatted += `**Shoes:**\n- *${items.shoes.item_name}:* ${items.shoes.description}\n`
        }
        if (items.bag) {
          formatted += `**Bag:**\n- *${items.bag.item_name}:* ${items.bag.description}\n`
        }
        if (items.accessories && items.accessories.length > 0) {
          formatted += `**Accessories:**\n`
          items.accessories.forEach((item: any) => {
            formatted += `- *${item.item_name}:* ${item.description}\n`
          })
        }
        if (items.hairstyle) {
          formatted += `**Hairstyle:**\n- *${items.hairstyle.style_name}:* ${items.hairstyle.description}\n`
        }

        return formatted
      }

      setMessages((prev) => {
        const newMessages = [...prev]
        const loadingMessageIndex = newMessages.map((m) => m.type).lastIndexOf("loading")

        const welcomeContent =
          "✨ I've analyzed your style! Here are three distinct outfit ideas for you. I'll create an image based on the first one."

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

      const outfits = suggestion.outfit_suggestions
      const totalDisplayTime = 10000
      const delayBetweenSuggestions = outfits.length > 0 ? totalDisplayTime / outfits.length : 1000

      for (let i = 0; i < outfits.length; i++) {
        const outfit = outfits[i]
        const bubbleStartTime = Date.now()
        console.log(`[PERF] 💭 Displaying outfit suggestion ${i + 1}/${outfits.length}: ${outfit.outfit_title}`)

        const formattedItems = formatItems(outfit.items)
        const messageContent = `### ${i + 1}. ${outfit.outfit_title}\n\n${outfit.explanation}\n\n---\n\n${formattedItems}`

        addMessage({
          type: "text",
          role: "ai",
          content: messageContent,
          agentInfo: {
            id: "style",
            name: "Styling Assistant",
            emoji: "👗",
          },
        })

        const bubbleEndTime = Date.now()
        console.log(`[PERF] 💭 Outfit bubble ${i + 1} displayed in ${bubbleEndTime - bubbleStartTime}ms`)

        if (i < outfits.length - 1) {
          console.log(`[PERF] 💭 Waiting ${delayBetweenSuggestions}ms before next bubble...`)
          await new Promise((resolve) => setTimeout(resolve, delayBetweenSuggestions))
        }
      }
    }

    const suggestionEndTime = Date.now()
    console.log(`[PERF] 💭 SUGGESTION DISPLAY COMPLETED: Total time ${suggestionEndTime - suggestionStartTime}ms`)

    console.log("[SUGGESTION DEBUG] All suggestions displayed, ready for image generation")
    setCurrentStep("complete")

    addMessage({
      type: "loading",
      role: "ai",
      loadingText: "🎨 Starting image generation...",
    })

    console.log("[SUGGESTION DEBUG] Added loading message for generation phase")

    displayWaitingTips()

    if (jobId) {
      startPolling(jobId)
    }
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

    setIsGenerating(true)
    setCurrentStep("generating")
    setPollingError(null)
    processedStatusesRef.current.clear()
    setIntermediateImageDisplayed(false)
    setHasProcessedCompletion(false)
    setIsShowingWaitingTips(false)
    isShowingWaitingTipsRef.current = false

    addMessage({
      type: "loading",
      role: "ai",
      loadingText: "Just a moment, I'm cooking up something stylish for you...",
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
        loadingText: "Crafting the perfect scene and pose, just like we used to do...",
      })

      replaceLastLoadingMessage({
        role: "ai",
        type: "loading",
        loadingText: "Putting the final touches on your look, hang tight...",
      })

      addMessage({
        type: "loading",
        role: "ai",
        loadingText: "Crafting the perfect scene and pose, just like we used to do...",
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
      setCurrentStep("error")
    }
  }

  const startPolling = (jobId: string) => {
    const pollingStartTime = Date.now()
    let suggestionDisplayTime = 0 // 在轮询开始时初始化
    console.log(`[PERF] 🔄 POLLING STARTED for job ${jobId} at ${new Date().toISOString()}`)

    const interval = setInterval(async () => {
      try {
        const pollRequestStart = Date.now()
        const response = await fetch(`/api/generation/status?jobId=${jobId}`)
        if (!response.ok) {
          throw new Error(`The server responded with status: ${response.status}`)
        }
        const data = await response.json()
        const pollRequestEnd = Date.now()
        const pollRequestTime = pollRequestEnd - pollRequestStart

        console.log(`[PERF] 📡 Poll request took ${pollRequestTime}ms, received status: ${data.status}`)

        const statusKey = data.status
        console.log("[POLLING DEBUG] Current statusKey:", statusKey)
        console.log("[POLLING DEBUG] processedStatusesRef contents:", Array.from(processedStatusesRef.current))

        if (processedStatusesRef.current.has(statusKey)) {
          console.log("[POLLING DEBUG] Status already processed, skipping:", statusKey)
          return
        }

        // Mark status as processed immediately to prevent concurrent processing
        processedStatusesRef.current.add(statusKey)
        console.log("[POLLING DEBUG] Marked status as processed:", statusKey)

        const statusProcessStart = Date.now()

        switch (data.status) {
          case "suggestion_generated":
            console.log(`[PERF] 💡 Phase 4: SUGGESTION_GENERATED received at ${new Date().toISOString()}`)
            const suggestionDisplayStart = Date.now()

            console.log("[POLLING DEBUG] Processing suggestion_generated status")
            await displaySuggestionSequentially(data.suggestion)

            const suggestionDisplayEnd = Date.now()
            suggestionDisplayTime = suggestionDisplayEnd - suggestionDisplayStart // 更新外部作用域的变量
            const totalSuggestionTime = suggestionDisplayEnd - pollingStartTime

            console.log(`[PERF] 💡 Phase 4 COMPLETED: Suggestion display took ${suggestionDisplayTime}ms`)
            console.log(`[PERF] 💡 Total time from polling start to suggestion complete: ${totalSuggestionTime}ms`)

            console.log("[POLLING DEBUG] Replacing loading message after suggestion display")
            replaceLastLoadingMessage({
              role: "ai",
              type: "loading",
              loadingText: "Creating a suitable scene and pose for you, remember our last adventure?",
            })
            break

          case "stylization_completed":
            if (!intermediateImageDisplayed) {
              const styledImageUrls = data.styledImages || (data.styledImage ? [data.styledImage] : [])
              if (styledImageUrls.length === 0) break

              const stylizationTime = Date.now() - pollingStartTime
              console.log(`[PERF] 🎨 Phase 5: STYLIZATION_COMPLETED received after ${stylizationTime}ms`)

              setIntermediateImageDisplayed(true)
              processedStatusesRef.current.add("stylization_completed")

              // 🆕 ADD: Notify ChatAgent about the styled images for context
              try {
                const sessionId = localStorage.getItem("chat_session_id")
                if (sessionId) {
                  if (styledImageUrls.length > 1) {
                    console.log(`[ChatPage] Adding ${styledImageUrls.length} styled images to ChatAgent context:`, styledImageUrls)
                    await fetch("/api/chat/simple", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        sessionId,
                        imageUrls: styledImageUrls,
                        action: "add_generated_images",
                      }),
                    })
                    console.log(`[ChatPage] ${styledImageUrls.length} styled images successfully added to ChatAgent context`)
                  } else {
                    console.log("[ChatPage] Adding styled image to ChatAgent context:", styledImageUrls[0])
                    await fetch("/api/chat/simple", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        sessionId,
                        imageUrl: styledImageUrls[0],
                        action: "add_generated_image",
                      }),
                    })
                    console.log("[ChatPage] Styled image successfully added to ChatAgent context")
                  }
                }
              } catch (error) {
                console.error("[ChatPage] Failed to add styled image(s) to ChatAgent context:", error)
              }

              replaceLastLoadingMessage({
                role: "ai",
                type: "text",
                content: "Here is the designed scene and pose, now putting on the final outfit for you...",
              })

              // Add all styled images
              styledImageUrls.forEach((imageUrl: string, index: number) => {
                addMessage({
                  role: "ai",
                  type: "image",
                  imageUrl: imageUrl,
                  content: styledImageUrls.length > 1
                    ? `Styled option ${index + 1}:`
                    : undefined,
                })
              })

              addMessage({
                role: "ai",
                type: "loading",
                loadingText: "Performing final composition, hang tight, buddy...",
              })

              console.log(`[PERF] 🎨 Phase 5: Intermediate images displayed, continuing to final generation...`)
            }
            break

          case "completed":
            if (!hasProcessedCompletion) {
              const completionTime = Date.now()
              const totalGenerationTime = completionTime - pollingStartTime

              console.log(`[PERF] 🎉 Phase 6: GENERATION COMPLETED after ${totalGenerationTime}ms total`)
              setCurrentStep("complete")

              // 🔧 FIX: Reset isGenerating and isLoading to false when generation is complete
              setIsGenerating(false)
              setIsLoading(false) // Reset loading state for unified chat

              // 停止显示等待小贴士
              setIsShowingWaitingTips(false)
              isShowingWaitingTipsRef.current = false

              const showCompletion = async () => {
                console.log("[POLLING] Generation completed successfully!")

                // 🆕 ADD: Notify ChatAgent about the generated images for context
                const generatedImageUrls = data.result?.imageUrls || (data.result?.imageUrl ? [data.result.imageUrl] : [])
                const totalImages = data.result?.totalImages || generatedImageUrls.length

                if (generatedImageUrls.length > 0) {
                  try {
                    const sessionId = localStorage.getItem("chat_session_id")
                    if (sessionId) {
                      console.log(`[ChatPage] Adding ${generatedImageUrls.length} generated images to ChatAgent context:`, generatedImageUrls)

                      // Use the new add_generated_images action for multiple images
                      await fetch("/api/chat/simple", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          sessionId,
                          imageUrls: generatedImageUrls,
                          action: "add_generated_images",
                        }),
                      })
                      console.log(`[ChatPage] ${generatedImageUrls.length} generated images successfully added to ChatAgent context`)
                    }
                  } catch (error) {
                    console.error("[ChatPage] Failed to add generated images to ChatAgent context:", error)
                  }
                }

                // Replace loading message with success message
                replaceLastLoadingMessage({
                  type: "text",
                  role: "ai",
                  content: totalImages > 1
                    ? `🎉 Your styling generation has completed! Here are ${totalImages} options for you, my friend:`
                    : "🎉 Your styling generation has completed! Here is the result for you, my friend:",
                })

                // Add all generated images as separate messages
                generatedImageUrls.forEach((imageUrl: string, index: number) => {
                  addMessage({
                    type: "image",
                    role: "ai",
                    imageUrl: imageUrl,
                    content: totalImages > 1
                      ? `Option ${index + 1}: What do you think of this styling?`
                      : "Here's your personalized styling result! What do you think?",
                    metadata: {
                      suggestions: ["Try another style", "Adjust colors", "Different occasion", "Style analysis"],
                    },
                  })
                })

                setCurrentStep("complete")
                setIsGenerating(false)
                setJobId(null)
              }

              // 优化：移除等待机制，立即显示最终图片，不等待建议显示完成
              await showCompletion()
            }
            break

          case "failed":
            const failureTime = Date.now() - pollingStartTime
            console.log(`[PERF] ❌ GENERATION FAILED after ${failureTime}ms`)

            // 🔧 FIX: Reset both isGenerating and isLoading to false when generation fails
            setIsGenerating(false)
            setIsLoading(false) // Reset loading state for unified chat
            setCurrentStep("error")

            throw new Error(data.statusMessage || "Generation failed without a specific reason.")

          default:
            console.log(`[POLLING] Unhandled status: ${data.status}`)
        }

        const statusProcessEnd = Date.now()
        const statusProcessTime = statusProcessEnd - statusProcessStart
        console.log(`[PERF] ⚙️ Status processing took ${statusProcessTime}ms for status: ${data.status}`)
      } catch (error) {
        const errorTime = Date.now()
        const totalErrorTime = errorTime - pollingStartTime
        console.error(`[PERF] ❌ POLLING ERROR after ${totalErrorTime}ms:`, error)

        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred"
        setPollingError(errorMessage)
        replaceLastLoadingMessage({
          type: "text",
          role: "ai",
          content: `Sorry, we ran into a problem: ${errorMessage}`,
        })
        clearInterval(interval)
        setPollingIntervalId(null)

        // 🔧 FIX: Reset both isGenerating and isLoading to false when there's an error
        setIsGenerating(false)
        setIsLoading(false) // Reset loading state for unified chat
      }
    }, 3000)

    setPollingIntervalId(interval)
  }

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

      {/* Status indicator for ongoing processes */}
      {(isGenerating || isLoading || isImageProcessing) && (
        <div className="sticky top-16 z-20 px-4 py-2 bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50">
          <div className="max-w-2xl mx-auto">
            <div className="bg-white/95 backdrop-blur-lg rounded-2xl p-3 shadow-lg border border-gray-200">
              <div className="flex items-center gap-3">
                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                <span className="text-sm text-gray-600 font-medium">
                  {isImageProcessing
                    ? "🖼️ 正在压缩图片以提升传输效率..."
                    : isGenerating
                      ? "🎨 Generating your exclusive styling effect..."
                      : "💭 AI正在思考中..."}
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
            {messages.map((message) => (
              <ChatBubble key={message.id} message={message} onImageClick={handleImageClick} sessionId={sessionId} />
            ))}
            <div ref={messagesEndRef} />
          </div>
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
        {process.env.NODE_ENV === "development" && (
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
