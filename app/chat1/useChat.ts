import { ChatMessage } from "@langchain/core/messages"
import { useState, useCallback } from "react"
import { generateUniqueId } from "../chat/utils"
import { ProductInfo, parseProductsFromText } from "../components/product-card"
import { Message } from "./types"

interface UseChatProps {
  sessionId: string
  stagedImage: string | null
  setStagedImage: (image: string | null) => void,
  addMessage: (message: Message) => void,
}

export function useChat({ sessionId, stagedImage, setStagedImage, addMessage }: UseChatProps) {


  const handleFreeChat = async (message: string,) => {
    const id = `ai-message-${sessionId}-${Date.now()}`
    const aiMessage: Message = {
      id: id,
      content: "sending...",
      sender: 'ai',
      timestamp: new Date(),
    }
    addMessage(aiMessage);

    const requestBody = { message, sessionId, imageUrl:stagedImage }
    setStagedImage(null)
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
        addMessage({
          id: id,
          sender: 'ai',
          content:      products.join("\n"),
          timestamp: new Date(),
        })
      } else {
        addMessage({
          id: id,
          sender: 'ai',
          content: responseText,
          timestamp: new Date(),
        })
      }
    } catch (error: any) {
      const aiMessageError: Message = {
        id: id,
        content: `API request failed: ${error.message}`,
        sender: 'ai',
        timestamp: new Date(),
      }
      addMessage(aiMessageError);
    } 
  }

  return {
    handleFreeChat,
  }
}