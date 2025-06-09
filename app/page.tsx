"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import CompactUpload from "./components/compact-upload"
import FashionHeader from "./components/fashion-header"
import LookCarousel from "./components/look-carousel"
import StylishWardrobe from "./components/stylish-wardrobe"
import IOSTabBar from "./components/ios-tab-bar"

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
  }

  const handleGenerate = async () => {
    if (!selfieFile) return

    setIsGenerating(true)
    try {
      const formData = new FormData()
      formData.append("human_image", selfieFile)

      let finalGarmentFile = clothingFile
      if (!finalGarmentFile && clothingPreview && clothingPreview.startsWith("data:image")) {
        finalGarmentFile = dataURLtoFile(clothingPreview, `wardrobe-item-${Date.now()}.png`)
      }

      if (finalGarmentFile) {
        formData.append("garment_image", finalGarmentFile)
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
        router.push(`/results?imageUrl=${encodeURIComponent(data.imageUrl)}`)
      }
    } catch (error) {
      console.error(error)
      if (error instanceof Error) {
        alert(error.message)
      }
    } finally {
      setIsGenerating(false)
    }
  }

  const hasRequiredImages = selfieFile && (clothingFile || clothingPreview)

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

        {/* Main content */}
        <div className="px-5 space-y-8">
          {/* Upload section */}
          <div className="space-y-6">
            <div className="flex gap-4">
              <CompactUpload
                label="Portrait"
                onImageSelect={handleSelfieUpload}
                preview={selfiePreview}
                required
                helpText="Full-body photo"
                variant="portrait"
              />
              <CompactUpload
                label="Garment"
                onImageSelect={handleClothingUpload}
                preview={clothingPreview}
                helpText="Clothing to try on"
                variant="garment"
              />
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

          {/* Stylish wardrobe */}
          <StylishWardrobe onGarmentSelect={handleGarmentSelect} />
        </div>
      </div>

      {/* iOS Tab Bar */}
      <IOSTabBar />
    </div>
  )
}
