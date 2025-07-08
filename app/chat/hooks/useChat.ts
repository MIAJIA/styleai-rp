import { useState, useCallback } from "react"
import type { ChatMessage } from "../types"
import { generateUniqueId } from "../utils"
import { parseProductsFromText, type ProductInfo } from "../../components/product-card"

interface UseChatProps {
  sessionId: string
  stagedImage: string | null
  setStagedImage: (image: string | null) => void
}

export function useChat({ sessionId, stagedImage, setStagedImage }: UseChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const addMessage = useCallback((message: Omit<ChatMessage, "id" | "timestamp">) => {
    setMessages((prev) => [...prev, { ...message, id: generateUniqueId(), timestamp: new Date() }])
  }, [])

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
    [],
  )

  const handleFreeChat = useCallback(
    async (message: string, imageUrl?: string | null) => {
      if (!sessionId) {
        replaceLastLoadingMessage({
          type: "text",
          role: "ai",
          content: "Sorry, the session has expired. Please refresh the page and try again.",
        })
        return
      }

      setIsLoading(true)
      const requestBody = { message, sessionId, imageUrl }

      try {
        const response = await fetch("/api/chat/simple", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        })

        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "API request failed")

        const responseText = data.response || ""
        let products: ProductInfo[] = []

        if (data.searchResults) {
          products =
            data.searchResults.items?.map((item: any) => ({
              id: item.id || `product-${Date.now()}`,
              name: item.name || "Product",
              price: item.price || "Price not available",
              description: item.description || "",
              link: item.link || "#",
              imageUrl: item.imageUrl || "/placeholder-product.jpg",
              source: item.source,
            })) || []
        }

        if (products.length === 0) products = parseProductsFromText(responseText)

        if (products.length > 0) {
          replaceLastLoadingMessage({
            type: "products",
            role: "ai",
            content: undefined,
            products,
            agentInfo: data.agentInfo,
            metadata: { suggestions: data.quickReplies || [] },
          })
        } else {
          replaceLastLoadingMessage({
            type: "text",
            role: "ai",
            content: responseText,
            agentInfo: data.agentInfo,
            metadata: { suggestions: data.quickReplies || [] },
          })
        }
      } catch (error: any) {
        replaceLastLoadingMessage({
          type: "text",
          role: "ai",
          content: `Sorry, something went wrong: ${error.message}`,
        })
      } finally {
        setIsLoading(false)
      }
    },
    [sessionId, replaceLastLoadingMessage],
  )

  const handleSendMessage = useCallback(
    async (message: string) => {
      if (message.trim() === "" && !stagedImage) return

      const imageUrlForThisMessage = stagedImage ?? undefined
      addMessage({
        type: "text",
        role: "user",
        content: message,
        imageUrl: imageUrlForThisMessage,
      })
      setStagedImage(null)

      addMessage({
        type: "loading",
        role: "ai",
        loadingText: "Hold on—I'm putting together a killer look just for you!",
      })

      await handleFreeChat(message, imageUrlForThisMessage)
    },
    [stagedImage, addMessage, setStagedImage, handleFreeChat],
  )

  return {
    messages,
    setMessages,
    isLoading,
    handleSendMessage,
    addMessage, // Exporting for external use (e.g., in generation logic)
  }
}