import { useState, useCallback, useRef } from "react"
import { usePolling } from "./usePolling"
import { getFileFromPreview } from "../utils"
import { loadCompleteOnboardingData } from "@/lib/onboarding-storage"
import { stylePrompts } from "../constants"
import type { ChatMessage, ChatModeData } from "../types"
import type { Job, Suggestion } from "@/lib/ai/types"

interface UseGenerationProps {
  chatData: ChatModeData | null
  addMessage: (message: Omit<ChatMessage, "id" | "timestamp">) => void
  replaceLastLoadingMessage: (message: Omit<ChatMessage, "id" | "timestamp">) => void
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
  const [pollingError, setPollingError] = useState<string | null>(null)

  // --- New State for Multi-Suggestion ---
  const [currentJob, setCurrentJob] = useState<Job | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [currentSuggestionIndex, setCurrentSuggestionIndex] = useState(0)

  // --- NEW: Refs for performance logging ---
  const jobStartTime = useRef<number | null>(null);

  // Use refs to track which results have been displayed to avoid re-rendering
  const displayedTextSuggestions = useRef(new Set<number>());
  const displayedIntermediateImages = useRef(new Set<number>());
  const displayedFinalImages = useRef(new Set<number>()); // <-- NEW: For final images

  const onPollingError = useCallback(
    (error: Error) => {
      console.error("[useGeneration | onPollingError] Polling failed:", error)

      // 🔍 改进：检查是否是友好的错误消息（来自我们的 API）
      let errorMessage: string;

      // 如果错误消息中包含我们设置的友好消息，直接使用
      if (error.message.includes('我们的设计师团队暂时离开了一下')) {
        errorMessage = error.message;
      } else if (error.message.includes('503')) {
        // 针对 503 错误提供友好提示
        errorMessage = "服务暂时不可用，我们的团队正在努力恢复中～ ✨";
      } else {
        // 其他错误使用原有逻辑
        errorMessage = `Oops... something went wrong. ${error.message.replace('Polling failed with status: ', '')}`;
      }

      setPollingError(errorMessage);
      replaceLastLoadingMessage({
        role: "ai",
        type: "text",
        content: errorMessage,
      })
      setCurrentStep("error")
      // We no longer setJobId(null) here. This allows the user to potentially
      // trigger another image generation for a different suggestion, which might
      // restart the polling process if the backend call is successful.
    },
    [replaceLastLoadingMessage, setCurrentStep],
  )

