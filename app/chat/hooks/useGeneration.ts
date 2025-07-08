import { useState, useCallback, useRef } from "react"
import { usePolling } from "./usePolling"
import { getFileFromPreview } from "../utils"
import { loadCompleteOnboardingData } from "@/lib/onboarding-storage"
import { stylePrompts } from "../constants"
import type { ChatMessage, ChatModeData } from "../types"

interface UseGenerationProps {
  chatData: ChatModeData | null
  addMessage: (message: Omit<ChatMessage, "id" | "timestamp">) => void
  replaceLastLoadingMessage: (message: Omit<ChatMessage, "id" | "timestamp">) => void // Assuming this is available from useChat
  displaySuggestionSequentially: (suggestion: any) => Promise<void>
  displayImageResults: (imageUrls: string[]) => Promise<void>
  setCurrentStep: (step: "suggestion" | "generating" | "complete" | "error") => void
}

export function useGeneration({
  chatData,
  addMessage,
  replaceLastLoadingMessage,
  displaySuggestionSequentially,
  displayImageResults,
  setCurrentStep,
}: UseGenerationProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [generationStatusText, setGenerationStatusText] = useState<string | null>(null)
  const [pollingError, setPollingError] = useState<string | null>(null)

  const lastStatusRef = useRef<string | null>(null);
  const lastStatusMessageRef = useRef<string | null>(null);
  const processedStatusesRef = useRef<Set<string>>(new Set())
  const hasDisplayedIntermediateImages = useRef(false)

  const onPollingSuccess = useCallback(
    (result: any) => {
      console.log("[useGeneration] Polling succeeded:", result)
      if (result?.imageUrls?.length > 0) {
        addMessage({
          role: "ai",
          type: "text",
          content: "🎉 Your styling masterpiece is ready! Here's your personalized result:",
        })
        displayImageResults(result.imageUrls)
      }
      setCurrentStep("complete")
      setJobId(null)
    },
    [addMessage, displayImageResults, setCurrentStep],
  )

  const onPollingError = useCallback(
    (error: Error) => {
      console.error("[useGeneration] Polling failed:", error)
      setPollingError(error.message)
      replaceLastLoadingMessage({
        role: "ai",
        type: "text",
        content: `Opps... something went wrong: ${error.message}`,
      })
      setCurrentStep("error")
      setJobId(null)
    },
    [replaceLastLoadingMessage, setCurrentStep],
  )

  const onPollingUpdate = useCallback(
    (job: any) => {
      const importantStatuses = ['pending', 'suggestion_generated', 'stylization_completed', 'completed', 'failed'];
      if (job.status !== lastStatusRef.current && importantStatuses.includes(job.status)) {
        console.log(`⚠️⚠️⚠️[GENERATION] ${job.jobId?.slice(-8)}: ${lastStatusRef.current || 'null'} → ${job.status}`);
        lastStatusRef.current = job.status;
      }

      if (job.statusMessage && job.statusMessage !== lastStatusMessageRef.current) {
        setGenerationStatusText(job.statusMessage);
        lastStatusMessageRef.current = job.statusMessage;
      }

      if (
        job.status === "stylization_completed" &&
        job.processImages?.styledImages?.length > 0 &&
        !hasDisplayedIntermediateImages.current
      ) {
        hasDisplayedIntermediateImages.current = true
        addMessage({
          role: "ai",
          type: "text",
          content: "✨ This is a preview of the initial scene for you, with final details being processed...",
        })
        job.processImages.styledImages.forEach((imageUrl: string, index: number) => {
          addMessage({
            role: "ai" as const,
            type: "image" as const,
            imageUrl: imageUrl,
            content: `In this vibe, here's how we'd wear it~ ${index + 1}`,
          })
        })
        addMessage({
          role: "ai",
          type: "text",
          content: "🤔 how do you enjoy this vibe？",
          metadata: {
            suggestions: ["不喜欢这套搭配", "继续生成最终效果", "换个风格试试"],
          },
        })
      }

      if (job.status === "suggestion_generated" && !processedStatusesRef.current.has("suggestion_generated")) {
        displaySuggestionSequentially(job.suggestion)
        processedStatusesRef.current.add("suggestion_generated")
      }
    },
    [addMessage, displaySuggestionSequentially],
  )

  usePolling({
    jobId,
    onSuccess: onPollingSuccess,
    onError: onPollingError,
    onUpdate: onPollingUpdate,
  })

  const startGeneration = async () => {
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
    setGenerationStatusText("Kicking off the magic... ✨")
    setPollingError(null)
    processedStatusesRef.current.clear()
    hasDisplayedIntermediateImages.current = false

    addMessage({
      type: "loading",
      role: "ai",
      loadingText: "Hold on—I'm putting together a killer look just for you!",
    })

    try {
      const selfieFile = await getFileFromPreview(chatData.selfiePreview, "user_selfie.jpg")
      const clothingFile = await getFileFromPreview(chatData.clothingPreview, "user_clothing.jpg")
      if (!selfieFile || !clothingFile) {
        throw new Error("Could not prepare image files for upload.")
      }

      const formData = new FormData()
      formData.append("human_image", selfieFile)
      formData.append("garment_image", clothingFile)
      formData.append("occasion", chatData.occasion)
      formData.append("generation_mode", chatData.generationMode)

      const onboardingData = loadCompleteOnboardingData()
      if (onboardingData) {
        formData.append("user_profile", JSON.stringify(onboardingData))
      }

      if (chatData.customPrompt && chatData.customPrompt.trim()) {
        formData.append("custom_prompt", chatData.customPrompt.trim())
      }
      if (stylePrompts[chatData.occasion as keyof typeof stylePrompts]) {
        formData.append("style_prompt", stylePrompts[chatData.occasion as keyof typeof stylePrompts])
      }

      const response = await fetch("/api/generation/start", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to start the generation job.")
      }

      const data = await response.json()
      setJobId(data.jobId) // This will trigger the usePolling hook
    } catch (error) {
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

  return {
    isGenerating,
    jobId,
    generationStatusText,
    pollingError,
    startGeneration,
  }
}