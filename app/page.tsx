"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import CompactUpload from "./components/compact-upload"
import FashionHeader from "./components/fashion-header"
import StylishWardrobe from "./components/stylish-wardrobe"
import IOSTabBar from "./components/ios-tab-bar"
import { Drawer } from "vaul"
import PortraitSelectionSheet from "./components/portrait-selection-sheet"
import GenerationAnimation from "./components/generation-animation"

function dataURLtoFile(dataurl: string, filename: string): File | null {
  if (!dataurl) return null
  const arr = dataurl.split(",")
  if (arr.length < 2) return null

  const mimeMatch = arr[0].match(/:(.*?);/)
  if (!mimeMatch) return null

  const mime = mimeMatch[1]
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)

  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }

  return new File([u8arr], filename, { type: mime })
}

export default function HomePage() {
  const [selfieFile, setSelfieFile] = useState<File | null>(null)
  const [clothingFile, setClothingFile] = useState<File | null>(null)
  const [selfiePreview, setSelfiePreview] = useState<string>("")
  const [clothingPreview, setClothingPreview] = useState<string>("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [showAnimation, setShowAnimation] = useState(false)
  const [isApiFinished, setIsApiFinished] = useState(false)
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null)
  const [isWardrobeOpen, setIsWardrobeOpen] = useState(false)
  const [isPortraitSheetOpen, setIsPortraitSheetOpen] = useState(false)
  const router = useRouter()

  const handleSelfieUpload = (file: File) => {
    setSelfieFile(file)
    if (file && file.name) {
      const url = URL.createObjectURL(file)
      setSelfiePreview(url)
    } else {
      setSelfiePreview("")
    }
  }

  const handleClothingUpload = (file: File) => {
    setClothingFile(file)
    if (file && file.name) {
      const url = URL.createObjectURL(file)
      setClothingPreview(url)
    } else {
      setClothingPreview("")
    }
  }

  const handleGarmentSelect = (imageSrc: string) => {
    setClothingPreview(imageSrc)
    setClothingFile(null)
    setIsWardrobeOpen(false)
  }

  const handlePortraitSelect = (imageSrc: string) => {
    setSelfiePreview(imageSrc)
    setSelfieFile(null)
    setIsPortraitSheetOpen(false)
  }

  const handleGenerate = async () => {
    if (!selfiePreview) {
      alert("Please select a portrait.")
      return
    }
    if (!clothingPreview) {
      alert("Please select a garment.")
      return
    }

    setIsGenerating(true)
    setShowAnimation(true)
    setIsApiFinished(false)
    setGeneratedImageUrl(null)

    try {
      const formData = new FormData()

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
        formData.append("human_image", finalSelfieFile)
      } else {
        alert("Could not process the selected portrait. Please try again.")
        setIsGenerating(false)
        return
      }

      // --- Smartly handle the garment image source (now fully robust) ---
      let finalGarmentFile = clothingFile
      // Scenario 1: Garment is a Data URL from localStorage (custom items)
      if (!finalGarmentFile && clothingPreview && clothingPreview.startsWith("data:image")) {
        finalGarmentFile = dataURLtoFile(clothingPreview, `wardrobe-item-${Date.now()}.png`)
      }
      // Scenario 2: Garment is a local URL from /public (default items)
      else if (!finalGarmentFile && clothingPreview.startsWith("/")) {
        const response = await fetch(clothingPreview);
        const blob = await response.blob();
        const fileName = clothingPreview.split('/').pop() || `default-garment-${Date.now()}.png`;
        finalGarmentFile = new File([blob], fileName, { type: blob.type });
      }

      if (finalGarmentFile) {
        formData.append("garment_image", finalGarmentFile)
        // Also send the original source path, which is the key for the description map
        if (clothingPreview) {
          formData.append("garment_src", clothingPreview);
        }
      } else {
        alert("Please select a garment to try on.")
        setIsGenerating(false)
        return
      }

      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to generate image: ${errorText}`)
      }

      const data = await response.json()
      if (data.imageUrl) {
        setGeneratedImageUrl(data.imageUrl)
        // Pass the garment description from the API to the animation component
        handleAnimationComplete(data.imageUrl, data.garmentDescription)
      } else {
        throw new Error("Generation succeeded but no image URL was returned.")
      }
    } catch (error) {
      console.error(error)
      if (error instanceof Error) {
        alert(error.message)
      }
      setShowAnimation(false)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleAnimationComplete = (finalImageUrl: string, garmentDescription?: string) => {
    if (finalImageUrl) {
      const params = new URLSearchParams();
      params.set('imageUrl', finalImageUrl);

      // Pass both the human and garment source URLs to the results page
      if (selfiePreview) {
        params.set('humanSrc', selfiePreview);
      }
      if (clothingPreview) {
        params.set('garmentSrc', clothingPreview);
      }
      // Pass the garment description if it exists
      if (garmentDescription) {
        params.set('garmentDescription', garmentDescription);
      }

      router.push(`/results?${params.toString()}`);
    }
    // Reset states
    setShowAnimation(false)
    setIsApiFinished(false)
    setGeneratedImageUrl(null)
  }

  const hasRequiredImages = selfiePreview && clothingPreview

  return (
    <div className="min-h-full pb-20 relative overflow-hidden">
      <GenerationAnimation
        isVisible={showAnimation}
        isComplete={isApiFinished}
        onComplete={() => handleAnimationComplete(generatedImageUrl!)}
      />
      {/* Gradient background elements */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#D5F500] rounded-full opacity-50 blur-xl -translate-y-1/2 translate-x-1/2"></div>
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-[#FF6EC7] rounded-full opacity-50 blur-xl translate-y-1/2 -translate-x-1/2"></div>
      <div className="absolute top-1/3 left-1/4 w-20 h-20 bg-[#00C2FF] rounded-full opacity-30 blur-xl"></div>
      <div className="absolute bottom-1/4 right-1/3 w-16 h-16 bg-[#FF9B3E] rounded-full opacity-40 blur-xl"></div>

      {/* Content with relative positioning */}
      <div className="relative z-10">
        {/* Stylish header */}
        <FashionHeader />

        {/* Main content */}
        <div className="px-5 space-y-8">
          {/* Guided upload section */}
          <div className="space-y-6">

            <div className="flex w-full gap-4">
              {/* --- Step 1: Portrait --- */}
              <div className="w-full space-y-2">
                <h2 className="text-base font-semibold tracking-tight text-center">
                  <span className="text-primary font-bold">Step 1:</span> Portrait
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

              {/* --- Step 2: Garment --- */}
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

            {/* Generate button */}
            <Button
              onClick={handleGenerate}
              disabled={!hasRequiredImages || isGenerating}
              className="w-full h-14 bg-[#FF6EC7] hover:bg-[#FF6EC7]/90 text-white rounded-full font-playfair text-lg font-bold shadow-lg btn-bounce disabled:opacity-50"
            >
              {isGenerating ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Creating Your Look...</span>
                </div>
              ) : (
                <span>✨ Generate My Look</span>
              )}
            </Button>
          </div>

          {/* Wardrobe Drawer */}
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

          {/* Portrait Selection Drawer */}
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
        </div>
      </div>

      {/* iOS Tab Bar */}
      <IOSTabBar />
    </div>
  )
}
