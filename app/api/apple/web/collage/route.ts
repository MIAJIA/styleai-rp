import { urlToFile } from "@/lib/ai/utils";
import { GoogleGenAI } from "@google/genai";
import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

const IMAGE_MODEL = 'gemini-3-pro-image-preview';

/**
 * Helper to clean base64 string (remove data:image/png;base64, prefix)
 */
const cleanBase64 = (b64: string) => b64.split(',')[1] || b64;

// Helper function to convert a File to a Base64 string
export const fileToBase64 = async (file: File): Promise<string> => {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    return buffer.toString("base64");
};


/**
 * 1. Generate Collage
 * Takes multiple item images and creates a flatlay.
 */
export async function POST(request: NextRequest) {
    const body = await request.json();
    const { urls } = body;
    if (!urls || urls.length === 0) {
        return NextResponse.json({ error: 'No URLs provided' }, { status: 400 });
    }


    console.log(`[Collage API] Generating collage for ${urls.length} images`);
    const imageBase64s = await Promise.all(urls.map(async (urlOrDataUrl: string) => {
        // Check if it's a data URL (starts with data:image)
        if (urlOrDataUrl.startsWith('data:image')) {
            // Extract base64 part from data URL
            return cleanBase64(urlOrDataUrl);
        } else {
            // It's a regular URL, fetch and convert
            return await urlToFile(urlOrDataUrl, `Collage Image`, 'image/jpeg')
                .then(fileToBase64);
        }
    }));

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    try {
        const parts = imageBase64s.map(b64 => ({
            inlineData: {
                mimeType: 'image/png',
                data: cleanBase64(b64)
            }
        }));

        parts.push({
            // @ts-ignore - Text part matches SDK expectation
            text: "Create a high-fashion flatlay collage of these clothing items arranged neatly on a pure white background. Ensure all items are visible and styled attractively together as a coordinate outfit. Do not crop items."
        });

        const response = await ai.models.generateContent({
            model: IMAGE_MODEL,
            contents: { parts },
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
                const fileName = `Collage_${Date.now()}.png`;
                const blob = await put(`app/Collage/${fileName}`, buffer, {
                    access: 'public',
                    addRandomSuffix: false
                });
                console.log(`[Collage API] Collage image saved to ${blob.url}`);
                return NextResponse.json({ url: blob.url }, { status: 200 });
            }

        }
        return NextResponse.json({ error: 'No image generated' }, { status: 400 });
    } catch (error) {
        console.error("Collage generation failed", error);
        return NextResponse.json({ error: 'Collage generation failed' }, { status: 500 });
    }
};