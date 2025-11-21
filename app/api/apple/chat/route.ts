import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { Job } from '@/lib/types';
import { generateChatCompletionWithGemini, GeminiChatMessage, GeminiChatResult } from '@/lib/apple/gemini';
import { fileToBase64, urlToFile } from '@/lib/utils';
import { checkAndIncrementLimit } from '@/lib/apple/checkLimit';
import sharp from 'sharp';
import { saveChatMessage, getChatHistory, ImageInfo, ChatMessage, ChatRequest, compressImage } from '@/lib/apple/chat';

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

        // Get chat history
        const chatHistory = await getChatHistory(sessionId || '');

        // Process images
        const imageParts: any[] = [];

        if (chatHistory.length <= 0) {
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

        if (imageUrl && imageUrl.length > 1) {
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
        parts.push({ text: message });

        console.log(`[Chat API] Message parts: 1 text + ${imageParts.length} image(s)`);

        // Build message array for Gemini with historical images
        const messages: GeminiChatMessage[] = [
            {
                role: 'user',
                parts: [{ text: systemPrompt }]
            }
        ];

        // Add historical conversation WITH images
        console.log(`[Chat API] 📚 Loading ${chatHistory.length} historical messages...`);
        for (const msg of chatHistory) {
            const messageParts: any[] = [];

            // Add text content
            if (msg.content && msg.content.trim()) {
                console.log(`[Chat API] 📚 Loading historical message: ${msg.content.length} characters`);
                messageParts.push({ text: msg.content });
            }

            // Add images from history (only uploaded images)
            if (msg.images && msg.images.length > 0) {
                console.log(`[Chat API] 🖼️ Loading ${msg.images.length} image(s) from history...`);
                for (const img of msg.images) {
                    // 只包含用户上传的图片作为上下文，不包含AI生成的图片
                    try {
                        if (img.isCompressed) {
                            messageParts.push({
                                inline_data: {
                                    mime_type: img.mimeType || 'image/jpeg',
                                    data: img.context
                                }
                            });
                            console.log(`[Chat API]    ✅ Added compressed image: ${img.name}`);
                        } else {
                            console.log(`[Chat API]    Compressing ${img.name}...`);
                            const imageBase64 = await urlToFile(img.url, img.name || 'image.jpg', img.mimeType || 'image/jpeg')
                                .then(fileToBase64);
                            const compressedImage = await compressImage(imageBase64);
                            messageParts.push({
                                inline_data: {
                                    mime_type: img.mimeType || 'image/jpeg',
                                    data: compressedImage
                                }
                            });
                            console.log(`[Chat API]    ✅ Added compressed image: ${img.name}`);
                        }
                        console.log(`[Chat API]    ✅ Added historical image: ${img.name}`);
                    } catch (error) {
                        console.error(`[Chat API]    ❌ Failed to load image ${img.name}:`, error);
                    }
                }
            }

            // Only add message if it has valid parts
            if (messageParts.length > 0) {
                messages.push({
                    role: msg.role === 'assistant' ? 'model' : 'user' as 'user' | 'model',
                    parts: messageParts
                });
            }
        }

        // Add current user message
        messages.push({
            role: 'user',
            parts: parts
        });

        console.log(`[Chat API] ✅ Built ${messages.length} messages for Gemini (including system prompt)`);

        console.log(`[Chat API] Sending request to Gemini with ${messages.length} messages`);

        const aiResponse = await generateChatCompletionWithGemini(userId, {
            messages: messages,
            maxOutputTokens: 1000,
            temperature: 0.7,
        });

        console.log(`[Chat API] AI Response text length: ${aiResponse.text?.length || 0}`);
        console.log(`[Chat API] AI Response images: ${aiResponse.images?.length || 0}`);

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
            const foundUrls = aiResponse.images;
            if (foundUrls && foundUrls.length > 0) {
                // 使用 Promise.all 并行处理所有图片，而不是 forEach
                await Promise.all(
                    foundUrls.map(async (url, index) => {
                        try {
                            const imageBase64 = await urlToFile(url, `Generated Image ${index + 1}`, 'image/jpeg')
                                .then(fileToBase64);
                            const compressedImage = await compressImage(imageBase64);
                            console.log(`[Chat API] Compressed generated image ${index + 1} size: ${compressedImage.length} chars`);
                            generatedImages.push({
                                isCompressed: true,
                                context: compressedImage,
                                url: url,
                                type: 'generated',
                                name: `Generated Image ${index + 1}`,
                            });
                        } catch (error) {
                            console.error(`[Chat API] Failed to compress generated image ${index + 1}:`, error);
                            // 即使压缩失败，也添加图片信息
                            generatedImages.push({
                                url: url,
                                type: 'generated',
                                name: `Generated Image ${index + 1}`,
                            });
                        }
                    })
                );
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
        // Return response
        return NextResponse.json({
            success: true,
            message: aiResponse,
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

