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
    stylizedImageUrl?: string;
    styleSuggestion?: any;
    finalPrompt?: string;
  };
}

export default function ResultsPage() {
  const router = useRouter();
  const [pastLooks, setPastLooks] = useState<PastLook[]>([]);
  const [isRecentLooksExpanded, setIsRecentLooksExpanded] = useState(false);
  const [selectedLook, setSelectedLook] = useState<PastLook | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreData, setHasMoreData] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [cacheTimestamp, setCacheTimestamp] = useState<number | null>(null);
  const [globalVoteStats, setGlobalVoteStats] = useState<{
    totalImages: number;
    totalVotes: number;
    upvotes: number;
    downvotes: number;
    upvotePercentage: number;
  } | null>(null);

  // 缓存配置
  const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存
  const CACHE_KEY = 'styleai_results_cache';
  const CACHE_STATS_KEY = 'styleai_vote_stats_cache';

  // 缓存辅助函数
  const getCachedData = (key: string) => {
    try {
      const cached = localStorage.getItem(key);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          return data;
        } else {
          localStorage.removeItem(key);
        }
      }
    } catch (error) {
      console.error('Error reading cache:', error);
    }
    return null;
  };

  const setCachedData = (key: string, data: any) => {
    try {
      localStorage.setItem(key, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Error setting cache:', error);
    }
  };

  const isCacheValid = () => {
    return cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_DURATION);
  };

  // Load past looks from database on initial render
  useEffect(() => {
    const loadLooks = async () => {
      setIsInitialLoading(true);

      try {
        // 1. 首先尝试从缓存加载
        const cachedLooks = getCachedData(CACHE_KEY);
        if (cachedLooks) {
          console.log(`Loaded ${cachedLooks.length} looks from cache`);
          setPastLooks(cachedLooks);
          setCacheTimestamp(Date.now());
          setIsInitialLoading(false);

          // 在后台异步检查是否有新数据
          setTimeout(() => {
            loadFreshData();
          }, 100);
          return;
        }

        // 2. 缓存未命中，加载新数据
        await loadFreshData();

      } catch (error) {
        console.error('Error in loadLooks:', error);
        setIsInitialLoading(false);
      }
    };

    const loadFreshData = async () => {
      try {
        // First, try to load from the database
        const response = await fetch('/api/looks?userId=default&limit=100');
        const result = await response.json();

        if (result.success && result.looks.length > 0) {
          console.log(`Loaded ${result.looks.length} looks from database`);
          setPastLooks(result.looks);
          setCachedData(CACHE_KEY, result.looks);
          setCacheTimestamp(Date.now());
          setIsInitialLoading(false);
          return;
        }

        // If there is no data in the database, try to migrate from localStorage
        const storedLooks = localStorage.getItem("pastLooks");
        if (storedLooks) {
          const localLooks = JSON.parse(storedLooks);
          console.log(`Found ${localLooks.length} looks in localStorage, migrating...`);

          // Display local data first
          setPastLooks(localLooks);
          setCachedData(CACHE_KEY, localLooks);
          setCacheTimestamp(Date.now());
          setIsInitialLoading(false);

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
              const freshResponse = await fetch('/api/looks?userId=default&limit=100');
              const freshResult = await freshResponse.json();
              if (freshResult.success) {
                setPastLooks(freshResult.looks);
                setCachedData(CACHE_KEY, freshResult.looks);
                setCacheTimestamp(Date.now());
              }
            }
          } catch (migrateError) {
            console.error('Migration failed:', migrateError);
            // Migration failed, continue to use local data
          }
        } else {
          console.log('No looks found in database or localStorage');
          setPastLooks([]);
          setIsInitialLoading(false);
        }
      } catch (error) {
        console.error('Error loading fresh data:', error);

        // If all methods fail, try to read from localStorage
        try {
          const storedLooks = localStorage.getItem("pastLooks");
          if (storedLooks) {
            const localLooks = JSON.parse(storedLooks);
            setPastLooks(localLooks);
            setCachedData(CACHE_KEY, localLooks);
            setCacheTimestamp(Date.now());
            console.log('Loaded looks from localStorage as fallback');
          }
        } catch (localError) {
          console.error('Failed to load from localStorage:', localError);
          setPastLooks([]);
        }
        setIsInitialLoading(false);
      }
    };

    loadLooks();
  }, []);

  // Load global vote statistics
  useEffect(() => {
    const loadGlobalVoteStats = async () => {
      if (pastLooks.length === 0) return;

      // 首先尝试从缓存加载投票统计
      const cachedStats = getCachedData(CACHE_STATS_KEY);
      if (cachedStats) {
        console.log(`[Results] Loaded vote stats from cache`);
        setGlobalVoteStats(cachedStats);
        return;
      }

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
          setCachedData(CACHE_STATS_KEY, stats);
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

    // 更新缓存
    setCachedData(CACHE_KEY, updatedLooks);
    setCacheTimestamp(Date.now());

    // 清理投票统计缓存，因为数据已更改
    localStorage.removeItem(CACHE_STATS_KEY);

    // Close modal if the deleted look was selected
    if (selectedLook?.id === lookId) {
      setSelectedLook(null);
    }
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
    setSelectedLook(null);
    setCurrentPage(1);
    setHasMoreData(true);

    // 清理所有缓存
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_STATS_KEY);
    setCacheTimestamp(null);
  };

  const loadMoreLooks = async () => {
    if (isLoadingMore || !hasMoreData) return;

    setIsLoadingMore(true);
    try {
      const offset = pastLooks.length;
      const response = await fetch(`/api/looks?userId=default&limit=20&offset=${offset}`);
      const result = await response.json();

      if (result.success && result.looks.length > 0) {
        const newLooks = [...pastLooks, ...result.looks];
        setPastLooks(newLooks);
        setCurrentPage(prev => prev + 1);

        // 更新缓存
        setCachedData(CACHE_KEY, newLooks);
        setCacheTimestamp(Date.now());

        // If we got fewer than 20 looks, we've reached the end
        if (result.looks.length < 20) {
          setHasMoreData(false);
        }
      } else {
        setHasMoreData(false);
      }
    } catch (error) {
      console.error('Error loading more looks:', error);
      setHasMoreData(false);
    } finally {
      setIsLoadingMore(false);
    }
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

  const handleCardClick = (look: PastLook) => {
    setSelectedLook(look);
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
          <div className="w-10">
            {/* 缓存状态指示器 */}
            {isCacheValid() && (
              <div className="w-2 h-2 bg-green-500 rounded-full" title="Data cached"></div>
            )}
          </div>
        </div>
      </div>

      {/* 初始加载状态 */}
      {isInitialLoading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-4 text-sm text-gray-500">Loading your looks...</p>
        </div>
      )}

      <div className="px-5 py-4 space-y-4">
        {/* 只有在不是初始加载时才显示内容 */}
        {!isInitialLoading && (
          <>
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
                      <div key={pastLook.id} className="bg-white rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow">
                        {/* Main Image */}
                        <div
                          className="relative aspect-[3/4] rounded-t-xl overflow-hidden group"
                          onClick={() => handleCardClick(pastLook)}
                        >
                          <img
                            src={pastLook.imageUrl}
                            alt="Generated look"
                            className="w-full h-full object-cover"
                          />

                          {/* Vote buttons - always visible if voted, otherwise show on hover */}
                          <div className="absolute top-2 left-2" onClick={(e) => e.stopPropagation()}>
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
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteLook(pastLook.id);
                            }}
                            className="absolute top-2 right-2 p-2 bg-black/40 rounded-full text-white hover:bg-black/60 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <X size={16} />
                          </button>
                        </div>

                        {/* Look Details */}
                        <div className="p-3 space-y-2" onClick={() => handleCardClick(pastLook)}>
                          <div className="flex-1">
                            <div className="prose prose-sm max-w-none">
                              <h4 className="font-semibold text-gray-800 text-sm line-clamp-1">
                                {pastLook.processImages?.styleSuggestion?.outfit_suggestion?.outfit_title || "AI Generated"}
                              </h4>
                              <p className="text-xs text-gray-500 line-clamp-2">
                                {pastLook.processImages?.styleSuggestion?.outfit_suggestion?.explanation ||
                                  pastLook.processImages?.styleSuggestion?.outfit_suggestion?.style_summary ||
                                  `Generated on ${formatDate(pastLook.timestamp)}`}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {pastLooks.length > 6 && (
                    <button
                      onClick={async () => {
                        if (!isRecentLooksExpanded) {
                          // 第一次点击，展开本地数据
                          setIsRecentLooksExpanded(true);
                        } else if (hasMoreData && !isLoadingMore) {
                          // 已经展开本地数据，加载更多数据库数据
                          await loadMoreLooks();
                        } else {
                          // 收起数据
                          setIsRecentLooksExpanded(false);
                        }
                      }}
                      disabled={isLoadingMore}
                      className="w-full text-xs text-center text-primary font-medium p-2 mt-4 rounded-lg ios-btn bg-primary/10 disabled:opacity-50"
                    >
                      {isLoadingMore
                        ? "Loading..."
                        : !isRecentLooksExpanded
                          ? `Show ${pastLooks.length - 6} More Looks...`
                          : hasMoreData
                            ? "Load More from Database"
                            : "Show Less"
                      }
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
          </>
        )}
      </div>

      {/* Modal for expanded look */}
      {selectedLook && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            {/* Modal Header - Fixed */}
            <div className="flex-shrink-0 bg-white border-b border-gray-100 p-4 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-lg font-semibold">Look Details</h2>
              <button
                onClick={() => setSelectedLook(null)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* 主图和"How to wear it!"图像并排展示 */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                {/* 主图 (Generated Look) */}
                <div className="relative">
                  <img
                    src={selectedLook.imageUrl}
                    alt="Generated Look"
                    className="w-full h-auto rounded-lg shadow-lg aspect-[3/4] object-cover"
                  />
                  <div className="absolute top-2 left-2">
                    <ImageVoteButtons imageUrl={selectedLook.imageUrl} size="sm" variant="overlay" />
                  </div>
                  <div className="mt-2 text-center">
                    <p className="text-sm font-medium text-gray-800">Generated Look</p>
                  </div>
                </div>

                {/* "How to wear it!" 图像 */}
                <div className="relative">
                  {selectedLook.processImages?.stylizedImageUrl ? (
                    <>
                      <img
                        src={selectedLook.processImages.stylizedImageUrl}
                        alt="How to wear it!"
                        className="w-full h-auto rounded-lg shadow-lg aspect-[3/4] object-cover"
                      />
                      <div className="mt-2 text-center">
                        <p className="text-sm font-medium text-gray-800">How to wear it!</p>
                      </div>
                    </>
                  ) : (
                    <div className="w-full aspect-[3/4] bg-gray-100 rounded-lg shadow-lg flex items-center justify-center">
                      <div className="text-center text-gray-500">
                        <div className="w-12 h-12 mx-auto mb-2 bg-gray-200 rounded-full flex items-center justify-center">
                          <span className="text-xl">👗</span>
                        </div>
                        <p className="text-sm">Style Guide</p>
                        <p className="text-xs">Coming Soon</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 原始图片 (只显示服装图片) */}
                <div>
                  <h3 className="text-md font-semibold mb-2">Originals</h3>
                  <div className="flex space-x-2">
                    {selectedLook.processImages?.garmentImage && (
                      <div className="text-center">
                        <img
                          src={selectedLook.processImages.garmentImage}
                          alt="Original Garment"
                          className="w-24 h-24 object-cover rounded-md border"
                        />
                        <p className="text-xs mt-1">Garment</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Vote Status */}
                <ImageVoteStatus imageUrl={selectedLook.imageUrl} />
              </div>

              {/* Look Information */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {selectedLook.processImages?.styleSuggestion?.outfit_suggestion?.outfit_title || "AI Generated Look"}
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Generated on {formatDate(selectedLook.timestamp)}
                  </p>
                  {selectedLook.processImages?.styleSuggestion?.outfit_suggestion?.explanation && (
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {selectedLook.processImages.styleSuggestion.outfit_suggestion.explanation}
                    </p>
                  )}
                  {!selectedLook.processImages?.styleSuggestion?.outfit_suggestion?.explanation &&
                    selectedLook.processImages?.styleSuggestion?.outfit_suggestion?.style_summary && (
                      <p className="text-sm text-gray-700 leading-relaxed">
                        {selectedLook.processImages.styleSuggestion.outfit_suggestion.style_summary}
                      </p>
                    )}
                </div>

                {/* Final Prompt Section */}
                {selectedLook.processImages?.finalPrompt && (
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <h4 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                      🎨 AI Generation Prompt
                    </h4>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {selectedLook.processImages.finalPrompt}
                    </p>
                  </div>
                )}

                {/* Outfit Details Section */}
                {selectedLook.processImages?.styleSuggestion?.outfit_suggestion && (
                  <div className="p-4 bg-blue-50 rounded-xl">
                    <h4 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
                      👔 Complete Outfit Details
                    </h4>
                    <div className="space-y-3">
                      {selectedLook.processImages.styleSuggestion.outfit_suggestion.items?.tops?.map((top: any, index: number) => (
                        <div key={index} className="p-3 bg-white rounded-lg">
                          <h5 className="font-medium text-blue-900 mb-1">Top {index + 1}</h5>
                          <p className="text-sm text-gray-700 font-medium mb-1">{top.item_name}</p>
                          {top.style_details && (
                            <p className="text-xs text-gray-600 mb-1">Style: {top.style_details}</p>
                          )}
                          {top.wearing_details && (
                            <p className="text-xs text-gray-600">Wearing: {top.wearing_details}</p>
                          )}
                        </div>
                      ))}

                      {selectedLook.processImages.styleSuggestion.outfit_suggestion.items?.bottoms && (
                        <div className="p-3 bg-white rounded-lg">
                          <h5 className="font-medium text-blue-900 mb-1">Bottom</h5>
                          <p className="text-sm text-gray-700 font-medium mb-1">
                            {selectedLook.processImages.styleSuggestion.outfit_suggestion.items.bottoms.item_name}
                          </p>
                          {selectedLook.processImages.styleSuggestion.outfit_suggestion.items.bottoms.style_details && (
                            <p className="text-xs text-gray-600 mb-1">
                              Style: {selectedLook.processImages.styleSuggestion.outfit_suggestion.items.bottoms.style_details}
                            </p>
                          )}
                          {selectedLook.processImages.styleSuggestion.outfit_suggestion.items.bottoms.wearing_details && (
                            <p className="text-xs text-gray-600">
                              Wearing: {selectedLook.processImages.styleSuggestion.outfit_suggestion.items.bottoms.wearing_details}
                            </p>
                          )}
                        </div>
                      )}

                      {selectedLook.processImages.styleSuggestion.outfit_suggestion.items?.shoes && (
                        <div className="p-3 bg-white rounded-lg">
                          <h5 className="font-medium text-blue-900 mb-1">Shoes</h5>
                          <p className="text-sm text-gray-700 font-medium mb-1">
                            {selectedLook.processImages.styleSuggestion.outfit_suggestion.items.shoes.item_name}
                          </p>
                          {selectedLook.processImages.styleSuggestion.outfit_suggestion.items.shoes.style_details && (
                            <p className="text-xs text-gray-600 mb-1">
                              Style: {selectedLook.processImages.styleSuggestion.outfit_suggestion.items.shoes.style_details}
                            </p>
                          )}
                          {selectedLook.processImages.styleSuggestion.outfit_suggestion.items.shoes.wearing_details && (
                            <p className="text-xs text-gray-600">
                              Wearing: {selectedLook.processImages.styleSuggestion.outfit_suggestion.items.shoes.wearing_details}
                            </p>
                          )}
                        </div>
                      )}

                      {selectedLook.processImages.styleSuggestion.outfit_suggestion.items?.bag && (
                        <div className="p-3 bg-white rounded-lg">
                          <h5 className="font-medium text-blue-900 mb-1">Bag</h5>
                          <p className="text-sm text-gray-700 font-medium mb-1">
                            {selectedLook.processImages.styleSuggestion.outfit_suggestion.items.bag.item_name}
                          </p>
                          {selectedLook.processImages.styleSuggestion.outfit_suggestion.items.bag.style_details && (
                            <p className="text-xs text-gray-600 mb-1">
                              Style: {selectedLook.processImages.styleSuggestion.outfit_suggestion.items.bag.style_details}
                            </p>
                          )}
                          {selectedLook.processImages.styleSuggestion.outfit_suggestion.items.bag.wearing_details && (
                            <p className="text-xs text-gray-600">
                              Wearing: {selectedLook.processImages.styleSuggestion.outfit_suggestion.items.bag.wearing_details}
                            </p>
                          )}
                        </div>
                      )}

                      {selectedLook.processImages.styleSuggestion.outfit_suggestion.items?.accessories &&
                        selectedLook.processImages.styleSuggestion.outfit_suggestion.items.accessories.length > 0 && (
                          <div className="p-3 bg-white rounded-lg">
                            <h5 className="font-medium text-blue-900 mb-2">Accessories</h5>
                            <div className="space-y-2">
                              {selectedLook.processImages.styleSuggestion.outfit_suggestion.items.accessories.map((accessory: any, index: number) => (
                                <div key={index} className="border-l-2 border-blue-200 pl-3">
                                  <p className="text-sm text-gray-700 font-medium">{accessory.item_name}</p>
                                  {accessory.style_details && (
                                    <p className="text-xs text-gray-600">Style: {accessory.style_details}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                      {selectedLook.processImages.styleSuggestion.outfit_suggestion.items?.hairstyle && (
                        <div className="p-3 bg-white rounded-lg">
                          <h5 className="font-medium text-blue-900 mb-1">Hairstyle</h5>
                          <p className="text-sm text-gray-700 font-medium mb-1">
                            {selectedLook.processImages.styleSuggestion.outfit_suggestion.items.hairstyle.style_name}
                          </p>
                          {selectedLook.processImages.styleSuggestion.outfit_suggestion.items.hairstyle.description && (
                            <p className="text-xs text-gray-600">
                              {selectedLook.processImages.styleSuggestion.outfit_suggestion.items.hairstyle.description}
                            </p>
                          )}
                        </div>
                      )}

                      {selectedLook.processImages.styleSuggestion.outfit_suggestion.items?.layering_description && (
                        <div className="p-3 bg-white rounded-lg">
                          <h5 className="font-medium text-blue-900 mb-1">Layering Guide</h5>
                          <p className="text-xs text-gray-600 leading-relaxed">
                            {selectedLook.processImages.styleSuggestion.outfit_suggestion.items.layering_description}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons - Fixed at Bottom */}
            <div className="flex-shrink-0 p-4 border-t border-gray-100 bg-white rounded-b-2xl">
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedLook(null)}
                  className="flex-1 py-2 px-4 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteLook(selectedLook.id);
                  }}
                  className="py-2 px-4 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors"
                >
                  Delete Look
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <IOSTabBar />
    </div>
  );
}
