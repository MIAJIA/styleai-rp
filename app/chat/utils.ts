import type { ChatMessage } from "./types"
import { styles } from "./constants"
import type { ProductInfo } from "../components/product-card"

// Helper for creating chat messages
export const createChatMessage = (
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

export const generateUniqueId = () => {
  return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export const getOccasionName = (occasionId: string) => {
  const style = styles.find((s) => s.id === occasionId)
  return style ? style.name : "Unknown Occasion"
}

// this function is used to get the file from the preview url
// it takes the preview url and the default name of the file
// it returns the file
// if the preview url is not provided, it returns null
// if the preview url is provided, it fetches the file from the url
// it returns the file
// if the file is not found, it returns null
export const getFileFromPreview = async (previewUrl: string, defaultName: string): Promise<File | null> => {
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

export const generateSmartSuggestions = (aiResponse: string): string[] => {
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