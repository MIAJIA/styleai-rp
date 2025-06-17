"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, X, ChevronDown, ChevronUp, Image as ImageIcon } from "lucide-react";
import IOSTabBar from "../components/ios-tab-bar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PastLook {
  id: string;
  imageUrl: string;
  style: string | null;
  timestamp: number;
  originalHumanSrc?: string;
  originalGarmentSrc?: string;
  garmentDescription?: string;
  personaProfile?: string | null;
  processImages?: {
    humanImage: string;
    garmentImage: string;
    finalImage: string;
    styleSuggestion?: any;
  };
}

export default function ResultsPage() {
  const router = useRouter();
  const [pastLooks, setPastLooks] = useState<PastLook[]>([]);
  const [isRecentLooksExpanded, setIsRecentLooksExpanded] = useState(false);
  const [selectedLook, setSelectedLook] = useState<PastLook | null>(null);
  const [showProcessImages, setShowProcessImages] = useState<Record<string, boolean>>({});

  // Load past looks from localStorage on initial render
  useEffect(() => {
    const storedLooks = localStorage.getItem("pastLooks");
    if (storedLooks) {
      setPastLooks(JSON.parse(storedLooks));
    }
  }, []);

  const handleDeleteLook = (lookId: string) => {
    const updatedLooks = pastLooks.filter((look) => look.id !== lookId);
    setPastLooks(updatedLooks);
    localStorage.setItem("pastLooks", JSON.stringify(updatedLooks));
  };

  const handleClearRecentLooks = () => {
    setPastLooks([]);
    localStorage.removeItem("pastLooks");
  };

  const toggleProcessImages = (lookId: string) => {
    setShowProcessImages(prev => ({
      ...prev,
      [lookId]: !prev[lookId]
    }));
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const displayedLooks = isRecentLooksExpanded ? pastLooks : pastLooks.slice(0, 6);

  return (
    <div className="min-h-full pb-20">
      {/* iOS-style header with back button */}
      <div className="bg-white sticky top-0 z-10 border-b border-neutral-100 pt-safe">
        <div className="flex items-center px-4 h-12">
          <button
            onClick={() => router.push("/")}
            className="w-10 h-10 flex items-center justify-center -ml-2 ios-btn"
          >
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

            {pastLooks.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                {displayedLooks.map((pastLook) => (
                  <div key={pastLook.id} className="bg-white rounded-xl shadow-sm border border-gray-100">
                    {/* Main Image */}
                    <div className="relative aspect-[3/4] rounded-t-xl overflow-hidden">
                    <img
                      src={pastLook.imageUrl}
                        alt="Generated look"
                      className="w-full h-full object-cover"
                    />
                  <button
                        onClick={() => handleDeleteLook(pastLook.id)}
                        className="absolute top-2 right-2 p-2 bg-black/40 rounded-full text-white hover:bg-black/60 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>

                    {/* Look Details */}
                    <div className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900 text-sm">
                            {pastLook.style === 'suggestion' ? 'Style Suggestion' : pastLook.style}
                          </h4>
                          <p className="text-xs text-gray-500">{formatDate(pastLook.timestamp)}</p>
                        </div>
                        {pastLook.processImages && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleProcessImages(pastLook.id)}
                            className="text-gray-600 h-8 px-2"
                          >
                            <ImageIcon className="w-4 h-4 mr-1" />
                            {showProcessImages[pastLook.id] ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                      </div>

                      {/* Process Images */}
                      {showProcessImages[pastLook.id] && pastLook.processImages && (
                        <div className="mt-3 space-y-3">
                          <div className="grid grid-cols-3 gap-1">
                            <div className="space-y-1">
                              <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                                <img
                                  src={pastLook.processImages.humanImage}
                                  alt="Original photo"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <p className="text-[10px] text-gray-500 text-center">Original</p>
                            </div>
                            <div className="space-y-1">
                              <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                                <img
                                  src={pastLook.processImages.garmentImage}
                                  alt="Garment"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <p className="text-[10px] text-gray-500 text-center">Garment</p>
                            </div>
                            <div className="space-y-1">
                              <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                                <img
                                  src={pastLook.processImages.finalImage}
                                  alt="Final look"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <p className="text-[10px] text-gray-500 text-center">Final</p>
                            </div>
                          </div>

                          {/* Style Suggestion */}
                          {pastLook.processImages.styleSuggestion && (
                            <div className="bg-gray-50 rounded-lg p-2 text-xs">
                              <h5 className="font-medium text-gray-900 mb-1">Style Suggestion</h5>
                              {Object.entries(pastLook.processImages.styleSuggestion)
                                .filter(([key]) => key !== "image_prompt")
                                .map(([key, value]) => (
                                  <div key={key} className="mb-1">
                                    <span className="text-gray-600 capitalize">{key.replace(/_/g, " ")}: </span>
                                    <span className="text-gray-900">{value as string}</span>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {pastLooks.length > 6 && (
                <button
                  onClick={() => setIsRecentLooksExpanded(!isRecentLooksExpanded)}
                  className="w-full text-xs text-center text-primary font-medium p-2 mt-4 rounded-lg ios-btn bg-primary/10"
                >
                  {isRecentLooksExpanded ? "Show Less" : `Show ${pastLooks.length - 6} More Looks...`}
                </button>
              )}
            </>
            ) : (
              // Empty placeholder boxes
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, index) => (
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
              ))}
          </div>
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
  );
}
