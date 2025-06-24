"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import IOSTabBar from "../components/ios-tab-bar";
import ImageModal from "../components/image-modal";
import {
  ArrowLeft,
  Download,
  Share2,
  Loader2,
  Sparkles,
  BookOpen,
  Footprints,
  Coffee,
  Mic,
  Palmtree,
  PartyPopper,
  Heart,
  Star,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Settings,
  Send,
  Upload,
  Image as ImageIcon,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getChatWelcomeMessage,
  getChatConfirmationMessage,
  formatStyleSuggestion,
  getChatCompletionMessage,
} from "@/lib/prompts";

// Enhanced Chat message type definition with generation support
type ChatMessage = {
  id: string;
  type: "text" | "image" | "loading" | "generation-request";
  role: "ai" | "user";
  content?: string;
  imageUrl?: string;
  loadingText?: string;
  timestamp: Date;
  agentInfo?: { // 👈 **请手动添加这部分**
    id: string;
    name: string;
    emoji: string;
  };
  metadata?: {
    // Generation-related data
    generationData?: {
      selfiePreview?: string;
      clothingPreview?: string;
      occasion?: string;
      generationMode?: string;
    };
    // Suggestions for quick replies
    suggestions?: string[];
    isGenerationTrigger?: boolean;
  };
};

// Data type for generation requests
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

type ChatStep = "suggestion" | "generating" | "complete" | "error";

const styles = [
  { id: "fashion-magazine", name: "Magazine", icon: BookOpen },
  { id: "running-outdoors", name: "Outdoors", icon: Footprints },
  { id: "coffee-shop", name: "Coffee", icon: Coffee },
  { id: "music-show", name: "Music Show", icon: Mic },
  { id: "date-night", name: "Date Night", icon: Heart },
  { id: "beach-day", name: "Beach Day", icon: Palmtree },
  { id: "casual-chic", name: "Casual Chic", icon: Sparkles },
  { id: "party-glam", name: "Party Glam", icon: PartyPopper },
];

const stylePrompts = {
  "fashion-magazine":
    "standing in a semi-surreal environment blending organic shapes and architectural elements. The background features dreamlike washes of indigo and burnt orange, with subtle floating geometric motifs inspired by Ukiyo-e clouds. Lighting combines soft studio strobes with atmospheric glow, creating dimensional shadows. Composition balances realistic human proportions with slightly exaggerated fabric movement, evoking a living oil painting. Texture details: fine wool fibers visible, slight film grain. Style fusion: Richard Avedon's fashion realism + Egon Schiele's expressive lines + niji's color vibrancy (but photorealistic), 4k resolution.",
  "running-outdoors":
    "A vibrant, sun-drenched hillside with lush greenery under a clear blue sky, capturing an adventure lifestyle mood. The scene is bathed in soft, natural light, creating a sense of cinematic realism. Shot with the professional quality of a Canon EOS R5, emphasizing realistic textures and high definition, 4k resolution.",
  "coffee-shop":
    "A cozy, sunlit coffee shop with the warm aroma of freshly ground beans. The person is sitting at a rustic wooden table by a large window, holding a ceramic mug. The background shows soft, blurred details of a barista and an espresso machine. The style should be intimate and warm, with natural light creating soft shadows, reminiscent of a lifestyle magazine photograph, 4k resolution.",
  "casual-chic":
    "trendy Brooklyn street with colorful murals, chic coffee shop with exposed brick walls, urban rooftop garden with city views, stylish boutique district, contemporary art gallery setting, natural daylight with artistic shadows, street style fashion photography, 4k resolution",
  "music-show":
    "Group idol style, performing on stage, spotlight and dreamy lighting, high-definition portrait, soft glow and bokeh, dynamic hair movement, glamorous makeup, K-pop inspired outfit (shiny, fashionable), expressive pose, cinematic stage background, lens flare, fantasy concert vibe, ethereal lighting, 4k resolution.",
  "date-night":
    "A realistic romantic evening on a backyard patio--string lights overhead, wine glasses, laughing mid-conversation with friend. Subtle body language, soft bokeh lights, hint of connection. Created using: Sony Alpha A7R IV, cinematic lighting, shallow depth of field, natural expressions, sunset color grading Shot in kodak gold 200 with a canon EOS R6, 4k resolution.",
  "beach-day":
    "On the beach, soft sunlight, gentle waves in the background, highly detailed, lifelike textures, natural lighting, vivid colors, 4k resolution",
  "party-glam":
    "opulent ballroom with crystal chandeliers, luxurious velvet curtains and gold accents, dramatic spotlight effects with rich jewel tones, champagne bar with marble countertops, exclusive VIP lounge atmosphere, professional event photography with glamorous lighting, 4k resolution",
};

// Helper for creating chat messages
const createChatMessage = (
  type: "text" | "image" | "loading" | "generation-request",
  role: "ai" | "user",
  content?: string,
  imageUrl?: string,
  loadingText?: string,
  metadata?: ChatMessage['metadata']
): ChatMessage => ({
  id: `msg-${Date.now()}-${Math.random()}`,
  type,
  role,
  content,
  imageUrl,
  loadingText,
  metadata,
  timestamp: new Date(),
});

// AI Avatar component
function AIAvatar() {
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-orange-300 flex items-center justify-center shadow-md flex-shrink-0">
      <Sparkles className="w-5 h-5 text-white" />
    </div>
  );
}

