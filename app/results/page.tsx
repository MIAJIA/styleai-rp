"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { useRouter } from "next/navigation"
import { Share2, Download, RefreshCw, Heart, Lock, ArrowLeft, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import IOSTabBar from "../components/ios-tab-bar"
import StyleSelector from "../components/style-selector"

interface PastLook {
  id: string
  imageUrl: string
  style: string | null
  timestamp: number
}

const RECENT_LOOKS_STORAGE_KEY = "styleai_recent_looks"

// Helper function to read from localStorage safely
const getRecentLooks = (): PastLook[] => {
  if (typeof window === "undefined") {
    return []
  }
  try {
    const storedLooks = window.localStorage.getItem(RECENT_LOOKS_STORAGE_KEY)
    if (storedLooks) {
      return JSON.parse(storedLooks)
    }
  } catch (error) {
    console.error("Failed to parse recent looks from localStorage", error)
  }
  return []
}

// Helper function to save to localStorage safely
const saveRecentLooks = (looks: PastLook[]) => {
  if (typeof window === "undefined") {
    return
  }
  try {
    window.localStorage.setItem(RECENT_LOOKS_STORAGE_KEY, JSON.stringify(looks))
  } catch (error) {
    console.error("Failed to save recent looks to localStorage", error)
  }
}

export default function ResultsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialImageUrl = searchParams.get("imageUrl")
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(initialImageUrl)
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null)
  const [pastLooks, setPastLooks] = useState<PastLook[]>([])
  const [isGenerating, setIsGenerating] = useState(false)

  // Load recent looks from localStorage on mount
  useEffect(() => {
    const storedLooks = getRecentLooks()
    setPastLooks(storedLooks)
  }, [])

  // Save the initial look to recent looks if it's new
  useEffect(() => {
    if (initialImageUrl) {
      const storedLooks = getRecentLooks()
      const isExistingLook = storedLooks.some(look => look.imageUrl === initialImageUrl)
      
      if (!isExistingLook) {
        const newLook: PastLook = {
          id: Date.now().toString(),
          imageUrl: initialImageUrl,
          style: null, // Original generated look has no style transformation
          timestamp: Date.now(),
        }
        const updatedLooks = [newLook, ...storedLooks]
        setPastLooks(updatedLooks)
        saveRecentLooks(updatedLooks)
      }
    }
  }, [initialImageUrl])

  // Save pastLooks to localStorage whenever it changes
  useEffect(() => {
    if (pastLooks.length > 0) {
      saveRecentLooks(pastLooks)
    }
  }, [pastLooks])

  const handleShare = () => {
    if (navigator.share && currentImageUrl) {
      navigator.share({
        title: "Check out my AI-generated look!",
        text: "I just tried on this amazing outfit using StyleAI",
        url: window.location.href,
      })
    }
  }

  // A simple function to trigger browser download
  const handleDownload = () => {
    if (currentImageUrl) {
      const link = document.createElement('a');
      link.href = currentImageUrl;
      // You might want to give a more descriptive name
      link.download = `styleai-look-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  const handleTryAnotherLook = async () => {
    if (!currentImageUrl || !selectedStyle) return

    setIsGenerating(true)
    try {
      const response = await fetch('/api/generate-style', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: currentImageUrl,
          style: selectedStyle,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to generate styled image: ${errorText}`);
      }

      const data = await response.json();

      if (data.imageUrl) {
        // Add current image to past looks before replacing it
        const newPastLook: PastLook = {
          id: Date.now().toString(),
          imageUrl: currentImageUrl,
          style: null, // Current image has no style applied initially
          timestamp: Date.now(),
        };
        const updatedPastLooks = [newPastLook, ...pastLooks];
        setPastLooks(updatedPastLooks);

        // Update current image
        setCurrentImageUrl(data.imageUrl);
        setSelectedStyle(null); // Reset style selection

        // Save the new styled image to recent looks
        const newStyledLook: PastLook = {
          id: (Date.now() + 1).toString(),
          imageUrl: data.imageUrl,
          style: selectedStyle, // Store which style was applied
          timestamp: Date.now() + 1,
        };
        const finalUpdatedLooks = [newStyledLook, ...updatedPastLooks];
        setPastLooks(finalUpdatedLooks);
      }
    } catch (error) {
      console.error(error);
      if (error instanceof Error) {
        alert(error.message);
      }
    } finally {
      setIsGenerating(false);
    }
  }

  const handlePastLookClick = (pastLook: PastLook) => {
    // Add current image to past looks
    if (currentImageUrl) {
      const currentLook: PastLook = {
        id: Date.now().toString(),
        imageUrl: currentImageUrl,
        style: null,
        timestamp: Date.now(),
      };
      setPastLooks(prev => [currentLook, ...prev.filter(look => look.id !== pastLook.id)]);
    }

    // Set the selected past look as current
    setCurrentImageUrl(pastLook.imageUrl);
  }

  const handleClearRecentLooks = () => {
    setPastLooks([])
    saveRecentLooks([])
  }

  return (
    <div className="min-h-full pb-20">
      {/* iOS-style header with back button */}
      <div className="bg-white sticky top-0 z-10 border-b border-neutral-100 pt-safe">
        <div className="flex items-center px-4 h-12">
          <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center -ml-2 ios-btn">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-semibold flex-1 text-center">Your Outfit Gallery</h1>
          <div className="w-10"></div>
        </div>
      </div>

      {/* Main result display */}
      <div className="px-5 py-4">
        <div
          className="w-full animate-fade-in"
        >
          <div className="bg-white rounded-xl shadow-sm">
            {/* TODO: The current `object-contain` is a good defensive measure. If the root
                image generation issue is fixed and results have a consistent aspect ratio,
                we can re-evaluate this container's styling. See OPEN_ISSUES.md. */}
            <div className="relative w-full aspect-[3/4] bg-neutral-100 rounded-t-xl">
              {currentImageUrl ? (
                <img
                  src={currentImageUrl}
                  alt="Generated fashion look"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
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
                  disabled={!currentImageUrl}
                >
                  <Share2 size={16} className="mr-2" />
                  Share
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  className="border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-800 rounded-xl h-12 font-medium"
                  disabled={!currentImageUrl}
                >
                  <Download size={16} className="mr-2" />
                  Save
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Style selector section */}
        <div className="ios-card p-5 animate-fade-up mt-6">
          <div className="mb-4">
            <h3 className="text-sm font-medium text-neutral-700 mb-2">Choose a New Style</h3>
            <p className="text-xs text-neutral-500">
              Select a style below and click "Try Another Look" to transform your image with AI
            </p>
          </div>
          <StyleSelector selectedStyle={selectedStyle} onStyleSelect={setSelectedStyle} />
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-5 space-y-4">
        <Button
          className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-medium"
          onClick={handleTryAnotherLook}
          disabled={!currentImageUrl || !selectedStyle || isGenerating}
        >
          {isGenerating ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Creating Your New Look...</span>
            </div>
          ) : (
            <>
              <RefreshCw size={16} className="mr-2" />
              Try Another Look
            </>
          )}
        </Button>

        {/* Recent Looks Section */}
        <div className="ios-card p-5 animate-fade-up">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium">Recent Looks</h3>
            {pastLooks.length > 0 && (
              <button 
                onClick={handleClearRecentLooks}
                className="text-xs text-primary font-medium ios-btn"
              >
                Clear All
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {pastLooks.length > 0 ? (
              pastLooks.slice(0, 6).map((pastLook) => (
                <button
                  key={pastLook.id}
                  onClick={() => handlePastLookClick(pastLook)}
                  className="aspect-[3/4] bg-neutral-100 rounded-lg overflow-hidden ios-btn hover:scale-105 transition-transform"
                >
                  <img
                    src={pastLook.imageUrl}
                    alt="Past look"
                    className="w-full h-full object-cover"
                  />
                </button>
              ))
            ) : (
              // Empty placeholder boxes
              Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`placeholder-${index}`}
                  className="aspect-[3/4] bg-neutral-50 border-2 border-dashed border-neutral-200 rounded-lg flex items-center justify-center"
                >
                  <div className="text-center text-neutral-400">
                    <div className="w-8 h-8 mx-auto mb-1 rounded-full bg-neutral-200 flex items-center justify-center">
                      <span className="text-xs">👗</span>
                    </div>
                    <p className="text-xs">New Look</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {pastLooks.length > 6 && (
            <p className="text-xs text-neutral-500 text-center mt-3">
              And {pastLooks.length - 6} more...
            </p>
          )}

          {pastLooks.length === 0 && (
            <p className="text-xs text-neutral-500 text-center mt-3">
              Try different styles to build your outfit collection
            </p>
          )}
        </div>
      </div>

      <IOSTabBar />
    </div>
  )
}
