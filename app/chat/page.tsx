"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import IOSTabBar from "../components/ios-tab-bar";
import ImageModal from "../components/image-modal";
import { ArrowLeft, Download, Share2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

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
      <div className="flex items-start gap-3 mb-4">
        <AIAvatar />
        <div className="bg-white rounded-2xl rounded-tl-md px-4 py-3 max-w-[80%] shadow-sm border border-gray-100">
          <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-line">{message.content}</p>
        </div>
      </div>
    );
  }

  if (message.type === 'image') {
    return (
      <div className="flex items-start gap-3 mb-4">
        <AIAvatar />
        <div className="bg-white rounded-2xl rounded-tl-md p-2 max-w-[80%] shadow-sm border border-gray-100">
          <img
            src={message.imageUrl}
            alt="Generated image"
            className="w-full rounded-xl cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => onImageClick(message.imageUrl!)}
          />
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
    const newMessage: ChatMessage = {
      ...message,
      id: generateUniqueId(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMessage]);
  };

  // 替换最后一条 loading 消息
  const replaceLastLoadingMessage = (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    setMessages(prev => {
      const newMessages = [...prev];
      const lastIndex = newMessages.length - 1;
      if (lastIndex >= 0 && newMessages[lastIndex].type === 'loading') {
        newMessages[lastIndex] = {
          ...message,
          id: newMessages[lastIndex].id, // 保持原有的 ID
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

  // 生成个性化的穿搭建议文本（基于API返回的数据）
  const formatStyleSuggestion = (suggestion: any, occasionName: string) => {
    const sections = [];

    sections.push(`我已经分析了你的照片和选择的服装！✨`);
    sections.push('');

    if (suggestion.scene_fit) {
      sections.push(`🎯 **场合适配度**\n${suggestion.scene_fit}`);
      sections.push('');
    }

    if (suggestion.style_alignment) {
      sections.push(`👗 **风格搭配建议**\n${suggestion.style_alignment}`);
      sections.push('');
    }

    if (suggestion.personal_match) {
      sections.push(`💫 **个人匹配度**\n${suggestion.personal_match}`);
      sections.push('');
    }

    if (suggestion.color_combination) {
      sections.push(`🎨 **配色方案**\n${suggestion.color_combination}`);
      sections.push('');
    }

    sections.push(`接下来我会为你生成专属的试穿效果图和场景搭配图！`);

    return sections.join('\n');
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
    const intervalId = setInterval(async () => {
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
            content: formatStyleSuggestion(data.suggestion, getOccasionName(chatData!.occasion))
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
                content: `🎉 你的专属造型已经完成！这是为${getOccasionName(chatData!.occasion)}场合精心设计的搭配，希望你喜欢！`
              });

              setCurrentStep('complete');
              setIsGenerating(false);
              clearInterval(intervalId);
            }, 1000);
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
      if (isGenerating) {
        setIsGenerating(false);
        setPollingError('生成超时，请重试');
      }
    }, 300000); // 5分钟超时
  };

  // 页面初始化
  useEffect(() => {
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
        const welcomeMessage = `你好！我是你的专属AI造型师 ✨

我看到你已经选择了照片和服装，准备为${getOccasionName(parsedData.occasion)}场合生成造型建议。

让我来为你打造完美的穿搭方案吧！`;

        console.log('[CHAT DEBUG] Adding welcome message:', welcomeMessage);
        addMessage({
          type: 'text',
          role: 'ai',
          content: welcomeMessage
        });
      } else {
        console.log('[CHAT DEBUG] No sessionStorage data found, showing default message');
        // 如果没有数据，显示提示消息
        addMessage({
          type: 'text',
          role: 'ai',
          content: '你好！我是你的专属AI造型师 ✨\n\n请先在主页选择你的照片和服装，然后我就可以为你生成专属的穿搭建议了！'
        });
      }
    } catch (error) {
      console.error('[CHAT DEBUG] Error reading chat data:', error);
      addMessage({
        type: 'text',
        role: 'ai',
        content: '你好！我是你的专属AI造型师 ✨\n\n请先在主页选择你的照片和服装，然后我就可以为你生成专属的穿搭建议了！'
      });
    }
  }, []);

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

  // 添加消息变化的调试日志
  useEffect(() => {
    console.log('[CHAT DEBUG] Messages updated:', messages.map(m => ({
      id: m.id,
      type: m.type,
      role: m.role,
      content: m.content?.substring(0, 50) + '...',
      loadingText: m.loadingText
    })));
  }, [messages]);

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
            <div>Show start button: {String(!isGenerating && currentStep === 'suggestion' && chatData && messages.length === 1)}</div>
            <div>Raw chatData: {chatData ? JSON.stringify(chatData, null, 2) : 'null'}</div>
          </div>
        )}

        {/* 如果有数据且没有在生成中，显示开始按钮 */}
        {(() => {
          const shouldShowButton = !isGenerating && currentStep === 'suggestion' && chatData && messages.length === 1;
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