"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Share2, Download, RefreshCw, Heart, Lock, ArrowLeft, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import IOSTabBar from "../components/ios-tab-bar"

export default function ResultsPage() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLiked, setIsLiked] = useState(false)
  const router = useRouter()

  const results = [
    {
      id: 1,
      image: "/elegant-outfit.png",
      style: "Date Night",
      isLocked: false,
    },
    {
      id: 2,
      image: "/casual-outfit.png",
      style: "Casual Chic",
      isLocked: true,
    },
    {
      id: 3,
      image: "/work-outfit.png",
      style: "Work Interview",
      isLocked: true,
    },
  ]

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: "Check out my AI-generated look!",
        text: "I just tried on this amazing outfit using Ensemble",
        url: window.location.href,
      })
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
          <h1 className="text-lg font-semibold flex-1 text-center">Your Looks</h1>
          <div className="w-10"></div>
        </div>
      </div>

      {/* Results carousel */}
      <div className="px-5 py-4">
        <div className="ios-scroll overflow-x-auto snap-x snap-mandatory flex gap-4 -mx-5 px-5 pb-4">
          {results.map((result, index) => (
            <div
              key={result.id}
              className="flex-shrink-0 w-[85%] snap-center animate-fade-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="ios-card overflow-hidden">
                <div className="relative">
                  <img
                    src={
                      result.image || `/placeholder.svg?height=500&width=400&query=fashion model outfit ${index + 1}`
                    }
                    alt={result.style}
                    className={`w-full aspect-[3/4] object-cover ${result.isLocked ? "blur-sm" : ""}`}
                  />

                  {/* Style label */}
                  <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 shadow-sm">
                    <span className="text-xs font-medium">{result.style}</span>
                  </div>

                  {/* Like button */}
                  <button
                    onClick={() => !result.isLocked && setIsLiked(!isLiked)}
                    className={`absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center shadow-sm ios-btn ${
                      result.isLocked ? "bg-neutral-200" : "bg-white/90 backdrop-blur-sm"
                    }`}
                  >
                    <Heart
                      size={16}
                      className={
                        result.isLocked
                          ? "text-neutral-400"
                          : isLiked
                            ? "text-primary fill-primary"
                            : "text-neutral-600"
                      }
                    />
                  </button>

                  {/* Lock overlay */}
                  {result.isLocked && (
                    <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                      <div className="bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg text-center max-w-[80%]">
                        <div className="w-10 h-10 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <Lock className="h-5 w-5 text-neutral-500" />
                        </div>
                        <h3 className="text-sm font-medium text-neutral-900 mb-1">Premium Look</h3>
                        <p className="text-xs text-neutral-500 mb-3">Upgrade to unlock all styles</p>
                        <Button
                          size="sm"
                          className="text-xs h-8 w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl"
                        >
                          Upgrade
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium">Look #{index + 1}</h3>
                    <span className="text-xs text-neutral-500">
                      {index + 1}/{results.length}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleShare}
                      className="border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-800 rounded-xl h-12 font-medium"
                      disabled={result.isLocked}
                    >
                      <Share2 size={16} className="mr-2" />
                      Share
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-800 rounded-xl h-12 font-medium"
                      disabled={result.isLocked}
                    >
                      <Download size={16} className="mr-2" />
                      Save
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
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

        <div className="ios-card p-4 animate-fade-up">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium">Unlock Premium Features</h3>
              <p className="text-xs text-neutral-500 mt-0.5">Get unlimited styles and remove watermarks</p>
            </div>
            <Button size="sm" className="text-xs h-8 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl">
              Upgrade
            </Button>
          </div>
        </div>
      </div>

      <IOSTabBar />
    </div>
  )
}
