import { useSession } from "next-auth/react"
import { ButtonAction, Message } from "./types"
import { ChatModeData } from "../chat/types"
import { SetStateAction, useState, useEffect, useRef } from "react"
import { getFileFromPreview } from "../chat/utils"
import { loadCompleteOnboardingData } from "@/lib/onboarding-storage"
import { stylePrompts } from "../chat/constants"
import { Job } from "@/lib/ai"
import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime"
import { sleep } from "@/lib/ai/utils"
import { upload } from '@vercel/blob/client';

const steps = [
  { current: 0, total: 5, status: 'pending' as const, message: 'Initializing...' },
  { current: 1, total: 5, status: 'processing' as const, message: 'Analyzing image...' },
  { current: 2, total: 5, status: 'processing' as const, message: 'Generating style...' },
  { current: 3, total: 5, status: 'processing' as const, message: 'Creating outfit...' },
  { current: 4, total: 5, status: 'processing' as const, message: 'Finalizing...' },
  { current: 5, total: 5, status: 'completed' as const, message: 'Complete!' }
]

export function useGeneration(chatData: ChatModeData, addMessage: (message: Message) => void, router: string[] | AppRouterInstance,userId:string) {
  const [jobId, setJobId] = useState<string | null>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastDataRef = useRef<Job | null>(null);
  const consecutiveFailsRef = useRef<number>(0);
  const [isPolling, setIsPolling] = useState(false)
  const [isGenerate, setGenerate] = useState(false)
  const [currentSuggestionIndex, setCurrentSuggestionIndex] = useState(0)

  const updateMessageProgress = (progress: { current: number; total: number; status: 'pending' | 'processing' | 'completed' | 'error'; message?: string }) => {


    addMessage({
      id: 'job-processing',
      content: "Just 1-2 mins to style magic ... !!!   ",
      sender: 'ai',
      progress, timestamp: new Date()
    })

  }
  // 处理 job 更新
  const handleJobUpdate = (jobData: Job) => {
    const suggestions = jobData.suggestions
    const message1: Message = {
      id: 'job-start',
      content: "",
      sender: 'ai',
      timestamp: new Date(),
    }

    // for (let index = 0; index < suggestions.length; index++) {
    const index = currentSuggestionIndex;
    const suggestion = suggestions[index];
    if (suggestion.status !== 'pending') {
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
        return true
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
      // // Helper function to safely get style details
      // const getImageUrls = (item: any): string[] => {
      //   if (Array.isArray(item)) {
      //     return item.map(i => i.imageUrls)
      //   } else if (item && typeof item === 'object') {
      //     return item.intermediateImageUrls
      //   }
      //   return []
      // }

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
      if (item.bag) {
        const bagDetails = getStyleDetails(item.bag)
        if (bagDetails) {
          sections.push(`Bag: ${bagDetails}`)
        }
      }

      const content = sections.join("\n")
      let contents = `${outfitDescription}\n\n${content}`

      let buttons: ButtonAction[] = []
      let images = ["wait"]

      //  处理失败不显示图片
      if (suggestion.status == 'failed') {
        images = []
        contents = contents + "\n\n\n\n" + suggestion.error
      } else if (suggestion.tryOnImageUrls||suggestion.stylizedImageUrls) {
        if (suggestion.stylizedImageUrls && suggestion.stylizedImageUrls.length > 0) {
            // images[0] = suggestion.stylizedImageUrls
            // images[0]="error"
        }
        if (suggestion.tryOnImageUrls && suggestion.tryOnImageUrls.length > 0) {
            images[0] = suggestion.tryOnImageUrls
        }
      }

      // 发送后续建议
      let buttons2: ButtonAction[] = []

      // 修正: 正确判断 jobData.status 是否为 "failed"
      if (suggestion.status !== 'failed') {
        if (images[0] === "wait") {
          updateMessageProgress(steps[3])
          sleep(1000)
          // 发送第一个建议
          const message2: Message = {
            id: `job-${jobId}-style-suggestion-${index}`,
            content: contents,
            sender: 'ai',
            timestamp: new Date(),
            buttons: buttons,
            imageUrls: images,
            isSaveDB: true
          }

          addMessage(message2)
          return false
        }
      }
      updateMessageProgress(steps[5])
      sleep(1000)
      const message2: Message = {
        id: `job-${jobId}-style-suggestion-${index}`,
        content: contents,
        sender: 'ai',
        timestamp: new Date(),
        buttons: buttons,
        imageUrls: images,
        isSaveDB: true,
        mustSaveDB: true
      }
      addMessage(message2)

      if (index == currentSuggestionIndex) {
        if (currentSuggestionIndex == 0 && suggestion.status == 'succeeded') {
          buttons2.push({
            id: `btn-${index}-more`,
            label: 'Yes,one more outfit',
            type: 'default',
            action: 'Generation-image',
            jobId: jobId || "",
            suggestionIndex: index,
          })
        }
        buttons2.push({
          id: `btn-${index}-update`,
          label: 'Try others',
          type: 'white',
          action: 'Update-Profile',
        })
        const message3: Message = {
          id: `job-${jobId}-more`,
          content: 'How do you like this outfit? Would you like to generate another one for this item?',
          sender: 'ai',
          timestamp: new Date(),
          buttons: buttons2,
        }
        addMessage(message3)
        // } else {
        //   const message3: Message = {
        //     id: `job-${jobId}-more`,
        //     content: '',
        //     sender: 'ai',
        //     timestamp: new Date(),
        //     buttons: buttons2,
        //   }
        //   addMessage(message3)
      }
    }
    // }

    return true

    // throw new Error(`jobData error ${JSON.stringify(jobData)}`)
  }

  // 轮询获取 job 状态
  const pollJobStatus = async (jobId: string) => {
    try {
      // 创建 AbortController 用于超时控制
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 1000 * 13 * 2); // 增加到10秒超时，避免过早中断

      const response = await fetch(`/api/generation/status?jobId=${jobId}&suggestionIndex=${currentSuggestionIndex}`, {
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
        const isSucceed = handleJobUpdate(data);
        if (isSucceed) {
          stopPolling()
        } else {
          throw new Error(`Get Job result is Failed`)
        }
      }

    } catch (error) {
      // console.error("[useGeneration | pollJobStatus] Error:", error)
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
    }
    setIsPolling(false)
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
  }, [jobId, currentSuggestionIndex])

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
    const selfieFile = await getFileFromPreview(chatData.selfiePreview, `${userId}_user_selfie.jpg`)
    const clothingFile = await getFileFromPreview(chatData.clothingPreview, `${userId}_user_clothing.jpg`)
    if (!selfieFile || !clothingFile) {
      throw new Error("Could not prepare image files for upload.")
    }

    try {
      // 直接使用 FormData，新接口会处理上传
      const formData = new FormData();
      formData.append("human_image", selfieFile);
      formData.append("garment_image", clothingFile);
      formData.append("occasion", chatData.occasion);
      formData.append("generation_mode", chatData.generationMode);
      
      const onboardingData = loadCompleteOnboardingData();
      if (onboardingData) {
        formData.append("user_profile", JSON.stringify(onboardingData));
      }
      
      if (chatData.customPrompt && chatData.customPrompt.trim()) {
        formData.append("custom_prompt", chatData.customPrompt.trim());
      }
      if (stylePrompts[chatData.occasion as keyof typeof stylePrompts]) {
        formData.append("style_prompt", stylePrompts[chatData.occasion as keyof typeof stylePrompts]);
      }
      
      // 添加 provider 参数支持 Gemini
      formData.append("generation_provider", "gemini");

      const response = await fetch("/api/generation/new", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        let errorDetails = "An unknown error occurred.";
        const clonedResponse = response.clone();
        try {
          const errorJson = await response.json();
          errorDetails = errorJson.details || errorJson.error || JSON.stringify(errorJson);
        } catch (e) {
          errorDetails = await clonedResponse.text();
        }
        throw new Error(`Failed to start generation. Server responded with ${response.status}: ${errorDetails}`);
      }

      const result = await response.json();
      const endTime = Date.now();
      console.log(`[FE_PERF_LOG | startGeneration] API call successful. Elapsed: ${endTime - startTime}ms.`);
      console.log(`[FE_PERF_LOG | startGeneration] Job ID received: ${result.jobId}`);

      setJobId(result.jobId);
      setCurrentSuggestionIndex(0);
      setIsPolling(true);
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
        addMessage({
          id: 'job-processing',
          content: "",
          sender: 'ai',
          timestamp: new Date()
        })
        const message: Message = {
          id: `job-${jobId}-0`,
          content: '',
          sender: 'ai',
          timestamp: new Date(),
        }
        addMessage(message)
        // handleJobUpdate
        setIsPolling(true)
        setCurrentSuggestionIndex(index);
        // startPolling(jobId);
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

