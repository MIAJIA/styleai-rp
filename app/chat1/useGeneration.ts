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
    console.log(`[useGeneration | handleJobUpdate] 🔄 Processing job update:`, {
      jobId: jobData.jobId.slice(-8),
      status: jobData.status,
      suggestionsCount: jobData.suggestions.length
    })
    
    const suggestions = jobData.suggestions
    const message1: Message = {
      id: 'job-start',
      content: "",
      sender: 'ai',
      timestamp: new Date(),
    }

    // 检查是否有任何suggestion已完成
    let hasCompletedSuggestion = false
    
    for (let index = 0; index < suggestions.length; index++) {
      const suggestion = suggestions[index];
      console.log(`[useGeneration | handleJobUpdate] 📊 Suggestion ${suggestion.index} status:`, suggestion.status)
      
      if (suggestion.status === 'succeeded') {
        hasCompletedSuggestion = true
        console.log(`[useGeneration | handleJobUpdate] ✅ Suggestion ${suggestion.index} succeeded`);
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
          imageUrls = [imageUrls[0],imageUrls[0]]
        }else{
          throw new Error(`imageUrls is null`)
        }


        const message2: Message = {
          id: 'job-style-suggestion',
          content: `${outfitDescription}\n\n${content}`,
          sender: 'ai',
          timestamp: new Date(),
          buttons: buttons,
          imageUrls: imageUrls
        }
        addMessage(message2)

      


        let buttons2: ButtonAction[] = []
        buttons2.push({
          id: 'btn3',
          label: 'yes,one more outfit',
          type: 'default',
          action: 'Generation-image',
        })
        buttons2.push({
          id: 'btn4',
          label: 'Update Profile',
          type: 'destructive',
          action: 'Update-Profile',
        })
        const message3: Message = {
          id: `job-${jobId}`,
          content: 'How do you like this outfit? Would you like to generate another one for this item?',
          sender: 'ai',
          timestamp: new Date(),
          buttons: buttons2 ,
        }
        addMessage(message3)

        
        // if (isGenerate&& !imageUrls) {
        //   throw new Error(`imageUrls is null`)
        // }
        stopPolling()
        return
      } else if (suggestion.status === 'generating_images') {
        console.log(`[useGeneration | handleJobUpdate] 🎨 Suggestion ${suggestion.index} is generating images...`)
        // 继续轮询，不做任何操作
      } else if (suggestion.status === 'pending') {
        console.log(`[useGeneration | handleJobUpdate] ⏳ Suggestion ${suggestion.index} is pending...`)
        // 继续轮询，不做任何操作
      } else if (suggestion.status === 'failed') {
        console.log(`[useGeneration | handleJobUpdate] ❌ Suggestion ${suggestion.index} failed`)
        // 可以显示错误信息
      }
    }
    
    // 如果没有完成的suggestion，继续轮询
    if (!hasCompletedSuggestion) {
      console.log(`[useGeneration | handleJobUpdate] 🔄 No completed suggestions yet, continuing polling...`)
      return // 继续轮询，不抛出错误
    }
    
    // 如果到这里，说明有未处理的情况
    console.warn(`[useGeneration | handleJobUpdate] ⚠️ Unhandled job state:`, jobData)
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
    console.log("[useGeneration | useEffect] 🔄 JobId or polling state changed:", { jobId, isPolling })
    if (jobId && isPolling) {
      console.log("[useGeneration | useEffect] 🚀 Starting polling for jobId:", jobId)
      startPolling(jobId)
    } else {
      console.log("[useGeneration | useEffect] ❌ Not starting polling:", { 
        hasJobId: !!jobId, 
        isPolling 
      })
    }
  }, [jobId, isPolling])

  // 开始生成jobid  
  const startGeneration = async () => {
    console.log("[useGeneration | startGeneration] 🚀 Starting generation process...")
    console.log("[useGeneration | startGeneration] 📊 ChatData:", chatData)
    
    if (!chatData) {
      console.log("[useGeneration | startGeneration] ❌ No chatData found")
      const message: Message = {
        id: 'error',
        content: "Error: Chat data is missing. Please start over.",
        sender: 'ai',
        timestamp: new Date(),
      }
      addMessage(message)
      return
    }

    console.log("[useGeneration | startGeneration] ✅ ChatData validation passed")
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
    
    console.log("[useGeneration | startGeneration] 🖼️ Processing images...")
    console.log("[useGeneration | startGeneration] 📷 Selfie preview:", chatData.selfiePreview ? "exists" : "missing")
    console.log("[useGeneration | startGeneration] 👕 Clothing preview:", chatData.clothingPreview ? "exists" : "missing")
    
    const selfieFile = await getFileFromPreview(chatData.selfiePreview, "user_selfie.jpg")
    const clothingFile = await getFileFromPreview(chatData.clothingPreview, "user_clothing.jpg")
    
    console.log("[useGeneration | startGeneration] 📁 Selfie file:", selfieFile ? "created" : "failed")
    console.log("[useGeneration | startGeneration] 📁 Clothing file:", clothingFile ? "created" : "failed")
    
    if (!selfieFile || !clothingFile) {
      console.log("[useGeneration | startGeneration] ❌ File creation failed")
      throw new Error("Could not prepare image files for upload.")
    }

    console.log("[useGeneration | startGeneration] 🌐 Preparing API request...")
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

      console.log("[useGeneration | startGeneration] 📤 Sending API request to /api/generation/start...")
      console.log("[useGeneration | startGeneration] 📋 FormData contents:", {
        occasion: chatData.occasion,
        generationMode: chatData.generationMode,
        hasOnboardingData: !!onboardingData,
        hasCustomPrompt: !!(chatData.customPrompt && chatData.customPrompt.trim()),
        hasStylePrompt: !!stylePrompts[chatData.occasion as keyof typeof stylePrompts]
      })
      
      // Create AbortController for timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log("[useGeneration | startGeneration] ⏰ Request timeout after 3 minutes")
        controller.abort();
      }, 180000); // 3 minutes timeout
      
      const response = await fetch("/api/generation/start", {
        method: "POST",
        body: formData,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId); // Clear timeout if request completes
      console.log("[useGeneration | startGeneration] 📥 API response received:", response.status, response.statusText)
      
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

      console.log("[useGeneration | startGeneration] 🔄 Parsing response JSON...")
      const result = await response.json();
      console.log("[useGeneration | startGeneration] 📊 Response data:", result)
      
      const endTime = Date.now();
      console.log(`[FE_PERF_LOG | startGeneration] API call successful. JobId received. Total time: ${endTime - startTime}ms.`);

      console.log("[useGeneration | startGeneration] 🎯 JobId received:", result.jobId, ". Triggering polling.");
      console.log("[useGeneration | startGeneration] 🔄 Setting polling state...")
      setIsPolling(true)
      setJobId(result.jobId);
      console.log("[useGeneration | startGeneration] ✅ Generation process initiated successfully!")
      console.log("[useGeneration | startGeneration] 🔄 Polling should start now with jobId:", result.jobId)
    } catch (error: any) {
      const errorMessage = error.name === 'AbortError' 
        ? "Request timed out after 3 minutes. The generation process may still be running in the background."
        : error.message || "An unexpected error occurred while starting the generation."
      
      console.error("[useGeneration | startGeneration] 💥 Error during generation start:", errorMessage)
      console.error("[useGeneration | startGeneration] 💥 Full error object:", error)
      console.error("[useGeneration | startGeneration] 💥 Error type:", error.name)
      
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
          imageUrls: [
            '/casual-outfit.png',
            '/elegant-outfit.png'
          ],
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
    console.log("[useGeneration | handleButtonAction] 🎯 Button clicked:", action.action)
    console.log("[useGeneration | handleButtonAction] 📝 Action details:", action)
    console.log("[useGeneration | handleButtonAction] 💬 Message:", message.id)
    
    switch (action.action) {
      case 'Start-Generation':
        console.log("[useGeneration | handleButtonAction] 🚀 Calling startGeneration...")
        startGeneration()
        break
      case 'Generation-image':
        console.log("[useGeneration | handleButtonAction] 🖼️ Calling generationImage...")
        generationImage(0)
        break
      case 'Update-Profile':
        console.log("[useGeneration | handleButtonAction] 👤 Redirecting to profile...")
        router.push('/')
        break
      default:
        console.log("[useGeneration | handleButtonAction] ❓ Unknown action:", action.action)
        break
    }
  }
  return { handleButtonAction }
}

