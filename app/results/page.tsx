"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, X } from "lucide-react"
import IOSTabBar from "../components/ios-tab-bar"

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

export default function ResultsPage() {
  const router = useRouter()
  const [pastLooks, setPastLooks] = useState<PastLook[]>([])
  const [isRecentLooksExpanded, setIsRecentLooksExpanded] = useState(false)

  // Load past looks from localStorage on initial render
  useEffect(() => {
    const storedLooks = localStorage.getItem("pastLooks")
    if (storedLooks) {
      setPastLooks(JSON.parse(storedLooks))
    }
  }, [])

  const handleDeleteLook = (lookId: string) => {
    const updatedLooks = pastLooks.filter((look) => look.id !== lookId)
    setPastLooks(updatedLooks)
    localStorage.setItem("pastLooks", JSON.stringify(updatedLooks))
  }

  const handleClearRecentLooks = () => {
    setPastLooks([])
    localStorage.removeItem("pastLooks")
  }

  const displayedLooks = isRecentLooksExpanded ? pastLooks : pastLooks.slice(0, 6)

  return (
    <div className="min-h-full pb-20">
      {/* iOS-style header with back button */}
      <div className="bg-white sticky top-0 z-10 border-b border-neutral-100 pt-safe">
        <div className="flex items-center px-4 h-12">
          <button onClick={() => router.push("/")} className="w-10 h-10 flex items-center justify-center -ml-2 ios-btn">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-semibold flex-1 text-center">My Looks</h1>
          <div className="w-10"></div>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
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
                  <div
                    className="w-full h-full bg-neutral-100 rounded-lg overflow-hidden"
                  >
                    <img
                      src={pastLook.imageUrl}
                      alt="Past look"
                      className="w-full h-full object-cover"
                    />
                  </div>
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
              Your generated looks will appear here.
            </p>
          )}
        </div>
      </div>

      <IOSTabBar />
    </div>
  )
}
