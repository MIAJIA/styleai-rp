"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import IOSTabBar from "./components/ios-tab-bar"
import IOSHeader from "./components/ios-header"
import IOSUpload from "./components/ios-upload"
import StyleSelector from "./components/style-selector"
import Link from 'next/link'

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
    try {
      const formData = new FormData();
      formData.append("human_image", selfieFile);
      if (clothingFile) {
        formData.append("garment_image", clothingFile);
      }

      const response = await fetch('/api/generate', {
        method: 'POST',
        body: formData,
        // Do NOT set Content-Type header, browser does it automatically for FormData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to generate image: ${errorText}`);
      }

      const data = await response.json();

      // For now, just log the data to the console to verify
      console.log('Generated data:', data);

      // We will handle the redirect in the next step
      if (data.imageUrl) {
        router.push(`/results?imageUrl=${encodeURIComponent(data.imageUrl)}`);
      }

    } catch (error) {
      console.error(error);
      // Here you could show an error message to the user
      // It's good practice to show the actual error from the server
      if (error instanceof Error) {
        alert(error.message);
      }
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="min-h-full pb-20">
      <header className="px-8 py-4 border-b">
        <div className="flex justify-between items-center">
          <h1 className="font-bold text-xl">StyleAI</h1>
          <Link href="/account" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
            Check Account Balance
          </Link>
        </div>
      </header>
      {/* iOS-style header */}
      <IOSHeader
        title="StyleAI"
        subtitle="Your Style Journey Starts here"
        className="bg-white sticky top-0 z-10 border-b border-neutral-100"
      />

      {/* Main content */}
      <div className="px-5 space-y-6">
        {/* Upload section */}
        <div className="ios-card p-5 animate-fade-up" style={{ animationDelay: "0.1s" }}>
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <IOSUpload
                label="Portrait"
                onImageSelect={handleSelfieUpload}
                preview={selfiePreview}
                required
                helpText="For best results, upload a front-facing, full-length image in clear lighting."
              />
              <IOSUpload
                label="Garment"
                onImageSelect={handleClothingUpload}
                preview={clothingPreview}
                helpText="Upload a clear image of the garment you'd like to try on — ideally laid flat or worn"
              />
            </div>

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
                <span>{selectedStyle ? "Creating Your Look..." : "Processing with Original Background..."}</span>
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
