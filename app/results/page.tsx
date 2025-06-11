"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { useRouter } from "next/navigation"
import { Share2, Download, RefreshCw, Heart, Lock, ArrowLeft, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import IOSTabBar from "../components/ios-tab-bar"
import StyleSelector from "../components/style-selector"

interface PastLook {
  id: string
  imageUrl: string
  style: string | null
  timestamp: number
  originalHumanSrc?: string
  originalGarmentSrc?: string
  garmentDescription?: string
  personaProfile?: string | null
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
  const initialHumanSrc = searchParams.get("humanSrc")
  const initialGarmentSrc = searchParams.get("garmentSrc")
  const initialGarmentDescription = searchParams.get("garmentDescription")
  const initialPersonaProfile = searchParams.get("personaProfile")
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(initialImageUrl)
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null)
  const [pastLooks, setPastLooks] = useState<PastLook[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isRecentLooksExpanded, setIsRecentLooksExpanded] = useState(false)

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
          originalHumanSrc: initialHumanSrc ?? undefined,
          originalGarmentSrc: initialGarmentSrc ?? undefined,
          garmentDescription: initialGarmentDescription ?? undefined,
          personaProfile: initialPersonaProfile,
        }
        const updatedLooks = [newLook, ...storedLooks]
        setPastLooks(updatedLooks)
        saveRecentLooks(updatedLooks)
      }
    }
  }, [initialImageUrl, initialHumanSrc, initialGarmentSrc, initialGarmentDescription, initialPersonaProfile])

  // Save pastLooks to localStorage whenever it changes
  useEffect(() => {
    if (pastLooks.length > 0) {
      saveRecentLooks(pastLooks)
    }
  }, [pastLooks])

  const handleDeleteLook = (lookIdToDelete: string) => {
    const updatedLooks = pastLooks.filter((look) => look.id !== lookIdToDelete)
    setPastLooks(updatedLooks)
  }

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

  const handleGenerateNewStyle = async (styleId: string) => {
    // The source of truth for the human image is whatever is currently displayed.
    const humanImageUrl = currentImageUrl;

    // We still need the original garment's path for the prompt and type lookup.
    // So we find the very first, un-styled look in our history.
    const originalLook = pastLooks.find(look => look.style === null);

    if (!humanImageUrl || !originalLook?.originalGarmentSrc || isGenerating) {
      alert("Could not find the necessary image sources to generate a new style. Please try again.");
      return;
    }

    const { originalGarmentSrc, originalHumanSrc, garmentDescription, personaProfile } = originalLook;

    // The backend API requires a full URL for relative paths.
    const fullGarmentUrl = originalGarmentSrc.startsWith('/')
      ? `${window.location.origin}${originalGarmentSrc}`
      : originalGarmentSrc;

    const fullHumanUrl = humanImageUrl.startsWith('/')
      ? `${window.location.origin}${humanImageUrl}`
      : humanImageUrl;

    setSelectedStyle(styleId);
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/generate-style', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          human_image_url: fullHumanUrl,
          style_prompt: styleId,
          garment_type: originalGarmentSrc,
          garment_description: garmentDescription,
          personaProfile: personaProfile ? JSON.parse(personaProfile) : null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorText = errorData.error || "An error occurred";
        throw new Error(errorText);
      }

      const data = await response.json();

      if (data.imageUrl) {
        const newStyledLook: PastLook = {
          id: Date.now().toString(),
          imageUrl: data.imageUrl,
          style: styleId,
          timestamp: Date.now(),
          originalHumanSrc: originalHumanSrc,
          originalGarmentSrc: originalGarmentSrc,
          garmentDescription: garmentDescription,
          personaProfile: personaProfile,
        };

        // Add the new look to the front of the list
        setPastLooks(prev => [newStyledLook, ...prev]);

        // Update current image
        setCurrentImageUrl(data.imageUrl);
      }
    } catch (error) {
      console.error(error);
      if (error instanceof Error) {
        setError(error.message);
      }
    } finally {
      setIsGenerating(false);
      setSelectedStyle(null);
    }
  }

  const handlePastLookClick = (pastLook: PastLook) => {
    // When clicking a past look, simply set it as the current one.
    // No need to add the previously viewed image to the history again.
    setCurrentImageUrl(pastLook.imageUrl);
  }

  const handleClearRecentLooks = () => {
    setPastLooks([])
    saveRecentLooks([])
  }

  const displayedLooks = isRecentLooksExpanded ? pastLooks : pastLooks.slice(0, 6)

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

      <div className="px-5 py-4 space-y-4">
        {/* Main result display */}
        <div className="w-full animate-fade-in">
          <div className="bg-white rounded-xl shadow-sm">
            {/* TODO: The current `object-contain` is a good defensive measure. If the root
                image generation issue is fixed and results have a consistent aspect ratio,
                we can re-evaluate this container's styling. See OPEN_ISSUES.md. */}
            <div className="relative w-full aspect-[3/4] bg-neutral-100 rounded-xl">
              {currentImageUrl ? (
                <>
                  <img
                    src={currentImageUrl}
                    alt="Generated fashion look"
                    className="w-full h-full object-contain rounded-xl"
                  />
                  <div className="absolute top-3 right-3 flex flex-col gap-3">
                    <button onClick={handleShare} className="h-10 w-10 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center ios-btn shadow-md">
                      <Share2 size={20} />
                    </button>
                    <button onClick={handleDownload} className="h-10 w-10 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center ios-btn shadow-md">
                      <Download size={20} />
                    </button>
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center text-neutral-500">
                    <p>Generating your look...</p>
                    <p className="text-xs">If this takes too long, please go back and try again.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Style selector section */}
        <div className="ios-card p-5 animate-fade-up">
          <div className="mb-4">
            <h3 className="text-sm font-medium text-neutral-700 mb-2">Transform with a New Style</h3>
          </div>
          <StyleSelector
            selectedStyle={selectedStyle}
            isGenerating={isGenerating}
            onStyleSelect={handleGenerateNewStyle}
          />
        </div>

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
              displayedLooks.map((pastLook) => (
                <div key={pastLook.id} className="relative group aspect-[3/4]">
                  <button
                    onClick={() => handlePastLookClick(pastLook)}
                    className="w-full h-full bg-neutral-100 rounded-lg overflow-hidden ios-btn hover:scale-105 transition-transform"
                  >
                    <img
                      src={pastLook.imageUrl}
                      alt="Past look"
                      className="w-full h-full object-cover"
                    />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation() // Prevent click from bubbling to the main card
                      handleDeleteLook(pastLook.id)
                    }}
                    className="absolute top-0 right-0 z-10 p-2 text-white bg-black/40 rounded-bl-lg rounded-tr-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 ios-btn"
                    aria-label="Delete look"
                  >
                    <X size={16} />
                  </button>
                </div>
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
            <button
              onClick={() => setIsRecentLooksExpanded(!isRecentLooksExpanded)}
              className="w-full text-xs text-center text-primary font-medium p-2 mt-2 rounded-lg ios-btn bg-primary/10"
            >
              {isRecentLooksExpanded ? 'Show Less' : `Show ${pastLooks.length - 6} More Looks...`}
            </button>
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
