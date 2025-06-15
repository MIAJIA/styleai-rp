"use client";

import { useState } from "react";
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
import { Palette, Wand2, Heart, Star, ArrowLeft, Share2, Download, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
  const [currentStage, setCurrentStage] = useState(1); // 1: Input, 2: Loading/Suggestion, 3: Result
  const [occasion, setOccasion] = useState("日常通勤");
  const [styleSuggestion, setStyleSuggestion] = useState<any>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isGeneratingFinalImage, setIsGeneratingFinalImage] = useState(false);
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

  // This function will now trigger the suggestion generation
  const handleGetSuggestion = async () => {
    if (!selfiePreview || !clothingPreview) {
      alert("Please upload both a portrait and a garment photo.");
      return;
    }

    setCurrentStage(2);
    setLoadingProgress(0);
    setStyleSuggestion(null);

    // Animate progress bar
    const interval = setInterval(() => {
      setLoadingProgress((prev) => Math.min(prev + 5, 95));
    }, 200);

    try {
      const formData = new FormData();

      const humanImageFile = selfieFile || (await getFileFromPreview(selfiePreview, "selfie"));
      const garmentImageFile =
        clothingFile || (await getFileFromPreview(clothingPreview, "garment"));

      if (!humanImageFile || !garmentImageFile) {
        throw new Error("Could not process one of the images.");
      }

      formData.append("human_image", humanImageFile);
      formData.append("garment_image", garmentImageFile);
      formData.append("occasion", occasion);

      const response = await fetch("/api/generate-suggestion", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get suggestion: ${errorText}`);
      }

      const suggestion = await response.json();
      setStyleSuggestion(suggestion);
      setLoadingProgress(100);

      // Automatically trigger the final image generation
      await handleGenerateFinalImage(suggestion);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "An unknown error occurred.");
      setCurrentStage(1); // Revert to input stage on error
    } finally {
      clearInterval(interval);
    }
  };

  const handleGenerateFinalImage = async (suggestion: any) => {
    console.log("\n--- Entering handleGenerateFinalImage ---");
    if (!suggestion?.image_prompt) {
      alert("Missing a valid style prompt. Please try generating the suggestion again.");
      console.error("Client Error: Missing image_prompt in suggestion object.", suggestion);
      return;
    }
    setIsGeneratingFinalImage(true);

    try {
      const formData = new FormData();

      const humanImageFile = selfieFile || (await getFileFromPreview(selfiePreview, "selfie"));
      const garmentImageFile =
        clothingFile || (await getFileFromPreview(clothingPreview, "garment"));

      if (!humanImageFile || !garmentImageFile) {
        throw new Error("Could not process one of the images for final generation.");
      }

      const prompt = suggestion.image_prompt;
      const modelVersion = "kling-v2";

      // --- Detailed Logging of Fields to be Sent ---
      console.log(`[CLIENT-SEND] Appending human_image:`, humanImageFile);
      console.log(`[CLIENT-SEND] Appending garment_image:`, garmentImageFile);
      console.log(`[CLIENT-SEND] Appending prompt: ${prompt.substring(0, 50)}...`);
      console.log(`[CLIENT-SEND] Appending modelVersion: ${modelVersion}`);
      // --- End of Logging ---

      formData.append("human_image", humanImageFile);
      formData.append("garment_image", garmentImageFile);
      formData.append("prompt", prompt);
      formData.append("modelVersion", modelVersion);

      console.log("[CLIENT-SEND] Sending request to /api/generate-style-v2...");
      const response = await fetch("/api/generate-style-v2", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to generate final image: ${errorText}`);
      }

      const result = await response.json();
      const imageUrl = result.imageUrl;

      if (!imageUrl) {
        throw new Error("Kling API response did not contain a valid image URL.");
      }

      // --- Save the new look to localStorage ---
      try {
        const storedLooks = localStorage.getItem("pastLooks");
        const pastLooks = storedLooks ? JSON.parse(storedLooks) : [];

        const newLook = {
          id: `look-${Date.now()}`,
          imageUrl: imageUrl,
          style: prompt, // Saving the detailed prompt as the "style"
          timestamp: Date.now(),
        };

        // Add the new look to the beginning of the array
        const updatedLooks = [newLook, ...pastLooks];

        localStorage.setItem("pastLooks", JSON.stringify(updatedLooks));
      } catch (storageError) {
        console.error("Failed to save look to localStorage:", storageError);
        // Non-fatal error, so we don't block the user from seeing their result
      }

      // --- Continue to update the UI ---
      setGeneratedImageUrl(imageUrl);
      setCurrentStage(3);
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "An unknown error occurred during final image generation.",
      );
    } finally {
      setIsGeneratingFinalImage(false);
    }
  };

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
          setCurrentStage(3);
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
      setCurrentStage(3);
    }
    setShowAnimation(false);
    setIsApiFinished(false);
    setIsGenerating(false);
  };

  const handleCreateAnother = () => {
    setCurrentStage(1);
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
          {currentStage === 1 && (
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
                  <span className="text-primary font-bold">Step 3:</span> Occasion
                </h3>
                <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
                  {["日常通勤", "约会之夜", "周末休闲", "商务会议", "健身运动"].map((o) => (
                    <button
                      key={o}
                      onClick={() => setOccasion(o)}
                      className={cn(
                        "flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors",
                        occasion === o
                          ? "bg-primary text-white shadow-md"
                          : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-100",
                      )}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <Button
                onClick={handleGetSuggestion}
                disabled={!hasRequiredImages}
                className="w-full h-14 bg-[#FF6EC7] hover:bg-[#FF6EC7]/90 text-white rounded-full font-playfair text-lg font-bold shadow-lg btn-bounce disabled:opacity-50"
              >
                <span>🚀 Get Styling Advice</span>
              </Button>
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

          {/* Stage 2: Loading & Suggestions */}
          {currentStage === 2 && (
            <div className="py-8 text-center space-y-6 animate-fade-in">
              {!styleSuggestion ? (
                <>
                  <div className="w-16 h-16 mx-auto bg-gradient-to-br from-[#FF6EC7] to-[#D5F500] rounded-full flex items-center justify-center shadow-xl animate-pulse">
                    <Wand2 className="text-white" size={28} />
                  </div>
                  <h2 className="text-xl font-bold text-gray-800 font-playfair">
                    Analyzing Your Style...
                  </h2>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-primary h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${loadingProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-600">
                    Generating personalized advice just for you
                  </p>
                </>
              ) : (
                <div className="text-left space-y-4">
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
          {currentStage === 3 && generatedImageUrl && (
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
