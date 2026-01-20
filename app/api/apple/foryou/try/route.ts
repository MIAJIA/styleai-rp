import { checkAndIncrementLimit } from "@/lib/apple/checkLimit";
import { GeminiChatMessage, generateChatCompletionWithGemini, generateStyledImagesWithGemini } from "@/lib/apple/gemini";
import { supabase } from "@/lib/supabase";
import { fileToBase64, sleep, urlToFile } from "@/lib/utils";
import { kv } from "@vercel/kv";
import { NextRequest, NextResponse } from 'next/server';



export async function GET(request: NextRequest) {
    try {
        const { data: userImages, error } = await supabase
            .from('user_images')
            .select('*')
            .not('request_id', 'is', null)
            // 筛选 metadata->>state 不等于 'success' 的记录
            // 使用 filter 处理 JSON 字段，支持 null 或不是 'success' 的情况
            .or('metadata->>state.neq.success,metadata->>state.is.null')
            .limit(10)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[NewGen API] Error fetching user images:', error);
            return NextResponse.json(
                { success: false, error: 'Failed to fetch user images', details: error.message },
                { status: 500 }
            );
        }

        // 遍历并记录用户图片信息（用于调试）
        for (const userImage of userImages || []) {
            const { request_id: requestId, user_id: userId, image_url: imageUrl, metadata, max_tokens: maxTokens = 2000, temperature = 0.8 } = userImage || {};
            
            if (metadata?.state == 'success') {
                console.log(`[NewGen API] Request ID: ${requestId} already processed`);
                continue;
            }
            console.log(`[NewGen API] Request ID: ${requestId} processing`);

            if (metadata?.template_id) {
                const { data: template, error: templateError } = await supabase
                    .from('style_templates')
                    .select('*')
                    .eq('id', metadata.template_id)
                    .single();
                if (templateError) {
                    console.error('[NewGen API] Error fetching template:', templateError);
                    continue;
                }

                const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('id', userId).single();
                if (profileError) {
                    console.error('[NewGen API] Error fetching profile:', profileError);
                    continue;
                }

                let imageUrls = [profile.fullbodyphoto, template.urls];
                const imageParts: any[] = [];
                for (let i = 0; i < imageUrls.length; i++) {
                    const img = imageUrls[i];
                    if (img.length === 0) {
                        continue;
                    }
                    console.log(`[NewGen API] Image URL: ${img}`);
                    const imageName = `Image ${i + 1}`;
                    const mimeType = 'image/jpeg';
                    const imageBase64 = await urlToFile(img, imageName, mimeType).then(fileToBase64);
                    imageParts.push({ inline_data: { mime_type: mimeType, data: imageBase64 } });
                }

                const messages: GeminiChatMessage[] = [
                    {
                        role: 'user',
                        parts: [{ text: template.prompt }, ...imageParts]
                    },

                ];
                console.log(messages);


                // Generate styled images
                const generatedImages = await generateChatCompletionWithGemini(userId, {
                    messages: messages,
                    maxOutputTokens: 1000,
                    temperature: 0.7,
                });

                console.log(`[NewGen API] Generated ${generatedImages.images?.length} images successfully`);
                if (generatedImages.images?.length && generatedImages.images.length > 0) {

                    await kv.set(requestId, {
                        success: true,
                        message: "Image generation completed",
                        data: {
                            images: generatedImages.images,
                            numImages: generatedImages.images?.length,
                            timestamp: new Date().toISOString()
                        }
                    });

                    await supabase.from('user_images').update({
                        metadata: {
                            server: "nextjs",
                            state: 'success',
                            ...metadata,
                        },
                        updated_at: new Date().toLocaleString()
                    }).eq('request_id', requestId).select();
                }
            }
        }

        // 返回查询结果
        return NextResponse.json({
            success: true,
            data: userImages || [],
            count: userImages?.length || 0
        });

    } catch (error) {
        console.error('[NewGen API] Error processing GET request:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to process request',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    } finally {
        return NextResponse.json({
            success: true,

        });
    }
}
