"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import IOSTabBar from "../components/ios-tab-bar";
import ImageModal from "../components/image-modal";
import { ArrowLeft, Download, Share2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getChatWelcomeMessage,
  getChatConfirmationMessage,
  formatStyleSuggestion,
  getChatCompletionMessage,
} from "@/lib/prompts";

// 消息类型定义
type ChatMessage = {
  id: string;
  type: 'text' | 'image' | 'loading';
  role: 'ai' | 'user';
  content?: string;
  imageUrl?: string;
  loadingText?: string;
  timestamp: Date;
};

// 从主页传递的数据类型
type ChatModeData = {
  selfiePreview: string;
  clothingPreview: string;
  occasion: string;
  generationMode: "tryon-only" | "simple-scene" | "advanced-scene";
  selectedPersona: object | null;
  selfieFile: any;
  clothingFile: any;
  timestamp: number;
};

// AI 头像组件
function AIAvatar() {
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center flex-shrink-0">
      <span className="text-white text-sm">✨</span>
    </div>
  );
}

// 消息气泡组件
function ChatBubble({ message, onImageClick }: {
  message: ChatMessage;
  onImageClick: (imageUrl: string) => void;
}) {
  const isAI = message.role === 'ai';

  if (message.type === 'loading') {
    return (
      <div className="flex items-start gap-3 mb-4">
        <AIAvatar />
        <div className="bg-gray-100 rounded-2xl rounded-tl-md px-4 py-3 max-w-[80%]">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-pink-500" />
            <span className="text-sm text-gray-600">{message.loadingText || "AI正在思考中..."}</span>
          </div>
        </div>
      </div>
    );
  }

  if (message.type === 'text') {
    return (
      <div className={`flex items-start gap-3 mb-4 ${isAI ? '' : 'flex-row-reverse'}`}>
        {isAI ? (
          <AIAvatar />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-500 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm">👤</span>
          </div>
        )}
        <div className={`rounded-2xl px-4 py-3 max-w-[80%] shadow-sm border ${isAI
          ? 'bg-white rounded-tl-md border-gray-100'
          : 'bg-blue-500 text-white rounded-tr-md border-blue-500'
          }`}>
          <p className={`text-sm leading-relaxed whitespace-pre-line ${isAI ? 'text-gray-800' : 'text-white'
            }`}>{message.content}</p>
        </div>
      </div>
    );
  }

  if (message.type === 'image') {
    return (
      <div className={`flex items-start gap-3 mb-4 ${isAI ? '' : 'flex-row-reverse'}`}>
        {isAI ? (
          <AIAvatar />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-500 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm">👤</span>
          </div>
        )}
        <div className={`rounded-2xl p-2 max-w-[80%] shadow-sm border ${isAI
          ? 'bg-white rounded-tl-md border-gray-100'
          : 'bg-blue-50 rounded-tr-md border-blue-200'
          }`}>
          <img
            src={message.imageUrl}
            alt="Generated image"
            className="w-full rounded-xl cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => onImageClick(message.imageUrl!)}
          />
          {isAI && (
            <div className="flex gap-2 mt-2 px-2">
              <Button size="sm" variant="ghost" className="text-xs">
                <Download className="w-3 h-3 mr-1" />
                保存
              </Button>
              <Button size="sm" variant="ghost" className="text-xs">
                <Share2 className="w-3 h-3 mr-1" />
                分享
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState<'suggestion' | 'tryon' | 'scene' | 'complete'>('suggestion');
  const [messageIdCounter, setMessageIdCounter] = useState(0);
  const [chatData, setChatData] = useState<ChatModeData | null>(null);
  const [isInitialized, setIsInitialized] = useState(false); // 新增：防止重复初始化
  const [hasProcessedCompletion, setHasProcessedCompletion] = useState(false); // 新增：防止重复处理完成状态
  const processedStatusesRef = useRef<Set<string>>(new Set()); // Ref to track processed statuses
  const [pollingIntervalId, setPollingIntervalId] = useState<NodeJS.Timeout | null>(null);
  const [isDisplayingSuggestion, setIsDisplayingSuggestion] = useState(false); // 新增：防止在建议显示期间重复触发

  // 新增：用于API集成的状态
  const [jobId, setJobId] = useState<string | null>(null);
  const [pollingError, setPollingError] = useState<string | null>(null);

  // 图片预览 Modal 状态
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 处理图片点击
  const handleImageClick = (imageUrl: string) => {
    setModalImage(imageUrl);
    setIsModalOpen(true);
  };

  // 关闭 Modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setModalImage(null);
  };

  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 生成唯一 ID
  const generateUniqueId = () => {
    const newCounter = messageIdCounter + 1;
    setMessageIdCounter(newCounter);
    return `msg-${Date.now()}-${newCounter}`;
  };

  // 添加消息的辅助函数
  const addMessage = (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    // 使用函数式更新来确保我们总是有最新的状态
    setMessages(prev => {
      const newId = `msg-${Date.now()}-${prev.length + 1}`;
      const newMessage: ChatMessage = {
        ...message,
        id: newId,
        timestamp: new Date(),
      };
      // 检查重复的消息ID
      if (prev.some(m => m.id === newId)) {
        console.warn("Duplicate message ID detected:", newId);
        // 可以选择在这里返回原状态，或者生成一个新的唯一ID
        return prev;
      }
      return [...prev, newMessage];
    });
  };

  // 更新或添加消息的辅助函数
  const upsertMessage = (message: Omit<ChatMessage, 'id' | 'timestamp'>, targetId?: string) => {
    setMessages(prev => {
      const existingMsgIndex = targetId ? prev.findIndex(m => m.id === targetId) : -1;

      if (existingMsgIndex !== -1) {
        // 更新现有消息
        const updatedMessages = [...prev];
        updatedMessages[existingMsgIndex] = {
          ...message,
          id: prev[existingMsgIndex].id, // 保持ID
          timestamp: new Date(),
        };
        return updatedMessages;
      } else {
        // 添加新消息
        const newId = `msg-${Date.now()}-${prev.length + 1}`;
        const newMessage: ChatMessage = {
          ...message,
          id: newId,
          timestamp: new Date(),
        };
        return [...prev, newMessage];
      }
    });
  };

  // 替换最后一条 loading 消息
  const replaceLastLoadingMessage = (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    setMessages(prev => {
      const newMessages = [...prev];
      const lastIndex = newMessages.length - 1;
      if (lastIndex >= 0 && newMessages[lastIndex].type === 'loading') {
        // 保持原有的 ID 以避免 React key 冲突
        newMessages[lastIndex] = {
          ...message,
          id: newMessages[lastIndex].id,
          timestamp: new Date(),
        };
      }
      // 如果最后一条不是loading，则直接添加
      const newId = `msg-${Date.now()}-${prev.length + 1}`;
      return [...prev, { ...message, id: newId, timestamp: new Date() }];
    });
  };

  // 新增：按顺序显示AI建议
  const displaySuggestionSequentially = async (suggestion: any) => {
    if (isDisplayingSuggestion) return; // 防止重复执行
    setIsDisplayingSuggestion(true);
    console.log('[CHAT UI] Received full suggestion object. Beginning sequential display.', suggestion);

    const suggestionOrder = [
      { key: 'scene_fit', title: '🎯 场合适配度' },
      { key: 'style_alignment', title: '👗 风格搭配建议' },
      { key: 'personal_match', title: '👤 个性化匹配' },
      { key: 'visual_focus', title: '✨ 视觉焦点' },
      { key: 'material_silhouette', title: '👚 材质与版型' },
      { key: 'color_combination', title: '🎨 色彩搭配' },
      { key: 'reuse_versatility', title: '💡 延展搭配性' },
    ];

    for (const item of suggestionOrder) {
      if (suggestion[item.key]) {
        await new Promise(resolve => setTimeout(resolve, 1200)); // 等待1.2秒
        console.log(`[CHAT UI] Displaying bubble: ${item.title}`);
        addMessage({
          type: 'text',
          role: 'ai',
          content: `**${item.title}**\n\n${suggestion[item.key]}`,
        });
      }
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('[CHAT UI] All suggestion bubbles displayed. Adding final loading message.');

    // 添加最后的"生成中"消息
    addMessage({
      type: 'loading',
      role: 'ai',
      loadingText: 'AI正在生成你的专属造型图片...',
    });
    setIsDisplayingSuggestion(false);
  };

  // 获取场合的中文名称
  const getOccasionName = (occasionId: string) => {
    const occasionMap: { [key: string]: string } = {
      'fashion-magazine': '时尚杂志风',
      'running-outdoors': '户外运动',
      'coffee-shop': '咖啡厅约会',
      'music-show': '音乐演出',
      'date-night': '浪漫约会',
      'beach-day': '海滩度假',
      'casual-chic': '休闲时尚',
      'party-glam': '派对魅力'
    };
    return occasionMap[occasionId] || occasionId;
  };

  // 将预览URL转换为File对象的辅助函数
  const getFileFromPreview = async (previewUrl: string, defaultName: string): Promise<File | null> => {
    try {
      if (previewUrl.startsWith("data:image")) {
        // Data URL转换为File
        const response = await fetch(previewUrl);
        const blob = await response.blob();
        return new File([blob], `${defaultName}-${Date.now()}.png`, { type: blob.type });
      } else if (previewUrl.startsWith("/")) {
        // 本地路径转换为File
        const response = await fetch(previewUrl);
        const blob = await response.blob();
        return new File([blob], `${defaultName}-${Date.now()}.jpg`, { type: blob.type });
      } else if (previewUrl.startsWith("blob:")) {
        // Blob URL转换为File
        const response = await fetch(previewUrl);
        const blob = await response.blob();
        return new File([blob], `${defaultName}-${Date.now()}.jpg`, { type: blob.type });
      }
      return null;
    } catch (error) {
      console.error('Error converting preview to file:', error);
      return null;
    }
  };

  // 真实的生成流程 - 集成现有API
  const startGeneration = async () => {
    // 确保 chatData 存在
    if (!chatData) {
      console.error("[CHAT] Start generation called but chatData is null.");
      addMessage({
        type: 'text',
        role: 'ai',
        content: "抱歉，启动生成时遇到错误，缺少必要的信息。",
      });
      return;
    }

    setIsGenerating(true);
    setPollingError(null);
    processedStatusesRef.current.clear(); // 重置已处理状态
    setHasProcessedCompletion(false);     // 重置完成状态

    addMessage({ type: 'loading', role: 'ai', loadingText: '正在准备你的专属造型分析...' });

    try {
      const humanImage = await getFileFromPreview(chatData.selfiePreview, "selfie");
      const garmentImage = await getFileFromPreview(chatData.clothingPreview, "garment");

      if (!humanImage || !garmentImage) {
        throw new Error("无法处理图片，请返回重试。");
      }

      const formData = new FormData();
      formData.append("human_image", humanImage);
      formData.append("garment_image", garmentImage);
      formData.append("occasion", chatData.occasion);
      formData.append("generation_mode", chatData.generationMode);
      // Hardcode 'advanced-scene' if not present
      // formData.append("generation_mode", chatData.generationMode || "advanced-scene");


      console.log('[CHAT] Starting generation with mode:', chatData.generationMode);


      const response = await fetch("/api/generation/start", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`启动生成失败: ${errorText}`);
      }

      const { jobId: newJobId } = await response.json();
      console.log(`[CHAT] Generation started. Job ID: ${newJobId}`);
      setJobId(newJobId);
      // 轮询将在 jobId 的 useEffect 中启动
    } catch (error) {
      console.error("[CHAT] Error starting generation:", error);
      const errorMessage = error instanceof Error ? error.message : "发生未知错误";
      replaceLastLoadingMessage({
        type: 'text',
        role: 'ai',
        content: `抱歉，启动时遇到问题: ${errorMessage}`,
      });
      setIsGenerating(false);
    }
  };

  // 轮询状态的函数
  const startPolling = (jobId: string) => {
    console.log(`[POLLING] Starting polling for Job ID: ${jobId}`);

    // 清除任何可能存在的旧轮询
    if (pollingIntervalId) {
      clearInterval(pollingIntervalId);
    }

    const interval = setInterval(async () => {
      // 如果已经处理完，或者正在显示建议，则暂时不轮询
      if (hasProcessedCompletion || isDisplayingSuggestion) {
        console.log(`[POLLING] Skipping poll because task is complete or suggestion is being displayed.`);
        return;
      }
      try {
        const response = await fetch(`/api/generation/status?jobId=${jobId}`);
        if (!response.ok) {
          // 对 404 Not Found 等情况进行更温和的处理
          if (response.status === 404) {
            console.warn(`[POLLING] Job ${jobId} not found. It might be pending creation. Will retry.`);
            return;
          }
          throw new Error(`轮询失败，状态码: ${response.status}`);
        }

        const data = await response.json();
        const statusKey = `${data.status}-${data.timestamp}`; // Create a unique key for the status update

        // 使用Ref来防止因React重渲染导致的重复处理
        if (processedStatusesRef.current.has(statusKey) || processedStatusesRef.current.has(data.status)) {
          return;
        }

        console.log('[POLLING] Received data:', data);

        // 根据状态更新UI
        switch (data.status) {
          case 'pending':
            setCurrentStep('suggestion');
            replaceLastLoadingMessage({
              type: 'loading',
              role: 'ai',
              loadingText: '已收到请求，正在排队等待处理...'
            });
            break;
          case 'processing_style_suggestion':
            setCurrentStep('suggestion');
            replaceLastLoadingMessage({
              type: 'loading',
              role: 'ai',
              loadingText: 'AI正在分析你的风格并生成建议...'
            });
            break;
          case 'suggestion_generated':
            // 确保只处理一次
            if (!processedStatusesRef.current.has('suggestion_generated')) {
              setCurrentStep('tryon');
              processedStatusesRef.current.add('suggestion_generated'); // 标记为已处理
              replaceLastLoadingMessage({ type: 'text', role: 'ai', content: '太棒了！我为你准备了一些专属的造型建议：' });

              // Fire-and-forget: Do not await. Let it run in the background
              // while polling continues.
              displaySuggestionSequentially(data.suggestion);
            }
            break;
          case 'processing_stylization':
            setCurrentStep('scene');
            // Only update the loading message if the suggestion display is finished.
            if (!isDisplayingSuggestion) {
              replaceLastLoadingMessage({
                type: 'loading',
                role: 'ai',
                loadingText: '正在应用场景风格化...'
              });
            }
            break;
          case 'processing_tryon':
            setCurrentStep('tryon');
            if (!isDisplayingSuggestion) {
              replaceLastLoadingMessage({
                type: 'loading',
                role: 'ai',
                loadingText: '正在进行虚拟试穿...'
              });
            }
            break;
          case 'processing_faceswap':
            setCurrentStep('scene');
            if (!isDisplayingSuggestion) {
              replaceLastLoadingMessage({
                type: 'loading',
                role: 'ai',
                loadingText: '正在进行最后的面部融合处理...'
              });
            }
            break;
          case 'completed':
            if (!hasProcessedCompletion) {
              setCurrentStep('complete');

              const showCompletion = () => {
                setHasProcessedCompletion(true); // 关键：设置标志位
                console.log('[POLLING] Status is completed. Final URL:', data.result?.imageUrl);
                const finalImageUrl = data.result?.imageUrl;
                if (finalImageUrl) {
                  replaceLastLoadingMessage({
                    type: 'text',
                    role: 'ai',
                    content: getChatCompletionMessage(getOccasionName(chatData!.occasion))
                  });
                  addMessage({
                    type: 'image',
                    role: 'ai',
                    imageUrl: finalImageUrl,
                  });
                } else {
                  replaceLastLoadingMessage({
                    type: 'text',
                    role: 'ai',
                    content: "抱歉，生成完成了，但图片链接丢失了。",
                  });
                }
                console.log('[POLLING] Stopping polling because job is complete.');
                clearInterval(interval);
                setPollingIntervalId(null);
              }

              // If suggestions are still being displayed, wait until they are finished.
              if (isDisplayingSuggestion) {
                const waitInterval = setInterval(() => {
                  if (!isDisplayingSuggestion) {
                    clearInterval(waitInterval);
                    showCompletion();
                  }
                }, 100);
              } else {
                showCompletion();
              }
            }
            break;
          case 'failed':
            throw new Error(data.statusMessage || '生成失败，未提供具体原因。');
          default:
            console.log(`[POLLING] Unhandled status: ${data.status}`);
        }

        // Do not add the general status key for 'suggestion_generated' as it has its own logic
        if (data.status !== 'suggestion_generated') {
          processedStatusesRef.current.add(statusKey); // 标记为已处理
        }

      } catch (error) {
        console.error("[POLLING] Polling error:", error);
        const errorMessage = error instanceof Error ? error.message : "发生未知错误";
        setPollingError(errorMessage);
        replaceLastLoadingMessage({
          type: 'text',
          role: 'ai',
          content: `抱歉，处理过程中遇到问题: ${errorMessage}`,
        });
        clearInterval(interval);
        setPollingIntervalId(null);
        setIsGenerating(false);
      }
    }, 3000);

    setPollingIntervalId(interval);
  };

  // 页面初始化
  useEffect(() => {
    // 防止重复初始化
    if (isInitialized) {
      console.log('[CHAT DEBUG] Already initialized, skipping...');
      return;
    }

    console.log('[CHAT DEBUG] Page initialized, reading sessionStorage...');

    // 尝试从sessionStorage读取数据
    try {
      const storedData = sessionStorage.getItem('chatModeData');
      console.log('[CHAT DEBUG] Raw sessionStorage data:', storedData);

      if (storedData) {
        const parsedData = JSON.parse(storedData);
        console.log('[CHAT DEBUG] Parsed chat data:', parsedData);
        setChatData(parsedData);

        // 添加个性化欢迎消息
        const welcomeMessage = getChatWelcomeMessage(getOccasionName(parsedData.occasion));

        console.log('[CHAT DEBUG] Adding welcome message:', welcomeMessage);

        // 使用一个数组来批量添加所有初始消息，避免多次状态更新
        const initialMessages: ChatMessage[] = [];
        let idCounter = 0;

        const createMessage = (message: Omit<ChatMessage, 'id' | 'timestamp'>): ChatMessage => ({
          ...message,
          id: `msg-${Date.now()}-${++idCounter}`,
          timestamp: new Date(),
        });

        // 1. AI 欢迎消息
        initialMessages.push(createMessage({
          type: 'text',
          role: 'ai',
          content: welcomeMessage
        }));

        // 2. 用户照片文本
        initialMessages.push(createMessage({
          type: 'text',
          role: 'user',
          content: '这是我的照片：'
        }));

        // 3. 用户照片
        initialMessages.push(createMessage({
          type: 'image',
          role: 'user',
          imageUrl: parsedData.selfiePreview
        }));

        // 4. 用户服装文本
        initialMessages.push(createMessage({
          type: 'text',
          role: 'user',
          content: '我想试穿这件衣服：'
        }));

        // 5. 用户服装图片
        initialMessages.push(createMessage({
          type: 'image',
          role: 'user',
          imageUrl: parsedData.clothingPreview
        }));

        // 6. AI 确认消息
        initialMessages.push(createMessage({
          type: 'text',
          role: 'ai',
          content: getChatConfirmationMessage(getOccasionName(parsedData.occasion))
        }));

        // 一次性设置所有消息
        setMessages(initialMessages);
        setMessageIdCounter(idCounter);

      } else {
        console.log('[CHAT DEBUG] No sessionStorage data found, showing default message');
        // 如果没有数据，显示提示消息
        const defaultMessage: ChatMessage = {
          id: `msg-${Date.now()}-1`,
          type: 'text',
          role: 'ai',
          content: '你好！我是你的专属AI造型师 ✨\n\n请先在主页选择你的照片和服装，然后我就可以为你生成专属的穿搭建议了！',
          timestamp: new Date(),
        };
        setMessages([defaultMessage]);
        setMessageIdCounter(1);
      }
    } catch (error) {
      console.error('[CHAT DEBUG] Error reading chat data:', error);
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}-1`,
        type: 'text',
        role: 'ai',
        content: '你好！我是你的专属AI造型师 ✨\n\n请先在主页选择你的照片和服装，然后我就可以为你生成专属的穿搭建议了！',
        timestamp: new Date(),
      };
      setMessages([errorMessage]);
      setMessageIdCounter(1);
    }

    // 标记为已初始化
    setIsInitialized(true);
  }, []); // 空依赖数组，确保只在组件挂载时运行一次

  // 当获取到 jobId 后，开始轮询
  useEffect(() => {
    if (jobId) {
      startPolling(jobId);
    }
  }, [jobId]);

  // 添加状态变化的调试日志
  useEffect(() => {
    console.log('[CHAT DEBUG] State changed:', {
      isGenerating,
      currentStep,
      chatData: chatData ? 'exists' : 'null',
      messagesLength: messages.length,
      pollingError
    });
  }, [isGenerating, currentStep, chatData, messages.length, pollingError]);

  // 移除消息变化的调试日志以避免额外的渲染
  // useEffect(() => {
  //   console.log('[CHAT DEBUG] Messages updated:', messages.map(m => ({
  //     id: m.id,
  //     type: m.type,
  //     role: m.role,
  //     content: m.content?.substring(0, 50) + '...',
  //     loadingText: m.loadingText
  //   })));
  // }, [messages]);

  // 组件卸载时清理轮询
  useEffect(() => {
    return () => {
      if (pollingIntervalId) {
        console.log('[LIFECYCLE] Component unmounting, clearing polling interval.');
        clearInterval(pollingIntervalId);
      }
    };
  }, [pollingIntervalId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50 pb-20">
      {/* 顶部标题栏 */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-gray-200">
        <div className="flex items-center justify-between px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="p-2"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-playfair text-lg font-bold text-gray-800">AI造型师</h1>
          <div className="w-9" /> {/* 占位符，保持标题居中 */}
        </div>
      </header>

      {/* 对话流区域 */}
      <div className="flex-1 px-4 py-6 space-y-4">
        <div className="max-w-2xl mx-auto">
          {messages.map((message) => (
            <ChatBubble
              key={message.id}
              message={message}
              onImageClick={handleImageClick}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* 调试信息显示 */}
        {process.env.NODE_ENV === 'development' && (
          <div className="max-w-2xl mx-auto mt-4 p-4 bg-gray-100 rounded-lg text-xs">
            <h3 className="font-bold mb-2">Debug Info:</h3>
            <div>isGenerating: {String(isGenerating)}</div>
            <div>currentStep: {String(currentStep)}</div>
            <div>chatData: {chatData ? 'exists' : 'null'}</div>
            <div>messages.length: {String(messages.length)}</div>
            <div>pollingError: {pollingError || 'none'}</div>
            <div>hasProcessedCompletion: {String(hasProcessedCompletion)}</div>
            <div>pollingActive: {pollingIntervalId ? 'yes' : 'no'}</div>
            <div>Show start button: {String(!isGenerating && currentStep === 'suggestion' && chatData && messages.length === 6)}</div>
            <div>Raw chatData: {chatData ? JSON.stringify({
              ...chatData,
              selfiePreview: chatData.selfiePreview?.startsWith('data:image')
                ? `${chatData.selfiePreview.substring(0, 30)}... [base64 data truncated]`
                : chatData.selfiePreview,
              clothingPreview: chatData.clothingPreview?.startsWith('data:image')
                ? `${chatData.clothingPreview.substring(0, 30)}... [base64 data truncated]`
                : chatData.clothingPreview
            }, null, 2) : 'null'}</div>
          </div>
        )}

        {/* 如果有数据且没有在生成中，显示开始按钮 */}
        {(() => {
          const shouldShowButton = !isGenerating && currentStep === 'suggestion' && chatData && messages.length === 6;
          console.log('[CHAT DEBUG] Button visibility check:', {
            isGenerating,
            currentStep,
            hasChatData: !!chatData,
            messagesLength: messages.length,
            shouldShowButton
          });

          return shouldShowButton;
        })() && (
            <div className="max-w-2xl mx-auto mt-8">
              <div className="bg-white/80 rounded-2xl p-4 shadow-sm border border-gray-100">
                <p className="text-sm text-gray-600 mb-4 text-center">
                  准备好开始生成你的专属造型了吗？
                </p>
                <Button
                  onClick={() => {
                    console.log('[CHAT DEBUG] Start generation button clicked');
                    startGeneration();
                  }}
                  className="w-full bg-[#FF6EC7] hover:bg-[#FF6EC7]/90"
                >
                  开始生成我的造型
                </Button>
              </div>
            </div>
          )}

        {/* 如果没有数据，显示返回主页按钮 */}
        {(() => {
          const shouldShowReturnButton = !chatData && messages.length === 1;
          console.log('[CHAT DEBUG] Return button visibility check:', {
            hasChatData: !!chatData,
            messagesLength: messages.length,
            shouldShowReturnButton
          });

          return shouldShowReturnButton;
        })() && (
            <div className="max-w-2xl mx-auto mt-8">
              <div className="bg-white/80 rounded-2xl p-4 shadow-sm border border-gray-100">
                <p className="text-sm text-gray-600 mb-4 text-center">
                  请先选择你的照片和服装
                </p>
                <Button
                  onClick={() => {
                    console.log('[CHAT DEBUG] Return to home button clicked');
                    router.push('/');
                  }}
                  className="w-full bg-[#FF6EC7] hover:bg-[#FF6EC7]/90"
                >
                  返回主页选择
                </Button>
              </div>
            </div>
          )}

        {/* 显示错误信息 */}
        {pollingError && (
          <div className="max-w-2xl mx-auto mt-4">
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
              <p className="text-sm text-red-600 text-center">{pollingError}</p>
              <Button
                onClick={() => {
                  setPollingError(null);
                  if (chatData) startGeneration();
                }}
                variant="outline"
                className="w-full mt-3"
              >
                重试
              </Button>
            </div>
          </div>
        )}

        {/* 完成状态的操作按钮 */}
        {currentStep === 'complete' && (
          <div className="max-w-2xl mx-auto mt-8">
            <div className="bg-white/80 rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-sm text-gray-600 mb-4 text-center">
                🎉 你的专属造型已经完成！
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={() => router.push('/')}
                  variant="outline"
                  className="flex-1"
                >
                  再试一套
                </Button>
                <Button
                  onClick={() => router.push('/results')}
                  className="flex-1 bg-[#FF6EC7] hover:bg-[#FF6EC7]/90"
                >
                  查看我的造型
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 图片预览 Modal */}
      <ImageModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        imageUrl={modalImage || ''}
        title="AI生成的造型图"
      />

      {/* 底部导航栏 */}
      <IOSTabBar />
    </div>
  );
}