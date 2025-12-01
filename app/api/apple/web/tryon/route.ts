import { fileToBase64, urlToFile } from "@/lib/ai/utils";
import { supabase } from "@/lib/supabase";
import { GoogleGenAI } from "@google/genai";
import { put } from "@vercel/blob";
import { kv } from "@vercel/kv";
import { NextRequest, NextResponse } from "next/server";


const prompt = 'Generate a photorealistic full-body fashion photograph of wearing the outfit shown in the reference image. The lighting should be cinematic and high-end fashion editorial style. Ensure the clothing looks exactly like the reference.'

const IMAGE_MODEL = 'gemini-3-pro-image-preview';

/**
 * Helper to clean base64 string (remove data:image/png;base64, prefix)
 */
const cleanBase64 = (b64: string) => b64.split(',')[1] || b64;

/**
 * 2. Generate Virtual Try-On
 * Takes the collage/outfit image + model desc + scene desc.
 */
export async function POST(request: NextRequest) {

    const body = await request.json();
    const { id, collage, modelPrompt, scenePrompt } = body;
    // 检查是否已有锁
    const lockKey = `tryon:lock:${id}`;

    
    try {
        const existingLock = await kv.get(lockKey);
        if (existingLock) {
            return NextResponse.json({ error: 'Try-on is already in progress' }, { status: 429 });
        }

        // 检查是否已有结果
        const { data: styleTemplate } = await supabase.from('style_templates').select().eq('id', id).single();
        if (styleTemplate?.post && styleTemplate.post.length > 0) {
            return NextResponse.json({ url: styleTemplate.post }, { status: 200 });
        }

        // 设置锁，5分钟过期
        await kv.set(lockKey, Date.now(), { ex: 300 });

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        // Handle both data URL and HTTP URL
        let imageBase64: string;
        if (collage.startsWith('data:image')) {
            // Extract base64 part from data URL
            imageBase64 = cleanBase64(collage);
        } else {
            // It's a regular URL, fetch and convert
            imageBase64 = await urlToFile(collage, 'Collage Image', 'image/jpeg')
                .then(fileToBase64);
        }

        const response = await ai.models.generateContent({
            model: IMAGE_MODEL,
            contents: {
                parts: [
                    {
                        inlineData: {
                            mimeType: 'image/png',
                            data: imageBase64
                        }
                    },
                    {
                        text: `Generate a photorealistic full-body fashion photograph of ${modelPrompt} wearing the outfit shown in the reference image. The setting is ${scenePrompt}. The lighting should be cinematic and high-end fashion editorial style. Ensure the clothing looks exactly like the reference.`
                    }
                ]
            },
            config: {
                imageConfig: {
                    aspectRatio: "3:4",
                    imageSize: "1K"
                }
            }
        });

        // Extract image from response
        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData && part.inlineData.data) {
                // part.inlineData.data is already base64, create buffer directly
                const buffer = Buffer.from(part.inlineData.data, 'base64');
                const fileName = `Tryon_${Date.now()}.png`;
                const blob = await put(`app/Tryon/${fileName}`, buffer, {
                    access: 'public',
                    addRandomSuffix: false
                });
                console.log(`[Tryon API] Try-on image saved to ${blob.url}`);
                const { error: dbError } = await supabase.from('style_templates').update({
                    post: blob.url,
                    prompt: prompt,
                    state: true,
                }).eq('id', id).select();
                if (dbError) {
                    console.error('[Tryon API] Failed to save to database:', dbError);
                }
                return NextResponse.json({ url: blob.url }, { status: 200 });
            }
        }

        return NextResponse.json({ error: 'No image generated' }, { status: 400 });
    } catch (error) {
        console.error("Try-on generation failed", error);
        return NextResponse.json({ error: 'Try-on generation failed' }, { status: 500 });
    } finally {
        await kv.del(lockKey);
    }

}