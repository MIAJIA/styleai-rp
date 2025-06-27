"use client";

import { useState } from "react";
import { Share2, Download, RefreshCw, Heart, Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import ImageVoteButtons from "@/components/image-vote-buttons";
import Navigation from "../components/navigation";

export default function ResultPage() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLiked, setIsLiked] = useState(false);

  const results = [
    {
      id: 1,
      image: "/fashionable-woman-elegant-dress.png",
      style: "Date Night Elegance",
      isBlurred: false,
    },
    {
      id: 2,
      image: "/casual-chic-woman.png",
      style: "Casual Chic",
      isBlurred: true,
    },
    {
      id: 3,
      image: "/professional-woman.png",
      style: "Professional Look",
      isBlurred: true,
    },
  ];

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: "Check out my AI-generated look!",
        text: "I just tried on this amazing outfit using StyleAI",
        url: window.location.href,
      });
    }
  };

  return (
    <div className="min-h-screen pb-20 bg-gradient-to-br from-rose-50 to-pink-50">
      {/* Header */}
      <div className="px-6 pt-12 pb-6 text-center">
        <h1 className="text-2xl font-bold gradient-text mb-2">Your AI Looks</h1>
        <p className="text-gray-600 text-sm">Swipe to explore different styles</p>
      </div>

      {/* Results Carousel */}
      <div className="px-6 mb-8">
        <div className="relative">
          <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-4">
            {results.map((result, index) => (
              <div
                key={result.id}
                className="flex-shrink-0 w-72 snap-center animate-fade-in"
                style={{ animationDelay: `${index * 0.2}s` }}
              >
                <div className="glass-card rounded-3xl p-4 relative overflow-hidden">
                  <div className="relative group">
                    <img
                      src={result.image || "/placeholder.svg"}
                      alt={result.style}
                      className={`w-full h-96 object-cover rounded-2xl ${result.isBlurred ? "blur-sm" : ""}`}
                    />

                    {/* Watermark for demo */}
                    {result.isBlurred && (
                      <div className="absolute inset-0 bg-black/20 rounded-2xl flex items-center justify-center">
                        <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-4 text-center">
                          <Lock className="mx-auto mb-2 text-gray-600" size={24} />
                          <p className="text-sm font-medium text-gray-800 mb-1">Premium Look</p>
                          <p className="text-xs text-gray-600">Upgrade to unlock</p>
                        </div>
                      </div>
                    )}

                    {/* Style Label */}
                    <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1">
                      <span className="text-xs font-medium text-gray-800">{result.style}</span>
                    </div>

                    {/* Vote buttons - only show for non-blurred images */}
                    {!result.isBlurred && (
                      <div className="absolute top-3 left-1/2 transform -translate-x-1/2">
                        <ImageVoteButtons
                          imageUrl={result.image}
                          size="sm"
                          variant="overlay"
                          className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                          onVoteChange={(voteType) => {
                            console.log(`[Result] Image vote changed: ${voteType} for style ${result.style}`);
                          }}
                        />
                      </div>
                    )}

                    {/* Like Button */}
                    <button
                      onClick={() => setIsLiked(!isLiked)}
                      className="absolute top-3 right-3 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
                    >
                      <Heart
                        size={18}
                        className={isLiked ? "text-rose-500 fill-current" : "text-gray-600"}
                      />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Button
            onClick={handleShare}
            variant="outline"
            className="h-12 border-rose-200 text-rose-600 hover:bg-rose-50 rounded-2xl"
          >
            <Share2 size={18} className="mr-2" />
            Share
          </Button>
          <Button
            variant="outline"
            className="h-12 border-rose-200 text-rose-600 hover:bg-rose-50 rounded-2xl"
          >
            <Download size={18} className="mr-2" />
            Save
          </Button>
        </div>

        <Button className="w-full h-12 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white rounded-2xl">
          <RefreshCw size={18} className="mr-2" />
          Try Another Look
        </Button>
      </div>

      {/* Upgrade Prompt */}
      <div className="mx-6 mt-6 glass-card rounded-3xl p-6 text-center animate-slide-up">
        <div className="w-12 h-12 bg-gradient-to-br from-rose-400 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <Sparkles className="text-white" size={20} />
        </div>
        <h3 className="font-semibold text-gray-800 mb-2">Unlock All Styles</h3>
        <p className="text-sm text-gray-600 mb-4">
          Get unlimited AI-generated looks and premium styles
        </p>
        <Button className="bg-gradient-to-r from-rose-500 to-pink-600 text-white rounded-xl px-6">
          Upgrade Now
        </Button>
      </div>

      <Navigation />
    </div>
  );
}
