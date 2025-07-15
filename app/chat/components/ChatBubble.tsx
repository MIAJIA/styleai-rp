import React from "react"
import ReactMarkdown from "react-markdown"
import ImageVoteButtons from "@/components/image-vote-buttons"
import { ProductGrid, type ProductInfo } from "../../components/product-card"
import type { ChatMessage, QuickReplyAction } from "../types"
import { AIAvatar } from "./AIAvatar"
import { QuickReplyButtons } from "./QuickReplyButtons"

interface ChatBubbleProps {
  message: ChatMessage
  onImageClick: (imageUrl: string) => void
  onQuickReplyAction: (action: QuickReplyAction) => void
  sessionId?: string
}

// Enhanced Chat Bubble component with generation support
export const ChatBubble = React.memo(function ChatBubble({
  message,
  onImageClick,
  onQuickReplyAction,
  sessionId,
}: ChatBubbleProps) {
  const isAI = message.role === "ai"
  const isUser = message.role === "user"

  // 🔍 FIX: 减少开发环境的调试日志频率，避免过度渲染
  if (process.env.NODE_ENV === 'development' && Math.random() < 0.01) { // 降低到1%的概率
    console.log('[ChatBubble] Rendering:', {
      sessionId: sessionId?.slice(-8),
      hasImage: !!message.imageUrl,
      messageType: message.type,
      messageId: message.id
    });
  }

  // Debug logging for product messages
  if (message.type === "products" || (message.products && message.products.length > 0)) {
    if (process.env.NODE_ENV === 'development') {
      console.log("[ChatBubble] Rendering message with products:", {
        messageId: message.id,
        messageType: message.type,
        hasProducts: !!message.products,
        productCount: message.products?.length || 0,
        products: message.products?.map((p) => ({ id: p.id, name: `${p.name.substring(0, 20)}...` })) || [],
      })
    }
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

          {/* 🔍 FIX: 优化图片渲染，减少重新渲染 */}
          {message.imageUrl && (
            <div className={message.content ? "mt-2" : ""}>
              <div className="relative group">
                <img
                  src={message.imageUrl}
                  alt={isAI ? "Generated image" : "Uploaded image"}
                  width={300}
                  height={400}
                  className="rounded-lg cursor-pointer"
                  onClick={() => message.imageUrl && onImageClick(message.imageUrl)}
                  onLoad={() => {
                    // 🔍 FIX: 图片加载完成后的日志
                    if (process.env.NODE_ENV === 'development') {
                      console.log(`[ChatBubble] 📸 Image loaded successfully: ${message.imageUrl?.substring(0, 50)}...`);
                    }
                  }}
                  onError={() => {
                    // 🔍 FIX: 图片加载失败的日志
                    if (process.env.NODE_ENV === 'development') {
                      console.warn(`[ChatBubble] ⚠️ Image failed to load: ${message.imageUrl?.substring(0, 50)}...`);
                    }
                  }}
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
                      src={message.metadata.generationData.selfiePreview}
                      alt="Selfie"
                      className="w-full h-20 object-cover rounded-lg"
                    />
                  )}
                  {message.metadata.generationData.clothingPreview && (
                    <img
                      src={message.metadata.generationData.clothingPreview}
                      alt="Clothing"
                      className="w-full h-20 object-cover rounded-lg"
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {/* Render quick replies if they exist */}
          {message.type === "quick-reply" && message.actions && (
            <div className={message.content ? "mt-2" : ""}>
              <QuickReplyButtons actions={message.actions} onAction={onQuickReplyAction} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}, (prevProps, nextProps) => {
  // 🔍 FIX: 自定义比较函数，减少不必要的重新渲染
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.imageUrl === nextProps.message.imageUrl &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.type === nextProps.message.type &&
    prevProps.sessionId === nextProps.sessionId
  );
})