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
    console.log(`[ImageVote-Get] Getting vote for image ID: ${imageId}, URL: ${imageUrl.substring(0, 50)}...`);

    const voteData = await kv.get(`image_vote:${imageId}`);
    console.log(`[ImageVote-Get] KV Store raw data:`, voteData);

    if (!voteData) {
      console.log(`[ImageVote-Get] No vote data found for image ID: ${imageId}`);
      return null;
    }

    // Vercel KV 自动处理序列化/反序列化，所以这里直接使用返回的对象
    const parsedVote = voteData as ImageVote;
    console.log(`[ImageVote-Get] Vote data:`, parsedVote);

    return parsedVote;
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
    console.log(`[ImageVote-Save] Saving vote for image ID: ${imageId}, URL: ${imageUrl.substring(0, 50)}...`);
    console.log(`[ImageVote-Save] Vote type: ${voteType}, Session ID: ${sessionId}`);

    const voteData: ImageVote = {
      imageUrl,
      voteType,
      timestamp: new Date().toISOString(),
      sessionId
    };

    console.log(`[ImageVote-Save] Vote data to save:`, voteData);
    console.log(`[ImageVote-Save] KV Store key: image_vote:${imageId}`);

    // 直接存储对象，让 Vercel KV 处理序列化
    await kv.set(`image_vote:${imageId}`, voteData);
    console.log(`[ImageVote-Save] Vote saved successfully to KV Store`);

    // 验证保存是否成功
    const savedData = await kv.get(`image_vote:${imageId}`);
    console.log(`[ImageVote-Save] Verification - saved data:`, savedData);

  } catch (error) {
    console.error('[ImageVote-Save] Error saving image vote:', error);
    throw error;
  }
}

// 移除图片投票（设置为null）
export async function removeImageVote(imageUrl: string): Promise<void> {
  try {
    await saveImageVote(imageUrl, null);
    console.log(`Image vote removed for: ${getImageId(imageUrl)}`);
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