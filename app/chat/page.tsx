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
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getChatWelcomeMessage,
  getChatConfirmationMessage,
  formatStyleSuggestion,
  getChatCompletionMessage,
} from "@/lib/prompts";

// Chat message type definition
type ChatMessage = {
  id: string;
  type: "text" | "image" | "loading";
  role: "ai" | "user";
  content?: string;
  imageUrl?: string;
  loadingText?: string;
  timestamp: Date;
};

// Data type passed from the main page
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
  type: "text" | "image" | "loading",
  role: "ai" | "user",
  content?: string,
  imageUrl?: string,
  loadingText?: string,
): ChatMessage => ({
  id: `msg-${Date.now()}-${Math.random()}`,
  type,
  role,
  content,
  imageUrl,
  loadingText,
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

// Chat Bubble component
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
      {isAI && <AIAvatar />}
      <div
        className={`
          px-4 py-3 rounded-2xl max-w-[80%]
          ${isAI ? "bg-white shadow-sm border border-gray-100" : "bg-[#FF6EC7] text-white"}
        `}
      >
        {message.type === "loading" && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-150"></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-300"></div>
            {message.loadingText && <span className="text-sm text-gray-600">{message.loadingText}</span>}
          </div>
        )}
        {message.type === "text" && (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        )}
        {message.type === "image" && message.imageUrl && (
          <img
            src={message.imageUrl}
            alt="Generated image"
            width={300}
            height={400}
            className="rounded-lg cursor-pointer"
            onClick={() => message.imageUrl && onImageClick(message.imageUrl)}
          />
        )}
      </div>
    </div>
  );
}

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
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

  // 🆕 NEW: Free chat mode state
  const [isFreeMode, setIsFreeMode] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [sessionId, setSessionId] = useState<string>('');
  const [isFreeChatLoading, setIsFreeChatLoading] = useState(false);

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

  const generateUniqueId = () => {
    setMessageIdCounter((prev) => prev + 1);
    return `msg-${Date.now()}-${messageIdCounter}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const addMessage = (message: Omit<ChatMessage, "id" | "timestamp">) => {
    const newMessage: ChatMessage = {
      ...message,
      id: generateUniqueId(),
      timestamp: new Date(),
    };
    setMessages((prevMessages) => [...prevMessages, newMessage]);
  };

  const upsertMessage = (message: Omit<ChatMessage, "id" | "timestamp">, targetId?: string) => {
    setMessages((prevMessages) => {
      const existingMsgIndex = targetId ? prevMessages.findIndex((m) => m.id === targetId) : -1;
      if (existingMsgIndex !== -1) {
        const updatedMessages = [...prevMessages];
        updatedMessages[existingMsgIndex] = { ...updatedMessages[existingMsgIndex], ...message };
        return updatedMessages;
      } else {
        return [...prevMessages, { ...message, id: generateUniqueId(), timestamp: new Date() }];
      }
    });
  };

  const replaceLastLoadingMessage = (message: Omit<ChatMessage, "id" | "timestamp">) => {
    setMessages((prevMessages) => {
      const newMessages = [...prevMessages];
      // 使用传统方法查找最后一个loading消息
      let lastMessageIndex = -1;
      for (let i = newMessages.length - 1; i >= 0; i--) {
        if (newMessages[i].type === "loading") {
          lastMessageIndex = i;
          break;
        }
      }

      if (lastMessageIndex !== -1) {
        newMessages[lastMessageIndex] = {
          ...message,
          id: newMessages[lastMessageIndex].id,
          timestamp: new Date(),
        };
        return newMessages;
      }
      return [...newMessages, { ...message, id: generateUniqueId(), timestamp: new Date() }];
    });
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

      console.log(`[PERF] 🎭 Displaying waiting content ${i + 1}/${allWaitingContent.length}: ${allWaitingContent[i].substring(0, 20)}...`);

      setMessages((prev) => [...prev, {
        id: generateUniqueId(),
        role: "ai",
        type: "text",
        content: allWaitingContent[i],
        timestamp: new Date(),
      }]);
    }

    console.log("[PERF] 🎭 WAITING TIPS COMPLETED");
    setIsShowingWaitingTips(false);
    isShowingWaitingTipsRef.current = false;
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
      setJobId(data.jobId);

      const apiRequestEnd = Date.now();
      const apiRequestTime = apiRequestEnd - apiRequestStart;
      const totalInitTime = apiRequestEnd - startTime;

      console.log(`[PERF] 🌐 Phase 2 COMPLETED: API request took ${apiRequestTime}ms`);
      console.log(`[PERF] ⚡ INITIALIZATION COMPLETE: Total init time ${totalInitTime}ms (File prep: ${filePreparationTime}ms + API: ${apiRequestTime}ms)`);
      console.log(`[PERF] 🔄 Phase 3: Starting polling for Job ID: ${data.jobId}`);

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

              // 🔧 FIX: Reset isGenerating to false when generation is complete
              setIsGenerating(false);

              // 停止显示等待小贴士
              setIsShowingWaitingTips(false);
              isShowingWaitingTipsRef.current = false;

              const showCompletion = () => {
                const finalDisplayStart = Date.now();
                setHasProcessedCompletion(true);
                console.log("[POLLING] Status is completed. Final URL:", data.result?.imageUrl);
                const finalImageUrl = data.result?.imageUrl;
                if (finalImageUrl) {
                  // 🆕 SMART: Add context message if user switched to free mode during generation
                  if (isFreeMode) {
                    addMessage({
                      type: 'text',
                      role: 'ai',
                      content: '🎉 您之前的穿搭生成已完成！这是为您生成的结果：'
                    });
                  }

                  replaceLastLoadingMessage({
                    type: "text",
                    role: "ai",
                    content: getChatCompletionMessage(getOccasionName(chatData!.occasion)),
                  });
                  addMessage({
                    type: "image",
                    role: "ai",
                    imageUrl: finalImageUrl,
                  });

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

            // 🔧 FIX: Reset isGenerating to false when generation fails
            setIsGenerating(false);
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

        // 🔧 FIX: Reset isGenerating to false when there's an error
        setIsGenerating(false);
      }
    }, 3000);

    setPollingIntervalId(interval);
  };

  useEffect(() => {
    if (isInitialized) {
      console.log("[CHAT DEBUG] Already initialized, skipping...");
      return;
    }

    console.log("[CHAT DEBUG] Page initialized, reading sessionStorage...");

    try {
      const storedData = sessionStorage.getItem("chatModeData");
      console.log("[CHAT DEBUG] Raw sessionStorage data:", storedData);

      if (storedData) {
        const parsedData = JSON.parse(storedData);
        console.log("[CHAT DEBUG] Parsed chat data:", parsedData);
        setChatData(parsedData);

        const welcomeMessage = getChatWelcomeMessage(getOccasionName(parsedData.occasion));

        console.log("[CHAT DEBUG] Adding welcome message:", welcomeMessage);

        const initialMessages: ChatMessage[] = [];
        let idCounter = 0;

        const createMessage = (message: Omit<ChatMessage, "id" | "timestamp">): ChatMessage => ({
          ...message,
          id: `msg-${Date.now()}-${++idCounter}`,
          timestamp: new Date(),
        });

        initialMessages.push(
          createMessage({
            type: "text",
            role: "ai",
            content: welcomeMessage,
          }),
        );

        initialMessages.push(
          createMessage({
            type: "text",
            role: "user",
            content: "Here is my photo:",
          }),
        );

        initialMessages.push(
          createMessage({
            type: "image",
            role: "user",
            imageUrl: parsedData.selfiePreview,
          }),
        );

        initialMessages.push(
          createMessage({
            type: "text",
            role: "user",
            content: "I want to try on this piece of clothing:",
          }),
        );

        initialMessages.push(
          createMessage({
            type: "image",
            role: "user",
            imageUrl: parsedData.clothingPreview,
          }),
        );

        initialMessages.push(
          createMessage({
            type: "text",
            role: "ai",
            content: getChatConfirmationMessage(getOccasionName(parsedData.occasion)),
          }),
        );

        setMessages(initialMessages);
        setMessageIdCounter(idCounter);

        // Mark that auto-start should happen, but let useEffect handle it
        console.log("[CHAT DEBUG] Marking for auto-start generation...");
        setHasAutoStarted(true);

      } else {
        console.log("[CHAT DEBUG] No sessionStorage data found, showing default message");
        const defaultMessage: ChatMessage = {
          id: `msg-${Date.now()}-1`,
          type: "text",
          role: "ai",
          content:
            "Hello! I'm your personal AI stylist ✨\n\nPlease select your photo and clothing on the homepage first, and then I can generate exclusive outfit suggestions for you!",
          timestamp: new Date(),
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
        content:
          "Hello! I'm your personal AI stylist ✨\n\nPlease select your photo and clothing on the homepage first, and then I can generate exclusive outfit suggestions for you!",
        timestamp: new Date(),
      };
      setMessages([errorMessage]);
      setMessageIdCounter(1);
    }

    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (jobId) {
      startPolling(jobId);
    }
  }, [jobId]);

  // Auto-start generation when chatData is ready and auto-start is requested
  useEffect(() => {
    if (chatData && hasAutoStarted && !isGenerating && currentStep === "suggestion") {
      console.log("[CHAT DEBUG] Auto-starting generation with chatData:", chatData);
      startGeneration();
    }
  }, [chatData, hasAutoStarted, isGenerating, currentStep]);

  useEffect(() => {
    console.log("[CHAT DEBUG] State changed:", {
      isGenerating,
      currentStep,
      chatData: chatData ? "exists" : "null",
      messagesLength: messages.length,
      pollingError,
    });
  }, [isGenerating, currentStep, chatData, messages.length, pollingError]);

  useEffect(() => {
    return () => {
      if (pollingIntervalId) {
        console.log("[LIFECYCLE] Component unmounting, clearing polling interval.");
        clearInterval(pollingIntervalId);
      }
    };
  }, [pollingIntervalId]);

  // 🆕 NEW: Generate session ID
  const generateSessionId = () => {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  // Initialize session ID
  useEffect(() => {
    if (!sessionId) {
      setSessionId(generateSessionId());
    }
  }, []);

  // 🆕 NEW: Free chat handler
  const handleFreeChat = async () => {
    if (!userInput.trim() || isFreeChatLoading) return;

    const currentInput = userInput.trim();
    setUserInput('');
    setIsFreeChatLoading(true);

    // Add user message
    const userMessage: ChatMessage = {
      id: generateUniqueId(),
      type: 'text',
      role: 'user',
      content: currentInput,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    // Add loading message
    const loadingMessage: ChatMessage = {
      id: generateUniqueId(),
      type: 'loading',
      role: 'ai',
      loadingText: 'AI正在思考中...',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, loadingMessage]);

    try {
      const response = await fetch('/api/chat/simple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: currentInput,
          sessionId: sessionId
        })
      });

      const data = await response.json();

      if (data.success && data.response) {
        // Replace loading message with AI response
        setMessages(prev => {
          const newMessages = [...prev];
          const lastLoadingIndex = newMessages.findLastIndex(msg => msg.type === 'loading');
          if (lastLoadingIndex !== -1) {
            newMessages[lastLoadingIndex] = {
              id: newMessages[lastLoadingIndex].id,
              type: 'text',
              role: 'ai',
              content: data.response,
              timestamp: new Date(),
            };
          }
          return newMessages;
        });
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Free chat error:', error);
      // Replace loading message with error
      setMessages(prev => {
        const newMessages = [...prev];
        const lastLoadingIndex = newMessages.findLastIndex(msg => msg.type === 'loading');
        if (lastLoadingIndex !== -1) {
          newMessages[lastLoadingIndex] = {
            id: newMessages[lastLoadingIndex].id,
            type: 'text',
            role: 'ai',
            content: '抱歉，出现了一些问题，请稍后再试。如果问题持续，请检查您的网络连接。',
            timestamp: new Date(),
          };
        }
        return newMessages;
      });
    } finally {
      setIsFreeChatLoading(false);
    }
  };

  // 🆕 NEW: Handle enter key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleFreeChat();
    }
  };

  // 🆕 NEW: Enhanced mode switcher with intelligent state management
  const handleModeSwitch = () => {
    try {
      if (isFreeMode) {
        // Switching from free mode to guided mode
        setIsFreeMode(false);
        setUserInput(''); // Clear any pending input

        // Stop any ongoing free chat loading
        setIsFreeChatLoading(false);

        // If no chat data exists, show instruction message
        if (!chatData) {
          addMessage({
            type: 'text',
            role: 'ai',
            content: '👋 欢迎使用引导模式！\n\n请先返回首页选择您的照片和服装，然后我就可以为您生成专属的穿搭建议啦！'
          });
        }
      } else {
        // Switching from guided mode to free mode
        // If generation is in progress, handle gracefully
        if (isGenerating) {
          handleGenerationInterruption();
        }

        switchToFreeMode();
      }
    } catch (error) {
      console.error('[MODE SWITCH] Error during mode switch:', error);
    }
  };

  // 🆕 NEW: Handle interruption of ongoing generation
  const handleGenerationInterruption = () => {
    // Add a message explaining the interruption
    addMessage({
      type: 'text',
      role: 'ai',
      content: '⏸️ 生成过程已暂停，切换到自由对话模式。\n\n如需继续生成，请切换回引导模式。生成进度已保存，您可以随时继续。'
    });

    // Note: We intentionally DON'T stop the generation process
    // This allows users to switch back and see the results
    // The generation will continue in the background
  };

  // 🆕 NEW: Switch to free mode with welcome message
  const switchToFreeMode = () => {
    setIsFreeMode(true);

    // Add welcome message for free mode if messages are mostly guided content
    const shouldAddWelcome = messages.length === 0 ||
      (messages.length > 0 && !messages.some(msg =>
        msg.content?.includes('专业穿搭顾问') ||
        msg.content?.includes('随时问我任何关于穿搭的问题')
      ));

    if (shouldAddWelcome) {
      addMessage({
        type: 'text',
        role: 'ai',
        content: '👋 切换到自由对话模式！我是你的专业穿搭顾问！\n\n我可以帮你：\n• 分析你的穿搭风格\n• 推荐适合的服装搭配\n• 解答时尚穿搭问题\n• 提供场合着装建议\n\n随时问我任何关于穿搭的问题吧！'
      });
    }
  };

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

      {/* 🆕 FIXED: Always visible mode switcher with improved event handling */}
      <div className="sticky top-16 z-20 px-4 py-2 bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white/95 backdrop-blur-lg rounded-2xl p-4 shadow-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full transition-all duration-300 ${isFreeMode ? 'bg-blue-500 animate-pulse shadow-lg shadow-blue-200' : 'bg-green-500 shadow-lg shadow-green-200'
                  }`}></div>
                <div>
                  <span className="text-sm font-semibold text-gray-800">
                    {isFreeMode ? '🗣️ 自由对话模式' : '🎯 引导生成模式'}
                  </span>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {isFreeMode
                      ? '随意提问任何穿搭问题，AI会智能回答'
                      : '按流程上传照片，AI生成个性化穿搭建议'
                    }
                  </p>
                </div>
              </div>
              <Button
                onClick={handleModeSwitch}
                variant="outline"
                size="sm"
                className="flex items-center gap-2 hover:bg-gray-50 active:bg-gray-100 transition-all duration-200 border-2 px-4 py-2 min-w-[100px]"
                disabled={isFreeChatLoading}
                type="button"
              >
                {isFreeMode ? (
                  <>
                    <Settings className="w-4 h-4" />
                    <span className="hidden sm:inline font-medium">引导模式</span>
                  </>
                ) : (
                  <>
                    <MessageCircle className="w-4 h-4" />
                    <span className="hidden sm:inline font-medium">自由对话</span>
                    {isGenerating && (
                      <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse ml-1" title="生成进行中，可以切换但进程将在后台继续"></div>
                    )}
                  </>
                )}
              </Button>
            </div>

            {/* Enhanced status indicator */}
            {(isGenerating || isFreeChatLoading) && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                    <span className="text-xs text-gray-600 font-medium">
                      {isGenerating ? '正在生成穿搭建议...' : '正在处理您的问题...'}
                    </span>
                  </div>
                  {isGenerating && (
                    <span className="text-xs text-gray-500">
                      可随时切换模式 →
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 space-y-4">
        <div className="max-w-2xl mx-auto">
          {messages.map((message) => (
            <ChatBubble key={message.id} message={message} onImageClick={handleImageClick} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* 🆕 UPDATED: Free chat input area with better positioning */}
        {isFreeMode && (
          <div className="max-w-2xl mx-auto mt-6">
            <div className="bg-white/90 backdrop-blur-lg rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <textarea
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="问我任何穿搭问题... (按Enter发送，Shift+Enter换行)"
                    className="w-full p-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-transparent resize-none bg-white/70"
                    rows={3}
                    disabled={isFreeChatLoading}
                  />
                </div>
                <Button
                  onClick={handleFreeChat}
                  disabled={!userInput.trim() || isFreeChatLoading}
                  className="bg-[#FF6EC7] hover:bg-[#FF6EC7]/90 p-3 transition-all"
                >
                  {isFreeChatLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </Button>
              </div>

              {/* Enhanced quick suggestions */}
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  '推荐一些时尚单品',
                  '分析我的穿搭风格',
                  '约会怎么穿？',
                  '职场穿搭建议',
                  '季节性搭配技巧',
                  '色彩搭配原理'
                ].map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setUserInput(suggestion);
                      // Auto-send the suggestion
                      setTimeout(() => handleFreeChat(), 100);
                    }}
                    className="px-3 py-1.5 bg-pink-100 hover:bg-pink-200 text-pink-700 rounded-full text-xs transition-colors disabled:opacity-50"
                    disabled={isFreeChatLoading}
                  >
                    💡 {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

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
                <div className="font-semibold text-gray-800 mb-2">🎯 Mode & UI States:</div>
                <div>isFreeMode: <span className="font-bold">{String(isFreeMode)}</span></div>
                <div>sessionId: {sessionId}</div>
                <div>isFreeChatLoading: <span className="font-bold">{String(isFreeChatLoading)}</span></div>
                <div className="font-semibold text-gray-800 mt-3 mb-2">📊 Generation States:</div>
                <div>isGenerating: <span className="font-bold">{String(isGenerating)}</span></div>
                <div>currentStep: <span className="font-bold">{String(currentStep)}</span></div>
                <div>hasAutoStarted: {String(hasAutoStarted)}</div>
                <div>hasProcessedCompletion: {String(hasProcessedCompletion)}</div>
                <div>pollingActive: {pollingIntervalId ? "yes" : "no"}</div>
                <div className="font-semibold text-gray-800 mt-3 mb-2">💾 Data States:</div>
                <div>chatData: {chatData ? "exists" : "null"}</div>
                <div>messages.length: {String(messages.length)}</div>
                <div>pollingError: {pollingError || "none"}</div>
                <div className="pt-2">
                  <div className="font-semibold mb-1">📁 Raw chatData:</div>
                  <pre className="bg-gray-200 p-2 rounded text-xs overflow-auto max-h-40">
                    {chatData
                      ? JSON.stringify(
                        {
                          ...chatData,
                          selfiePreview: chatData.selfiePreview?.startsWith("data:image")
                            ? `${chatData.selfiePreview.substring(0, 30)}... [base64 data truncated]`
                            : chatData.selfiePreview,
                          clothingPreview: chatData.clothingPreview?.startsWith("data:image")
                            ? `${chatData.clothingPreview.substring(0, 30)}... [base64 data truncated]`
                            : chatData.clothingPreview,
                        },
                        null,
                        2,
                      )
                      : "null"}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Only show guided mode buttons when NOT in free mode */}
        {!isFreeMode && (() => {
          const shouldShowButton =
            !isGenerating &&
            currentStep === "suggestion" &&
            chatData &&
            messages.length === 6 &&
            !hasAutoStarted; // Don't show button if auto-generation has started
          console.log("[CHAT DEBUG] Button visibility check:", {
            isGenerating,
            currentStep,
            hasChatData: !!chatData,
            messagesLength: messages.length,
            hasAutoStarted,
            shouldShowButton,
          });

          return shouldShowButton;
        })() && (
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

        {!isFreeMode && (() => {
          const shouldShowReturnButton = !chatData && messages.length >= 1 &&
            messages.some(msg => msg.content?.includes('请先返回首页选择'));
          console.log("[CHAT DEBUG] Return button visibility check:", {
            hasChatData: !!chatData,
            messagesLength: messages.length,
            shouldShowReturnButton,
          });

          return shouldShowReturnButton;
        })() && (
            <div className="max-w-2xl mx-auto mt-8">
              <div className="bg-white/80 rounded-2xl p-4 shadow-sm border border-gray-100">
                <p className="text-sm text-gray-600 mb-4 text-center">
                  Please select your photo and clothing first
                </p>
                <Button
                  onClick={() => {
                    console.log("[CHAT DEBUG] Return to home button clicked");
                    router.push("/");
                  }}
                  className="w-full bg-[#FF6EC7] hover:bg-[#FF6EC7]/90"
                >
                  Return to Homepage
                </Button>
              </div>
            </div>
          )}

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
                Retry
              </Button>
            </div>
          </div>
        )}

        {currentStep === "complete" && (
          <div className="max-w-2xl mx-auto mt-8">
            <div className="bg-white/80 rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-sm text-gray-600 mb-4 text-center">
                🎉 Your personalized style is complete!
              </p>
              <div className="flex gap-3">
                <Button onClick={() => router.push("/")} variant="outline" className="flex-1">
                  Try Another Set
                </Button>
                <Button
                  onClick={() => router.push("/results")}
                  className="flex-1 bg-[#FF6EC7] hover:bg-[#FF6EC7]/90"
                >
                  View My Styles
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <ImageModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        imageUrl={modalImage || ""}
        title="AI-Generated Style Image"
      />

      <IOSTabBar />
    </div>
  );
}