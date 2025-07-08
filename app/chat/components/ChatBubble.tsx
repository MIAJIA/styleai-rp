import ReactMarkdown from "react-markdown"
import ImageVoteButtons from "@/components/image-vote-buttons"
import { ProductGrid, type ProductInfo } from "../../components/product-card"
import type { ChatMessage } from "../types"
import { AIAvatar } from "./AIAvatar"

// Enhanced Chat Bubble component with generation support
export function ChatBubble({
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

  console.log(`[ChatBubble] Rendering message with sessionId: ${sessionId}, hasImage: ${!!message.imageUrl}`)

  // Debug logging for product messages
  if (message.type === "products" || (message.products && message.products.length > 0)) {
    console.log("[ChatBubble] Rendering message with products:", {
      messageId: message.id,
      messageType: message.type,
      hasProducts: !!message.products,
      productCount: message.products?.length || 0,
      products: message.products?.map((p) => ({ id: p.id, name: `${p.name.substring(0, 20)}...` })) || [],
    })
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
                        console.log(
                          `[ChatBubble] Image vote changed: ${voteType} for ${message.imageUrl?.substring(0, 50)}...`,
                        )
                        console.log(`[ChatBubble] SessionId used: ${sessionId}`)
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