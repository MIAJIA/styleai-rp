import { kv } from "@vercel/kv";
import sharp from "sharp";

export interface ImageInfo {
    isCompressed?: boolean;
    context?: string;
    url: string;
    type: 'uploaded' | 'generated'; // 区分用户上传和AI生成的图片
    mimeType?: string;
    name?: string;
    generatedPrompt?: string; // AI生成图片时使用的提示词
}

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: string;
    images?: ImageInfo[]; // 保存图片信息
    metadata?: {
        bodyShape?: string;
        skincolor?: string;
        bodySize?: string;
        stylePreferences?: string;
    };
}


export interface ChatRequest {
    chatType: 'freechat' | 'outfitchat' | 'stylechat';
    userId: string;
    message: string;
    imageUrl?: string[]; // Legacy: array of image URLs
    sessionId?: string;
    includeJobContext?: boolean;
    bodyShape?: string;
    skinTone?: string;
    bodySize?: string;
    stylePreferences?: string;
    trycount: number;
}

export async function saveChatMessage(sessionId: string, message: ChatMessage): Promise<void> {
    try {
        // 使用更精确的时间戳 + 随机数确保唯一性
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 9);
        const messageKey = `chat:message:${sessionId}:${timestamp}:${randomSuffix}`;

        await kv.set(messageKey, message);

        // Add to session message list
        const messagesListKey = `chat:messages:${sessionId}`;
        await kv.lpush(messagesListKey, messageKey);

        // Limit history length (保留最新的 99 条消息)
        // ltrim 保留索引 0 到 98 的元素（共 99 个）
        await kv.ltrim(messagesListKey, 0, 98);
    } catch (error) {
        console.error('[Chat API] Error saving chat message:', error);
    }
}

// Get chat history
export async function getChatHistory(sessionId: string, limit: number = 10): Promise<ChatMessage[]> {
    try {
        const messagesListKey = `chat:messages:${sessionId}`;
        // 获取最新的 limit 条消息的 key（lrange 从 0 开始，获取最新的 limit 条）
        const messageKeys = await kv.lrange(messagesListKey, 0, limit - 1);

        if (!messageKeys || messageKeys.length === 0) {
            return [];
        }

        const messages: ChatMessage[] = [];
        // 并行获取所有消息以提高性能
        const messagePromises = messageKeys.map(key => kv.get(key) as Promise<ChatMessage | null>);
        const messageResults = await Promise.all(messagePromises);

        // 过滤掉 null 值并按时间戳排序（最新的在前）
        for (const message of messageResults) {
            if (message) {
                messages.push(message);
            }
        }

        // 由于 lpush 是最新的在列表前面，需要反转顺序以按时间顺序返回（旧的在前）
        // 这样构建对话上下文时，消息会按正确的时间顺序排列
        return messages.reverse();
    } catch (error) {
        console.error('[Chat API] Error fetching chat history:', error);
        return [];
    }
}

// 获取会话中所有图片信息
export async function getSessionImages(sessionId: string): Promise<ImageInfo[]> {
    try {
        const messages = await getChatHistory(sessionId, 100); // 获取最近100条消息
        const allImages: ImageInfo[] = [];

        messages.forEach(msg => {
            if (msg.images && msg.images.length > 0) {
                allImages.push(...msg.images);
            }
        });

        return allImages;
    } catch (error) {
        console.error('[Chat API] Error fetching session images:', error);
        return [];
    }
}


// 服务器端图片压缩函数 - 使用 Sharp 进行压缩
export async function compressImage(imageBase64: string): Promise<string> {
    try {
        // 移除 data URL 前缀（如果有的话，如 "data:image/jpeg;base64,"）
        const base64Content = imageBase64.includes(',')
            ? imageBase64.split(',')[1]
            : imageBase64;

        // 将 base64 转换为 Buffer
        const imageBuffer = Buffer.from(base64Content, 'base64');

        // 使用 Sharp 压缩图片
        // 配置：最大尺寸 512x512，质量 80%，JPEG 格式
        let compressedBuffer = await sharp(imageBuffer)
            .resize(512, 512, {
                fit: 'inside',
                withoutEnlargement: true, // 不放大图片
            })
            .jpeg({ quality: 80 })
            .toBuffer();

        // 如果仍然太大（> 200KB），逐步降低质量
        let currentQuality = 80;
        const maxSizeKB = 200;
        while (compressedBuffer.length / 1024 > maxSizeKB && currentQuality > 40) {
            currentQuality -= 10;
            compressedBuffer = await sharp(imageBuffer)
                .resize(512, 512, {
                    fit: 'inside',
                    withoutEnlargement: true,
                })
                .jpeg({ quality: currentQuality })
                .toBuffer();
        }

        // 转换回 base64 字符串
        const compressedBase64 = compressedBuffer.toString('base64');
        console.log(`[compressImage] Compressed: ${(imageBuffer.length / 1024).toFixed(2)}KB -> ${(compressedBuffer.length / 1024).toFixed(2)}KB`);

        return compressedBase64;
    } catch (error) {
        console.error('[compressImage] Compression failed:', error);
        // 如果压缩失败，返回原始 base64（移除 data URL 前缀）
        // 这样即使压缩失败，API 仍然可以工作
        return imageBase64.includes(',')
            ? imageBase64.split(',')[1]
            : imageBase64;
    }
}