  const onPollingUpdate = useCallback(
    (job: Job) => {
      console.log(`[useGeneration | onPollingUpdate] 🎯 Received job update for ID: ${job.jobId}`, job);
      setCurrentJob(job);
      // This state update is crucial for the UI to react.
      setSuggestions(job.suggestions);

      // --- NEW: Iterate over ALL suggestions to check for updates ---
      job.suggestions.forEach((suggestion) => {
        const { index, status, imageUrls, intermediateImageUrls, error, styleSuggestion } = suggestion;

        // Display text for any newly triggered suggestion, but only if it's the current one.
        if (styleSuggestion && !displayedTextSuggestions.current.has(index)) {
          console.log(`[useGeneration] Checking text for suggestion ${index}.`);
          if (index === currentSuggestionIndex) {
            console.log(`[useGeneration] Displaying text for suggestion ${index} for the first time.`);
            if (jobStartTime.current) {
              const elapsed = Date.now() - jobStartTime.current;
              console.log(`[FE_PERF_LOG] Text suggestions appeared on UI for index ${index}. Total time since start: ${elapsed}ms.`);
            }
            displaySuggestionSequentially(styleSuggestion);
            // FIX: Only add to the set *after* the text has been displayed.
            displayedTextSuggestions.current.add(index);
          }
        }

        // --- 🔍 FIX: 重新设计中间图片显示逻辑 ---
        // 不再依赖 status === 'generating_images'，而是直接检查 intermediateImageUrls 的存在
        if (
          intermediateImageUrls &&
          intermediateImageUrls.length > 0 &&
          !displayedIntermediateImages.current.has(index)
        ) {
          console.log(`[useGeneration] 🖼️ Found intermediate images for suggestion ${index}, status: ${status}`);
          console.log(`[useGeneration] 🖼️ Intermediate images count: ${intermediateImageUrls.length}`);

          // 只有当前选中的 suggestion 才显示中间图片
          if (index === currentSuggestionIndex) {
            console.log(`[useGeneration] Displaying INTERMEDIATE images for suggestion ${index} for the first time.`);
            if (jobStartTime.current) {
              const elapsed = Date.now() - jobStartTime.current;
              console.log(`[FE_PERF_LOG] Intermediate images appeared on UI for index ${index}. Total time since start: ${elapsed}ms.`);
            }

            // 🔍 FIX: 确保intermediate images在final images之前显示
            const currentTime = Date.now();
            console.log(`[useGeneration] 🕐 Displaying intermediate images at timestamp: ${currentTime}`);

            displayImageResults(intermediateImageUrls);
            addMessage({
              role: 'ai',
              type: 'text',
              content: `✨ 这是为你生成的第 ${index + 1} 套搭配的场景预览，即将进行最终的细节处理...`
            });
            addMessage({
              type: "loading" as const,
              role: "ai" as const,
              loadingText: `正在进行最终处理...`,
              metadata: { isImagePlaceholder: true },
            });
            displayedIntermediateImages.current.add(index);
          }
        }
        // --- END 🔍 FIX ---

        // Display FINAL images for any completed suggestion that hasn't been displayed yet
        if (
          status === 'succeeded' &&
          imageUrls &&
          imageUrls.length > 0 &&
          !displayedFinalImages.current.has(index)
        ) {
          console.log(`[useGeneration] Displaying FINAL images for suggestion ${index} for the first time.`);
          if (jobStartTime.current) {
            const elapsed = Date.now() - jobStartTime.current;
            console.log(`[FE_PERF_LOG] Final images appeared on UI for index ${index}. Total time since start: ${elapsed}ms.`);
          }

          // 🔍 FIX: 确保final images在intermediate images之后显示
          const currentTime = Date.now();
          console.log(`[useGeneration] 🕐 Displaying final images at timestamp: ${currentTime}`);

          // 🔍 FIX: 确保图片立即显示，不等待额外的加载时间
          console.log(`[useGeneration] 📸 About to display final images:`, imageUrls.map(url => url.substring(0, 100) + '...'));
          displayImageResults(imageUrls);
          addMessage({
            role: "ai",
            type: "text",
            content: `🎉 这是为你生成的第 ${index + 1} 套搭配建议！`,
          });
          displayedFinalImages.current.add(index);
        }

        // 🔍 FIX: 处理没有imageUrls但status为succeeded的情况
        if (
          status === 'succeeded' &&
          (!imageUrls || imageUrls.length === 0) &&
          !displayedFinalImages.current.has(index)
        ) {
          console.warn(`[useGeneration] ⚠️ Suggestion ${index} succeeded but has no imageUrls`);
          addMessage({
            role: "ai",
            type: "text",
            content: `✅ 任务 ${index + 1} 完成，但似乎没有生成图片。`,
          });
          displayedFinalImages.current.add(index);
        }

        // Handle failure for any failed suggestion
        if (
          status === 'failed' &&
          !displayedFinalImages.current.has(index)
        ) {
          console.error(`[useGeneration | onPollingUpdate] ❌ Suggestion ${index} failed:`, error);
          // Same logic as above, this will target the last loading message.
          replaceLastLoadingMessage({
            role: "ai",
            type: "text",
            content: `Opps, Error on Suggestion ${index + 1}: ${error}`,
          });
          displayedFinalImages.current.add(index); // Also "remember" failed attempts
        }
      });
      // --- END NEW ITERATION LOGIC ---

      // 🔍 FIX: 更智能的完成状态检查 - 只要有一个成功的suggestion就可以认为job基本完成
      const hasAnySucceeded = job.suggestions.some(s => s.status === 'succeeded');
      const hasAnyGenerating = job.suggestions.some(s => s.status === 'generating_images' || s.status === 'processing_tryon');

      // 如果有任何一个成功了，并且没有正在生成的，就认为当前阶段完成
      if (hasAnySucceeded && !hasAnyGenerating) {
        console.log("[useGeneration | onPollingUpdate] 🏁 At least one suggestion succeeded and no more generating. Updating step to complete.");
        setCurrentStep("complete");
        // 但不要停止轮询，因为用户可能还会选择其他suggestion
      }

      // 只有当所有suggestions都完成时才停止轮询
      const isJobComplete = job.suggestions.every(s => s.status === 'succeeded' || s.status === 'failed');
      if (isJobComplete) {
        console.log("[useGeneration | onPollingUpdate] 🏁 All suggestions processed. Stopping polling.");
        setCurrentStep("complete");
        setJobId(null);
      }
    },
    [
      // currentSuggestionIndex is now only used for displaying the *initial* text,
      // so the core update logic is independent of which suggestion is being viewed.
      currentSuggestionIndex,
      displayImageResults,
      replaceLastLoadingMessage,
      setCurrentStep,
      displaySuggestionSequentially,
      addMessage
    ],
  )

  usePolling<Job>(jobId, onPollingUpdate, {
    onPollingError: onPollingError,
  });

