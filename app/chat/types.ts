import { ProductInfo } from "../components/product-card"

// Enhanced Chat message type definition with generation support
export type ChatMessage = {
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
    outfitIndex?: number
    waitingForImage?: boolean
    isImagePlaceholder?: boolean
    totalImages?: number
    variationIndex?: number
    imageIndex?: number
    isOutfitPreview?: boolean
    isFallback?: boolean
    isStyledImage?: boolean // Flag to identify styled images
  }
}

// Data type for generation requests
export type ChatModeData = {
  selfiePreview: string
  clothingPreview: string
  occasion: string
  generationMode: "tryon-only" | "simple-scene" | "advanced-scene"
  selectedPersona: object | null
  selfieFile: any
  clothingFile: any
  timestamp: number
  customPrompt?: string
}

// Chat step type definition
export type ChatStep = "suggestion" | "generating" | "complete" | "error"