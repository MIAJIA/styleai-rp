"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, X, ChevronDown, ChevronUp, Image as ImageIcon, BarChart3, ThumbsUp, ThumbsDown } from "lucide-react";
import IOSTabBar from "../components/ios-tab-bar";
import ImageVoteButtons from "@/components/image-vote-buttons";
import ImageVoteStatus from "@/components/image-vote-status";
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
  const [globalVoteStats, setGlobalVoteStats] = useState<{
    totalImages: number;
    totalVotes: number;
    upvotes: number;
    downvotes: number;
    upvotePercentage: number;
  } | null>(null);

  // Load past looks from database on initial render
  useEffect(() => {
    const loadLooks = async () => {
      try {
        // First, try to load from the database
        const response = await fetch('/api/looks?userId=default&limit=50');
        const result = await response.json();

        if (result.success && result.looks.length > 0) {
          console.log(`Loaded ${result.looks.length} looks from database`);
          setPastLooks(result.looks);
          return;
        }

        // If there is no data in the database, try to migrate from localStorage
        const storedLooks = localStorage.getItem("pastLooks");
        if (storedLooks) {
          const localLooks = JSON.parse(storedLooks);
          console.log(`Found ${localLooks.length} looks in localStorage, migrating...`);

          // Display local data first
          setPastLooks(localLooks);

          // Migrate to the database in the background
          try {
            const migrateResponse = await fetch('/api/looks/migrate', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                looks: localLooks,
                userId: 'default',
              }),
            });

            const migrateResult = await migrateResponse.json();
            console.log('Migration result:', migrateResult);

            if (migrateResult.success) {
              // Clear localStorage after successful migration
              localStorage.removeItem('pastLooks');
              console.log('Migration completed, localStorage cleared');

              // Reload from the database to ensure data consistency
              const freshResponse = await fetch('/api/looks?userId=default&limit=50');
              const freshResult = await freshResponse.json();
              if (freshResult.success) {
                setPastLooks(freshResult.looks);
              }
            }
          } catch (migrateError) {
            console.error('Migration failed:', migrateError);
            // Migration failed, continue to use local data
          }
        } else {
          console.log('No looks found in database or localStorage');
          setPastLooks([]);
        }
      } catch (error) {
        console.error('Error loading looks:', error);

        // If all methods fail, try to read from localStorage
        try {
          const storedLooks = localStorage.getItem("pastLooks");
          if (storedLooks) {
            setPastLooks(JSON.parse(storedLooks));
            console.log('Loaded looks from localStorage as fallback');
          }
        } catch (localError) {
          console.error('Failed to load from localStorage:', localError);
          setPastLooks([]);
        }
      }
    };

    loadLooks();
  }, []);

  // Load global vote statistics
  useEffect(() => {
    const loadGlobalVoteStats = async () => {
      if (pastLooks.length === 0) return;

      console.log(`[Results] Loading global vote stats for ${pastLooks.length} images`);
      try {
        const imageUrls = pastLooks.map(look => look.imageUrl);
        console.log(`[Results] Image URLs to check:`, imageUrls.map(url => url.substring(0, 50) + '...'));

        const response = await fetch(`/api/image-vote/stats?imageUrls=${encodeURIComponent(JSON.stringify(imageUrls))}`);
        console.log(`[Results] Stats API response status: ${response.status}`);

        const data = await response.json();
        console.log(`[Results] Stats API response data:`, data);

        if (data.success && data.stats) {
          // Calculate global statistics
          let totalImages = 0;
          let totalVotes = 0;
          let upvotes = 0;
          let downvotes = 0;

          Object.values(data.stats).forEach((stat: any) => {
            if (stat.totalVotes > 0) {
              totalImages++;
              totalVotes += stat.totalVotes;
              upvotes += stat.upvotes;
              downvotes += stat.downvotes;
            }
          });

          const stats = {
            totalImages,
            totalVotes,
            upvotes,
            downvotes,
            upvotePercentage: totalVotes > 0 ? (upvotes / totalVotes) * 100 : 0
          };

          console.log(`[Results] Calculated global stats:`, stats);
          setGlobalVoteStats(stats);
        } else {
          console.log(`[Results] No stats data received or API failed`);
        }
      } catch (error) {
        console.error('[Results] Error loading global vote stats:', error);
      }
    };

    loadGlobalVoteStats();
  }, [pastLooks]);

  const handleDeleteLook = async (lookId: string) => {
    try {
      // Try to delete from the database
      const response = await fetch(`/api/looks?lookId=${lookId}&userId=default`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        console.log('Look deleted from database successfully');
      } else {
        throw new Error(result.error || 'Failed to delete from database');
      }
    } catch (error) {
      console.error('Failed to delete from database:', error);

      // Fallback to deleting from localStorage
      try {
        const storedLooks = localStorage.getItem("pastLooks");
        if (storedLooks) {
          const looks = JSON.parse(storedLooks);
          const updatedLooks = looks.filter((look: PastLook) => look.id !== lookId);
          localStorage.setItem("pastLooks", JSON.stringify(updatedLooks));
        }
      } catch (localError) {
        console.error('Failed to delete from localStorage:', localError);
      }
    }

    // Update the UI anyway
    const updatedLooks = pastLooks.filter((look) => look.id !== lookId);
    setPastLooks(updatedLooks);
  };

  const handleClearRecentLooks = async () => {
    try {
      // Try to clear from the database
      const response = await fetch('/api/looks?clearAll=true&userId=default', {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        console.log('All looks cleared from database successfully');
      } else {
        throw new Error(result.error || 'Failed to clear database');
      }
    } catch (error) {
      console.error('Failed to clear database:', error);

      // Fallback to clearing localStorage
      try {
        localStorage.removeItem("pastLooks");
      } catch (localError) {
        console.error('Failed to clear localStorage:', localError);
      }
    }

    // Update the UI anyway
    setPastLooks([]);
  };

  const toggleProcessImages = (lookId: string) => {
    setShowProcessImages(prev => ({
      ...prev,
      [lookId]: !prev[lookId]
    }));
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
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
        {/* Global Vote Statistics */}
        {globalVoteStats && globalVoteStats.totalVotes > 0 && (
          <div className="ios-card p-5 animate-fade-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Global Vote Statistics
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Images with votes:</span>
                  <span className="text-xs font-medium">{globalVoteStats.totalImages}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Total votes:</span>
                  <span className="text-xs font-medium">{globalVoteStats.totalVotes}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <ThumbsUp className="w-3 h-3 text-green-600" />
                    Upvotes:
                  </span>
                  <span className="text-xs font-medium text-green-600">{globalVoteStats.upvotes}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <ThumbsDown className="w-3 h-3 text-red-600" />
                    Downvotes:
                  </span>
                  <span className="text-xs font-medium text-red-600">{globalVoteStats.downvotes}</span>
                </div>
              </div>
            </div>

            {/* Progress bar for upvote percentage */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">Approval Rate:</span>
                <span className="text-xs font-medium">{globalVoteStats.upvotePercentage.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${globalVoteStats.upvotePercentage}%` }}
                />
              </div>
            </div>
          </div>
        )}

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
                    <div className="relative aspect-[3/4] rounded-t-xl overflow-hidden group">
                      <img
                        src={pastLook.imageUrl}
                        alt="Generated look"
                        className="w-full h-full object-cover"
                      />

                      {/* Vote buttons - always visible if voted, otherwise show on hover */}
                      <div className="absolute top-2 left-2">
                        <ImageVoteButtons
                          imageUrl={pastLook.imageUrl}
                          size="sm"
                          variant="overlay"
                          className="opacity-100 group-hover:opacity-100 transition-opacity duration-200"
                          onVoteChange={(voteType) => {
                            console.log(`[Results] Image vote changed: ${voteType} for look ${pastLook.id}`);
                          }}
                        />
                      </div>

                      <button
                        onClick={() => handleDeleteLook(pastLook.id)}
                        className="absolute top-2 right-2 p-2 bg-black/40 rounded-full text-white hover:bg-black/60 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    {/* Look Details */}
                    <div className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 text-sm">
                            {pastLook.style === 'suggestion' ? 'Style Suggestion' : pastLook.style}
                          </h4>
                          <p className="text-xs text-gray-500">{formatDate(pastLook.timestamp)}</p>

                          {/* 投票状态显示 */}
                          <div className="mt-1">
                            <ImageVoteStatus
                              imageUrl={pastLook.imageUrl}
                              size="sm"
                              showStats={true}
                              showUserVote={true}
                              className="text-xs"
                            />
                          </div>
                        </div>
                        {pastLook.processImages && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleProcessImages(pastLook.id)}
                            className="text-gray-600 h-8 px-2 ml-2"
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
