import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { Job } from '@/lib/types';
import { generateChatCompletionWithGemini, GeminiChatMessage } from '@/lib/apple/gemini';
import { fileToBase64, urlToFile } from '@/lib/utils';
import { checkAndIncrementLimit } from '@/lib/apple/checkLimit';

interface ImageInfo {
    url: string;
    type: 'uploaded' | 'generated'; // 区分用户上传和AI生成的图片
    mimeType?: string;
    name?: string;
    generatedPrompt?: string; // AI生成图片时使用的提示词
}

interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: string;
    images?: ImageInfo[]; // 保存图片信息
    metadata?: {
        bodyShape?: string;
        skincolor?: string;
        bodySize?: string;
        stylePreference?: string;
    };
}


interface ChatRequest {
    userId: string;
    imageUrl?: string[]; // Legacy: array of image URLs
    message: string;
    sessionId?: string;
    includeJobContext?: boolean;
    bodyShape?: string;
    skincolor?: string;
    bodySize?: string;
    stylePreference?: string;
}

// Build system prompt with JOB context
function buildSystemPromptWithJobContext(job: Job): string {
    const { input, suggestions } = job;
    const { userProfile, occasion, generationMode, customPrompt, stylePrompt } = input;

    let contextPrompt = `You are a professional fashion consultant AI assistant. The current conversation is related to a fashion styling task. Here is the task context information:

## Task Basic Information
- Occasion: ${occasion}
- Generation Mode: ${generationMode}
- Custom Requirements: ${customPrompt || 'None'}
- Style Prompt: ${stylePrompt || 'None'}

## User Profile Information
- Body Type: ${userProfile?.bodyType || 'Not provided'}
- Skin Tone: ${userProfile?.skinTone || 'Not provided'}
- Body Structure: ${userProfile?.bodyStructure || 'Not provided'}
- Face Shape: ${userProfile?.faceShape || 'Not provided'}
- Style Preferences: ${userProfile?.stylePreferences?.join(', ') || 'Not provided'}

## Generated Style Suggestions
${suggestions.length > 0 ? suggestions.map((suggestion, index) => {
        const outfit = suggestion.styleSuggestion?.outfit_suggestion;
        return `Suggestion ${index + 1}: ${outfit?.outfit_title || 'No title'}
- Styling Description: ${outfit?.explanation || 'No description'}
- Status: ${suggestion.status}`;
    }).join('\n') : 'No style suggestions yet'}

## Your Role
Based on the above context information, please provide professional fashion advice and styling guidance to users. You can:
1. Analyze current style suggestions
2. Provide personalized styling advice
3. Answer questions about fashion and styling
4. Adjust styling plans according to user needs

Please communicate with users in English with a friendly and professional tone, and provide practical and specific advice.`;

    return contextPrompt;
}

// Get JOB information
async function getJobContext(jobId: string): Promise<Job | null> {
    try {
        const job = await kv.get(jobId) as Job;
        return job;
    } catch (error) {
        console.error('[Chat API] Error fetching job context:', error);
        return null;
    }
}

// Save chat history (optional)
async function saveChatMessage(sessionId: string, message: ChatMessage): Promise<void> {
    try {
        const messageKey = `chat:message:${sessionId}:${Date.now()}`;
        await kv.set(messageKey, message);

        // Add to session message list
        const messagesListKey = `chat:messages:${sessionId}`;
        await kv.lpush(messagesListKey, messageKey);

        // Limit history length
        await kv.ltrim(messagesListKey, 0, 99);
    } catch (error) {
        console.error('[Chat API] Error saving chat message:', error);
    }
}

// Get chat history
async function getChatHistory(sessionId: string, limit: number = 10): Promise<ChatMessage[]> {
    try {
        const messagesListKey = `chat:messages:${sessionId}`;
        const messageKeys = await kv.lrange(messagesListKey, 0, limit - 1);

        const messages: ChatMessage[] = [];
        for (const key of messageKeys) {
            const message = await kv.get(key) as ChatMessage;
            if (message) {
                messages.push(message);
            }
        }

        return messages.reverse(); // Sort in chronological order
    } catch (error) {
        console.error('[Chat API] Error fetching chat history:', error);
        return [];
    }
}

