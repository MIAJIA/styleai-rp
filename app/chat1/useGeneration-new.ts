import { useSession } from "next-auth/react"
import { ButtonAction, Message } from "./types"
import { ChatModeData } from "../chat/types"
import { SetStateAction, useState, useEffect, useRef } from "react"
import { getFileFromPreview } from "../chat/utils"
import { loadCompleteOnboardingData } from "@/lib/onboarding-storage"
import { stylePrompts } from "../chat/constants"
import { Job, Suggestion } from "@/lib/ai"
import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime"
import { sleep } from "@/lib/ai/utils"

const steps = [
  { current: 0, total: 5, status: 'pending' as const, message: 'Initializing...' },
  { current: 1, total: 5, status: 'processing' as const, message: 'Analyzing image...' },
  { current: 2, total: 5, status: 'processing' as const, message: 'Generating style...' },
  { current: 3, total: 5, status: 'processing' as const, message: 'Creating outfit...' },
  { current: 4, total: 5, status: 'processing' as const, message: 'Finalizing...' },
  { current: 5, total: 5, status: 'completed' as const, message: 'Complete!' }
]

export function useGeneration(chatData: ChatModeData, addMessage: (message: Message) => void, router: string[] | AppRouterInstance) {
  const jobIdRef = useRef<string | null>(null)
  const suggestionIndexRef = useRef<number>(0)
  const sseReaderRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)

  const updateMessageProgress = (progress: { current: number; total: number; status: 'pending' | 'processing' | 'completed' | 'error'; message?: string }) => {
    addMessage({
      id: 'job-processing',
      content: "Just 1-2 mins to style magic ... !!!   ",
      sender: 'ai',
      progress, timestamp: new Date()
    })
  }

  const handleSuggestion = (styleSuggestion: any) => {
    if (!styleSuggestion || !styleSuggestion.outfit_suggestion) {
      const message2: Message = {
        id: 'job-error',
        content: "I couldn't come up with a specific outfit suggestion, but I'll generate an image based on the overall style idea!",
        sender: 'ai',
        timestamp: new Date(),
      }
      const message1: Message = {
        id: 'job-start',
        content: "",
        sender: 'ai',
        timestamp: new Date(),
      }
      addMessage(message1)
      addMessage(message2)
      return ""
    }

    const outfit = styleSuggestion.outfit_suggestion
    const outfitDescription = outfit.explanation || outfit.style_summary || "A stylish outfit designed for you."

    const sections: string[] = []
    const item = outfit.items

    // Helper function to safely get style details
    const getStyleDetails = (item: any): string => {
      if (Array.isArray(item)) {
        return item.map(i => i.item_name || i.name || 'Unknown item').join(', ')
      } else if (item && typeof item === 'object') {
        return item.item_name || item.name || 'Unknown item'
      }
      return 'Unknown item'
    }

    if (item.tops) {
      const topsDetails = getStyleDetails(item.tops)
      if (topsDetails) {
        sections.push(`Tops: ${topsDetails}`)
      }
    }
    if (item.bottoms) {
      const bottomsDetails = getStyleDetails(item.bottoms)
      if (bottomsDetails) {
        sections.push(`Bottoms: ${bottomsDetails}`)
      }
    }
    if (item.shoes) {
      const shoesDetails = getStyleDetails(item.shoes)
      if (shoesDetails) {
        sections.push(`Shoes: ${shoesDetails}`)
      }
    }
    if (item.accessories) {
      const accessoriesDetails = getStyleDetails(item.accessories)
      if (accessoriesDetails) {
        sections.push(`Accessories: ${accessoriesDetails}`)
      }
    }
    const content = sections.join("\n")
    return `${outfitDescription}\n\n${content}`
  }


  // 关闭SSE连接
  const closeSSE = () => {
    if (sseReaderRef.current) {
      console.log("[useGeneration | closeSSE] Closing SSE connection");
      try {
        sseReaderRef.current.cancel();
      } catch (error) {
        console.warn("[useGeneration | closeSSE] Error canceling reader:", error);
      }
      sseReaderRef.current = null;
    }
  };

  // 检查SSE连接状态
  const isSSEOpen = () => {
    return sseReaderRef.current !== null;
  };

  // 开始SSE连接
  const startSSE = async (formData: FormData) => {
    try {
      console.log("[useGeneration | startSSE] Starting SSE connection");

      // 先关闭现有连接
      closeSSE();

      const response = await fetch("/api/generation/new", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // 检查响应类型
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/event-stream')) {
        // SSE响应，开始读取流
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('No response body');
        }

        // 保存reader引用以便后续关闭
        sseReaderRef.current = reader;
        let message: Message = {
          id: 'job-start',
          content: "",
          sender: 'ai',
          timestamp: new Date(),
        };
        // 读取SSE流
        try {
          while (isSSEOpen()) {
            const { done, value } = await reader.read();

            if (done) {
              console.log("[useGeneration | SSE] Stream ended");
              break;
            }

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  console.log("[useGeneration | SSE] Received event:", data);

                  if (data.type === 'create_job_success') {
                    jobIdRef.current = data.message
                    updateMessageProgress(steps[1])
                  } else if (data.type === 'api_style_suggestion_success') {
                    message = {
                      id: `job-${jobIdRef.current}-style-suggestion-${suggestionIndexRef.current}`,
                      content: handleSuggestion(data.message),
                      sender: 'ai',
                      timestamp: new Date(),
                      isSaveDB: true
                    }
                    addMessage(message)
                    updateMessageProgress(steps[2])
                  } else if (data.type === 'api_stylization_success') {
                    message.imageUrls = [data.message]
                    message.timestamp = new Date()
                    addMessage(message)
                    updateMessageProgress(steps[3])
                  } else if (data.type === 'api_tryon_success') {
                    message.imageUrls?.push(data.message)
                    if (suggestionIndexRef.current == 0) {
                      message.buttons = [
                        {
                          id: `btn-${suggestionIndexRef.current}-more`,
                          label: 'Yes,one more outfit',
                          type: 'default',
                          action: 'Generation-image',
                          jobId: jobIdRef.current || "",
                          suggestionIndex: suggestionIndexRef.current,
                        },
                        {
                          id: `btn-${suggestionIndexRef.current}-update`,
                          label: 'Try others',
                          type: 'white',
                          action: 'Update-Profile',
                        }
                      ]
                    } else {
                      message.buttons = [
                        {
                          id: `btn-${suggestionIndexRef.current}-update`,
                          label: 'Try others',
                          type: 'white',
                          action: 'Update-Profile',
                        }
                      ]
                    }
                    message.timestamp = new Date()
                    message.mustSaveDB = true
                    addMessage(message)
                    updateMessageProgress(steps[5])
                    // 任务完成，关闭SSE连接
                    closeSSE();
                    return;
                  } else if (data.type === 'error') {
                    console.error("[useGeneration | SSE] Error:", data.message);
                    closeSSE();
                    throw new Error(data.message);
                  }
                } catch (e) {
                  console.error('Failed to parse SSE data:', e);
                }
              }
            }
          }
        } catch (error) {
          console.error("[useGeneration | SSE] Error reading stream:", error);
          closeSSE();
          throw error;
        } finally {
          // 确保连接被关闭
          if (isSSEOpen()) {
            closeSSE();
          }
        }
      } else {
        const result = await response.json();
        console.log("[useGeneration | startGeneration] Received jobId:", result.jobId);
      }

    } catch (error) {
      console.error("[useGeneration | startSSE] Error:", error);
      closeSSE();
      throw error;
    }
  };

  // 开始生成jobid  
  const startGeneration = async () => {
    if (!chatData) {
      const message: Message = {
        id: 'error',
        content: "Error: Chat data is missing. Please start over.",
        sender: 'ai',
        timestamp: new Date(),
      }
      addMessage(message)
      return
    }

    const message: Message = {
      id: 'start-generation',
      content: "Welcome! I see you've provided your images and occasion. Ready to see your personalized style?",
      sender: 'ai',
      timestamp: new Date(),
    }
    addMessage(message)
    const message1: Message = {
      id: 'job-start',
      content: "Hold on—I'm putting together a killer look just for you!",
      sender: 'ai',
      timestamp: new Date(),
    }
    addMessage(message1)

    updateMessageProgress(steps[0])
    const startTime = Date.now();
    const selfieFile = await getFileFromPreview(chatData.selfiePreview, "user_selfie.jpg")
    const clothingFile = await getFileFromPreview(chatData.clothingPreview, "user_clothing.jpg")
    if (!selfieFile || !clothingFile) {
      throw new Error("Could not prepare image files for upload.")
    }

    try {
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

      // 使用SSE连接
      await startSSE(formData);
      const endTime = Date.now();
      console.log(`[FE_PERF_LOG | startGeneration] SSE connection successful. Total time: ${endTime - startTime}ms.`);

    } catch (error: any) {
      const errorMessage =
        error.message || "An unexpected error occurred while starting the generation."
      console.error("[useGeneration | startGeneration] 💥 Error during generation start:", errorMessage)
      console.error("[useGeneration | startGeneration] 💥 Full error object:", error)
      // 删除旧信息
      const message: Message = {
        id: 'job-processing',
        content: "",
        sender: 'ai',
        timestamp: new Date(),
      }
      const message1: Message = {
        id: 'job-start',
        content: "",
        sender: 'ai',
        timestamp: new Date(),
      }
      const message2: Message = {
        id: 'job-error',
        content: `Sorry, something went wrong: ${errorMessage}`,
        sender: 'ai',
        timestamp: new Date(),
      }
      addMessage(message)
      addMessage(message1)
      addMessage(message2)
      const initialMessage: Message = {
        id: 'start-generation',
        content: "Welcome! I see you've provided your images and occasion. Ready to see your personalized style?",
        sender: 'ai',
        timestamp: new Date(),
        buttons: [
          {
            id: 'btn1',
            label: 'Start Generation',
            type: 'default',
            action: 'Start-Generation',
          }
        ]
      }
      addMessage(initialMessage)
    }
  }

  const generationImage = async (index: number) => {
    console.log("[useGeneration | generationImage] Generation image")

    try {
      if (jobIdRef.current) {
        addMessage({
          id: 'job-processing',
          content: "",
          sender: 'ai',
          timestamp: new Date()
        })
        const message: Message = {
          id: `job-${jobIdRef.current}-0`,
          content: '',
          sender: 'ai',
          timestamp: new Date(),
        }
        addMessage(message)
        const startTime = Date.now();
        const formData = new FormData()
        formData.append("job_id", jobIdRef.current)
        formData.append("suggestion_index", index.toString())
        await startSSE(formData);
        const endTime = Date.now();
        console.log(`[FE_PERF_LOG | startGeneration] SSE connection successful. Total time: ${endTime - startTime}ms.`);

      } else {
        console.error("[useGeneration | generationImage] Error: jobId is null");
      }
    } catch (error) {
      console.error("[useGeneration | generationImage] Error:", error);
    }
  }

  // 清理SSE连接
  useEffect(() => {
    return () => {
      closeSSE();
    };
  }, []);

  const handleButtonAction = (action: ButtonAction, message: Message): void => {
    switch (action.action) {
      case 'Start-Generation':
        startGeneration()
        break
      case 'Generation-image':
        suggestionIndexRef.current = 1
        jobIdRef.current = action.jobId || ""
        generationImage(1)

        message.buttons?.shift()
        message.mustSaveDB = true
        addMessage(message)
        break
      case 'Update-Profile':
        router.push('/')
        break
      default:
        break
    }
  }
  return { handleButtonAction }
}

