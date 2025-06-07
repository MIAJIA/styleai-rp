"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import IOSTabBar from "./components/ios-tab-bar"
import IOSHeader from "./components/ios-header"
import IOSUpload from "./components/ios-upload"
import StyleSelector from "./components/style-selector"

export default function HomePage() {
  const [selfieFile, setSelfieFile] = useState<File | null>(null)
  const [clothingFile, setClothingFile] = useState<File | null>(null)
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null)
  const [selfiePreview, setSelfiePreview] = useState<string>("")
  const [clothingPreview, setClothingPreview] = useState<string>("")
  const [isGenerating, setIsGenerating] = useState(false)
  const router = useRouter()

  const handleSelfieUpload = (file: File) => {
    setSelfieFile(file)
    if (file) {
      const url = URL.createObjectURL(file)
      setSelfiePreview(url)
    } else {
      setSelfiePreview("")
    }
  }

  const handleClothingUpload = (file: File) => {
    setClothingFile(file)
    if (file) {
      const url = URL.createObjectURL(file)
      setClothingPreview(url)
    } else {
      setClothingPreview("")
    }
  }

  const handleGenerate = async () => {
    if (!selfieFile) return

    setIsGenerating(true)
    // Simulate AI processing
    await new Promise((resolve) => setTimeout(resolve, 2000))
    setIsGenerating(false)
    router.push("/results")
  }

  return (
    <div className="min-h-full pb-20">
      {/* iOS-style header */}
      <IOSHeader
        title="Ensemble"
        subtitle="Discover your perfect style with AI"
        className="bg-white sticky top-0 z-10 border-b border-neutral-100"
      />

      {/* Welcome message for iOS users */}
      <div className="px-5 py-4 animate-fade-in">
        <div className="ios-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-medium text-neutral-900">Welcome to Ensemble</h2>
              <p className="text-xs text-neutral-500 mt-0.5">Upload a selfie to see yourself in stunning new outfits</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="px-5 space-y-6">
        {/* Upload section */}
        <div className="ios-card p-5 animate-fade-up" style={{ animationDelay: "0.1s" }}>
          <h2 className="text-lg font-semibold text-center mb-5">Try On a Look</h2>

          <div className="space-y-5">
            <IOSUpload label="Your Selfie" onImageSelect={handleSelfieUpload} preview={selfiePreview} required />

            <IOSUpload
              label="Clothing Item (Optional)"
              onImageSelect={handleClothingUpload}
              preview={clothingPreview}
            />

            <StyleSelector selectedStyle={selectedStyle} onStyleSelect={setSelectedStyle} />
          </div>
        </div>

        {/* Generate button */}
        <div className="animate-fade-up" style={{ animationDelay: "0.2s" }}>
          <Button
            onClick={handleGenerate}
            disabled={!selfieFile || isGenerating}
            className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-medium shadow-sm"
          >
            {isGenerating ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Creating Your Look...</span>
              </div>
            ) : (
              <span>Generate My Look</span>
            )}
          </Button>
        </div>

        {/* Previous looks */}
        <div className="ios-card p-5 animate-fade-up" style={{ animationDelay: "0.3s" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium">Recent Looks</h3>
            <button className="text-xs text-primary font-medium ios-btn">View All</button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="aspect-[3/4] bg-neutral-100 rounded-lg flex items-center justify-center">
                {selfiePreview ? (
                  <img
                    src={`/fashion-model-outfit.png?height=120&width=90&query=fashion model outfit ${i}`}
                    alt={`Look ${i}`}
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  <Sparkles className="text-neutral-300" size={18} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <IOSTabBar />
    </div>
  )
}
