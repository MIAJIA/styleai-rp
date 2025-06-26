import { kv } from '@vercel/kv';
import { put, del } from '@vercel/blob';

// 数据库中的 Look 结构
export interface DBLook {
  id: string;
  userId?: string; // 可选的用户ID，用于多用户支持
  style: string | null;
  occasion: string;
  timestamp: number;

  // 图片存储在 Blob 中，这里只存储 URL
  finalImageUrl: string;
  originalHumanImageUrl?: string;
  originalGarmentImageUrl?: string;

  // 元数据
  garmentDescription?: string;
  personaProfile?: any;
  styleSuggestion?: any;

  // 处理过程的图片URLs
  processImages?: {
    humanImageUrl: string;
    garmentImageUrl: string;
    finalImageUrl: string;
    styleSuggestion?: any;
  };
}

// 从 localStorage 的 PastLook 转换为 DBLook
export interface PastLook {
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

// 生成用户的 looks 列表键
function getUserLooksKey(userId: string = 'default'): string {
  return `user:${userId}:looks`;
}

// 生成单个 look 的键
function getLookKey(lookId: string): string {
  return `look:${lookId}`;
}

// 清理对象中的 null 和 undefined 值（Redis 不支持这些值）
function cleanObjectForRedis(obj: any): any {
  if (obj === null || obj === undefined) {
    return undefined;
  }

  if (Array.isArray(obj)) {
    const cleanArray = obj.map(cleanObjectForRedis).filter(item => item !== undefined);
    return cleanArray.length > 0 ? cleanArray : undefined;
  }

  if (typeof obj === 'object') {
    const cleanObject: Record<string, any> = {};
    Object.entries(obj).forEach(([key, value]) => {
      const cleanValue = cleanObjectForRedis(value);
      if (cleanValue !== undefined) {
        cleanObject[key] = cleanValue;
      }
    });
    return Object.keys(cleanObject).length > 0 ? cleanObject : undefined;
  }

  return obj;
}

// 将 base64 图片上传到 Blob 存储
async function uploadImageToBlob(imageData: string, filename: string): Promise<string> {
  try {
    if (imageData.startsWith('data:image')) {
      // 处理 base64 数据
      const response = await fetch(imageData);
      const blob = await response.blob();

      const result = await put(filename, blob, {
        access: 'public',
        contentType: blob.type,
        addRandomSuffix: true, // 添加随机后缀避免文件名冲突
      });

      return result.url;
    } else if (imageData.startsWith('/') || imageData.startsWith('http')) {
      // 如果是 URL，直接返回
      return imageData;
    } else {
      throw new Error('Invalid image data format');
    }
  } catch (error) {
    console.error('Error uploading image to blob:', error);
    throw error;
  }
}

// 保存 Look 到数据库
export async function saveLookToDB(look: PastLook, userId: string = 'default'): Promise<void> {
  try {
    console.log('Saving look to database:', look.id);

    // 检查是否已经存在相同的 look
    const existingLook = await getLookById(look.id);
    if (existingLook) {
      console.log(`Look ${look.id} already exists in database, skipping save`);
      return;
    }

    // 上传图片到 Blob 存储
    const finalImageUrl = await uploadImageToBlob(
      look.imageUrl,
      `looks/${look.id}/final.jpg`
    );

    let originalHumanImageUrl: string | undefined;
    let originalGarmentImageUrl: string | undefined;
    let processImages: DBLook['processImages'] | undefined;

    // 处理原始图片
    if (look.originalHumanSrc) {
      originalHumanImageUrl = await uploadImageToBlob(
        look.originalHumanSrc,
        `looks/${look.id}/human.jpg`
      );
    }

    if (look.originalGarmentSrc) {
      originalGarmentImageUrl = await uploadImageToBlob(
        look.originalGarmentSrc,
        `looks/${look.id}/garment.jpg`
      );
    }

    // 处理过程图片
    if (look.processImages) {
      const humanImageUrl = await uploadImageToBlob(
        look.processImages.humanImage,
        `looks/${look.id}/process_human.jpg`
      );

      const garmentImageUrl = await uploadImageToBlob(
        look.processImages.garmentImage,
        `looks/${look.id}/process_garment.jpg`
      );

      const processImageUrl = await uploadImageToBlob(
        look.processImages.finalImage,
        `looks/${look.id}/process_final.jpg`
      );

      processImages = {
        humanImageUrl,
        garmentImageUrl,
        finalImageUrl: processImageUrl,
        styleSuggestion: look.processImages.styleSuggestion,
      };
    }

    // 创建数据库记录
    const dbLook: DBLook = {
      id: look.id,
      userId,
      style: look.style,
      occasion: 'default', // 可以从 look 中提取或设置默认值
      timestamp: look.timestamp,
      finalImageUrl,
      originalHumanImageUrl,
      originalGarmentImageUrl,
      garmentDescription: look.garmentDescription,
      personaProfile: look.personaProfile,
      processImages,
    };

    // 清理对象中的 null 和 undefined 值，因为 Redis 不支持这些值
    const cleanDbLook = cleanObjectForRedis(dbLook);

    if (!cleanDbLook) {
      throw new Error('Unable to clean dbLook object for Redis storage');
    }

    console.log('Cleaned dbLook for Redis:', cleanDbLook);

    // 保存到 KV
    if (Object.keys(cleanDbLook).length > 0) {
      await kv.hset(getLookKey(look.id), cleanDbLook);
    } else {
      throw new Error('Cleaned dbLook is empty, cannot save to Redis');
    }

    // 更新用户的 looks 列表
    const userLooksKey = getUserLooksKey(userId);
    // 确保幂等性：先移除所有旧的实例，再添加到列表头部
    await kv.lrem(userLooksKey, 0, look.id);
    await kv.lpush(userLooksKey, look.id);

    // 限制列表长度（保留最近的100个）
    await kv.ltrim(userLooksKey, 0, 99);

    console.log('Look saved successfully to database');
  } catch (error) {
    console.error('Error saving look to database:', error);
    throw error;
  }
}

// 从数据库获取用户的所有 Looks
export async function getUserLooks(userId: string = 'default', limit: number = 50): Promise<DBLook[]> {
  try {
    const userLooksKey = getUserLooksKey(userId);
    const lookIds = await kv.lrange(userLooksKey, 0, limit - 1);

    if (!lookIds || lookIds.length === 0) {
      return [];
    }

    // 去重，防止数据库中存在重复ID导致前端显示重复
    const uniqueLookIds = [...new Set(lookIds)];

    // 批量获取 look 数据
    const looks: DBLook[] = [];
    for (const lookId of uniqueLookIds) {
      try {
        const look = await kv.hgetall(getLookKey(lookId as string));
        if (look && Object.keys(look).length > 0) {
          // 确保必需字段存在
          if (look.id && look.finalImageUrl && look.timestamp) {
            looks.push(look as unknown as DBLook);
          } else {
            console.warn('Incomplete look data found:', lookId, look);
          }
        }
      } catch (error) {
        console.error('Error fetching individual look:', lookId, error);
        // 继续处理其他 looks，不因单个错误而中断
      }
    }

    return looks;
  } catch (error) {
    console.error('Error fetching user looks:', error);
    return [];
  }
}

// 获取单个 Look
export async function getLookById(lookId: string): Promise<DBLook | null> {
  try {
    const look = await kv.hgetall(getLookKey(lookId));
    return look && Object.keys(look).length > 0 ? (look as unknown as DBLook) : null;
  } catch (error) {
    console.error('Error fetching look by ID:', error);
    return null;
  }
}

// 删除 Look
export async function deleteLook(lookId: string, userId: string = 'default'): Promise<void> {
  try {
    // 获取 look 数据以删除相关图片
    const look = await getLookById(lookId);

    if (look) {
      // 删除 Blob 存储中的图片
      const imagesToDelete = [
        look.finalImageUrl,
        look.originalHumanImageUrl,
        look.originalGarmentImageUrl,
      ].filter(Boolean);

      if (look.processImages) {
        imagesToDelete.push(
          look.processImages.humanImageUrl,
          look.processImages.garmentImageUrl,
          look.processImages.finalImageUrl
        );
      }

      // 删除图片文件
      for (const imageUrl of imagesToDelete) {
        try {
          if (imageUrl && imageUrl.includes('vercel-storage.com')) {
            await del(imageUrl);
          }
        } catch (error) {
          console.warn('Failed to delete image:', imageUrl, error);
        }
      }
    }

    // 从 KV 中删除记录
    await kv.del(getLookKey(lookId));

    // 从用户列表中移除
    const userLooksKey = getUserLooksKey(userId);
    await kv.lrem(userLooksKey, 1, lookId);

    console.log('Look deleted successfully:', lookId);
  } catch (error) {
    console.error('Error deleting look:', error);
    throw error;
  }
}

// 清空用户的所有 Looks
export async function clearUserLooks(userId: string = 'default'): Promise<void> {
  try {
    const looks = await getUserLooks(userId);

    // 删除所有 looks
    for (const look of looks) {
      await deleteLook(look.id, userId);
    }

    // 清空用户列表
    await kv.del(getUserLooksKey(userId));

    console.log('All user looks cleared successfully');
  } catch (error) {
    console.error('Error clearing user looks:', error);
    throw error;
  }
}

// 从 localStorage 迁移数据到数据库
export async function migrateLooksFromLocalStorage(userId: string = 'default'): Promise<void> {
  try {
    if (typeof window === 'undefined') return;

    const storedLooks = localStorage.getItem('pastLooks');
    if (!storedLooks) return;

    const looks: PastLook[] = JSON.parse(storedLooks);
    console.log(`Migrating ${looks.length} looks from localStorage to database`);

    // 逐个迁移
    for (const look of looks) {
      try {
        await saveLookToDB(look, userId);
      } catch (error) {
        console.error('Failed to migrate look:', look.id, error);
      }
    }

    // 迁移完成后清空 localStorage
    localStorage.removeItem('pastLooks');
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Error during migration:', error);
    throw error;
  }
}

// 将 DBLook 转换为 PastLook（用于兼容现有组件）
export function dbLookToPastLook(dbLook: DBLook): PastLook {
  return {
    id: dbLook.id,
    imageUrl: dbLook.finalImageUrl,
    style: dbLook.style,
    timestamp: dbLook.timestamp,
    originalHumanSrc: dbLook.originalHumanImageUrl,
    originalGarmentSrc: dbLook.originalGarmentImageUrl,
    garmentDescription: dbLook.garmentDescription,
    personaProfile: dbLook.personaProfile,
    processImages: dbLook.processImages ? {
      humanImage: dbLook.processImages.humanImageUrl,
      garmentImage: dbLook.processImages.garmentImageUrl,
      finalImage: dbLook.processImages.finalImageUrl,
      styleSuggestion: dbLook.processImages.styleSuggestion,
    } : undefined,
  };
}
