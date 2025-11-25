import { fileToBase64, urlToFile } from "@/lib/ai/utils";
import { GoogleGenAI } from "@google/genai";
import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

const IMAGE_MODEL = 'gemini-3-pro-image-preview';

/**
 * 2. Generate Virtual Try-On
 * Takes the collage/outfit image + model desc + scene desc.
 */
export async function POST(request: NextRequest) {

    const body = await request.json();

    const { collage, modelPrompt, scenePrompt } = body;

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const imageBase64 = await urlToFile(collage, 'Collage Image', 'image/jpeg')
            .then(fileToBase64);

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
            if (part.inlineData) {
                const base64Data = `data:image/png;base64,${part.inlineData.data}`;
                const buffer = Buffer.from(base64Data, 'base64');
                const fileName = `Collage_${Date.now()}.png`;
                const blob = await put(`app/users/Collage/${fileName}`, buffer, {
                    access: 'public',
                    addRandomSuffix: false
                });
                return NextResponse.json({ url: blob.url }, { status: 200 });
            }

        }
        return NextResponse.json({ error: 'No image generated' }, { status: 400 });
    } catch (error) {
        console.error("Collage generation failed", error);
        return NextResponse.json({ error: 'Collage generation failed' }, { status: 500 });
    }

}