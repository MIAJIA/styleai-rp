"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import CompactUpload from "./components/compact-upload";
import FashionHeader from "./components/fashion-header";
import StylishWardrobe from "./components/stylish-wardrobe";
import PortraitSelectionSheet from "./components/portrait-selection-sheet";
import IOSTabBar from "./components/ios-tab-bar";
import { Drawer } from "vaul";
import {
  Heart,
  BookOpen,
  Footprints,
  Coffee,
  Mic,
  Palmtree,
  Sparkles,
  PartyPopper,
  MessageCircle,
  Shirt,
  Layers,
  Briefcase,
  Wine,
  Plane,
  Crown,
  User,
  Camera,
  X,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { hasCompletedOnboarding, getOnboardingStatus } from "@/lib/onboarding-storage";

const styles = [
  { id: "work", name: "Work", icon: Briefcase, color: "bg-slate-100 text-slate-900" },
  { id: "casual-chic", name: "Casual Chic", icon: Sparkles, color: "bg-violet-100 text-violet-900" },
  { id: "date-night", name: "Date Night", icon: Heart, color: "bg-rose-100 text-rose-900" },
  { id: "cocktail", name: "Cocktail", icon: Wine, color: "bg-purple-100 text-purple-900" },
  { id: "vacation", name: "Vacation", icon: Plane, color: "bg-sky-100 text-sky-900" },
  { id: "formal", name: "Formal", icon: Crown, color: "bg-amber-100 text-amber-900" },
];

const stylePrompts = {
  "work": "Modern office environment with clean lines and professional atmosphere. Natural lighting from large windows, contemporary office furniture, neutral color palette with subtle textures. The setting conveys competence and reliability while maintaining approachability. Shot with professional business photography style, crisp details, confident posture, 4k resolution.",
  "casual-chic": "Trendy urban setting with artistic elements - exposed brick walls, modern coffee shop interior, or stylish boutique district. Natural daylight with soft shadows, contemporary art pieces in background, relaxed yet curated atmosphere. Street style photography aesthetic with effortless sophistication, 4k resolution.",
  "date-night": "Romantic evening setting with warm, intimate lighting - upscale restaurant with soft candlelight, elegant rooftop terrace with city lights, or charming wine bar atmosphere. Golden hour lighting with bokeh effects, sophisticated ambiance that's alluring yet tasteful. Shot with cinematic romantic photography style, 4k resolution.",
  "cocktail": "Sophisticated cocktail lounge or upscale bar setting with ambient lighting, rich textures like velvet and marble, elegant floral arrangements. Warm lighting with dramatic shadows, luxurious yet approachable atmosphere. Fashion-forward photography with emphasis on style and elegance, 4k resolution.",
  "vacation": "Bright, airy vacation destination - beachside resort with ocean views, tropical poolside setting, or charming European street cafe. Natural sunlight with vibrant colors, relaxed holiday atmosphere with palm trees or scenic backgrounds. Travel photography style with fresh, carefree energy, 4k resolution.",
  "formal": "Elegant formal venue with grand architecture - luxury hotel ballroom, opera house foyer, or prestigious gala setting. Dramatic lighting with crystal chandeliers, rich fabrics and ornate details. Classical formal photography with emphasis on dignity and sophistication, 4k resolution.",
};

function dataURLtoFile(dataurl: string, filename: string): File | null {
  if (!dataurl) return null;
  const arr = dataurl.split(",");
  if (arr.length < 2) return null;

  const mimeMatch = arr[0].match(/:(.*?);/);
  if (!mimeMatch) return null;

  const mime = mimeMatch[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);

  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }

  return new File([u8arr], filename, { type: mime });
}

interface PastLook {
  id: string;
  imageUrl: string;
  style: string | null;
  timestamp: number;
  originalHumanSrc?: string;
  originalGarmentSrc?: string;
  garmentDescription?: string;
  personaProfile?: string | null;
  processImages?: {
    humanImage: string;
    garmentImage: string;
    finalImage: string;
    styleSuggestion?: any;
  };
}

