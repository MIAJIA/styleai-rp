import { kv } from '@vercel/kv';

export interface ImageVote {
  imageUrl: string;
  voteType: 'upvote' | 'downvote' | null;
  timestamp: string; // 字符串类型，存储ISO字符串
  sessionId?: string; // 可选的会话ID，用于追踪用户行为
}

// 生成图片的唯一标识符（基于URL的hash）
export function getImageId(imageUrl: string): string {
  // 简单的hash函数，将URL转换为唯一ID
  let hash = 0;
  for (let i = 0; i < imageUrl.length; i++) {
    const char = imageUrl.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 转换为32位整数
  }
  return Math.abs(hash).toString();
}

// 获取图片投票状态
export async function getImageVote(imageUrl: string): Promise<ImageVote | null> {
  try {
    const imageId = getImageId(imageUrl);
    const voteData = await kv.get(`image_vote:${imageId}`);

    if (!voteData) {
      return null;
    }

    return voteData as ImageVote;
  } catch (error) {
    console.error('[ImageVote-Get] Error getting image vote:', error);
    return null;
  }
}

// 保存图片投票
export async function saveImageVote(
  imageUrl: string,
  voteType: 'upvote' | 'downvote' | null,
  sessionId?: string
): Promise<void> {
  try {
    const imageId = getImageId(imageUrl);
    const voteData: ImageVote = {
      imageUrl,
      voteType,
      timestamp: new Date().toISOString(),
      sessionId
    };
    await kv.set(`image_vote:${imageId}`, voteData);
  } catch (error) {
    console.error('[ImageVote-Save] Error saving image vote:', error);
    throw error;
  }
}

// 移除图片投票（设置为null）
export async function removeImageVote(imageUrl: string): Promise<void> {
  try {
    await saveImageVote(imageUrl, null);
  } catch (error) {
    console.error('Error removing image vote:', error);
    throw error;
  }
}

// 批量获取多张图片的投票状态
export async function getBatchImageVotes(imageUrls: string[]): Promise<Map<string, ImageVote | null>> {
  const voteMap = new Map<string, ImageVote | null>();

  try {
    const promises = imageUrls.map(async (imageUrl) => {
      const vote = await getImageVote(imageUrl);
      return { imageUrl, vote };
    });

    const results = await Promise.all(promises);

    results.forEach(({ imageUrl, vote }) => {
      voteMap.set(imageUrl, vote);
    });

    return voteMap;
  } catch (error) {
    console.error('Error getting batch image votes:', error);
    return voteMap;
  }
}