// 获取会话中所有图片信息
async function getSessionImages(sessionId: string): Promise<ImageInfo[]> {
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

// 统计会话图片信息
async function getSessionImageStats(sessionId: string): Promise<{
    total: number;
    uploaded: number;
    generated: number;
}> {
    try {
        const images = await getSessionImages(sessionId);
        return {
            total: images.length,
            uploaded: images.filter(img => img.type === 'uploaded').length,
            generated: images.filter(img => img.type === 'generated').length
        };
    } catch (error) {
        console.error('[Chat API] Error getting image stats:', error);
        return { total: 0, uploaded: 0, generated: 0 };
    }
}


export async function POST(request: NextRequest) {

    const limitCheck = await checkAndIncrementLimit();
    if (!limitCheck.allowed) {
        return NextResponse.json({
            success: false,
            error: limitCheck.message
        }, { status: 429 });
    }
    
    try {
        const body: ChatRequest = await request.json();
        const { userId, message, imageUrl, sessionId, bodyShape, skincolor, bodySize, stylePreference } = body;

        console.log(`[Chat API] Processing chat request for user: ${userId}`);

        // Get JOB context information
        let systemPrompt = "You are a professional fashion consultant AI assistant. Please provide professional fashion advice and styling guidance to users in English.";


        // Get chat history
        const chatHistory = await getChatHistory(sessionId || '');

        // Process images
        const imageParts: any[] = [];

        // Handle new multi-image format with names and mime types
        if (imageUrl && imageUrl.length > 0) {
            console.log(`[Chat API] Processing ${imageUrl.length} images (with metadata)...`);
            if (imageUrl.length > 1) {
                systemPrompt = `You are Styla, a stylist and fashion expert. Your goal is to create complete outfits for the user in image1, styled around the key piece shown in image2. The outfit must suit the occasion and current season. 
                You have deep knowledge of fashion styling, color theory, silhouette balance, layering rules, and aesthetics.
                The user has ${bodyShape} body shape, ${skincolor} skin, ${bodySize} body-size, prefers ${stylePreference} style. Combine user's characteristics with the latest fashion trends to provide personalized and practical styling recommendation. Choose the style from the user’s preferred styles that best matches the item and occasion; if they conflict, prioritize the item and occasion, and do not mention the user’s preferred style.
                Create 2 different outfits and generate image preview of each outfit. Each preview should be high-quality fashion-editorial full-body photography of the user wearing the entire outfit. Keep the character consistent with the user, and use a stunning and cinematic background that reflects the occasion. 
                Build the complete outfit around the key piece for the user and the occasion. Select tops, bottoms and layering pieces that match the color, material and style of the key piece. Style with suitable handbags, shoes and accessories. Suggest suitable hairstyle or makeup to complete the look.
                Summarize recommendation in one sentence within 50 words. Always reply clearly and concisely in a friendly and encouraging tone, and avoid explicitly mentioning the user’s physical traits. 
                At the end of each response, suggest the next actions the user might want to take. Keep the suggestions short, relevant and phrased as friendly questions. `;
            }
            for (let i = 0; i < imageUrl.length; i++) {
                const img = imageUrl[i];
                if (img.length === 0) {
                    continue;
                }
                const imageName = `Image ${i + 1}`;
                const mimeType = 'image/jpeg';

                try {
                    console.log(`[Chat API] Converting ${imageName} (${i + 1}/${imageUrl.length})...`);
                    const imageBase64 = await urlToFile(img, imageName, mimeType).then(fileToBase64);

                    imageParts.push({
                        inline_data: {
                            mime_type: mimeType,
                            data: imageBase64
                        }
                    });

                    console.log(`[Chat API] ✅ ${imageName} converted, size: ${imageBase64?.length} chars`);
                } catch (error) {
                    console.error(`[Chat API] ❌ Failed to process ${imageName}:`, error);
                    // Continue with other images even if one fails
                }
            }
        }


        // Build message parts: text first, then all images
        const parts: any[] = [...imageParts];
        if (imageParts.length === 0) {
            parts.push({ text: message });
        }

        console.log(`[Chat API] Message parts: 1 text + ${imageParts.length} image(s)`);
        // Build message array for Gemini
        const messages: GeminiChatMessage[] = [
            {
                role: 'user',
                parts: [{ text: systemPrompt }]
            },
            // Add historical conversation
            ...chatHistory.map(msg => ({
                role: msg.role === 'assistant' ? 'model' : 'user' as 'user' | 'model',
                parts: [{ text: msg.content }]
            })),
            // Add current user message
            {
                role: 'user',
                parts: parts
            },

        ];

        console.log(`[Chat API] Sending request to Gemini with ${messages.length} messages`);

        // Call Gemini API
        const aiResponse = await generateChatCompletionWithGemini(userId, {
            messages: messages,
            maxOutputTokens: 1000,
            temperature: 0.7,
        });

        console.log(`[Chat API] Received response from Gemini`);

        // 准备用户上传的图片信息
        const uploadedImages: ImageInfo[] = [];
        if (imageUrl && imageUrl.length > 0) {
            imageUrl.forEach((url, index) => {
                if (url.length > 0) {
                    uploadedImages.push({
                        url: url,
                        type: 'uploaded',
                        mimeType: 'image/jpeg',
                        name: `Image ${index + 1}`
                    });
                }
            });
        }

        // 提取AI生成的图片信息（从响应中解析）
        const generatedImages: ImageInfo[] = [];
        try {
            // 尝试从响应中提取图片URL（如果AI响应包含图片链接）
            const imageUrlPattern = /https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp)/gi;
            const foundUrls = aiResponse.text.match(imageUrlPattern);
            if (foundUrls) {
                foundUrls.forEach((url, index) => {
                    generatedImages.push({
                        url: url,
                        type: 'generated',
                        name: `Generated Image ${index + 1}`,
                        generatedPrompt: message // 记录生成图片时的用户提示词
                    });
                });
            }
        } catch (error) {
            console.error('[Chat API] Error extracting generated images:', error);
        }

        // Save chat history with image information
        const userMessage: ChatMessage = {
            role: 'user',
            content: message,
            timestamp: new Date().toISOString(),
            images: uploadedImages.length > 0 ? uploadedImages : undefined,
            metadata: {
                bodyShape,
                skincolor,
                bodySize,
                stylePreference
            }
        };

        const assistantMessage: ChatMessage = {
            role: 'assistant',
            content: aiResponse.text,
            timestamp: new Date().toISOString(),
            images: generatedImages.length > 0 ? generatedImages : undefined
        };
        
        console.log(`[Chat API] Saving user message with ${uploadedImages.length} uploaded image(s)`);
        console.log(`[Chat API] Saving assistant message with ${generatedImages.length} generated image(s)`);
        console.log(`[Chat API] Assistant message: ${assistantMessage.content}`);
        
        await saveChatMessage(sessionId || '', userMessage);
        await saveChatMessage(sessionId || '', assistantMessage);

        // Return response
        return NextResponse.json({
            success: true,
            message: aiResponse,
            sessionId: sessionId,
        });

    } catch (error) {
        console.error('[Chat API] Error processing chat request:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to process chat request',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

// GET - Get chat history with image statistics
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get('sessionId');
        const includeImages = searchParams.get('includeImages') === 'true';
        const imagesOnly = searchParams.get('imagesOnly') === 'true';

        if (!sessionId) {
            return NextResponse.json({
                error: 'sessionId is required'
            }, { status: 400 });
        }

        // 如果只需要图片信息
        if (imagesOnly) {
            const images = await getSessionImages(sessionId);
            const stats = await getSessionImageStats(sessionId);
            
            return NextResponse.json({
                success: true,
                images,
                stats,
                sessionId
            });
        }

        const chatHistory = await getChatHistory(sessionId, 20);
        
        // 默认包含图片统计
        const imageStats = await getSessionImageStats(sessionId);

        const response: any = {
            success: true,
            messages: chatHistory,
            sessionId: sessionId,
            imageStats
        };

        // 如果需要完整的图片列表
        if (includeImages) {
            response.allImages = await getSessionImages(sessionId);
        }

        return NextResponse.json(response);

    } catch (error) {
        console.error('[Chat API] Error fetching chat history:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to fetch chat history'
        }, { status: 500 });
    }
}

// DELETE - Clear chat history
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get('sessionId');

        if (!sessionId) {
            return NextResponse.json({
                error: 'sessionId is required'
            }, { status: 400 });
        }

        // Get all message keys
        const messagesListKey = `chat:messages:${sessionId}`;
        const messageKeys = await kv.lrange(messagesListKey, 0, -1);

        // Delete all messages
        if (messageKeys.length > 0) {
            const deletePromises = messageKeys.map(key => kv.del(key));
            await Promise.all(deletePromises);
        }

        // Clear message list
        await kv.del(messagesListKey);

        console.log(`[Chat API] Chat history cleared for session: ${sessionId}`);

        return NextResponse.json({
            success: true,
            message: 'Chat history cleared successfully'
        });

    } catch (error) {
        console.error('[Chat API] Error clearing chat history:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to clear chat history'
        }, { status: 500 });
    }
}
