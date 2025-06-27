import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { getImageId } from '@/lib/image-vote';

// GET /api/image-vote/stats - 获取全局投票统计
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const imageUrls = searchParams.get('imageUrls');

    if (!imageUrls) {
      return NextResponse.json({ error: 'Image URLs required' }, { status: 400 });
    }

    const urlList = JSON.parse(imageUrls);
    const statsMap = new Map<string, {
      upvotes: number;
      downvotes: number;
      totalVotes: number;
      userVote: 'upvote' | 'downvote' | null;
    }>();

    // 获取每张图片的投票统计
    for (const imageUrl of urlList) {
      const imageId = getImageId(imageUrl);
      console.log(`[API-Stats] Processing image: ${imageUrl.substring(0, 50)}..., ID: ${imageId}`);

      try {
        // 获取该图片的所有投票记录
        const voteData = await kv.get(`image_vote:${imageId}`);
        console.log(`[API-Stats] KV Store data for ${imageId}:`, voteData);

        let upvotes = 0;
        let downvotes = 0;
        let userVote: 'upvote' | 'downvote' | null = null;

        if (voteData) {
          const vote = JSON.parse(voteData as string);
          console.log(`[API-Stats] Parsed vote data for ${imageId}:`, vote);

          // 这里简化处理，实际上每张图片只有一个投票记录
          // 如果需要支持多用户投票，需要修改数据结构
          if (vote.voteType === 'upvote') {
            upvotes = 1;
          } else if (vote.voteType === 'downvote') {
            downvotes = 1;
          }

          userVote = vote.voteType;
        } else {
          console.log(`[API-Stats] No vote data found for ${imageId}`);
        }

        const stats = {
          upvotes,
          downvotes,
          totalVotes: upvotes + downvotes,
          userVote
        };

        console.log(`[API-Stats] Final stats for ${imageId}:`, stats);
        statsMap.set(imageUrl, stats);
      } catch (error) {
        console.error(`[API-Stats] Error getting stats for image ${imageId}:`, error);
        statsMap.set(imageUrl, {
          upvotes: 0,
          downvotes: 0,
          totalVotes: 0,
          userVote: null
        });
      }
    }

    // 转换Map为对象以便JSON序列化
    const statsObject: Record<string, any> = {};
    statsMap.forEach((stats, url) => {
      statsObject[url] = stats;
    });

    return NextResponse.json({
      success: true,
      stats: statsObject
    });
  } catch (error) {
    console.error('Error getting vote stats:', error);
    return NextResponse.json(
      { error: 'Failed to get vote stats' },
      { status: 500 }
    );
  }
}

// GET /api/image-vote/stats/global - 获取全局投票统计概览
export async function POST(request: Request) {
  try {
    // 这个端点可以用来获取全站的投票统计概览
    // 由于当前的数据结构限制，我们先返回一个简化的统计

    return NextResponse.json({
      success: true,
      globalStats: {
        message: 'Global stats feature will be implemented when we have more voting data',
        totalImages: 0,
        totalVotes: 0,
        upvotePercentage: 0
      }
    });
  } catch (error) {
    console.error('Error getting global stats:', error);
    return NextResponse.json(
      { error: 'Failed to get global stats' },
      { status: 500 }
    );
  }
}