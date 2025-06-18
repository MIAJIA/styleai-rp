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
  Layers
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const styles = [
  { id: "fashion-magazine", name: "Magazine", icon: BookOpen, color: "bg-pink-100 text-pink-900" },
  { id: "running-outdoors", name: "Outdoors", icon: Footprints, color: "bg-emerald-100 text-emerald-900" },
  { id: "coffee-shop", name: "Coffee", icon: Coffee, color: "bg-amber-100 text-amber-900" },
  { id: "music-show", name: "Music Show", icon: Mic, color: "bg-purple-100 text-purple-900" },
  { id: "date-night", name: "Date Night", icon: Heart, color: "bg-rose-100 text-rose-900" },
  { id: "beach-day", name: "Beach Day", icon: Palmtree, color: "bg-sky-100 text-sky-900" },
  { id: "casual-chic", name: "Casual Chic", icon: Sparkles, color: "bg-violet-100 text-violet-900" },
  { id: "party-glam", name: "Party Glam", icon: PartyPopper, color: "bg-amber-100 text-amber-900" },
];

const stylePrompts = {
  "fashion-magazine": "standing in a semi-surreal environment blending organic shapes and architectural elements. The background features dreamlike washes of indigo and burnt orange, with subtle floating geometric motifs inspired by Ukiyo-e clouds. Lighting combines soft studio strobes with atmospheric glow, creating dimensional shadows. Composition balances realistic human proportions with slightly exaggerated fabric movement, evoking a living oil painting. Texture details: fine wool fibers visible, slight film grain. Style fusion: Richard Avedon's fashion realism + Egon Schiele's expressive lines + niji's color vibrancy (but photorealistic), 4k resolution.",
  "running-outdoors": "A vibrant, sun-drenched hillside with lush greenery under a clear blue sky, capturing an adventure lifestyle mood. The scene is bathed in soft, natural light, creating a sense of cinematic realism. Shot with the professional quality of a Canon EOS R5, emphasizing realistic textures and high definition, 4k resolution.",
  "coffee-shop": "A cozy, sunlit coffee shop with the warm aroma of freshly ground beans. The person is sitting at a rustic wooden table by a large window, holding a ceramic mug. The background shows soft, blurred details of a barista and an espresso machine. The style should be intimate and warm, with natural light creating soft shadows, reminiscent of a lifestyle magazine photograph, 4k resolution.",
  "casual-chic": "trendy Brooklyn street with colorful murals, chic coffee shop with exposed brick walls, urban rooftop garden with city views, stylish boutique district, contemporary art gallery setting, natural daylight with artistic shadows, street style fashion photography, 4k resolution",
  "music-show": "Group idol style, performing on stage, spotlight and dreamy lighting, high-definition portrait, soft glow and bokeh, dynamic hair movement, glamorous makeup, K-pop inspired outfit (shiny, fashionable), expressive pose, cinematic stage background, lens flare, fantasy concert vibe, ethereal lighting, 4k resolution.",
  "date-night": "A realistic romantic evening on a backyard patio--string lights overhead, wine glasses, laughing mid-conversation with friend. Subtle body language, soft bokeh lights, hint of connection. Created using: Sony Alpha A7R IV, cinematic lighting, shallow depth of field, natural expressions, sunset color grading Shot in kodak gold 200 with a canon EOS R6, 4k resolution.",
  "beach-day": "On the beach, soft sunlight, gentle waves in the background, highly detailed, lifelike textures, natural lighting, vivid colors, 4k resolution",
  "party-glam": "opulent ballroom with crystal chandeliers, luxurious velvet curtains and gold accents, dramatic spotlight effects with rich jewel tones, champagne bar with marble countertops, exclusive VIP lounge atmosphere, professional event photography with glamorous lighting, 4k resolution",
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
  const [occasion, setOccasion] = useState("fashion-magazine");
  const [generationMode, setGenerationMode] = useState<"tryon-only" | "simple-scene" | "advanced-scene">("simple-scene");
  const router = useRouter();

  const hasRequiredImages = Boolean(selfiePreview && clothingPreview);

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

    // Auto-navigate if both images are selected
    if (hasRequiredImages) {
      // Store current selection data to sessionStorage for Chat page to use
      const chatData = {
        selfiePreview,
        clothingPreview,
        occasion,
        generationMode: mode, // Use the newly selected mode
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
        timestamp: Date.now()
      };

      console.log('[MAIN DEBUG] Auto-navigating to chat with data:', chatData);
      sessionStorage.setItem('chatModeData', JSON.stringify(chatData));

      // Navigate to Chat page
      router.push('/chat');
    }
  };

  // Simplified generation handler - directly go to Chat Experience
  const handleStartGeneration = () => {
    if (!hasRequiredImages) {
      alert("Please select both a photo and garment to continue.");
      return;
    }

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
      timestamp: Date.now()
    };

    console.log('[MAIN DEBUG] Storing chat data to sessionStorage:', chatData);
    sessionStorage.setItem('chatModeData', JSON.stringify(chatData));

    // Navigate to Chat page
    console.log('[MAIN DEBUG] Navigating to /chat');
    router.push('/chat');
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
              <div className="grid grid-cols-4 gap-2 md:grid-cols-4">
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
