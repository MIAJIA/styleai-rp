"use client";

import { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ImageVoteButtonsProps {
  imageUrl: string;
  sessionId?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'overlay' | 'minimal';
  onVoteChange?: (voteType: 'upvote' | 'downvote' | null) => void;
}

export default function ImageVoteButtons({
  imageUrl,
  sessionId,
  className = '',
  size = 'md',
  variant = 'default',
  onVoteChange
}: ImageVoteButtonsProps) {
  const [voteType, setVoteType] = useState<'upvote' | 'downvote' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  // 加载当前投票状态
  useEffect(() => {
    const loadVoteStatus = async () => {
      console.log(`[ImageVoteButtons] Loading vote status for image: ${imageUrl.substring(0, 50)}...`);
      try {
        const response = await fetch(`/api/image-vote?imageUrl=${encodeURIComponent(imageUrl)}`);
        const data = await response.json();

        console.log(`[ImageVoteButtons] Vote status response:`, data);

        if (data.success && data.vote) {
          console.log(`[ImageVoteButtons] Found existing vote: ${data.vote.voteType} for image ${imageUrl.substring(0, 50)}...`);
          setVoteType(data.vote.voteType);
        } else {
          console.log(`[ImageVoteButtons] No existing vote found for image ${imageUrl.substring(0, 50)}...`);
        }
      } catch (error) {
        console.error('[ImageVoteButtons] Error loading vote status:', error);
      }
    };

    if (imageUrl) {
      loadVoteStatus();
    }
  }, [imageUrl]);

  const handleVote = async (newVoteType: 'upvote' | 'downvote') => {
    if (isLoading) return;

    console.log(`[ImageVoteButtons] HandleVote called: ${newVoteType}, current vote: ${voteType}, sessionId: ${sessionId}`);
    console.log(`[ImageVoteButtons] Image URL: ${imageUrl.substring(0, 50)}...`);

    setIsLoading(true);

    try {
      // 如果点击的是当前已选择的投票，则取消投票
      const finalVoteType = voteType === newVoteType ? null : newVoteType;

      console.log(`[ImageVoteButtons] Final vote type to send: ${finalVoteType}`);

      const requestBody = {
        imageUrl,
        voteType: finalVoteType,
        sessionId
      };

      console.log(`[ImageVoteButtons] Sending vote request:`, requestBody);

      const response = await fetch('/api/image-vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log(`[ImageVoteButtons] Vote response status: ${response.status}`);

      const responseData = await response.json();
      console.log(`[ImageVoteButtons] Vote response data:`, responseData);

      if (response.ok) {
        console.log(`[ImageVoteButtons] Vote saved successfully: ${finalVoteType}`);
        setVoteType(finalVoteType);
        setShowFeedback(true);

        // 调用回调函数
        if (onVoteChange) {
          console.log(`[ImageVoteButtons] Calling onVoteChange callback with: ${finalVoteType}`);
          onVoteChange(finalVoteType);
        }

        // 3秒后隐藏反馈
        setTimeout(() => setShowFeedback(false), 3000);
      } else {
        console.error('[ImageVoteButtons] Failed to save vote, response not ok:', responseData);
      }
    } catch (error) {
      console.error('[ImageVoteButtons] Error saving vote:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 根据尺寸设置样式
  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return {
          button: 'h-7 w-7 p-1',
          icon: 'w-3 h-3',
          gap: 'gap-1'
        };
      case 'lg':
        return {
          button: 'h-10 w-10 p-2',
          icon: 'w-5 h-5',
          gap: 'gap-3'
        };
      default:
        return {
          button: 'h-8 w-8 p-1.5',
          icon: 'w-4 h-4',
          gap: 'gap-2'
        };
    }
  };

  // 根据变体设置样式
  const getVariantClasses = () => {
    switch (variant) {
      case 'overlay':
        return 'bg-black/60 hover:bg-black/80 backdrop-blur-sm';
      case 'minimal':
        return 'bg-transparent hover:bg-gray-100 border-none shadow-none';
      default:
        return 'bg-white/90 hover:bg-white border border-gray-200 shadow-sm';
    }
  };

  const sizeClasses = getSizeClasses();
  const variantClasses = getVariantClasses();

  // 确定是否应该显示按钮
  const hasVote = voteType !== null;
  const shouldAlwaysShow = hasVote; // 如果有投票，始终显示

  return (
    <div className={cn(
      'flex items-center',
      sizeClasses.gap,
      // 如果有投票则始终显示，否则使用传入的className控制显示
      shouldAlwaysShow ? 'opacity-100' : className
    )}>
      {/* Upvote Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleVote('upvote')}
        disabled={isLoading}
        className={cn(
          sizeClasses.button,
          variantClasses,
          'transition-all duration-200',
          voteType === 'upvote'
            ? 'text-green-600 bg-green-100 hover:bg-green-200'
            : variant === 'overlay'
              ? 'text-white hover:text-green-400'
              : 'text-gray-600 hover:text-green-600'
        )}
      >
        <ThumbsUp className={cn(
          sizeClasses.icon,
          voteType === 'upvote' && 'fill-current'
        )} />
      </Button>

      {/* Downvote Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleVote('downvote')}
        disabled={isLoading}
        className={cn(
          sizeClasses.button,
          variantClasses,
          'transition-all duration-200',
          voteType === 'downvote'
            ? 'text-red-600 bg-red-100 hover:bg-red-200'
            : variant === 'overlay'
              ? 'text-white hover:text-red-400'
              : 'text-gray-600 hover:text-red-600'
        )}
      >
        <ThumbsDown className={cn(
          sizeClasses.icon,
          voteType === 'downvote' && 'fill-current'
        )} />
      </Button>

      {/* 反馈消息 */}
      {showFeedback && (
        <span className={cn(
          'text-xs transition-opacity duration-300',
          variant === 'overlay' ? 'text-white' : 'text-gray-500'
        )}>
          {voteType === 'upvote' ? '👍 Liked' :
            voteType === 'downvote' ? '👎 Disliked' :
              '✓ Vote removed'}
        </span>
      )}
    </div>
  );
}
