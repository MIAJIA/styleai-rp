"use client";

import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Send,
  Sparkles,
  User,
  Bot,
  Camera,
  Shirt,
  Palette,
  Heart,
  MessageCircle,
  Loader2,
} from "lucide-react";
import {
  loadCompleteOnboardingData,
  getUserPhotos,
  type OnboardingData,
} from "@/lib/onboarding-storage";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  suggestions?: string[];
  isTyping?: boolean;
}

interface UserProfile extends OnboardingData {
  savedAt?: string;
  photoMetadata?: {
    hasFullBodyPhoto: boolean;
    photosStoredSeparately?: boolean;
  };
}

const CONVERSATION_STARTERS = [
  {
    icon: Shirt,
    text: "What should I wear today?",
    color: "bg-blue-100 text-blue-700 border-blue-200"
  },
  {
    icon: Palette,
    text: "Help me find my style",
    color: "bg-purple-100 text-purple-700 border-purple-200"
  },
  {
    icon: Heart,
    text: "Outfit for a date night",
    color: "bg-pink-100 text-pink-700 border-pink-200"
  },
  {
    icon: Camera,
    text: "Analyze my style profile",
    color: "bg-green-100 text-green-700 border-green-200"
  }
];

const AI_RESPONSES = {
  greeting: [
    "Hi there! ✨ I'm your personal AI stylist. I've analyzed your style profile and I'm excited to help you look amazing today! What can I help you with?",
    "Hello gorgeous! 💫 Ready to create some stunning looks together? I have some great ideas based on your unique style profile!",
    "Hey style star! 🌟 I'm here to help you express your beautiful self through fashion. What's on your mind today?"
  ],
  "what should i wear today": [
    "Great question! Based on your style profile, I'd recommend something that highlights your best features. What's the occasion? Work, casual day out, or something special? 💫",
    "I love helping with daily outfit choices! Tell me - what's your mood today? Feeling bold and confident, or more relaxed and comfortable? ✨"
  ],
  "help me find my style": [
    "I'd love to help you discover your unique style! From your profile, I can see you have some amazing features to work with. Let's explore what makes you feel most confident and beautiful! 🌟",
    "Style discovery is my favorite topic! Your profile shows some interesting preferences. What kind of vibe are you drawn to lately? Classic elegance, trendy chic, or something more edgy? ✨"
  ],
  "outfit for a date night": [
    "Ooh, date night! 💕 How exciting! Based on your style profile, I have some gorgeous ideas that will make you feel absolutely stunning. What's the setting - dinner, casual coffee, or something more adventurous?",
    "Date night calls for something special! ✨ I'm thinking we can create a look that's both elegant and shows your personality. Tell me about your date - romantic dinner or fun activity?"
  ],
  "analyze my style profile": [
    "I'd love to dive into your style analysis! 📊 From what I can see, you have some wonderful strengths we can highlight. Your facial features and body proportions give us so many styling opportunities! What aspect interests you most?",
    "Your style profile is fascinating! ✨ I see some great potential for creating looks that really showcase your unique beauty. Would you like me to focus on colors, silhouettes, or overall styling approaches?"
  ],
  default: [
    "That's an interesting question! I'd love to help you with that. Can you tell me a bit more about what you're looking for? ✨",
    "I'm here to help with all your style needs! Could you give me a bit more context so I can provide the best advice? 💫",
    "Great topic! I have some ideas, but I'd love to understand more about your specific situation. Tell me more! 🌟"
  ]
};

