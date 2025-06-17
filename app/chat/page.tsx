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
          <p className="text-sm text-gray-800 leading-relaxed">{message.content}</p>
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

  // 模拟生成流程
  const startGeneration = async () => {
    setIsGenerating(true);

    // 第一步：生成穿搭建议
    addMessage({
      type: 'loading',
      role: 'ai',
      loadingText: 'AI正在分析你的穿搭需求...'
    });

    // 模拟 API 调用延迟
    setTimeout(() => {
      replaceLastLoadingMessage({
        type: 'text',
        role: 'ai',
        content: '根据你选择的服装和场合，我为你推荐以下穿搭建议：\n\n这件衣服非常适合你选择的场合，颜色搭配很棒！建议搭配一些简约的配饰来完善整体造型。'
      });

      // 第二步：生成试穿图
      setTimeout(() => {
        addMessage({
          type: 'loading',
          role: 'ai',
          loadingText: 'AI正在生成试穿效果图...'
        });

        setTimeout(() => {
          replaceLastLoadingMessage({
            type: 'image',
            role: 'ai',
            imageUrl: '/casual-chic-woman.png' // 使用存在的图片
          });

          // 第三步：生成场景图
          setTimeout(() => {
            addMessage({
              type: 'loading',
              role: 'ai',
              loadingText: 'AI正在生成场景搭配图...'
            });

            setTimeout(() => {
              replaceLastLoadingMessage({
                type: 'image',
                role: 'ai',
                imageUrl: '/elegant-outfit.png' // 使用存在的图片
              });

              setCurrentStep('complete');
              setIsGenerating(false);
            }, 3000);
          }, 1000);
        }, 4000);
      }, 1000);
    }, 2000);
  };

  // 页面初始化
  useEffect(() => {
    // 添加欢迎消息
    addMessage({
      type: 'text',
      role: 'ai',
      content: '你好！我是你的专属AI造型师 ✨\n\n请先在主页选择你的照片和服装，然后我就可以为你生成专属的穿搭建议了！'
    });

    // 移除自动开始生成流程
    // setTimeout(() => {
    //   startGeneration();
    // }, 1000);
  }, []);

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

        {/* 如果没有在生成中，显示开始按钮 */}
        {!isGenerating && currentStep === 'suggestion' && messages.length === 1 && (
          <div className="max-w-2xl mx-auto mt-8">
            <div className="bg-white/80 rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-sm text-gray-600 mb-4 text-center">
                准备好开始生成你的专属造型了吗？
              </p>
              <Button
                onClick={startGeneration}
                className="w-full bg-[#FF6EC7] hover:bg-[#FF6EC7]/90"
              >
                开始生成我的造型
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