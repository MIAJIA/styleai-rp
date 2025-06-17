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
  const hasProcessedCompletionRef = useRef(false); // Ref for reliable check inside interval
  const [pollingIntervalRef, setPollingIntervalRef] = useState<NodeJS.Timeout | null>(null); // 新增：轮询引用管理
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
    setMessages(prev => {
      const newId = `msg-${Date.now()}-${prev.length + 1}`;
      const newMessage: ChatMessage = {
        ...message,
        id: newId,
        timestamp: new Date(),
      };
      return [...prev, newMessage];
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
      return newMessages;
    });
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
    console.log('[CHAT DEBUG] startGeneration called');
    console.log('[CHAT DEBUG] Current chatData:', chatData);

    if (!chatData) {
      console.log('[CHAT DEBUG] No chatData found, showing error message');
      addMessage({
        type: 'text',
        role: 'ai',
        content: '抱歉，我没有收到你的选择数据。请返回主页重新选择照片和服装。'
      });
      return;
    }

    console.log('[CHAT DEBUG] Starting generation process...');
    setIsGenerating(true);
    setPollingError(null);
    setHasProcessedCompletion(false); // 重置完成状态标记
    hasProcessedCompletionRef.current = false; // 重置ref锁

    try {
      // 第一步：显示开始生成的消息
      addMessage({
        type: 'loading',
        role: 'ai',
        loadingText: 'AI正在分析你的穿搭需求...'
      });

      // 准备图片文件
      const humanImage = await getFileFromPreview(chatData.selfiePreview, "selfie");
      const garmentImage = await getFileFromPreview(chatData.clothingPreview, "garment");

      if (!humanImage || !garmentImage) {
        throw new Error("无法处理选择的图片，请重新选择。");
      }

      // 调用generation/start API
      const formData = new FormData();
      formData.append("human_image", humanImage);
      formData.append("garment_image", garmentImage);
      formData.append("occasion", chatData.occasion);

      const response = await fetch("/api/generation/start", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`生成请求失败: ${errorText}`);
      }

      const { jobId: newJobId } = await response.json();
      setJobId(newJobId);

      // 开始轮询状态
      startPolling(newJobId);

    } catch (error) {
      console.error('Generation error:', error);
      setPollingError(error instanceof Error ? error.message : String(error));
      setIsGenerating(false);

      // 替换loading消息为错误消息
      replaceLastLoadingMessage({
        type: 'text',
        role: 'ai',
        content: `生成过程中出现错误：${error instanceof Error ? error.message : '未知错误'}。请重试或返回主页重新选择。`
      });
    }
  };

  // 轮询状态的函数
  const startPolling = (jobId: string) => {
    // 清理现有的轮询
    if (pollingIntervalRef) {
      console.log('[CHAT POLLING] Clearing existing polling interval');
      clearInterval(pollingIntervalRef);
    }

    console.log('[CHAT POLLING] Starting new polling for job:', jobId);

    const intervalId = setInterval(async () => {
      // 使用Ref进行最可靠的检查，防止由于闭包导致的状态陈旧问题
      if (hasProcessedCompletionRef.current) {
        console.log('[CHAT POLLING] Completion already processed via ref, stopping this interval.');
        clearInterval(intervalId);
        setPollingIntervalRef(null);
        return;
      }

      try {
        const response = await fetch(`/api/generation/status?jobId=${jobId}`);
        if (!response.ok) {
          throw new Error(`轮询失败，状态码: ${response.status}`);
        }

        const data = await response.json();
        console.log('[CHAT POLLING] Received data:', data);

        if (data.status === 'suggestion_generated') {
          console.log('[CHAT POLLING] Suggestion generated');

          // 替换loading消息为穿搭建议
          replaceLastLoadingMessage({
            type: 'text',
            role: 'ai',
            content: formatStyleSuggestion(data.suggestion)
          });

          // 添加新的loading消息用于最终图片生成
          setTimeout(() => {
            addMessage({
              type: 'loading',
              role: 'ai',
              loadingText: 'AI正在生成你的专属造型图片...'
            });
          }, 1000);

        } else if (data.status === 'completed') {
          console.log('[CHAT POLLING] Generation completed');

          // 再次检查，并立即设置锁
          if (hasProcessedCompletionRef.current) {
            console.log('[CHAT POLLING] Already processed completion, skipping...');
            return;
          }
          hasProcessedCompletionRef.current = true;
          setHasProcessedCompletion(true);

          const finalImageUrl = data.result?.imageUrl;

          if (finalImageUrl) {
            // 替换loading消息为最终图片
            replaceLastLoadingMessage({
              type: 'image',
              role: 'ai',
              imageUrl: finalImageUrl
            });

            // 添加完成消息
            setTimeout(() => {
              addMessage({
                type: 'text',
                role: 'ai',
                content: getChatCompletionMessage(getOccasionName(chatData!.occasion))
              });

              // 新增：告知用户已保存
              addMessage({
                type: 'text',
                role: 'ai',
                content: '✨ 这个造型已经自动保存到你的 "My Looks" 页面，方便随时查看！'
              });

              setCurrentStep('complete');
              setIsGenerating(false);
            }, 1000);

            // 立即停止轮询
            clearInterval(intervalId);
            setPollingIntervalRef(null);
          } else {
            throw new Error('生成完成但未返回图片URL');
          }

        } else if (data.status === 'failed') {
          throw new Error(data.statusMessage || '生成失败');
        }

        // 继续轮询其他状态
        console.log(`[CHAT POLLING] Current status: ${data.status}, continuing...`);

      } catch (error) {
        console.error("Polling error:", error);
        setPollingError(error instanceof Error ? error.message : String(error));
        setIsGenerating(false);
        clearInterval(intervalId);
        setPollingIntervalRef(null);

        // 显示错误消息
        addMessage({
          type: 'text',
          role: 'ai',
          content: `生成过程中出现错误：${error instanceof Error ? error.message : '未知错误'}。请重试或返回主页重新选择。`
        });
      }
    }, 3000); // 每3秒轮询一次

    // 设置超时清理
    setTimeout(() => {
      clearInterval(intervalId);
      setPollingIntervalRef(null);
      if (isGenerating) {
        setIsGenerating(false);
        setPollingError('生成超时，请重试');
      }
    }, 300000); // 5分钟超时

    // 设置新的轮询引用
    setPollingIntervalRef(intervalId);
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
      if (pollingIntervalRef) {
        console.log('[CHAT DEBUG] Cleaning up polling interval on unmount');
        clearInterval(pollingIntervalRef);
      }
    };
  }, [pollingIntervalRef]);

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
            <div>pollingActive: {pollingIntervalRef ? 'yes' : 'no'}</div>
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