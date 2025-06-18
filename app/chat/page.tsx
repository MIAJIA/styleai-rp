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

  const [jobId, setJobId] = useState<string | null>(null);
  const [pollingError, setPollingError] = useState<string | null>(null);

  const [modalImage, setModalImage] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Debug panel state - collapsed by default
  const [isDebugExpanded, setIsDebugExpanded] = useState(false);

  // Track if auto-generation has been triggered to prevent multiple calls
  const [hasAutoStarted, setHasAutoStarted] = useState(false);

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
      const lastMessageIndex = newMessages.findLastIndex((m) => m.type === "loading");

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
    };

    let suggestionMessageId: string | null = null;

    // First, try to replace the last loading message with the initial text
    const messageSetupStart = Date.now();
    setMessages((prev) => {
      const newMessages = [...prev];
      const lastMessageIndex = newMessages.findLastIndex((m) => m.type === "loading");

      if (lastMessageIndex !== -1) {
        const newId = generateUniqueId();
        suggestionMessageId = newId;
        console.log("[SUGGESTION DEBUG] Replacing loading message");
        newMessages[lastMessageIndex] = {
          id: newId,
          role: "ai",
          type: "text",
          content: "Ok, I've had a look. Here are some of my thoughts:\n\n",
          timestamp: new Date(),
        };
        return newMessages;
      } else {
        console.log("[SUGGESTION DEBUG] No loading message found, will add new message");
      }
      return prev;
    });

    // If we couldn't find a loading message to replace, add a new one
    if (!suggestionMessageId) {
      console.log("[SUGGESTION DEBUG] Adding new suggestion message");
      const newId = generateUniqueId();
      suggestionMessageId = newId;
      setMessages((prev) => [...prev, {
        id: newId,
        role: "ai",
        type: "text",
        content: "Ok, I've had a look. Here are some of my thoughts:\n\n",
        timestamp: new Date(),
      }]);
    }

    const messageSetupEnd = Date.now();
    const messageSetupTime = messageSetupEnd - messageSetupStart;
    console.log(`[PERF] 💭 Message setup took ${messageSetupTime}ms`);

    console.log(`[PERF] 💭 Starting initial delay (100ms)...`);
    await new Promise((resolve) => setTimeout(resolve, 100)); // 优化：减少初始延迟从500ms到100ms

    const currentSuggestionMessageId = suggestionMessageId;
    const suggestionKeys = Object.keys(suggestionKeyToTitleMap).filter(key => suggestion[key]);
    console.log(`[PERF] 💭 Processing ${suggestionKeys.length} suggestion items`);

    let itemCount = 0;
    for (const key of suggestionKeys) {
      if (suggestion[key]) {
        const itemStart = Date.now();
        itemCount++;
        const title = suggestionKeyToTitleMap[key as keyof typeof suggestionKeyToTitleMap];

        console.log(`[PERF] 💭 Processing item ${itemCount}/${suggestionKeys.length}: ${title}`);

        setMessages((prev) => {
          const msgIndex = prev.findIndex((m) => m.id === currentSuggestionMessageId);
          if (msgIndex !== -1) {
            const updatedMessages = [...prev];
            const oldMessage = updatedMessages[msgIndex];
            const newContent = (oldMessage.content || "") + `${title}\n${suggestion[key]}\n\n`;
            updatedMessages[msgIndex] = {
              ...oldMessage,
              content: newContent,
            };
            return updatedMessages;
          }
          return prev;
        });

        const itemEnd = Date.now();
        const itemTime = itemEnd - itemStart;
        console.log(`[PERF] 💭 Item ${itemCount} displayed in ${itemTime}ms, starting delay (200ms)...`);

        await new Promise((resolve) => setTimeout(resolve, 200)); // 优化：减少每项延迟从800ms到200ms
      }
    }

    const suggestionEndTime = Date.now();
    const totalSuggestionTime = suggestionEndTime - suggestionStartTime;
    console.log(`[PERF] 💭 SUGGESTION DISPLAY COMPLETED: Total time ${totalSuggestionTime}ms`);
    console.log(`[PERF] 💭 - Message setup: ${messageSetupTime}ms`);
    console.log(`[PERF] 💭 - Initial delay: 100ms`);
    console.log(`[PERF] 💭 - Items processed: ${itemCount}`);
    console.log(`[PERF] 💭 - Item delays: ${itemCount * 200}ms`);
    console.log(`[PERF] 💭 - Actual processing time: ${totalSuggestionTime - 100 - (itemCount * 200)}ms`);

    console.log("[SUGGESTION DEBUG] Finished displaying suggestion");
    setIsDisplayingSuggestion(false);
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
            const suggestionDisplayTime = suggestionDisplayEnd - suggestionDisplayStart;
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

              const showCompletion = () => {
                const finalDisplayStart = Date.now();
                setHasProcessedCompletion(true);
                console.log("[POLLING] Status is completed. Final URL:", data.result?.imageUrl);
                const finalImageUrl = data.result?.imageUrl;
                if (finalImageUrl) {
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
                  console.log(`[PERF] 📊 - Suggestion phase: ${suggestionDisplayTime || 'N/A'}ms`);
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

      <div className="flex-1 px-4 py-6 space-y-4">
        <div className="max-w-2xl mx-auto">
          {messages.map((message) => (
            <ChatBubble key={message.id} message={message} onImageClick={handleImageClick} />
          ))}
          <div ref={messagesEndRef} />
        </div>

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
                <div>isGenerating: {String(isGenerating)}</div>
                <div>currentStep: {String(currentStep)}</div>
                <div>chatData: {chatData ? "exists" : "null"}</div>
                <div>messages.length: {String(messages.length)}</div>
                <div>pollingError: {pollingError || "none"}</div>
                <div>hasProcessedCompletion: {String(hasProcessedCompletion)}</div>
                <div>pollingActive: {pollingIntervalId ? "yes" : "no"}</div>
                <div>
                  Show start button:{" "}
                  {String(!isGenerating && currentStep === "suggestion" && chatData && messages.length === 6)}
                </div>
                <div className="pt-2">
                  <div className="font-semibold mb-1">Raw chatData:</div>
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

        {(() => {
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

        {(() => {
          const shouldShowReturnButton = !chatData && messages.length === 1;
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