// Enhanced Chat Bubble component with generation support
function ChatBubble({
  message,
  onImageClick,
}: {
  message: ChatMessage;
  onImageClick: (imageUrl: string) => void;
}) {
  const isAI = message.role === "ai";

  return (
    <div className={`flex items-start gap-3 my-4 ${!isAI ? "flex-row-reverse" : ""}`}>
      {isAI ? (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center mr-2 flex-shrink-0">
          <span className="text-lg">{message.agentInfo?.emoji || '🤖'}</span>
        </div>
      ) : (
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center mr-2 flex-shrink-0">
          <User className="w-5 h-5 text-gray-600" />
        </div>
      )}
      <div
        className={`
          px-4 py-3 rounded-2xl max-w-[80%] flex flex-col
          ${isAI ? "bg-white shadow-sm border border-gray-100" : "bg-[#FF6EC7] text-white"}
        `}
      >
        {isAI && message.agentInfo && (
          <div className="text-xs text-gray-500 mb-1 font-semibold">
            {message.agentInfo.name}
          </div>
        )}

        {/* Render text content if it exists */}
        {message.content && (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        )}

        {/* Render image if it exists, with a margin if text is also present */}
        {message.imageUrl && (
          <img
            src={message.imageUrl}
            alt={isAI ? "Generated image" : "Uploaded image"}
            width={300}
            height={400}
            className={`rounded-lg cursor-pointer ${message.content ? 'mt-2' : ''}`}
            onClick={() => message.imageUrl && onImageClick(message.imageUrl)}
          />
        )}

        {message.type === "loading" && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-150"></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-300"></div>
            {message.loadingText && <span className="text-sm text-gray-600">{message.loadingText}</span>}
          </div>
        )}

        {/* The old separate type checks are no longer needed for text/image */}

        {message.type === "generation-request" && (
          <div className="space-y-2">
            <p className="text-sm leading-relaxed">{message.content}</p>
            {message.metadata?.generationData && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                {message.metadata.generationData.selfiePreview && (
                  <img
                    src={message.metadata.generationData.selfiePreview}
                    alt="Selfie"
                    className="w-full h-20 object-cover rounded-lg"
                  />
                )}
                {message.metadata.generationData.clothingPreview && (
                  <img
                    src={message.metadata.generationData.clothingPreview}
                    alt="Clothing"
                    className="w-full h-20 object-cover rounded-lg"
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [stagedImage, setStagedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<ChatStep>("suggestion");
  const [messageIdCounter, setMessageIdCounter] = useState(0);
  const [chatData, setChatData] = useState<ChatModeData | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasProcessedCompletion, setHasProcessedCompletion] = useState(false);
  const processedStatusesRef = useRef<Set<string>>(new Set());
  const [pollingIntervalId, setPollingIntervalId] = useState<NodeJS.Timeout | null>(null);
  const [isDisplayingSuggestion, setIsDisplayingSuggestion] = useState(false);
  const [intermediateImageDisplayed, setIntermediateImageDisplayed] = useState(false);
  const [isShowingWaitingTips, setIsShowingWaitingTips] = useState(false);
  const isShowingWaitingTipsRef = useRef(false);

  const [jobId, setJobId] = useState<string | null>(null);
  const [pollingError, setPollingError] = useState<string | null>(null);

  const [modalImage, setModalImage] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Debug panel state - collapsed by default
  const [isDebugExpanded, setIsDebugExpanded] = useState(false);

  // Track if auto-generation has been triggered to prevent multiple calls
  const [hasAutoStarted, setHasAutoStarted] = useState(false);

  // Re-enable state variables that are still in use by other parts of the component
  const [userInput, setUserInput] = useState('');
  const [sessionId, setSessionId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const [isImageProcessing, setIsImageProcessing] = useState(false);

  // --- START: Image Handling Functions ---
  const handleImageUploadClick = () => {
    imageInputRef.current?.click();
  };

  const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log(`[ChatPage] Image selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);

    // 文件类型检查
    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件');
      return;
    }

    // 文件大小预警
    if (file.size > 50 * 1024 * 1024) { // >50MB
      alert('图片过大(>50MB)，请选择更小的图片');
      return;
    }

    setIsImageProcessing(true);

    try {
      // 根据文件大小选择压缩策略
      let compressionResult;
      if (file.size > 10 * 1024 * 1024) { // >10MB
        console.log('[ChatPage] Using aggressive compression for large file');
        compressionResult = await import('@/lib/image-compression').then(m => m.compressForChat(file));
      } else if (file.size > 5 * 1024 * 1024) { // >5MB
        console.log('[ChatPage] Using standard compression for medium file');
        compressionResult = await import('@/lib/image-compression').then(m => m.compressForChat(file));
      } else {
        console.log('[ChatPage] Using standard compression for small file');
        compressionResult = await import('@/lib/image-compression').then(m => m.compressForChat(file));
      }

      console.log(`[ChatPage] 图片压缩完成: ${(file.size / 1024).toFixed(1)}KB → ${(compressionResult.compressedSize / 1024).toFixed(1)}KB (减少${(compressionResult.compressionRatio * 100).toFixed(1)}%)`);

      setStagedImage(compressionResult.dataUrl);

      // 显示压缩结果给用户
      if (compressionResult.compressionRatio > 0.5) {
        console.log(`[ChatPage] 图片已优化: 大小减少${(compressionResult.compressionRatio * 100).toFixed(1)}%，提升传输速度`);
      }

    } catch (error) {
      console.error('[ChatPage] 图片压缩失败:', error);

      // 降级处理：对于小图片，仍然允许使用原图
      if (file.size < 5 * 1024 * 1024) { // <5MB
        console.log('[ChatPage] 压缩失败，使用原图');
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          console.log('[ChatPage] 原图 Data URL 长度:', result.length);
          setStagedImage(result);
        };
        reader.readAsDataURL(file);
      } else {
        alert('图片处理失败，请重试或选择更小的图片');
      }
    } finally {
      setIsImageProcessing(false);
    }

    // Reset file input to allow selecting the same file again
    event.target.value = '';
  };

  const clearStagedImage = () => {
    setStagedImage(null);
  };
  // --- END: Image Handling Functions ---

  const handleImageClick = (imageUrl: string) => {
    setModalImage(imageUrl);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setModalImage(null);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // This effect now handles all client-side initialization
  useEffect(() => {
    if (isInitialized) {
      return;
    }

    // 1. Ensure a session ID exists on the client
    let currentSessionId = localStorage.getItem("chat_session_id");
    if (!currentSessionId) {
      currentSessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem("chat_session_id", currentSessionId);
    }

    // The rest of the initialization logic remains the same...
    try {
      const storedData = sessionStorage.getItem("chatModeData");
      console.log("[CHAT DEBUG] Raw sessionStorage data:", storedData);

      if (storedData) {
        const parsedData = JSON.parse(storedData);
        console.log("[CHAT DEBUG] Parsed chat data:", parsedData);
        setChatData(parsedData);

        // Initialize with unified welcome message
        const initialMessages: ChatMessage[] = [];
        let idCounter = 0;

        const createMessage = (message: Omit<ChatMessage, "id" | "timestamp">): ChatMessage => ({
          ...message,
          id: `msg-${Date.now()}-${++idCounter}`,
          timestamp: new Date(),
        });

        // Welcome message for unified mode
        initialMessages.push(
          createMessage({
            type: "text",
            role: "ai",
            content: `👋 您好！我是您的专业AI穿搭顾问！

我看到您已经准备好了照片和服装，太棒了！

💬 **您可以：**
• 直接说"帮我试穿"或"生成穿搭效果"来开始图像生成
• 问我任何穿搭相关的问题
• 讨论颜色搭配、风格分析等话题

🎨 **智能生成**：当您提到试穿、搭配、生成等关键词时，我会自动为您创建专属的穿搭效果图！

有什么想了解的吗？`,
            metadata: {
              suggestions: ['帮我试穿这件衣服', '分析我的穿搭风格', '推荐搭配建议', '颜色搭配技巧']
            }
          }),
        );

        setMessages(initialMessages);
        setMessageIdCounter(idCounter);

      } else {
        console.log("[CHAT DEBUG] No sessionStorage data found, showing default message");
        const defaultMessage: ChatMessage = {
          id: `msg-${Date.now()}-1`,
          type: "text",
          role: "ai",
          content: `👋 您好！我是您的专业AI穿搭顾问！

💬 **我可以帮您：**
• 分析穿搭风格和色彩搭配
• 提供不同场合的着装建议
• 解答时尚穿搭问题
• 推荐时尚单品和搭配技巧

🎨 **想要生成穿搭效果图？**
请先返回首页上传您的照片和想要试穿的服装，然后回来告诉我"帮我试穿"！

现在就开始聊穿搭吧～`,
          timestamp: new Date(),
          metadata: {
            suggestions: ['返回首页上传照片', '穿搭风格分析', '颜色搭配原理', '场合着装建议']
          }
        };
        setMessages([defaultMessage]);
        setMessageIdCounter(1);
      }
    } catch (error) {
      console.error("[CHAT DEBUG] Error reading chat data:", error);
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}-1`,
        type: "text",
        role: "ai",
        content: "Hello! I'm your personal AI stylist ✨\n\nFeel free to ask me anything about fashion and styling!",
        timestamp: new Date(),
      };
      setMessages([errorMessage]);
      setMessageIdCounter(1);
    }

    setIsInitialized(true);
  }, [isInitialized]); // Dependency array ensures it runs once

  const generateUniqueId = () => {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const addMessage = (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    setMessages(prev => [...prev, { ...message, id: generateUniqueId(), timestamp: new Date() }]);
  };

  // 1. Re-create the missing helper function
  const replaceLastLoadingMessage = (message: Omit<ChatMessage, "id" | "timestamp">) => {
    setMessages((prevMessages) => {
      const newMessages = [...prevMessages];
      // Find the index of the last loading message
      const lastLoadingIndex = newMessages.map(m => m.type).lastIndexOf('loading');

      if (lastLoadingIndex !== -1) {
        // Replace the loading message with the new message
        newMessages[lastLoadingIndex] = {
          ...message,
          id: newMessages[lastLoadingIndex].id, // Keep the same ID for smooth UI updates
          timestamp: new Date(),
        };
        return newMessages;
      }

      // If for some reason no loading message is found, just add the new message
      return [...newMessages, { ...message, id: generateUniqueId(), timestamp: new Date() }];
    });
  };

  const handleSendMessage = async (message: string) => {
    console.log(`[ChatPage] handleSendMessage called. Message: "${message}", Has Staged Image: ${!!stagedImage}`);
    if (message.trim() === "" && !stagedImage) return;

    // Add user message to UI immediately, including the staged image
    addMessage({
      type: "text",
      role: "user",
      content: message,
      imageUrl: stagedImage ?? undefined, // 2. Fix type error (null -> undefined)
    });

    const imageToSend = stagedImage;
    // Clear the staged image immediately after capturing it
    setStagedImage(null);

    // Show loading indicator
    addMessage({
      type: "loading",
      role: "ai",
      loadingText: "思考中...",
    });

    // Pass the captured image to the chat handler
    await handleFreeChat(message, imageToSend);
  };

  const handleFreeChat = async (message: string, imageUrl?: string | null) => {
    const sessionId = localStorage.getItem("chat_session_id");
    if (!sessionId) {
      console.error("[ChatPage] Session ID is missing. Aborting API call.");
      // 3. Use the recreated function for error handling
      replaceLastLoadingMessage({
        type: "text",
        role: "ai",
        content: "抱歉，会话已过期，请刷新页面重试。",
      });
      return;
    }

    const requestBody = { message, sessionId, imageUrl };
    console.log('[ChatPage] Sending request to /api/chat/simple with body:', {
      message: requestBody.message,
      sessionId: requestBody.sessionId,
      imageUrl: requestBody.imageUrl ? `DataURL of length ${requestBody.imageUrl.length}` : 'null',
    });

    try {
      const response = await fetch("/api/chat/simple", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody), // Send imageUrl to API
      });

      const data = await response.json();
      console.log('[ChatPage] Received response from API:', data);

      // 🔍 添加详细的agentInfo调试日志
      console.log('🤖 [AGENT DEBUG] API返回的agentInfo:', data.agentInfo);
      console.log('🤖 [AGENT DEBUG] agentInfo类型:', typeof data.agentInfo);
      console.log('🤖 [AGENT DEBUG] agentInfo内容:', JSON.stringify(data.agentInfo, null, 2));

      if (data.agentInfo) {
        console.log('✅ [AGENT DEBUG] agentInfo存在:', {
          id: data.agentInfo.id,
          name: data.agentInfo.name,
          emoji: data.agentInfo.emoji
        });
      } else {
        console.warn('❌ [AGENT DEBUG] agentInfo不存在或为空');
      }

      if (!response.ok) {
        throw new Error(data.error || "API request failed");
      }

      // 4. Use the recreated function to display the AI response
      replaceLastLoadingMessage({
        type: "text",
        role: "ai",
        content: data.response,
        agentInfo: data.agentInfo,
        metadata: {
          suggestions: generateSmartSuggestions(data.response),
        }
      });

      // 🔍 添加消息添加后的调试日志
      console.log('📝 [AGENT DEBUG] 消息已添加，agentInfo应该显示:', data.agentInfo);

    } catch (error: any) {
      console.error("[ChatPage] Free chat API error:", error);
      replaceLastLoadingMessage({
        type: "text",
        role: "ai",
        content: `抱歉，出了一点问题：${error.message}`,
      });
    }
  };

  const generateSmartSuggestions = (aiResponse: string): string[] => {
    const suggestions: string[] = [];

    if (aiResponse.includes('颜色') || aiResponse.includes('色彩')) {
      suggestions.push('色彩搭配技巧');
    }
    if (aiResponse.includes('场合') || aiResponse.includes('约会') || aiResponse.includes('工作')) {
      suggestions.push('不同场合穿搭');
    }
    if (aiResponse.includes('风格') || aiResponse.includes('款式')) {
      suggestions.push('风格分析');
    }
    if (aiResponse.includes('搭配') || aiResponse.includes('组合')) {
      suggestions.push('搭配建议');
    }

    // Add some general suggestions
    suggestions.push('时尚趋势', '购物建议');

    return suggestions.slice(0, 4); // Limit to 4 suggestions
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (userInput.trim()) {
        handleSendMessage(userInput);
      }
    }
  };

  const displayWaitingTips = async () => {
    console.log("[PERF] 🎭 WAITING TIPS STARTED");
    setIsShowingWaitingTips(true);
    isShowingWaitingTipsRef.current = true;

    // Fashion tips and generation progress library
    const fashionTips = [
      "💡 Tip: Angle your body 45 degrees for more flattering silhouettes!",
      "✨ Style Secret: Mix different shades of the same color for depth!",
      "🌟 Photo Hack: Natural lighting makes your skin glow beautifully!",
      "💫 Styling Tip: Keep accessories to 3 or less for a clean look!",
      "🎨 Color Theory: Warm tones appear friendly, cool tones look professional!",
      "👗 Fashion Rule: A belt can instantly define your waistline!",
      "💄 Beauty Tip: Match your lipstick undertone to your outfit's mood!",
      "🌈 Pattern Play: Mix patterns by keeping one element consistent!",
      "👠 Shoe Game: Nude shoes elongate your legs instantly!",
      "💎 Jewelry Wisdom: Layer necklaces in odd numbers for visual interest!",
      "🧥 Layering Art: Start with fitted pieces, add loose layers on top!",
      "👜 Bag Balance: Large bags with fitted outfits, small bags with flowy looks!",
      "🌸 Seasonal Style: Pastels in spring, jewel tones in fall!",
      "✂️ Fit First: Perfect fit matters more than designer labels!",
      "🎭 Confidence Boost: Good posture is your best accessory!",
      "🌟 Mirror Magic: Check your outfit from all angles before leaving!",
      "💝 Color Pop: Add one bright accent to neutral outfits!",
      "👑 Hair Harmony: Match your hairstyle to your outfit's formality!",
      "🎪 Texture Mix: Combine smooth and textured fabrics for interest!",
      "💫 Proportion Play: Balance loose tops with fitted bottoms!",
      "🌺 Seasonal Swap: Light fabrics in summer, rich textures in winter!",
      "👗 Dress Code: When in doubt, slightly overdress rather than under!",
      "🎨 Monochrome Magic: All-black or all-white looks are always chic!",
      "💍 Metal Matching: Stick to one metal tone for jewelry cohesion!",
      "🌟 Statement Piece: Let one bold item be the star of your outfit!",
      "👠 Comfort First: You'll look better when you feel comfortable!",
      "🎯 Body Love: Highlight your favorite features with strategic styling!",
      "✨ Fabric Care: Well-maintained clothes always look more expensive!",
      "🌈 Mood Dressing: Choose colors that match how you want to feel!",
      "💫 Style Evolution: Don't be afraid to try new trends gradually!"
    ];

    const generationSteps = [
      "🎨 AI is analyzing your unique style characteristics...",
      "✨ Creating your personalized scene atmosphere...",
      "🌟 Adjusting lighting and composition perfectly...",
      "💫 Adding sophisticated fashion details...",
      "🎯 Applying final color grading and polish...",
      "🔍 Examining fabric textures and materials...",
      "🌈 Balancing color harmony and contrast...",
      "💎 Enhancing jewelry and accessory details...",
      "🎭 Perfecting facial expressions and poses...",
      "🌸 Fine-tuning background elements...",
      "✂️ Adjusting garment fit and draping...",
      "🎪 Creating depth and dimensional effects...",
      "💫 Optimizing skin tone and complexion...",
      "🌟 Adding realistic shadow and highlight...",
      "🎨 Refining artistic style and mood...",
      "💄 Enhancing makeup and beauty details...",
      "🌺 Adjusting seasonal lighting effects...",
      "👑 Perfecting hair texture and movement...",
      "🎯 Fine-tuning proportions and symmetry...",
      "✨ Adding cinematic quality touches...",
      "🌈 Calibrating color temperature and mood...",
      "💎 Polishing metallic and reflective surfaces...",
      "🎭 Creating natural body language flow...",
      "🌟 Enhancing fabric shine and texture...",
      "💫 Adjusting atmospheric perspective...",
      "🎨 Applying professional retouching...",
      "✂️ Finalizing composition and framing...",
      "🌸 Adding subtle artistic filters...",
      "💄 Perfecting overall visual impact...",
      "🎯 Completing your stunning transformation..."
    ];

    // 随机选择2-3个小贴士
    const selectedTips = fashionTips.sort(() => 0.5 - Math.random()).slice(0, 2);
    const selectedSteps = generationSteps.slice(0, 2);

    // 合并小贴士和生成步骤
    const allWaitingContent = [...selectedTips, ...selectedSteps];

    // 每个内容间隔4-6秒显示
    for (let i = 0; i < allWaitingContent.length; i++) {
      // 检查是否应该继续显示小贴士（使用ref确保最新状态）
      if (!isShowingWaitingTipsRef.current) {
        console.log("[PERF] 🎭 WAITING TIPS STOPPED (generation completed)");
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 4000 + Math.random() * 2000)); // 4-6秒随机间隔

      // 再次检查状态，因为在等待期间可能已经完成
      if (!isShowingWaitingTipsRef.current) {
        console.log("[PERF] 🎭 WAITING TIPS STOPPED (generation completed)");
        return;
      }

      // 显示小贴士或生成步骤
      replaceLastLoadingMessage({
        role: "ai",
        type: "loading",
        loadingText: allWaitingContent[i],
      });
    }

    console.log("[PERF] 🎭 WAITING TIPS COMPLETED");
  };

  const displaySuggestionSequentially = async (suggestion: any) => {
    const suggestionStartTime = Date.now();
    console.log(`[PERF] 💭 SUGGESTION DISPLAY STARTED at ${new Date().toISOString()}`);

    if (!suggestion) return;

    console.log("[SUGGESTION DEBUG] Starting displaySuggestionSequentially");
    setIsDisplayingSuggestion(true);

    const suggestionKeyToTitleMap = {
      scene_fit: "🎯 Occasion Fit",
      style_alignment: "👗 Styling Suggestions",
      personal_match: "💫 Personal Match",
      visual_focus: "👀 Visual Focus",
      material_silhouette: "👚 Material & Silhouette",
      color_combination: "🎨 Color Palette",
      reuse_versatility: "✨ Reuse & Versatility",
      confident_note: "💪 Confidence Boost",
    };

    // 动态获取有内容的建议部分
    const availableSuggestions = Object.entries(suggestionKeyToTitleMap)
      .filter(([key, _]) => suggestion[key] && suggestion[key].trim().length > 0)
      .map(([key, title]) => ({
        key,
        title,
        content: suggestion[key]
      }));

    console.log(`[PERF] 💭 Found ${availableSuggestions.length} suggestion parts to display`);

    // 动态计算延迟时间：30秒总时长，均匀分布
    const totalDisplayTime = 30000; // 30秒
    const delayBetweenBubbles = availableSuggestions.length > 1
      ? Math.floor(totalDisplayTime / availableSuggestions.length)
      : 1000; // 如果只有一个建议，延迟1秒

    console.log(`[PERF] 💭 Calculated delay between bubbles: ${delayBetweenBubbles}ms`);

    // 首先替换或添加欢迎消息
    const messageSetupStart = Date.now();
    setMessages((prev) => {
      const newMessages = [...prev];
      // 使用传统方法查找最后一个loading消息
      let lastMessageIndex = -1;
      for (let i = newMessages.length - 1; i >= 0; i--) {
        if (newMessages[i].type === "loading") {
          lastMessageIndex = i;
          break;
        }
      }

      if (lastMessageIndex !== -1) {
        console.log("[SUGGESTION DEBUG] Replacing loading message with welcome");
        newMessages[lastMessageIndex] = {
          id: generateUniqueId(),
          role: "ai",
          type: "text",
          content: "✨ I've analyzed your style! Let me share my insights with you:",
          timestamp: new Date(),
        };
        return newMessages;
      } else {
        console.log("[SUGGESTION DEBUG] Adding new welcome message");
        return [...newMessages, {
          id: generateUniqueId(),
          role: "ai",
          type: "text",
          content: "✨ I've analyzed your style! Let me share my insights with you:",
          timestamp: new Date(),
        }];
      }
    });

    const messageSetupEnd = Date.now();
    const messageSetupTime = messageSetupEnd - messageSetupStart;
    console.log(`[PERF] 💭 Message setup took ${messageSetupTime}ms`);

    // 等待一小段时间让欢迎消息显示
    await new Promise((resolve) => setTimeout(resolve, 800));

    // 逐个显示建议气泡
    for (let i = 0; i < availableSuggestions.length; i++) {
      const { title, content } = availableSuggestions[i];
      const bubbleStartTime = Date.now();

      console.log(`[PERF] 💭 Displaying bubble ${i + 1}/${availableSuggestions.length}: ${title}`);

      // 添加新的聊天气泡
      const bubbleId = generateUniqueId();
      setMessages((prev) => [...prev, {
        id: bubbleId,
        role: "ai",
        type: "text",
        content: `${title}\n\n${content}`,
        timestamp: new Date(),
      }]);

      const bubbleEndTime = Date.now();
      const bubbleDisplayTime = bubbleEndTime - bubbleStartTime;
      console.log(`[PERF] 💭 Bubble ${i + 1} displayed in ${bubbleDisplayTime}ms`);

      // 如果不是最后一个气泡，等待延迟时间
      if (i < availableSuggestions.length - 1) {
        console.log(`[PERF] 💭 Waiting ${delayBetweenBubbles}ms before next bubble...`);
        await new Promise((resolve) => setTimeout(resolve, delayBetweenBubbles));
      }
    }

    const suggestionEndTime = Date.now();
    const totalSuggestionTime = suggestionEndTime - suggestionStartTime;
    console.log(`[PERF] 💭 SUGGESTION DISPLAY COMPLETED: Total time ${totalSuggestionTime}ms`);
    console.log(`[PERF] 💭 - Message setup: ${messageSetupTime}ms`);
    console.log(`[PERF] 💭 - Bubbles displayed: ${availableSuggestions.length}`);
    console.log(`[PERF] 💭 - Average delay between bubbles: ${delayBetweenBubbles}ms`);
    console.log(`[PERF] 💭 - Target time: 30000ms, Actual time: ${totalSuggestionTime}ms`);

    console.log("[SUGGESTION DEBUG] All suggestion bubbles displayed, ready for image generation");
    setIsDisplayingSuggestion(false);

    // 立即添加下一阶段的加载消息，不等待
    setMessages((prev) => [...prev, {
      id: generateUniqueId(),
      role: "ai",
      type: "loading",
      loadingText: "Now creating your personalized style images...",
      timestamp: new Date(),
    }]);

    // 开始显示等待期间的小贴士
    displayWaitingTips();
  };

  const getOccasionName = (occasionId: string) => {
    const style = styles.find((s) => s.id === occasionId);
    return style ? style.name : "Unknown Occasion";
  };

  const getFileFromPreview = async (
    previewUrl: string,
    defaultName: string,
  ): Promise<File | null> => {
    if (!previewUrl) return null;
    try {
      const response = await fetch(previewUrl);
      const blob = await response.blob();
      const fileType = blob.type || "image/jpeg";
      const fileName = defaultName;
      return new File([blob], fileName, { type: fileType });
    } catch (error) {
      console.error("Error converting preview to file:", error);
      return null;
    }
  };

  const startGeneration = async () => {
    const startTime = Date.now();
    console.log(`[PERF] 🚀 GENERATION STARTED at ${new Date().toISOString()}`);

    if (!chatData) {
      addMessage({
        type: "text",
        role: "ai",
        content: "Error: Chat data is missing. Please start over.",
      });
      return;
    }

    setIsGenerating(true);
    setCurrentStep("generating");
    setPollingError(null);
    processedStatusesRef.current.clear();
    setIntermediateImageDisplayed(false);
    setHasProcessedCompletion(false);
    setIsShowingWaitingTips(false);
    isShowingWaitingTipsRef.current = false;

    addMessage({
      type: "loading",
      role: "ai",
      loadingText: "Analyzing your request, please wait...",
    });

    try {
      // Phase 1: Image File Preparation
      const filePreparationStart = Date.now();
      console.log(`[PERF] 📁 Phase 1: Starting image file preparation at ${new Date().toISOString()}`);

      const selfieFile = await getFileFromPreview(chatData.selfiePreview, "user_selfie.jpg");
      const clothingFile = await getFileFromPreview(chatData.clothingPreview, "user_clothing.jpg");

      if (!selfieFile || !clothingFile) {
        throw new Error("Could not prepare image files for upload.");
      }

      const filePreparationEnd = Date.now();
      const filePreparationTime = filePreparationEnd - filePreparationStart;
      console.log(`[PERF] 📁 Phase 1 COMPLETED: File preparation took ${filePreparationTime}ms`);

      // Phase 2: FormData Assembly & API Request
      const apiRequestStart = Date.now();
      console.log(`[PERF] 🌐 Phase 2: Starting API request preparation at ${new Date().toISOString()}`);

      const formData = new FormData();
      formData.append("human_image", selfieFile);
      formData.append("garment_image", clothingFile);
      formData.append("occasion", chatData.occasion);
      formData.append("generation_mode", chatData.generationMode);

      if (stylePrompts[chatData.occasion as keyof typeof stylePrompts]) {
        formData.append("style_prompt", stylePrompts[chatData.occasion as keyof typeof stylePrompts]);
      } else {
        console.warn(`No style prompt found for occasion: ${chatData.occasion}`);
      }

      console.log(`[PERF] 🌐 Phase 2: Sending API request to /api/generation/start`);
      const response = await fetch("/api/generation/start", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to start the generation job.");
      }

      const data = await response.json();
      const newJobId = data.jobId; // Capture new job ID
      setJobId(newJobId); // Set state

      const apiRequestEnd = Date.now();
      const apiRequestTime = apiRequestEnd - apiRequestStart;
      const totalInitTime = apiRequestEnd - startTime;

      console.log(`[PERF] 🌐 Phase 2 COMPLETED: API request took ${apiRequestTime}ms`);
      console.log(`[PERF] ⚡ INITIALIZATION COMPLETE: Total init time ${totalInitTime}ms (File prep: ${filePreparationTime}ms + API: ${apiRequestTime}ms)`);

      // 1. Call startPolling directly instead of relying on useEffect
      console.log(`[PERF] 🔄 Calling startPolling directly for Job ID: ${newJobId}`);
      startPolling(newJobId);

      // Restore the proper, multi-step loading messages
      replaceLastLoadingMessage({
        type: "text",
        role: "ai",
        content:
          "Great! Your request has been sent. I'm starting the design process now. This might take a minute or two.",
      });
      addMessage({
        type: "loading",
        role: "ai",
        loadingText: "Generating suggestions for you...",
      });

    } catch (error) {
      const errorTime = Date.now();
      const totalErrorTime = errorTime - startTime;
      console.error(`[PERF] ❌ GENERATION FAILED after ${totalErrorTime}ms:`, error);

      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      replaceLastLoadingMessage({
        type: "text",
        role: "ai",
        content: `Sorry, something went wrong: ${errorMessage}`,
      });
      setIsGenerating(false);
      setCurrentStep("error");
    }
  };

  const startPolling = (jobId: string) => {
    const pollingStartTime = Date.now();
    let suggestionDisplayTime = 0; // 在轮询开始时初始化
    console.log(`[PERF] 🔄 POLLING STARTED for job ${jobId} at ${new Date().toISOString()}`);

    const interval = setInterval(async () => {
      try {
        const pollRequestStart = Date.now();
        const response = await fetch(`/api/generation/status?jobId=${jobId}`);
        if (!response.ok) {
          throw new Error(`The server responded with status: ${response.status}`);
        }
        const data = await response.json();
        const pollRequestEnd = Date.now();
        const pollRequestTime = pollRequestEnd - pollRequestStart;

        console.log(`[PERF] 📡 Poll request took ${pollRequestTime}ms, received status: ${data.status}`);

        const statusKey = data.status;
        console.log("[POLLING DEBUG] Current statusKey:", statusKey);
        console.log("[POLLING DEBUG] processedStatusesRef contents:", Array.from(processedStatusesRef.current));

        if (processedStatusesRef.current.has(statusKey)) {
          console.log("[POLLING DEBUG] Status already processed, skipping:", statusKey);
          return;
        }

        // Mark status as processed immediately to prevent concurrent processing
        processedStatusesRef.current.add(statusKey);
        console.log("[POLLING DEBUG] Marked status as processed:", statusKey);

        const statusProcessStart = Date.now();

        switch (data.status) {
          case "suggestion_generated":
            console.log(`[PERF] 💡 Phase 4: SUGGESTION_GENERATED received at ${new Date().toISOString()}`);
            const suggestionDisplayStart = Date.now();

            console.log("[POLLING DEBUG] Processing suggestion_generated status");
            await displaySuggestionSequentially(data.suggestion);

            const suggestionDisplayEnd = Date.now();
            suggestionDisplayTime = suggestionDisplayEnd - suggestionDisplayStart; // 更新外部作用域的变量
            const totalSuggestionTime = suggestionDisplayEnd - pollingStartTime;

            console.log(`[PERF] 💡 Phase 4 COMPLETED: Suggestion display took ${suggestionDisplayTime}ms`);
            console.log(`[PERF] 💡 Total time from polling start to suggestion complete: ${totalSuggestionTime}ms`);

            console.log("[POLLING DEBUG] Replacing loading message after suggestion display");
            replaceLastLoadingMessage({
              role: "ai",
              type: "loading",
              loadingText: "Creating a suitable scene and pose for you...",
            });
            break;

          case "stylization_completed":
            if (!intermediateImageDisplayed) {
              const styledImageUrl = data.styledImage;
              if (!styledImageUrl) break;

              const stylizationTime = Date.now() - pollingStartTime;
              console.log(`[PERF] 🎨 Phase 5: STYLIZATION_COMPLETED received after ${stylizationTime}ms`);

              setIntermediateImageDisplayed(true);
              processedStatusesRef.current.add("stylization_completed");

              replaceLastLoadingMessage({
                role: "ai",
                type: "text",
                content: "Here is the designed scene and pose, now putting on the final outfit for you...",
              });

              addMessage({
                role: "ai",
                type: "image",
                imageUrl: styledImageUrl,
              });

              addMessage({
                role: "ai",
                type: "loading",
                loadingText: "Performing final composition, please wait...",
              });

              console.log(`[PERF] 🎨 Phase 5: Intermediate image displayed, continuing to final generation...`);
            }
            break;

          case "completed":
            if (!hasProcessedCompletion) {
              const completionTime = Date.now();
              const totalGenerationTime = completionTime - pollingStartTime;

              console.log(`[PERF] 🎉 Phase 6: GENERATION COMPLETED after ${totalGenerationTime}ms total`);
              setCurrentStep("complete");

              // 🔧 FIX: Reset isGenerating and isLoading to false when generation is complete
              setIsGenerating(false);
              setIsLoading(false); // Reset loading state for unified chat

              // 停止显示等待小贴士
              setIsShowingWaitingTips(false);
              isShowingWaitingTipsRef.current = false;

              const showCompletion = () => {
                const finalDisplayStart = Date.now();
                setHasProcessedCompletion(true);
                console.log("[POLLING] Status is completed. Final URL:", data.result?.imageUrl);
                const finalImageUrl = data.result?.imageUrl;
                if (finalImageUrl) {
                  // Add completion message
                  addMessage({
                    type: 'text',
                    role: 'ai',
                    content: '🎉 您的穿搭生成已完成！这是为您生成的结果：'
                  });

                  replaceLastLoadingMessage({
                    type: "text",
                    role: "ai",
                    content: getChatCompletionMessage(getOccasionName(chatData!.occasion)),
                  });

                  addMessage({
                    type: "image",
                    role: "ai",
                    imageUrl: finalImageUrl,
                    agentInfo: {
                      id: "style",
                      name: "小雅",
                      emoji: "👗"
                    }
                  });

                  // 🆕 通知ChatAgent将生成的图片添加到上下文中
                  const sessionId = localStorage.getItem("chat_session_id");
                  if (sessionId) {
                    fetch('/api/chat/simple', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        sessionId,
                        imageUrl: finalImageUrl,
                        action: 'add_generated_image'
                      })
                    }).then(response => response.json())
                      .then(result => {
                        if (result.success) {
                          console.log('[ChatPage] ✅ Generated image added to ChatAgent context');
                        } else {
                          console.warn('[ChatPage] ⚠️ Failed to add generated image to context:', result);
                        }
                      })
                      .catch(error => {
                        console.error('[ChatPage] ❌ Error adding generated image to context:', error);
                      });
                  }

                  const finalDisplayEnd = Date.now();
                  const finalDisplayTime = finalDisplayEnd - finalDisplayStart;
                  const grandTotalTime = finalDisplayEnd - pollingStartTime;

                  console.log(`[PERF] 🎉 FINAL IMAGE DISPLAYED: Display took ${finalDisplayTime}ms`);
                  console.log(`[PERF] 🏁 GENERATION FLOW COMPLETE: Grand total ${grandTotalTime}ms`);
                  console.log(`[PERF] 📊 PERFORMANCE SUMMARY:`);
                  console.log(`[PERF] 📊 - Total generation time: ${grandTotalTime}ms (${(grandTotalTime / 1000).toFixed(1)}s)`);
                  console.log(`[PERF] 📊 - Suggestion phase: ${suggestionDisplayTime}ms`);
                  console.log(`[PERF] 📊 - Final display: ${finalDisplayTime}ms`);
                } else {
                  replaceLastLoadingMessage({
                    type: "text",
                    role: "ai",
                    content: "Sorry, the generation is complete, but the image link was lost.",
                  });
                  console.log(`[PERF] ❌ Generation completed but image URL missing after ${totalGenerationTime}ms`);
                }
                console.log("[POLLING] Stopping polling because job is complete.");
                clearInterval(interval);
                setPollingIntervalId(null);
              };

              // 优化：移除等待机制，立即显示最终图片，不等待建议显示完成
              showCompletion();
            }
            break;

          case "failed":
            const failureTime = Date.now() - pollingStartTime;
            console.log(`[PERF] ❌ GENERATION FAILED after ${failureTime}ms`);

            // 🔧 FIX: Reset both isGenerating and isLoading to false when generation fails
            setIsGenerating(false);
            setIsLoading(false); // Reset loading state for unified chat
            setCurrentStep("error");

            throw new Error(data.statusMessage || "Generation failed without a specific reason.");

          default:
            console.log(`[POLLING] Unhandled status: ${data.status}`);
        }

        const statusProcessEnd = Date.now();
        const statusProcessTime = statusProcessEnd - statusProcessStart;
        console.log(`[PERF] ⚙️ Status processing took ${statusProcessTime}ms for status: ${data.status}`);

      } catch (error) {
        const errorTime = Date.now();
        const totalErrorTime = errorTime - pollingStartTime;
        console.error(`[PERF] ❌ POLLING ERROR after ${totalErrorTime}ms:`, error);

        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
        setPollingError(errorMessage);
        replaceLastLoadingMessage({
          type: "text",
          role: "ai",
          content: `Sorry, we ran into a problem: ${errorMessage}`,
        });
        clearInterval(interval);
        setPollingIntervalId(null);

        // 🔧 FIX: Reset both isGenerating and isLoading to false when there's an error
        setIsGenerating(false);
        setIsLoading(false); // Reset loading state for unified chat
      }
    }, 3000);

    setPollingIntervalId(interval);
  };

  // 2. Prevent rendering on server and initial client render to avoid hydration mismatch
  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF6EC7]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50 pb-20">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-gray-200">
        <div className="flex items-center justify-between px-4 py-3">
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="p-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-playfair text-lg font-bold text-gray-800">AI Stylist</h1>
          <div className="w-9" />
        </div>
      </header>

      {/* Status indicator for ongoing processes */}
      {(isGenerating || isLoading || isImageProcessing) && (
        <div className="sticky top-16 z-20 px-4 py-2 bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50">
          <div className="max-w-2xl mx-auto">
            <div className="bg-white/95 backdrop-blur-lg rounded-2xl p-3 shadow-lg border border-gray-200">
              <div className="flex items-center gap-3">
                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                <span className="text-sm text-gray-600 font-medium">
                  {isImageProcessing ? '🖼️ 正在压缩图片以提升传输效率...' :
                    isGenerating ? '🎨 正在生成您的专属穿搭效果...' :
                      '💭 AI正在思考中...'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Fix hydration error by rendering page shell and showing loader inside content area */}
      <div className="flex-1 px-4 py-6 space-y-4">
        {!isInitialized ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-[#FF6EC7]" />
          </div>
        ) : (
          <div className="max-w-2xl mx-auto">
            {messages.map((message) => (
              <ChatBubble key={message.id} message={message} onImageClick={handleImageClick} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Chat Input Area */}
        <footer className="p-4 bg-white border-t border-gray-200">
          <div className="max-w-2xl mx-auto">
            {/* Staged image preview */}
            {stagedImage && (
              <div className="mb-2 relative w-24 h-24">
                <img src={stagedImage} alt="Preview" className="w-full h-full object-cover rounded-lg" />
                <button
                  onClick={clearStagedImage}
                  className="absolute -top-2 -right-2 bg-gray-700 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs shadow-lg"
                  aria-label="Remove image"
                >
                  X
                </button>
              </div>
            )}

            {/* Image processing indicator */}
            {isImageProcessing && (
              <div className="mb-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                  <span className="text-sm text-blue-700">正在优化图片...</span>
                </div>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const message = (e.target as HTMLFormElement).message.value;
                if (!message.trim() && !stagedImage) return;
                handleSendMessage(message);
                (e.target as HTMLFormElement).reset();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="file"
                ref={imageInputRef}
                onChange={handleImageSelect}
                className="hidden"
                accept="image/*"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleImageUploadClick}
                disabled={isImageProcessing}
                aria-label="Upload image"
              >
                {isImageProcessing ? (
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                ) : (
                  <ImageIcon className="w-5 h-5 text-gray-500" />
                )}
              </Button>
              <input
                name="message"
                placeholder="跟你的专属顾问聊聊吧..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-[#FF6EC7] text-sm"
                autoComplete="off"
              />
              <Button type="submit" className="bg-[#FF6EC7] hover:bg-[#ff5bb0] rounded-full" size="icon" aria-label="Send message">
                <Send className="w-5 h-5 text-white" />
              </Button>
            </form>
          </div>
        </footer>

        {/* Debug panel */}
        {process.env.NODE_ENV === "development" && (
          <div className="max-w-2xl mx-auto mt-4">
            <div
              className="bg-gray-100 rounded-lg cursor-pointer select-none"
              onClick={() => setIsDebugExpanded(!isDebugExpanded)}
            >
              <div className="flex items-center justify-between p-3 border-b border-gray-200">
                <h3 className="font-bold text-sm text-gray-700">Debug Info</h3>
                {isDebugExpanded ? (
                  <ChevronUp className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                )}
              </div>
            </div>

            {isDebugExpanded && (
              <div className="bg-gray-100 rounded-b-lg p-4 text-xs space-y-1">
                <div className="font-semibold text-gray-800 mb-2">🎯 Unified Chat States:</div>
                <div>sessionId: {sessionId}</div>
                <div>isLoading: <span className="font-bold">{String(isLoading)}</span></div>
                <div className="font-semibold text-gray-800 mt-3 mb-2">📊 Generation States:</div>
                <div>isGenerating: <span className="font-bold">{String(isGenerating)}</span></div>
                <div>currentStep: <span className="font-bold">{String(currentStep)}</span></div>
                <div>hasAutoStarted: {String(hasAutoStarted)}</div>
                <div>pollingActive: {pollingIntervalId ? "yes" : "no"}</div>
                <div className="font-semibold text-gray-800 mt-3 mb-2">💾 Data States:</div>
                <div>chatData: {chatData ? "exists" : "null"}</div>
                <div>messages.length: {String(messages.length)}</div>
                <div>pollingError: {pollingError || "none"}</div>
              </div>
            )}
          </div>
        )}

        {/* Generation button for guided mode (when chat data exists but no auto-start) */}
        {!isGenerating && currentStep === "suggestion" && chatData && messages.length > 0 && !hasAutoStarted && (
          <div className="max-w-2xl mx-auto mt-8">
            <div className="bg-white/80 rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-sm text-gray-600 mb-4 text-center">
                Ready to generate your personalized style?
              </p>
              <Button
                onClick={() => {
                  console.log("[CHAT DEBUG] Start generation button clicked");
                  startGeneration();
                }}
                className="w-full bg-[#FF6EC7] hover:bg-[#FF6EC7]/90"
              >
                Generate My Style
              </Button>
            </div>
          </div>
        )}

        {/* Return to homepage button when no chat data */}
        {!chatData && messages.length >= 1 && (
          <div className="max-w-2xl mx-auto mt-8">
            <div className="bg-white/80 rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-sm text-gray-600 mb-4 text-center">
                Want to generate styling effects? Upload your photos first!
              </p>
              <Button
                onClick={() => router.push('/')}
                variant="outline"
                className="w-full"
              >
                <Upload className="w-4 h-4 mr-2" />
                Go to Homepage
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Image Modal */}
      <ImageModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        imageUrl={modalImage || ''}
      />

      {/* iOS Tab Bar */}
      <IOSTabBar />
    </div>
  );
}