export default function MyStylePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [photos, setPhotos] = useState<{ fullBodyPhoto: string | null }>({
    fullBodyPhoto: null,
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const loadProfile = () => {
      try {
        const savedProfile = localStorage.getItem("styleMe_user_profile");
        const onboardingData = loadCompleteOnboardingData();
        const userPhotos = getUserPhotos();

        let profile: UserProfile = onboardingData;

        if (savedProfile) {
          try {
            const parsedProfile = JSON.parse(savedProfile);
            profile = { ...onboardingData, ...parsedProfile };
          } catch (error) {
            console.error("Error parsing saved profile:", error);
          }
        }

        profile.photoMetadata = {
          hasFullBodyPhoto: !!userPhotos.fullBodyPhoto || !!onboardingData.fullBodyPhoto,
          photosStoredSeparately: true,
        };

        setProfileData(profile);
        setPhotos(userPhotos);

        // Initialize conversation with greeting
        const greetingMessage: Message = {
          id: `ai-${Date.now()}`,
          type: 'ai',
          content: AI_RESPONSES.greeting[Math.floor(Math.random() * AI_RESPONSES.greeting.length)],
          timestamp: new Date()
        };
        setMessages([greetingMessage]);
      } catch (error) {
        console.error("Error loading profile:", error);
      }
    };

    loadProfile();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const getAIResponse = (userMessage: string): string => {
    const lowerMessage = userMessage.toLowerCase();

    if (lowerMessage.includes("wear today") || lowerMessage.includes("what to wear")) {
      return AI_RESPONSES["what should i wear today"][Math.floor(Math.random() * AI_RESPONSES["what should i wear today"].length)];
    }
    if (lowerMessage.includes("find my style") || lowerMessage.includes("style help")) {
      return AI_RESPONSES["help me find my style"][Math.floor(Math.random() * AI_RESPONSES["help me find my style"].length)];
    }
    if (lowerMessage.includes("date") || lowerMessage.includes("romantic")) {
      return AI_RESPONSES["outfit for a date night"][Math.floor(Math.random() * AI_RESPONSES["outfit for a date night"].length)];
    }
    if (lowerMessage.includes("analyze") || lowerMessage.includes("profile")) {
      return AI_RESPONSES["analyze my style profile"][Math.floor(Math.random() * AI_RESPONSES["analyze my style profile"].length)];
    }

    return AI_RESPONSES.default[Math.floor(Math.random() * AI_RESPONSES.default.length)];
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsTyping(true);

    // Simulate AI thinking time
    setTimeout(() => {
      const aiResponse: Message = {
        id: `ai-${Date.now()}`,
        type: 'ai',
        content: getAIResponse(inputValue),
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiResponse]);
      setIsTyping(false);
    }, 1000 + Math.random() * 2000); // 1-3 seconds delay
  };

  const handleQuickReply = (text: string) => {
    setInputValue(text);
  };

  const hasCompletedOnboarding = profileData && (
    profileData.stylePreferences?.length ||
    Object.keys(profileData).length > 2
  );

  if (!hasCompletedOnboarding) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 flex items-center justify-center p-4 pb-20">
        <div className="w-full max-w-md text-center bg-white rounded-3xl shadow-xl p-8">
          <div className="w-20 h-20 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Bot className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold mb-4 text-gray-800">Meet Your AI Stylist</h2>
          <p className="text-gray-600 mb-8 leading-relaxed">
            Complete your style assessment first, and I'll provide personalized fashion advice tailored just for you!
          </p>
          <Button
            onClick={() => router.push("/onboarding")}
            className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white rounded-full font-bold py-4 text-lg shadow-lg"
          >
            <Sparkles className="w-5 h-5 mr-2" />
            Start Style Assessment
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 pb-20 flex flex-col">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-lg border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-800">AI Stylist</h1>
              <p className="text-xs text-gray-500">Your personal fashion advisor</p>
            </div>
            <div className="ml-auto flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-xs text-gray-500">Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 max-w-md mx-auto w-full">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3",
                message.type === 'user' ? "justify-end" : "justify-start"
              )}
            >
              {message.type === 'ai' && (
                <div className="w-8 h-8 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
              )}

              <div
                className={cn(
                  "max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed",
                  message.type === 'user'
                    ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-br-md"
                    : "bg-white shadow-sm border border-gray-100 text-gray-800 rounded-bl-md"
                )}
              >
                {message.content}
              </div>

              {message.type === 'user' && (
                <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-gray-600" />
                </div>
              )}
            </div>
          ))}

          {isTyping && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-white shadow-sm border border-gray-100 px-4 py-3 rounded-2xl rounded-bl-md">
                <div className="flex items-center gap-1">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                  <span className="text-sm text-gray-500">AI is thinking...</span>
                </div>
              </div>
            </div>
          )}
        </div>
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Reply Suggestions */}
      {messages.length <= 1 && (
        <div className="px-4 pb-4 max-w-md mx-auto w-full">
          <p className="text-xs text-gray-500 mb-3 text-center">Try asking me about:</p>
          <div className="grid grid-cols-2 gap-2">
            {CONVERSATION_STARTERS.map((starter, index) => {
              const Icon = starter.icon;
              return (
                <button
                  key={index}
                  onClick={() => handleQuickReply(starter.text)}
                  className={cn(
                    "flex items-center gap-2 p-3 rounded-xl text-xs font-medium transition-all border",
                    starter.color,
                    "hover:shadow-md"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span>{starter.text}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 px-4 py-4 max-w-md mx-auto w-full">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Ask me anything about style..."
              className="rounded-full border-gray-300 focus:border-pink-500 focus:ring-pink-500"
              disabled={isTyping}
            />
          </div>
          <Button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isTyping}
            className="w-12 h-12 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white shadow-lg flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