  const startGeneration = async () => {
    if (!chatData) {
      addMessage({
        type: "text",
        role: "ai",
        content: "Error: Chat data is missing. Please start over.",
      })
      return
    }

    console.log("[useGeneration | startGeneration] 🚀 Starting generation process with chatData:", chatData);

    setIsGenerating(true)
    setCurrentStep("generating")
    setPollingError(null)
    // --- Reset new state ---
    setCurrentJob(null);
    setSuggestions([]);
    setCurrentSuggestionIndex(0);
    displayedTextSuggestions.current.clear();
    displayedIntermediateImages.current.clear();
    displayedFinalImages.current.clear();
    jobStartTime.current = Date.now(); // Start the timer

    addMessage({
      type: "loading",
      role: "ai",
      loadingText: "Hold on—I'm putting together a killer look just for you!",
    })

    try {
      const startTime = Date.now();
      console.log(`[FE_PERF_LOG | startGeneration] API call initiated. Timestamp: ${startTime}`);
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
      });

      if (!response.ok) {
        let errorDetails = "An unknown error occurred.";
        const clonedResponse = response.clone();
        try {
          const errorJson = await response.json();
          errorDetails =
            errorJson.details || errorJson.error || JSON.stringify(errorJson);
        } catch (e) {
          // If the response is not JSON, use the text content from the cloned response
          errorDetails = await clonedResponse.text();
        }
        throw new Error(
          `Failed to start generation. Server responded with ${response.status}: ${errorDetails}`
        );
      }

      const result = await response.json();
      const endTime = Date.now();
      console.log(`[FE_PERF_LOG | startGeneration] API call successful. JobId received. Total time: ${endTime - startTime}ms.`);

      console.log("[useGeneration | startGeneration]  получили  получили jobId:", result.jobId, ". Triggering polling.");
      setJobId(result.jobId);
    } catch (error: any) {
      let errorMessage: string;
      const rawMessage = error.message || "An unexpected error occurred while starting the generation.";

      console.error("[useGeneration | startGeneration] 💥 Error during generation start:", rawMessage);

      // 🔍 改进：检查是否是友好的错误消息
      if (rawMessage.includes('我们的设计师团队暂时离开了一下')) {
        // 如果是我们设置的友好消息，提取实际的友好消息部分
        const friendlyMatch = rawMessage.match(/我们的设计师团队暂时离开了一下[^。]*。[^✨]*✨/);
        errorMessage = friendlyMatch ? friendlyMatch[0] : rawMessage;
      } else if (rawMessage.includes('503')) {
        // 针对 503 错误提供友好提示
        errorMessage = "服务暂时不可用，我们的团队正在努力恢复中～ ✨";
      } else {
        // 其他错误使用原有逻辑，但去掉冗余的技术信息
        errorMessage = rawMessage.includes('Failed to start generation. Server responded')
          ? rawMessage.split(': ').slice(1).join(': ') || "生成服务遇到了一些问题，请稍后再试"
          : rawMessage;
      }

      replaceLastLoadingMessage({
        type: "text",
        role: "ai",
        content: errorMessage,
      })
      setIsGenerating(false)
      setCurrentStep("error")
    }
  }

  // TODO: Implement this function to be called by UI buttons
  const selectSuggestion = async (index: number) => {
    if (!currentJob || !suggestions[index]) {
      console.warn(`[useGeneration | selectSuggestion] Cannot select suggestion ${index}. Job or suggestion missing.`);
      return;
    }

    console.log(`[useGeneration | selectSuggestion] 🕵️‍♀️ User selected suggestion index: ${index}`);
    setCurrentSuggestionIndex(index);

    // If the selected suggestion is 'pending', we need to start its image generation
    const selected = suggestions[index];
    if (selected.status === 'pending') {
      console.log(`[useGeneration | selectSuggestion] Suggestion ${index} is pending. Starting image generation...`);
      try {
        const response = await fetch('/api/generation/start-image-task', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ jobId: currentJob.jobId, suggestionIndex: index }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to start image task.');
        }

        console.log(`[useGeneration | selectSuggestion] Successfully triggered image generation for suggestion ${index}.`);
        // The polling mechanism will automatically pick up the status change to 'generating_images'
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        console.error(`[useGeneration | selectSuggestion] Error starting image task for suggestion ${index}:`, errorMessage);
        // Optionally, update the UI to show an error for this specific suggestion
        setSuggestions(prev => {
          const newSuggestions = [...prev];
          if (newSuggestions[index]) {
            newSuggestions[index].status = 'failed';
            newSuggestions[index].error = errorMessage;
          }
          return newSuggestions;
        });
      }
    }
  };

  return {
    isGenerating,
    jobId,
    pollingError,
    startGeneration,
    // --- Expose new state ---
    status: currentJob?.status,
    suggestions,
    currentSuggestionIndex,
    selectSuggestion,
    // Keep this for now for any components that might use it directly
    generationStatusText: "Legacy status - to be removed"
  }
}