const saveLook = (look: PastLook) => {
  try {
    console.log('!!!Saving look:', look); // Debug log
    const storedLooks = localStorage.getItem("pastLooks");
    let looks: PastLook[] = [];
    if (storedLooks) {
      looks = JSON.parse(storedLooks);
      console.log('!!!Existing looks:', looks); // Debug log
    }

    // Add process images to the look
    if (!look.processImages) {
      look.processImages = {
        humanImage: look.originalHumanSrc || '',
        garmentImage: look.originalGarmentSrc || '',
        finalImage: look.imageUrl,
        styleSuggestion: look.style === 'suggestion' ? look.personaProfile : undefined
      };
    }

    // Remove any existing look with the same ID
    looks = looks.filter(existingLook => existingLook.id !== look.id);

    // Add the new look at the beginning
    looks.unshift(look);
    console.log('Saving looks to localStorage:', looks); // Debug log
    localStorage.setItem("pastLooks", JSON.stringify(looks));
  } catch (error) {
    console.error("Failed to save look to localStorage:", error);
  }
};

export default function HomePage() {
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [clothingFile, setClothingFile] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string>("");
  const [clothingPreview, setClothingPreview] = useState<string>("");
  const [selectedPersona, setSelectedPersona] = useState<object | null>(null);
  const [isWardrobeOpen, setIsWardrobeOpen] = useState(false);
  const [isPortraitSheetOpen, setIsPortraitSheetOpen] = useState(false);
  const [occasion, setOccasion] = useState("work");
  const [generationMode, setGenerationMode] = useState<"tryon-only" | "simple-scene" | "advanced-scene">("simple-scene");
  const [customPrompt, setCustomPrompt] = useState<string>("");

  // Onboarding check states
  const [isMounted, setIsMounted] = useState(false);
  const [showOnboardingPrompt, setShowOnboardingPrompt] = useState(false);
  const [hasUserCompletedOnboarding, setHasUserCompletedOnboarding] = useState(true);
  const [onboardingStatus, setOnboardingStatus] = useState<{
    isCompleted: boolean;
    hasProfile: boolean;
    hasPhotos: boolean;
    hasStylePreferences: boolean;
    profileKeys: number;
  }>({
    isCompleted: true,
    hasProfile: false,
    hasPhotos: false,
    hasStylePreferences: false,
    profileKeys: 0,
  });

  const router = useRouter();

  const hasRequiredImages = Boolean(selfiePreview && clothingPreview);

  // Mount effect to prevent hydration issues
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Check onboarding status on component mount (client-side only)
  useEffect(() => {
    if (!isMounted) return; // Only run on client side after mount

    const checkOnboardingStatus = () => {
      const isCompleted = hasCompletedOnboarding();
      const status = getOnboardingStatus();

      setHasUserCompletedOnboarding(isCompleted);
      setOnboardingStatus(status);

      // Show onboarding prompt if user hasn't completed onboarding
      // and hasn't dismissed it in this session
      if (!isCompleted) {
        const hasBeenDismissed = sessionStorage.getItem('onboarding_prompt_dismissed');

        if (!hasBeenDismissed) {
          setShowOnboardingPrompt(true);
        }
      }
    };

    checkOnboardingStatus();
  }, [isMounted]);

  const handleSelfieUpload = (file: File) => {
    setSelfieFile(file);
    setSelectedPersona(null);
    if (file && file.name) {
      const url = URL.createObjectURL(file);
      setSelfiePreview(url);
    } else {
      setSelfiePreview("");
    }
  };

  const handleClothingUpload = (file: File) => {
    setClothingFile(file);
    if (file && file.name) {
      const url = URL.createObjectURL(file);
      setClothingPreview(url);
    } else {
      setClothingPreview("");
    }
  };

  const handleGarmentSelect = (imageSrc: string) => {
    setClothingPreview(imageSrc);
    setClothingFile(null);
    setIsWardrobeOpen(false);
  };

  const handlePortraitSelect = (imageSrc: string, persona?: object) => {
    setSelfiePreview(imageSrc);
    setSelectedPersona(persona || null);
    setSelfieFile(null);
    setIsPortraitSheetOpen(false);
  };

  // Auto-navigate to chat when generation mode is selected
  const handleGenerationModeSelect = (mode: "tryon-only" | "simple-scene" | "advanced-scene") => {
    setGenerationMode(mode);

    // Remove auto-navigation to allow users to enter custom prompt
    // Navigation will happen when user clicks the "Start Generation" button
  };

  // Modify handleStartGeneration to use customPrompt if provided
  const handleStartGeneration = () => {
    if (!hasRequiredImages) {
      alert("Please select both a photo and garment to continue.");
      return;
    }

    // Debug customPrompt before storing
    console.log('[MAIN DEBUG] Current customPrompt state:', customPrompt);
    console.log('[MAIN DEBUG] CustomPrompt type:', typeof customPrompt);
    console.log('[MAIN DEBUG] CustomPrompt length:', customPrompt?.length || 0);

    // Store current selection data to sessionStorage for Chat page to use
    const chatData = {
      selfiePreview,
      clothingPreview,
      occasion,
      generationMode,
      selectedPersona,
      selfieFile: selfieFile ? {
        name: selfieFile.name,
        type: selfieFile.type,
        size: selfieFile.size
      } : null,
      clothingFile: clothingFile ? {
        name: clothingFile.name,
        type: clothingFile.type,
        size: clothingFile.size
      } : null,
      timestamp: Date.now(),
      customPrompt // Add custom prompt to chat data
    };

    console.log('[MAIN DEBUG] Storing chat data to sessionStorage:', chatData);
    console.log('[MAIN DEBUG] ChatData customPrompt:', chatData.customPrompt);
    sessionStorage.setItem('chatModeData', JSON.stringify(chatData));

    // Navigate to Chat page
    console.log('[MAIN DEBUG] Navigating to /chat');
    router.push('/chat');
  };

  // Handle onboarding prompt actions
  const handleCompleteOnboarding = () => {
    setShowOnboardingPrompt(false);
    router.push('/onboarding');
  };

  const handleDismissOnboardingPrompt = () => {
    setShowOnboardingPrompt(false);
    sessionStorage.setItem('onboarding_prompt_dismissed', 'true');
  };

  const handleGoToMyStyle = () => {
    setShowOnboardingPrompt(false);
    router.push('/my-style');
  };

  return (
    <div className="min-h-full pb-20 relative overflow-hidden">
      {/* Gradient background elements */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#D5F500] rounded-full opacity-50 blur-xl -translate-y-1/2 translate-x-1/2"></div>
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-[#FF6EC7] rounded-full opacity-50 blur-xl translate-y-1/2 -translate-x-1/2"></div>
      <div className="absolute top-1/3 left-1/4 w-20 h-20 bg-[#00C2FF] rounded-full opacity-30 blur-xl"></div>
      <div className="absolute bottom-1/4 right-1/3 w-16 h-16 bg-[#FF9B3E] rounded-full opacity-40 blur-xl"></div>

      {/* Content with relative positioning */}
      <div className="relative z-10">
        {/* Stylish header */}
        <FashionHeader />

        {/* Main content area */}
        <div className="px-5 space-y-8">
          {/* Input Selection Interface */}
          <div className="space-y-6 animate-fade-in">
            {/* Upload Grids */}
            <div className="flex w-full gap-4">
              <div className="w-full space-y-2">
                <h2 className="text-base font-semibold tracking-tight text-center">
                  <span className="text-primary font-bold">Step 1:</span> Your Photo
                </h2>
                <div onClick={() => setIsPortraitSheetOpen(true)} className="w-full">
                  <CompactUpload
                    preview={selfiePreview}
                    required
                    helpText="Full-body photo"
                    variant="portrait"
                    isTrigger
                  />
                </div>
              </div>
              <div className="w-full space-y-2">
                <h2 className="text-base font-semibold tracking-tight text-center">
                  <span className="text-primary font-bold">Step 2:</span> Garment
                </h2>
                <div onClick={() => setIsWardrobeOpen(true)} className="w-full">
                  <CompactUpload
                    preview={clothingPreview}
                    helpText="Item to try on"
                    variant="garment"
                    isTrigger
                  />
                </div>
              </div>
            </div>

            {/* Occasion Selector */}
            <div className="space-y-3">
              <h3 className="text-base font-semibold tracking-tight text-center">
                <span className="text-primary font-bold">Step 3:</span> Choose Your Scene
              </h3>
              <div className="grid grid-cols-3 gap-2 md:grid-cols-3">
                {styles.map((style) => {
                  const Icon = style.icon;
                  return (
                    <button
                      key={style.id}
                      onClick={() => setOccasion(style.id)}
                      className={cn(
                        "flex flex-col items-center justify-center p-3 rounded-xl transition-all",
                        occasion === style.id ? style.color : "bg-white hover:bg-gray-50",
                        "border border-gray-200"
                      )}
                    >
                      <Icon className="w-5 h-5 mb-1.5" />
                      <span className="text-xs font-medium text-center leading-tight">{style.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Generation Mode Selection */}
            <div className="space-y-3">
              <h3 className="text-base font-semibold tracking-tight text-center">
                <span className="text-primary font-bold">Step 4:</span> Choose Generation Mode
              </h3>
              <div className="grid grid-cols-3 gap-2 md:gap-3">
                <ModeButton
                  title="Try-On Only"
                  description="Fastest results"
                  icon={Shirt}
                  isSelected={generationMode === 'tryon-only'}
                  onClick={() => handleGenerationModeSelect('tryon-only')}
                />
                <ModeButton
                  title="Best Performance"
                  description="Recommended ⭐"
                  icon={Sparkles}
                  isSelected={generationMode === 'simple-scene'}
                  onClick={() => handleGenerationModeSelect('simple-scene')}
                />
                <ModeButton
                  title="Pro Mode"
                  description="Working on it 🚧"
                  icon={Layers}
                  isSelected={generationMode === 'advanced-scene'}
                  onClick={() => handleGenerationModeSelect('advanced-scene')}
                />
              </div>
            </div>

            {/* Add Step 5 for custom prompt input */}
            <div className="space-y-3">
              <h3 className="text-base font-semibold tracking-tight text-center">
                <span className="text-primary font-bold">Step 5 (Optional):</span> Describe any specific add-ons or styling ideas
              </h3>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder='(e.g. "add a white hat," "match with red heels," "include pearl earrings")'
                className="w-full p-2 border border-gray-300 rounded-md"
                rows={3}
              />
            </div>

            {/* Start Generation Button - Show when all required steps are completed */}
            {hasRequiredImages && (
              <div className="space-y-3">
                <button
                  onClick={handleStartGeneration}
                  className="w-full bg-gradient-to-r from-[#FF6EC7] to-[#FF9B3E] text-white font-semibold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]"
                >
                  <div className="flex items-center justify-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    <span>Start Generation</span>
                  </div>
                </button>
                <p className="text-xs text-gray-500 text-center">
                  This will take you to the chat where your styling magic happens!
                </p>
              </div>
            )}
          </div>

          {/* Drawers for selection */}
          <Drawer.Root open={isWardrobeOpen} onOpenChange={setIsWardrobeOpen}>
            {/* @ts-ignore */}
            <Drawer.Portal>
              <Drawer.Overlay className="fixed inset-0 bg-black/40 z-40" />
              <Drawer.Content className="bg-zinc-100 flex flex-col rounded-t-[10px] h-[90%] fixed bottom-0 left-0 right-0 z-50">
                <div className="p-4 bg-white rounded-t-[10px] flex-1 overflow-y-auto">
                  <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-zinc-300 mb-4" />
                  <div className="max-w-md mx-auto">
                    <Drawer.Title className="font-medium mb-4 text-center">
                      Select from My Wardrobe
                    </Drawer.Title>
                    <StylishWardrobe onGarmentSelect={handleGarmentSelect} />
                  </div>
                </div>
              </Drawer.Content>
            </Drawer.Portal>
          </Drawer.Root>

          <Drawer.Root open={isPortraitSheetOpen} onOpenChange={setIsPortraitSheetOpen}>
            {/* @ts-ignore */}
            <Drawer.Portal>
              <Drawer.Overlay className="fixed inset-0 bg-black/40 z-40" />
              <Drawer.Content className="bg-zinc-100 flex flex-col rounded-t-[10px] h-[90%] fixed bottom-0 left-0 right-0 z-50">
                <div className="p-4 bg-white rounded-t-[10px] flex-1 overflow-y-auto">
                  <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-zinc-300 mb-4" />
                  <div className="max-w-md mx-auto">
                    <Drawer.Title className="font-medium mb-4 text-center">
                      Choose Your Portrait
                    </Drawer.Title>
                    <PortraitSelectionSheet onPortraitSelect={handlePortraitSelect} />
                  </div>
                </div>
              </Drawer.Content>
            </Drawer.Portal>
          </Drawer.Root>

          {/* Status Message - Show when images are missing */}
          {!hasRequiredImages && (
            <div className="text-center">
              <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-4">
                📸 Please complete Steps 1-2 first, then select your preferred mode in Step 4 to start your styling session
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Onboarding Prompt Modal */}
      {showOnboardingPrompt && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full mx-4 relative">
            {/* Close button */}
            <button
              onClick={handleDismissOnboardingPrompt}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>

            <div className="p-6 pt-8 text-center">
              {/* Icon */}
              <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="w-8 h-8 text-white" />
              </div>

              {/* Title */}
              <h2 className="text-xl font-bold text-gray-800 mb-2">
                Create Your Style Profile
              </h2>

              {/* Description */}
              <p className="text-gray-600 mb-6 leading-relaxed">
                Get personalized styling recommendations by completing your style profile first. It only takes 2-3 minutes!
              </p>

              {/* Status indicators */}
              <div className="bg-gray-50 rounded-lg p-3 mb-6 text-left">
                <div className="text-sm space-y-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${onboardingStatus.hasPhotos ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                    <span className={onboardingStatus.hasPhotos ? 'text-green-600' : 'text-gray-500'}>
                      Upload your photo
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${onboardingStatus.hasStylePreferences ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                    <span className={onboardingStatus.hasStylePreferences ? 'text-green-600' : 'text-gray-500'}>
                      Set style preferences
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${onboardingStatus.isCompleted ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                    <span className={onboardingStatus.isCompleted ? 'text-green-600' : 'text-gray-500'}>
                      Complete profile
                    </span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="space-y-3">
                <Button
                  onClick={handleCompleteOnboarding}
                  className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white rounded-full font-semibold py-3"
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Complete Style Profile
                </Button>

                <div className="flex gap-2">
                  <Button
                    onClick={handleGoToMyStyle}
                    variant="outline"
                    className="flex-1 rounded-full border-gray-200 text-gray-600 hover:bg-gray-50"
                  >
                    View Profile
                  </Button>

                  <Button
                    onClick={handleDismissOnboardingPrompt}
                    variant="ghost"
                    className="flex-1 rounded-full text-gray-400 hover:bg-gray-50"
                  >
                    Skip for now
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* iOS Tab Bar */}
      <IOSTabBar />
    </div>
  );
}

// Helper component for the mode buttons to avoid repetition
const ModeButton = ({ title, description, icon: Icon, isSelected, onClick }: {
  title: string;
  description: string;
  icon: React.ElementType;
  isSelected: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={cn(
      "flex flex-col items-center justify-center p-3 md:p-4 rounded-xl transition-all text-center",
      "border-2",
      isSelected
        ? "bg-purple-50 border-purple-300 shadow-md"
        : "bg-white hover:bg-gray-50 border-gray-200"
    )}
  >
    <div className={cn(
      "w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center mb-1.5 md:mb-2",
      isSelected ? "bg-purple-500 text-white" : "bg-gray-100 text-gray-500"
    )}>
      <Icon size={16} className="md:w-5 md:h-5" />
    </div>
    <h4 className="font-semibold text-xs md:text-sm text-gray-800 leading-tight">{title}</h4>
    <p className="text-xs text-gray-500 leading-tight">{description}</p>
  </button>
);
