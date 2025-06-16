"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import CompactUpload from "./components/compact-upload";
import FashionHeader from "./components/fashion-header";
import StylishWardrobe from "./components/stylish-wardrobe";
import IOSTabBar from "./components/ios-tab-bar";
import { Drawer } from "vaul";
import PortraitSelectionSheet from "./components/portrait-selection-sheet";
import GenerationAnimation from "./components/generation-animation";
import StyleSelector from "./components/style-selector";
import {
  Palette,
  Wand2,
  Heart,
  Star,
  ArrowLeft,
  Share2,
  Download,
  Loader2,
  BookOpen,
  Footprints,
  Coffee,
  Mic,
  Palmtree,
  Sparkles,
  PartyPopper,
  Image as ImageIcon
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const styles = [
  { id: "original-scene", name: "Original", icon: ImageIcon, color: "bg-gray-100 text-gray-900" },
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
  "original-scene": "",
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

interface ProcessImages {
  styledImage?: string;
  tryOnImage?: string;
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
  const [selectedStyle, setSelectedStyle] = useState<string>("fashion-magazine");
  const [selectedPersona, setSelectedPersona] = useState<object | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAnimation, setShowAnimation] = useState(false);
  const [isApiFinished, setIsApiFinished] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [isWardrobeOpen, setIsWardrobeOpen] = useState(false);
  const [isPortraitSheetOpen, setIsPortraitSheetOpen] = useState(false);
  const [stage, setStage] = useState<"initial" | "loading" | "suggestion" | "result">("initial");
  const [occasion, setOccasion] = useState("日常通勤");
  const [styleSuggestion, setStyleSuggestion] = useState<any>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isGeneratingFinalImage, setIsGeneratingFinalImage] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [pollingError, setPollingError] = useState<string | null>(null);
  const [processImages, setProcessImages] = useState<ProcessImages>({});
  const router = useRouter();

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

  const handleStyleSelect = (styleId: string) => {
    console.log(`Style selected: ${styleId}`);
    setSelectedStyle(styleId);
  };

  // Helper function to prepare image files for upload
  const getFileFromPreview = async (
    previewUrl: string,
    defaultName: string,
  ): Promise<File | null> => {
    if (previewUrl.startsWith("data:image")) {
      return dataURLtoFile(previewUrl, `${defaultName}-${Date.now()}.png`);
    } else if (previewUrl.startsWith("/")) {
      const response = await fetch(previewUrl);
      const blob = await response.blob();
      return new File([blob], `${defaultName}-${Date.now()}.jpg`, { type: blob.type });
    } else if (previewUrl.startsWith("blob:")) {
      const response = await fetch(previewUrl);
      const blob = await response.blob();
      return new File([blob], `${defaultName}-${Date.now()}.jpg`, { type: blob.type });
    }
    return null;
  };

  // New handler for the entire generation process
  const handleStartGeneration = async () => {
    if (!selfiePreview || !clothingPreview) return;
    setIsLoading(true);
    setStage("loading"); // Move to loading stage
    setJobId(null);
    setPollingError(null);
    setStyleSuggestion(null);

    try {
      const humanImage = await getFileFromPreview(selfiePreview, "selfie");
      const garmentImage = await getFileFromPreview(clothingPreview, "garment");

      if (!humanImage || !garmentImage) {
        throw new Error("Could not process one of the images.");
      }

      const formData = new FormData();
      formData.append("human_image", humanImage);
      formData.append("garment_image", garmentImage);
      formData.append("occasion", occasion);
      // Add the style prompt if available
      if (stylePrompts[occasion as keyof typeof stylePrompts]) {
        formData.append("style_prompt", stylePrompts[occasion as keyof typeof stylePrompts]);
      }

      const response = await fetch("/api/generation/start", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to start generation: ${errorText}`);
      }

      const { jobId: newJobId } = await response.json();
      setJobId(newJobId);
      // Polling will be initiated by the useEffect hook
    } catch (error) {
      console.error(error);
      setPollingError(error instanceof Error ? error.message : String(error));
      setIsLoading(false);
      setStage("initial"); // Revert stage on error
    }
  };

  useEffect(() => {
    if (!jobId) return;

    const intervalId = setInterval(async () => {
      try {
        const response = await fetch(`/api/generation/status?jobId=${jobId}`);
        if (!response.ok) {
          throw new Error(`Polling failed with status: ${response.status}`);
        }

        const data = await response.json();
        console.log('[POLLING] Received data:', data);

        if (data.processImages) {
          setProcessImages(data.processImages);
        }

        if (data.status === 'suggestion_generated') {
          console.log('[POLLING] Status is suggestion_generated. Setting stage to "suggestion".');
          setStyleSuggestion(data.suggestion);
          setStage("suggestion");

        } else if (data.status === 'completed') {
          const finalImageUrl = data.result?.imageUrl;
          console.log('[POLLING] Status is completed. Final URL:', finalImageUrl);
          if (finalImageUrl) {
            console.log('[POLLING] Setting stage to "result" and updating image URL.');
            setGeneratedImageUrl(finalImageUrl);
            setStage("result");
            setIsLoading(false);

            // Save only the final look with all process images
            const finalLook: PastLook = {
              id: jobId,
              imageUrl: finalImageUrl,
              style: occasion,
              timestamp: Date.now(),
              originalHumanSrc: selfiePreview,
              originalGarmentSrc: clothingPreview,
              personaProfile: selectedPersona ? JSON.stringify(selectedPersona) : null,
              processImages: {
                humanImage: selfiePreview,
                garmentImage: clothingPreview,
                finalImage: finalImageUrl,
                styleSuggestion: data.suggestion
              }
            };
            console.log('Saving final look:', finalLook);
            saveLook(finalLook);

            clearInterval(intervalId);
          } else {
            console.error('[POLLING] Error: Job completed but finalImageUrl is missing in the response.');
          }
        } else if (data.status === 'failed') {
          throw new Error(data.statusMessage || 'Generation failed.');
        }
        console.log(`[POLLING] Current job status: ${data.status}. Polling will continue.`);

      } catch (error) {
        console.error("Polling error:", error);
        setPollingError(error instanceof Error ? error.message : String(error));
        setIsLoading(false);
        setStage("initial");
        clearInterval(intervalId);
      }
    }, 3000);

    return () => clearInterval(intervalId);
  }, [jobId, occasion, selfiePreview, clothingPreview, selectedPersona, styleSuggestion]);

  const handleGenerate = async () => {
    if (!selfiePreview) {
      alert("Please select a portrait.");
      return;
    }
    if (!clothingPreview) {
      alert("Please select a garment.");
      return;
    }

    setIsGenerating(true);
    setShowAnimation(true);
    setIsApiFinished(false);
    setGeneratedImageUrl(null);

    try {
      const formData = new FormData();

      // --- Smartly handle the selfie image source ---
      let finalSelfieFile = selfieFile;

      // Scenario 1: Selfie is a Data URL from localStorage (My Photos)
      if (!finalSelfieFile && selfiePreview.startsWith("data:image")) {
        finalSelfieFile = dataURLtoFile(selfiePreview, `selfie-${Date.now()}.png`);
      }
      // Scenario 2: Selfie is a local URL from /public (Idols)
      else if (!finalSelfieFile && selfiePreview.startsWith("/")) {
        const response = await fetch(selfiePreview);
        const blob = await response.blob();
        finalSelfieFile = new File([blob], `idol-${Date.now()}.jpg`, { type: blob.type });
      }

      if (finalSelfieFile) {
        formData.append("human_image", finalSelfieFile);
      } else {
        alert("Could not process the selected portrait. Please try again.");
        setIsGenerating(false);
        return;
      }

      // --- Smartly handle the garment image source (now fully robust) ---
      let finalGarmentFile = clothingFile;
      // Scenario 1: Garment is a Data URL from localStorage (custom items)
      if (!finalGarmentFile && clothingPreview && clothingPreview.startsWith("data:image")) {
        finalGarmentFile = dataURLtoFile(clothingPreview, `wardrobe-item-${Date.now()}.png`);
      }
      // Scenario 2: Garment is a local URL from /public (default items)
      else if (!finalGarmentFile && clothingPreview.startsWith("/")) {
        const response = await fetch(clothingPreview);
        const blob = await response.blob();
        const fileName = clothingPreview.split("/").pop() || `default-garment-${Date.now()}.png`;
        finalGarmentFile = new File([blob], fileName, { type: blob.type });
      }

      if (finalGarmentFile) {
        formData.append("garment_image", finalGarmentFile);
        if (clothingPreview) {
          formData.append("garment_src", clothingPreview);
        }
      } else {
        alert("Please select a garment to try on.");
        setIsGenerating(false);
        return;
      }

      if (selectedPersona) {
        formData.append("persona_profile", JSON.stringify(selectedPersona));
      }
      formData.append("style_name", selectedStyle);

      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Failed to generate image: ${await response.text()}`);
      }

      const data = await response.json();
      if (data.imageUrl) {
        setGeneratedImageUrl(data.imageUrl);
        setIsApiFinished(true);
        if (generatedImageUrl) {
          setStage("result");
        }
      } else {
        throw new Error("Generation succeeded but no image URL was returned.");
      }
    } catch (error) {
      console.error(error);
      if (error instanceof Error) {
        alert(error.message);
      }
      setShowAnimation(false);
      setIsGenerating(false);
    }
  };

  const handleAnimationAndNavigation = () => {
    if (generatedImageUrl) {
      setStage("result");
    }
    setShowAnimation(false);
    setIsApiFinished(false);
    setIsGenerating(false);
    setGeneratedImageUrl(null);
  };

  const handleCreateAnother = () => {
    setStage("initial");
    setSelfiePreview("");
    setClothingPreview("");
    setSelfieFile(null);
    setClothingFile(null);
    setSelectedPersona(null);
    setGeneratedImageUrl(null);
  };

  const handleShare = () => {
    if (navigator.share && generatedImageUrl) {
      // Use the Web Share API on supported devices
      fetch(generatedImageUrl)
        .then((res) => res.blob())
        .then((blob) => {
          const file = new File([blob], "styleai-look.png", { type: "image/png" });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            navigator
              .share({
                title: "My StyleAI Look",
                text: "Check out the new look I generated with StyleAI!",
                files: [file],
              })
              .catch(console.error);
          } else {
            // Fallback for when file sharing is not supported but API exists
            navigator
              .share({
                title: "My StyleAI Look",
                text: "Check out the new look I generated with StyleAI!",
                url: generatedImageUrl,
              })
              .catch(console.error);
          }
        });
    } else if (generatedImageUrl) {
      // Fallback for desktop browsers
      navigator.clipboard
        .writeText(generatedImageUrl)
        .then(() => alert("Image URL copied to clipboard! You can paste it to share."))
        .catch(console.error);
    }
  };

  const handleDownload = () => {
    if (generatedImageUrl) {
      const link = document.createElement("a");
      link.href = generatedImageUrl;
      link.download = `styleai-look-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const hasRequiredImages = selfiePreview && clothingPreview;

  console.log(`[RENDER] Component rendering with stage: "${stage}" and generatedImageUrl: ${generatedImageUrl ? "Exists" : "null"}`);

  return (
    <div className="min-h-full pb-20 relative overflow-hidden">
      {/* This animation component might be repurposed or removed depending on the new flow */}
      {/* <GenerationAnimation ... /> */}

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
          {/* Stage 1: Input Selection */}
          {stage === "initial" && (
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
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  {styles.map((style) => {
                    const Icon = style.icon;
                    return (
                      <button
                        key={style.id}
                        onClick={() => setOccasion(style.id)}
                        className={cn(
                          "flex flex-col items-center justify-center p-4 rounded-xl transition-all",
                          occasion === style.id ? style.color : "bg-white hover:bg-gray-50",
                          "border border-gray-200"
                        )}
                      >
                        <Icon className="w-6 h-6 mb-2" />
                        <span className="text-sm font-medium">{style.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Action Button */}
              <Button
                onClick={handleStartGeneration}
                disabled={!hasRequiredImages || isLoading}
                className="w-full h-14 bg-[#FF6EC7] hover:bg-[#FF6EC7]/90 text-white rounded-full font-playfair text-lg font-bold shadow-lg btn-bounce disabled:opacity-50"
              >
                {isLoading ? "Generating..." : "Generate Style"}
              </Button>
              {pollingError && (
                <p className="text-sm text-red-500 text-center mt-2">{pollingError}</p>
              )}
            </div>
          )}

          {/* Drawers are part of the Input stage */}
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
                  <Drawer.Title className="sr-only">Select a Portrait</Drawer.Title>
                  <PortraitSelectionSheet onPortraitSelect={handlePortraitSelect} />
                </div>
              </Drawer.Content>
            </Drawer.Portal>
          </Drawer.Root>

          {/* Stage 2 & 3 combined: Loading, Suggestions, and Result */}
          {(stage === "loading" || stage === "suggestion") && (
            <div className="py-8 text-center space-y-6 animate-fade-in">
              {/* Loading state (before suggestion) */}
              {stage === "loading" && !styleSuggestion && (
                <>
                  <div className="w-16 h-16 mx-auto bg-gradient-to-br from-[#FF6EC7] to-[#D5F500] rounded-full flex items-center justify-center shadow-xl animate-pulse">
                    <Wand2 className="text-white" size={28} />
                  </div>
                  <h2 className="text-xl font-bold text-gray-800 font-playfair">
                    Analyzing Your Style...
                  </h2>
                  <p className="text-sm text-gray-600">
                    Generating personalized advice just for you...
                  </p>

                  {/* Preview track images */}
                  <div className="grid grid-cols-2 gap-2 max-w-xs mx-auto">
                    {[
                      { label: "Original", src: selfiePreview },
                      { label: "Garment", src: clothingPreview },
                      { label: "Styled", src: processImages.styledImage },
                      { label: "Try-On", src: processImages.tryOnImage },
                    ]
                      .filter((item) => item.src)
                      .map((item) => (
                        <div key={item.label} className="space-y-1">
                          <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                            {/* @ts-ignore */}
                            <img src={item.src} alt={item.label} className="w-full h-full object-cover" />
                          </div>
                          <p className="text-[10px] text-gray-500 text-center">{item.label}</p>
                        </div>
                      ))}
                  </div>
                </>
              )}

              {/* Suggestion state (after suggestion, before final image) */}
              {stage === "suggestion" && styleSuggestion && (
                <div className="text-left space-y-4">
                  {/* Process images grid on top */}
                  <div className="grid grid-cols-2 gap-2 max-w-xs mx-auto pb-6">
                    {[
                      { label: "Original", src: selfiePreview },
                      { label: "Garment", src: clothingPreview },
                      { label: "Styled", src: processImages.styledImage },
                      { label: "Try-On", src: processImages.tryOnImage },
                    ]
                      .filter((item) => item.src)
                      .map((item) => (
                        <div key={item.label} className="space-y-1">
                          <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                            {/* @ts-ignore */}
                            <img src={item.src} alt={item.label} className="w-full h-full object-cover" />
                          </div>
                          <p className="text-[10px] text-gray-500 text-center">{item.label}</p>
                        </div>
                      ))}
                  </div>

                  <h2 className="text-2xl font-bold text-center text-gray-800 font-playfair mb-6">
                    Your Personal Style Guide
                  </h2>

                  {Object.entries(styleSuggestion)
                    .filter(([key]) => key !== "image_prompt")
                    .map(([key, value]) => (
                      <div
                        key={key}
                        className="bg-white/80 p-4 rounded-xl shadow-sm border border-black/5"
                      >
                        <h3 className="font-semibold text-primary mb-1 capitalize">
                          {key.replace(/_/g, " ")}
                        </h3>
                        <p className="text-gray-700 text-sm">{value as string}</p>
                      </div>
                    ))}

                  <div className="flex flex-col items-center justify-center pt-6 space-y-3">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <p className="text-md font-semibold text-gray-700">Generating your look...</p>
                    <p className="text-sm text-gray-500">This may take a moment.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Stage 3: Final Result */}
          {stage === "result" && generatedImageUrl && (
            <div className="animate-fade-in space-y-6">
              {/* Result Image */}
              <div className="w-full aspect-[3/4] bg-neutral-100 rounded-2xl shadow-lg overflow-hidden relative">
                <img
                  src={generatedImageUrl}
                  alt="Generated fashion look"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-4 right-4 flex flex-col gap-3">
                  <button
                    onClick={handleShare}
                    className="h-11 w-11 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center ios-btn shadow-md"
                  >
                    <Share2 size={22} className="text-gray-800" />
                  </button>
                  <button
                    onClick={handleDownload}
                    className="h-11 w-11 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center ios-btn shadow-md"
                  >
                    <Download size={22} className="text-gray-800" />
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <Button
                  onClick={handleCreateAnother}
                  className="w-full h-14 bg-[#FF6EC7] hover:bg-[#FF6EC7]/90 text-white rounded-full font-playfair text-lg font-bold shadow-lg btn-bounce"
                >
                  <ArrowLeft className="mr-2 h-5 w-5" />
                  Create Another Look
                </Button>
                <Button
                  onClick={() => router.push("/results")}
                  variant="ghost"
                  className="w-full h-12 text-gray-700 font-semibold"
                >
                  View All My Looks
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* iOS Tab Bar */}
      <IOSTabBar />
    </div>
  );
}
