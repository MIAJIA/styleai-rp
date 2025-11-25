import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { LangChainGeminiChat } from '@/lib/apple/langchain-chat';
import { saveChatMessage, getChatHistory, ImageInfo, ChatMessage, ChatRequest } from '@/lib/apple/chat';

// 历史消息窗口大小：只保留最近的 N 条消息用于上下文
// 可以通过环境变量 CHAT_HISTORY_WINDOW 配置，默认值为 10
const HISTORY_WINDOW_SIZE = 5;

export async function POST(request: NextRequest) {


    const body: ChatRequest = await request.json();
    const { chatType, userId, message, imageUrl, sessionId, bodyShape, skinTone: skincolor, bodySize, stylePreferences, trycount } = body;
    try {

        console.log(`[Chat API] Try count: ${trycount}`);
        kv.set(sessionId || "" + "_request", {
            userId,
            timestamp: new Date().toISOString()
        });
        // 提供重试，直接返回有效结果
        const messageKey = `chat:message:${sessionId}:temp_message`;
        if (trycount == 0) {
            await kv.del(messageKey);
        } else {
            const tempMessage = await kv.get(messageKey);
            console.log(`[Chat API] have Temp message `);
            if (tempMessage) {
                kv.set(sessionId || "" + "_temp_message", {
                    userId,
                    timestamp: new Date().toISOString()
                });
                return NextResponse.json({
                    success: true,
                    message: tempMessage,
                    sessionId: sessionId,
                });
            }
        }

        console.log(`[Chat API] Processing chat request for user: ${userId}`);
        console.log(`[Chat API] User message: ${message}`);
        console.log(`[Chat API] Body Shape: ${bodyShape}`);
        console.log(`[Chat API] Skin Tone: ${skincolor}`);
        console.log(`[Chat API] Body Size: ${bodySize}`);
        console.log(`[Chat API] Style Preference: ${stylePreferences}`);


        let systemPrompt = `You are Styla, a fashion stylist and personal image consultant. Your goal is to help the user with outfit ideas, styling logic, color pairing, occasion dressing, shopping guidance, and fashion education. 
You have knowledge of silhouettes, color theory, fabrics, proportions, layering, hairstyle, accessories, seasonal trends, and occasion-based outfits. Avoid negative judgment about body, age, or skin. Always respond in a friendly, concise, and encouraging tone. 
The user has ${bodyShape} body shape, ${skincolor} skin, ${bodySize} body-size, prefers ${stylePreferences} style. When asked for outfit advice, consider user’s characteristics and give personalized feedback.
Ask clarifying questions if needed (occasion, weather, color preference, formality, footwear options, etc.). 
When the user uploads clothing or outfit photos, analyze silhouette, fit, color coordination, footwear pairing, and accessories. Offer gentle improvement suggestions.
Offer to generate a visual preview when:
- user asks you to do so
- user asks how to elevate the look
- user wants to visualize or compare styling ideas
- user provides reference items or asks how to style an item 
For previews: generate high-quality fashion-editorial full-body images with consistent facial identity, realistic fabric texture, accurate seasonality, cohesive styling, and clean, aesthetic backgrounds.
Avoid unrealistic body modification or sexualization by default.
If the user chats casually, respond naturally while adding helpful style insight when relevant.
Keep your response short and concise. End each response with 1–2 short follow-up questions to continue the conversation. ;`;

        // Initialize LangChain chat handler
        const langChainChat = new LangChainGeminiChat();

        if ((await getChatHistory(sessionId || '', 1)).length <= 0) {
            // Handle new multi-image format with names and mime types
            if (chatType === 'stylechat' && imageUrl && imageUrl.length > 0) {
                console.log(`[Chat API] Processing ${imageUrl.length} images (with metadata)...`);
                systemPrompt = `You are Styla, a stylist and fashion expert. Your goal is to create complete outfits for the user in image1, styled around the key piece shown in image2. The outfit must suit the occasion and current season. 
                You have deep knowledge of fashion styling, color theory, silhouette balance, layering rules, and aesthetics.
                The user has ${bodyShape} body shape, ${skincolor} skin, ${bodySize} body-size, prefers ${stylePreferences} style. Combine user's characteristics with the latest fashion trends to provide personalized and practical styling recommendation. Choose the style from the user’s preferred styles that best matches the item and occasion; if they conflict, prioritize the item and occasion, and do not mention the user’s preferred style.
                Create 2 different outfits and generate image preview of each outfit. Each preview should be high-quality fashion-editorial full-body photography of the user wearing the entire outfit. Keep the character consistent with the user, and use a stunning and cinematic background that reflects the occasion. 
                Build the complete outfit around the key piece for the user and the occasion. Select tops, bottoms and layering pieces that match the color, material and style of the key piece. Style with suitable handbags, shoes and accessories. Suggest suitable hairstyle or makeup to complete the look.
                Summarize recommendation in one sentence within 50 words. Always reply clearly and concisely in a friendly and encouraging tone, and avoid explicitly mentioning the user’s physical traits. 
                At the end of each response, suggest the next actions the user might want to take. Keep the suggestions short, relevant and phrased as friendly questions. `;
            }

            if (chatType === 'outfitchat' && imageUrl && imageUrl.length > 0) {
                systemPrompt = `You are Styla, a stylist and fashion expert. Your goal is to analyze the user's outfit in the uploaded photo, and provide personalized and practical styling advice.
You have deep knowledge of fashion styling, color theory, silhouette balance, layering rules, and aesthetics.
Analyze the user's current outfit in the photo, identify what works well for the user and what could be improved. Give styling recommendation to elevate the look and generate image preview. Keep the user's original outfit as the foundation, and optimize around it. Refine layering and proportions through styling adjustments, add layering pieces if necessary, style with handbag, shoes and accessories for balance, and suggest suitable hairstyle or makeup to complete the look.
Summarize recommendation in one sentence within 50 words. Always reply clearly and concisely in a friendly and encouraging tone. 
At the end of each response, suggest the next actions the user might want to take. Keep the suggestions short, relevant and phrased as friendly questions.
 Your goal is to create complete outfits for the user in image1, styled around the key piece shown in image2.
  `;
            }
        }

        // Use LangChain to process chat with enhanced context and image support
        console.log(`[Chat API] Using LangChain for enhanced context management...`);
        console.log(`[Chat API] History window size: ${HISTORY_WINDOW_SIZE} messages`);
        
        const aiResponse = await langChainChat.chat({
            sessionId: sessionId || '',
            userId: userId,
            message: message,
            imageUrls: imageUrl && imageUrl.length > 0 ? imageUrl.filter(url => url.length > 0) : [],
            systemPrompt: systemPrompt,
            historyWindow: HISTORY_WINDOW_SIZE, // 使用窗口处理历史消息
        });

        console.log(`[Chat API] AI Response text length: ${aiResponse.text?.length || 0}`);
        console.log(`[Chat API] AI Response images: ${aiResponse.images?.length || 0}`);

        // Prepare user uploaded images info
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

        // Extract AI generated images from response
        const generatedImages: ImageInfo[] = [];
        if (aiResponse.images && aiResponse.images.length > 0) {
            // Images are already processed and saved by LangChain handler
            aiResponse.images.forEach((url, index) => {
                generatedImages.push({
                    url: url,
                    type: 'generated',
                    name: `Generated Image ${index + 1}`,
                });
            });
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
                stylePreferences
            }
        };

        const assistantMessage: ChatMessage = {
            role: 'assistant',
            content: aiResponse.text,
            timestamp: new Date().toISOString(),
            images: generatedImages.length > 0 ? generatedImages : undefined
        };

        console.log(`[Chat API] 💾 Saving chat messages to history...`);
        console.log(`[Chat API] 💾 User message with ${uploadedImages.length} uploaded image(s):`);

        await saveChatMessage(sessionId || '', userMessage);
        await saveChatMessage(sessionId || '', assistantMessage);
        kv.set(sessionId || "" + "_response", {
            userId,
            status: "success",
            timestamp: new Date().toISOString()
        });
        // Return response in expected format
        return NextResponse.json({
            success: true,
            message: {
                text: aiResponse.text,
                images: aiResponse.images || [],
                metadata: aiResponse.metadata
            },
            sessionId: sessionId,
        });

    } catch (error) {
        console.error('[Chat API] Error processing chat request:', error);
        kv.set(sessionId || "" + "_response", {
            userId,
            status: "error",
            error: error,
            timestamp: new Date().toISOString()
        });
        return NextResponse.json({
            success: false,
            error: 'Failed to process chat request',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

