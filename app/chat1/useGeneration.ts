import { useSession } from "next-auth/react"
import { ButtonAction, Message } from "./types"
import { ChatModeData } from "../chat/types"
import { SetStateAction, useState, useEffect, useRef } from "react"
import { getFileFromPreview } from "../chat/utils"
import { loadCompleteOnboardingData } from "@/lib/onboarding-storage"
import { stylePrompts } from "../chat/constants"
import { Job } from "@/lib/ai"
import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime"


export function useGeneration(chatData: ChatModeData, addMessage: (message: Message) => void, router: string[] | AppRouterInstance) {
  const [jobId, setJobId] = useState<string | null>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastDataRef = useRef<Job | null>(null);
  const consecutiveFailsRef = useRef<number>(0);
  const [isPolling, setIsPolling] = useState(false)
  const [isGenerate, setGenerate] = useState(false)
  const [currentSuggestionIndex, setCurrentSuggestionIndex] = useState(0)
  // 处理 job 更新
  const handleJobUpdate = (jobData: Job) => {
    const suggestions = jobData.suggestions
    const message1: Message = {
      id: 'job-start',
      content: "",
      sender: 'ai',
      timestamp: new Date(),
    }

    for (let index = 0; index < suggestions.length - 1; index++) {
      const suggestion = suggestions[index];
      if (suggestion.status === 'succeeded' || suggestion.status === 'generating_images') {
        console.log(`[useGeneration | handleJobUpdate] 📡 Suggestion ${suggestion.index} succeeded`);
        addMessage(message1)
        const styleSuggestion = suggestion.styleSuggestion
        if (!styleSuggestion || !styleSuggestion.outfit_suggestion) {
          const message2: Message = {
            id: 'job-error',
            content: "I couldn't come up with a specific outfit suggestion, but I'll generate an image based on the overall style idea!",
            sender: 'ai',
            timestamp: new Date(),
          }
          addMessage(message1)
          addMessage(message2)
          break
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
        // Helper function to safely get style details
        const getImageUrls = (item: any): string[] => {
          if (Array.isArray(item)) {
            return item.map(i => i.intermediateImageUrls)
          } else if (item && typeof item === 'object') {
            return item.intermediateImageUrls
          }
          return []
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

        let buttons: ButtonAction[] = []
        let imageUrls = getImageUrls(suggestion)
        if (imageUrls && imageUrls.length > 0) {
          imageUrls = [imageUrls[0], imageUrls[0]]
        } else {
          imageUrls = ["wait", "wait"]
        }
        // 发送第一个建议
        const message2: Message = {
          id: `job-style-suggestion-${index}`,
          content: `${outfitDescription}\n\n${content}`,
          sender: 'ai',
          timestamp: new Date(),
          buttons: buttons,
          imageUrls: imageUrls
        }
        addMessage(message2)




        // 发送后续建议
        let buttons2: ButtonAction[] = []

        if (index == 0 && !isGenerate) {
          buttons2.push({
            id: `btn-${index}-more`,
            label: 'yes,one more outfit',
            type: 'default',
            action: 'Generation-image',
          })
        }

        buttons2.push({
          id: `btn-${index}-update`,
          label: 'Update Profile',
          type: 'destructive',
          action: 'Update-Profile',
        })
        const message3: Message = {
          id: `job-${jobId}-${index}`,
          content: 'How do you like this outfit? Would you like to generate another one for this item?',
          sender: 'ai',
          timestamp: new Date(),
          buttons: buttons2,
        }

        if (index == 0 && !isGenerate) {
          addMessage(message3)
        }
        
        if (index == 1 && isGenerate) {
          addMessage(message3)
        }


        if (imageUrls[0] === "wait" || imageUrls[1] === "wait") {
          throw new Error(`imageUrls is null`)
        }
      }
    }
    stopPolling()
    return

    // throw new Error(`jobData error ${JSON.stringify(jobData)}`)
  }

  // 轮询获取 job 状态
  const pollJobStatus = async (jobId: string) => {
    try {
      // 创建 AbortController 用于超时控制
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 10000 * 10); // 增加到10秒超时，避免过早中断

      const response = await fetch(`/api/generation/status?jobId=${jobId}`, {
        signal: controller.signal
      });

      clearTimeout(timeoutId); // 清除超时定时器

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }


      const data = await response.json() as Job;

      // 🔍 FIX: 简单的数据变化检测，减少不必要的更新 
      const dataString = JSON.stringify(data);
      const lastDataString = lastDataRef.current ? JSON.stringify(lastDataRef.current) : null;
      if (dataString !== lastDataString) {
        console.log(`[usePolling] 📡 Data changed, triggering update for job ${jobId?.slice(-8)}`);
        lastDataRef.current = data;
        handleJobUpdate(data);
      }

    } catch (error) {
      console.error("[useGeneration | pollJobStatus] Error:", error)
      lastDataRef.current = null;
      // 错误处理：可以选择重试或停止轮询
      // 增加连续失败计数
      consecutiveFailsRef.current += 1;
      if (consecutiveFailsRef.current >= 20) {
        consecutiveFailsRef.current = 0;
        stopPolling()
      } else {
        await new Promise(resolve => setTimeout(resolve, 5000));
        pollingIntervalRef.current = setTimeout(() => {
          pollJobStatus(jobId)
        }, 1000)
      }
    }
  }


  // 开始轮询
  const startPolling = (jobId: string) => {
    consecutiveFailsRef.current = 0;
    lastDataRef.current = null;
    console.log("[useGeneration | startPolling] Starting polling for job:", jobId)
    // 立即执行一次
    pollJobStatus(jobId)

  }

  // 停止轮询
  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearTimeout(pollingIntervalRef.current)
      pollingIntervalRef.current = null
      setIsPolling(false)
    }
    console.log("[useGeneration | stopPolling] Polling stopped")
  }

  // // 清理轮询
  // useEffect(() => {
  //   return () => {
  //     stopPolling()
  //   }
  // }, [])

  // 当 jobId 变化时开始轮询
  useEffect(() => {
    if (jobId && isPolling) {
      startPolling(jobId)
    }
  }, [jobId])

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
      setIsPolling(true)
      setJobId(result.jobId);
    } catch (error: any) {
      const errorMessage =
        error.message || "An unexpected error occurred while starting the generation."
      console.error("[useGeneration | startGeneration] 💥 Error during generation start:", errorMessage)
      console.error("[useGeneration | startGeneration] 💥 Full error object:", error)
      // 删除旧信息
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
    setCurrentSuggestionIndex(index);
    try {
      const response = await fetch('/api/generation/start-image-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobId: jobId, suggestionIndex: index }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      const data = await response.json() as Job;
      console.log("[useGeneration | generationImage] Generation image data:", data);
      if (jobId) {
        const message: Message = {
          id: `job-${jobId}-0`,
          content: '',
          sender: 'ai',
          timestamp: new Date(),
        }
        addMessage(message)

        setIsPolling(true)
        startPolling(jobId);
        setGenerate(true)
      } else {
        console.error("[useGeneration | generationImage] Error: jobId is null");
      }
    } catch (error) {
      console.error("[useGeneration | generationImage] Error:", error);
    }
  }

  const handleButtonAction = (action: ButtonAction, message: Message): void => {
    switch (action.action) {
      case 'Start-Generation':
        setGenerate(false)
        startGeneration()
        break
      case 'Generation-image':
        generationImage(1)
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
