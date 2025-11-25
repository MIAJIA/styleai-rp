import { fileToBase64, urlToFile } from "@/lib/ai/utils";
import { GoogleGenAI } from "@google/genai";
import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

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

    const { collage, modelPrompt, scenePrompt } = body;

    try {
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
                return NextResponse.json({ url: blob.url }, { status: 200 });
            }

        }
        return NextResponse.json({ error: 'No image generated' }, { status: 400 });
    } catch (error) {
        console.error("Try-on generation failed", error);
        return NextResponse.json({ error: 'Try-on generation failed' }, { status: 500 });
    }

}