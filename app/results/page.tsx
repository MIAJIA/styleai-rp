"use client"

import { useSearchParams } from "next/navigation"
import { useRouter } from "next/navigation"
import { Share2, Download, RefreshCw, Heart, Lock, ArrowLeft, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import IOSTabBar from "../components/ios-tab-bar"

export default function ResultsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const imageUrl = searchParams.get("imageUrl")

  const handleShare = () => {
    if (navigator.share && imageUrl) {
      navigator.share({
        title: "Check out my AI-generated look!",
        text: "I just tried on this amazing outfit using StyleAI",
        url: window.location.href,
      })
    }
  }

  // A simple function to trigger browser download
  const handleDownload = () => {
    if (imageUrl) {
      const link = document.createElement('a');
      link.href = imageUrl;
      // You might want to give a more descriptive name
      link.download = `styleai-look-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  return (
    <div className="min-h-full pb-20">
      {/* iOS-style header with back button */}
      <div className="bg-white sticky top-0 z-10 border-b border-neutral-100 pt-safe">
        <div className="flex items-center px-4 h-12">
          <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center -ml-2 ios-btn">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-semibold flex-1 text-center">Your New Look</h1>
          <div className="w-10"></div>
        </div>
      </div>

      {/* Main result display */}
      <div className="px-5 py-4">
        <div
          className="w-full animate-fade-in"
        >
          <div className="ios-card overflow-hidden">
            <div className="relative">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt="Generated fashion look"
                  className="w-full aspect-[3/4] object-contain bg-gray-100"
                />
              ) : (
                <div className="w-full aspect-[3/4] bg-neutral-100 flex items-center justify-center">
                  <div className="text-center text-neutral-500">
                    <p>Generating your look...</p>
                    <p className="text-xs">If this takes too long, please go back and try again.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4">
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleShare}
                  className="border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-800 rounded-xl h-12 font-medium"
                  disabled={!imageUrl}
                >
                  <Share2 size={16} className="mr-2" />
                  Share
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  className="border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-800 rounded-xl h-12 font-medium"
                  disabled={!imageUrl}
                >
                  <Download size={16} className="mr-2" />
                  Save
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-5 space-y-4">
        <Button
          className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-medium"
          onClick={() => router.push("/")}
        >
          <RefreshCw size={16} className="mr-2" />
          Try Another Look
        </Button>
      </div>

      <IOSTabBar />
    </div>
  )
}
