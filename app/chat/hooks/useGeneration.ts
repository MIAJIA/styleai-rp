import { useState, useCallback, useRef, useEffect } from "react"
import { usePolling } from "./usePolling"
import { generateUniqueId, getFileFromPreview } from "../utils"
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
  setCurrentStep: (step: "suggestion" | "generating" | "complete" | "error") => void,
  setMessages: (messages: ChatMessage[]) => void
}

export function useGeneration({
  chatData,
  addMessage,
  replaceLastLoadingMessage,
  displaySuggestionSequentially,
  displayImageResults,
  setCurrentStep,
  setMessages
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
  // 🔧 NEW: Ref for managing recovery timeout
  const recoveryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Use refs to track which results have been displayed to avoid re-rendering
  const displayedTextSuggestions = useRef(new Set<number>());
  const displayedIntermediateImages = useRef(new Set<number>());
  const displayedFinalImages = useRef(new Set<number>()); // <-- NEW: For final images

  const onPollingError = useCallback(
    (error: Error) => {
      console.error("[useGeneration | onPollingError] Polling failed:", error)
      const errorMessage = `Opps... something went wrong. Polling failed with status: ${error.message.replace('Polling failed with status: ', '')}`;
      setPollingError(errorMessage);
      
      // 🔧 FIX: 不要立即显示错误UI，而是等待一段时间看系统是否能恢复
      // 只有在确实无法恢复时才显示错误消息
      console.warn("[useGeneration | onPollingError] ⚠️ Polling failed, but not immediately showing error UI. System may recover.");
      
      // 清除之前的recovery timeout（如果存在）
      if (recoveryTimeoutRef.current) {
        clearTimeout(recoveryTimeoutRef.current);
        recoveryTimeoutRef.current = null;
      }
      
      // 给系统一个恢复的机会 - 如果30秒后仍然没有成功，再显示错误
      recoveryTimeoutRef.current = setTimeout(() => {
        // 检查系统是否已经恢复（通过检查是否有成功的job数据）
        if (!currentJob || !currentJob.suggestions.some(s => s.status === 'succeeded' || s.status === 'generating_images')) {
          console.error("[useGeneration | onPollingError] System failed to recover. Showing error UI.");
          
          // 用 replaceLastLoadingMessage 而不是 setMessages 来避免清除所有消息
          replaceLastLoadingMessage({
            type: "quick-reply",
            role: "ai",
            content: "Sorry, something went wrong with the generation. Would you like to try again?",
            actions: [
              {
                id: "start-generation-btn",
                label: "retry-generation",
                type: "retry-start-generation",
              },
            ],
          });
          setCurrentStep("error");
        } else {
          console.log("[useGeneration | onPollingError] ✅ System recovered successfully. No error UI needed.");
        }
        recoveryTimeoutRef.current = null; // 清除引用
      }, 30000); // 30秒恢复超时
      
      // setJobId(null) // Clear the job ID to allow restart
    },
    [replaceLastLoadingMessage, setCurrentStep, currentJob],
  )

  const onPollingUpdate = useCallback(
    (job: Job) => {
      console.log(`[useGeneration | onPollingUpdate] 🎯 Received job update for ID: ${job.jobId}`, job);

      // 🔧 FIX: 清除recovery timeout，因为我们收到了成功的数据更新，说明系统已经恢复
      if (recoveryTimeoutRef.current) {
        console.log("[useGeneration | onPollingUpdate] ✅ System recovered - clearing recovery timeout");
        clearTimeout(recoveryTimeoutRef.current);
        recoveryTimeoutRef.current = null;
        // 重置轮询错误状态
        setPollingError(null);
      }

      // 🔍 DEBUG: 详细检查每个suggestion的中间图片状态
      console.log(`[useGeneration | DEBUG] 🕵️ Checking all suggestions for intermediate images:`);
      job.suggestions.forEach((suggestion, idx) => {
        console.log(`[useGeneration | DEBUG] 📋 Suggestion ${idx}:`, {
          status: suggestion.status,
          hasIntermediateImages: !!(suggestion.intermediateImageUrls && suggestion.intermediateImageUrls.length > 0),
          intermediateCount: suggestion.intermediateImageUrls?.length || 0,
          hasFinalImages: !!(suggestion.imageUrls && suggestion.imageUrls.length > 0),
          finalCount: suggestion.imageUrls?.length || 0,
        });
        if (suggestion.intermediateImageUrls && suggestion.intermediateImageUrls.length > 0) {
          console.log(`[useGeneration | DEBUG] 🖼️ Intermediate URLs for suggestion ${idx}:`,
            suggestion.intermediateImageUrls.map(url => url.substring(0, 100) + '...'));
        }
      });

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

          // 🔧 FIX: 放宽显示条件 - 对于single suggestion模式或当前选中的suggestion都显示
          const shouldDisplayIntermediate =
            job.suggestions.length === 1 || // Single suggestion模式（如simple-scene），直接显示
            index === currentSuggestionIndex; // Multi suggestion模式，只显示当前选中的

          if (shouldDisplayIntermediate) {
            console.log(`[useGeneration] Displaying INTERMEDIATE images for suggestion ${index} for the first time.`);
            console.log(`[useGeneration] 📊 Display logic: suggestions.length=${job.suggestions.length}, currentIndex=${currentSuggestionIndex}, targetIndex=${index}`);

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
              content: job.suggestions.length === 1
                ? `✨ Here's your scene preview, working on final details...`
                : `✨ Here's the scene preview for outfit ${index + 1}, working on final details...`
            });
            addMessage({
              type: "loading" as const,
              role: "ai" as const,
              loadingText: `Finalizing your look...`,
              metadata: { isImagePlaceholder: true },
            });
            displayedIntermediateImages.current.add(index);
          } else {
            console.log(`[useGeneration] ⏸️ Skipping intermediate images for suggestion ${index} (not current: ${currentSuggestionIndex})`);
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
            content: job.suggestions.length === 1
              ? `🎉 Here's your final outfit recommendation!`
              : `🎉 Here's your outfit recommendation ${index + 1}!`,
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
            content: `✅ Task ${index + 1} completed, but no images were generated.`,
          });
          displayedFinalImages.current.add(index);
        }

        // Handle failure for any failed suggestion
        if (
          status === 'failed' &&
          !displayedFinalImages.current.has(index)
        ) {
          console.error(`[useGeneration | onPollingUpdate] ❌ Suggestion ${index} failed:`, error);
          
          // 💡 NEW (Scalable): Directly use the error message from the backend 
          // as the single source of truth.
          const errorMessage = error || "An unknown error occurred. Please try again.";

          // Always provide a retry mechanism for any failure.
          replaceLastLoadingMessage({
            role: "ai",
            type: "quick-reply",
            content: errorMessage, // Display the exact error from the backend.
            actions: [
              {
                id: `retry-failed-suggestion-${index}`,
                label: "Retry Generation",
                type: "retry-start-generation",
              },
            ],
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
      addMessage,
      setPollingError // Added setPollingError to the dependency array
    ],
  )

  usePolling<Job>(jobId, onPollingUpdate, {
    onPollingError: onPollingError,
  });

  // 🔧 FIX: 组件卸载时清理recovery timeout
  useEffect(() => {
    return () => {
      if (recoveryTimeoutRef.current) {
        clearTimeout(recoveryTimeoutRef.current);
        recoveryTimeoutRef.current = null;
      }
    };
  }, []);

  const restartGeneration = async () => {
    if (!chatData) {
      addMessage({
        type: "text",
        role: "ai",
        content: "Error: Chat data is missing. Please start over.",
      })
      return
    }

    console.log("[useGeneration | restartGeneration] 🚀 Starting generation process with chatData:", chatData);

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
    
    // 🔧 FIX: 清除任何现有的recovery timeout
    if (recoveryTimeoutRef.current) {
      clearTimeout(recoveryTimeoutRef.current);
      recoveryTimeoutRef.current = null;
    }

    addMessage({
      type: "loading",
      role: "ai",
      loadingText: "Hold on—I'm putting together a killer look just for you!",
    })

    try {
      const startTime = Date.now();
      console.log(`[FE_PERF_LOG | startGeneration] API call initiated. Timestamp: ${startTime}`);
      
      console.log(`[useGeneration | DEBUG] Preparing image files...`);
      const selfieFile = await getFileFromPreview(chatData.selfiePreview, "user_selfie.jpg")
      const clothingFile = await getFileFromPreview(chatData.clothingPreview, "user_clothing.jpg")
      if (!selfieFile || !clothingFile) {
        throw new Error("Could not prepare image files for upload.")
      }
      console.log(`[useGeneration | DEBUG] Image files prepared: selfie=${selfieFile.size}bytes, clothing=${clothingFile.size}bytes`);

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
      
      console.log(`[useGeneration | DEBUG] Sending request to /api/generation/start...`);
      const response = await fetch("/api/generation/start", {
        method: "POST",
        body: formData,
      });
      
      console.log(`[useGeneration | DEBUG] Response received: status=${response.status}, ok=${response.ok}`);

      if (!response.ok) {
        let errorDetails = "An unknown error occurred.";
        const clonedResponse = response.clone();
        try {
          const errorJson = await response.json();
          errorDetails = errorJson.details || errorJson.error || JSON.stringify(errorJson);
          console.log(`[useGeneration | DEBUG] Error response JSON:`, errorJson);
        } catch (e) {
          // If the response is not JSON, use the text content from the cloned response
          errorDetails = await clonedResponse.text();
          console.log(`[useGeneration | DEBUG] Error response text:`, errorDetails);
        }
        throw new Error(
          `Failed to start generation. Server responded with ${response.status}: ${errorDetails}`
        );
      }

      console.log(`[useGeneration | DEBUG] Parsing response JSON...`);
      const result = await response.json();
      const endTime = Date.now();
      console.log(`[FE_PERF_LOG | restartGeneration] API call successful. JobId received: ${result.jobId}. Total time: ${endTime - startTime}ms.`);

      console.log("[useGeneration | restartGeneration] получили jobId:", result.jobId, ". Triggering polling.");
      setJobId(result.jobId);
    } catch (error: any) {
      const errorMessage =
        error.message || "An unexpected error occurred while starting the generation."
      console.error("[useGeneration | startGeneration] 💥 Error during generation start:", errorMessage)
      console.error("[useGeneration | startGeneration] 💥 Full error object:", error)

      replaceLastLoadingMessage({
        type: "text",
        role: "ai",
        content: `Sorry, something went wrong: ${errorMessage}`,
      })
      setIsGenerating(false)
      setCurrentStep("error")
    }
  }
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

    // 🔧 FIX: 清除任何现有的recovery timeout
    if (recoveryTimeoutRef.current) {
      clearTimeout(recoveryTimeoutRef.current);
      recoveryTimeoutRef.current = null;
    }

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
      const errorMessage =
        error.message || "An unexpected error occurred while starting the generation."
      console.error("[useGeneration | startGeneration] 💥 Error during generation start:", errorMessage)

      replaceLastLoadingMessage({
        type: "text",
        role: "ai",
        content: `Sorry, something went wrong: ${errorMessage}`,
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
    restartGeneration,
    // --- Expose new state ---
    status: currentJob?.status,
    suggestions,
    currentSuggestionIndex,
    selectSuggestion,
    // Keep this for now for any components that might use it directly
    generationStatusText: "Legacy status - to be removed"
  }
}