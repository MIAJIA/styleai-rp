"use client";

import { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoteStats {
  upvotes: number;
  downvotes: number;
  totalVotes: number;
  userVote: 'upvote' | 'downvote' | null;
}

interface ImageVoteStatusProps {
  imageUrl: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showStats?: boolean;
  showUserVote?: boolean;
}

export default function ImageVoteStatus({
  imageUrl,
  className = '',
  size = 'sm',
  showStats = true,
  showUserVote = true
}: ImageVoteStatusProps) {
  const [voteStats, setVoteStats] = useState<VoteStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 加载投票统计
  useEffect(() => {
    const loadVoteStats = async () => {
      if (!imageUrl) return;

      console.log(`[ImageVoteStatus] Loading vote stats for image: ${imageUrl.substring(0, 50)}...`);
      setIsLoading(true);

      try {
        const response = await fetch(`/api/image-vote/stats?imageUrls=${encodeURIComponent(JSON.stringify([imageUrl]))}`);
        console.log(`[ImageVoteStatus] Stats API response status: ${response.status}`);

        const data = await response.json();
        console.log(`[ImageVoteStatus] Stats API response data:`, data);

        if (data.success && data.stats[imageUrl]) {
          console.log(`[ImageVoteStatus] Found stats for image:`, data.stats[imageUrl]);
          setVoteStats(data.stats[imageUrl]);
        } else {
          console.log(`[ImageVoteStatus] No stats found for image: ${imageUrl.substring(0, 50)}...`);
        }
      } catch (error) {
        console.error('[ImageVoteStatus] Error loading vote stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadVoteStats();
  }, [imageUrl]);

  if (isLoading) {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        <div className="w-4 h-4 bg-gray-200 rounded animate-pulse" />
        <div className="w-8 h-3 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  if (!voteStats) {
    return null;
  }

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return {
          icon: 'w-3 h-3',
          text: 'text-xs',
          gap: 'gap-1'
        };
      case 'lg':
        return {
          icon: 'w-5 h-5',
          text: 'text-sm',
          gap: 'gap-2'
        };
      default:
        return {
          icon: 'w-4 h-4',
          text: 'text-xs',
          gap: 'gap-1.5'
        };
    }
  };

  const sizeClasses = getSizeClasses();
  const hasVotes = voteStats.totalVotes > 0;
  const upvotePercentage = hasVotes ? (voteStats.upvotes / voteStats.totalVotes) * 100 : 0;

  return (
    <div className={cn('flex items-center', sizeClasses.gap, className)}>
      {/* 用户投票状态指示器 */}
      {showUserVote && voteStats.userVote && (
        <div className={cn(
          'flex items-center',
          sizeClasses.gap,
          voteStats.userVote === 'upvote' ? 'text-green-600' : 'text-red-600'
        )}>
          {voteStats.userVote === 'upvote' ? (
            <ThumbsUp className={cn(sizeClasses.icon, 'fill-current')} />
          ) : (
            <ThumbsDown className={cn(sizeClasses.icon, 'fill-current')} />
          )}
        </div>
      )}

      {/* 投票统计 */}
      {showStats && hasVotes && (
        <div className={cn('flex items-center', sizeClasses.gap, 'text-gray-600')}>
          <BarChart3 className={sizeClasses.icon} />

          {/* 显示upvote/downvote数量 */}
          <div className={cn('flex items-center', sizeClasses.gap)}>
            {voteStats.upvotes > 0 && (
              <div className={cn('flex items-center gap-0.5', sizeClasses.text, 'text-green-600')}>
                <ThumbsUp className="w-2.5 h-2.5" />
                <span>{voteStats.upvotes}</span>
              </div>
            )}

            {voteStats.downvotes > 0 && (
              <div className={cn('flex items-center gap-0.5', sizeClasses.text, 'text-red-600')}>
                <ThumbsDown className="w-2.5 h-2.5" />
                <span>{voteStats.downvotes}</span>
              </div>
            )}
          </div>

          {/* 总投票数和比例 */}
          {voteStats.totalVotes > 1 && (
            <div className={cn(sizeClasses.text, 'text-gray-500')}>
              ({upvotePercentage.toFixed(0)}% 👍)
            </div>
          )}
        </div>
      )}

      {/* 无投票状态 */}
      {showStats && !hasVotes && (
        <div className={cn(sizeClasses.text, 'text-gray-400')}>
          No votes yet
        </div>
      )}
    </div>
  );
}