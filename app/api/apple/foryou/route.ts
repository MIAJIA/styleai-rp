import { GeminiChatMessage, generateChatCompletionWithGemini, generateStyledImagesWithGemini } from "@/lib/apple/gemini";
import { fileToBase64, urlToFile } from "@/lib/utils";
import { NextRequest, NextResponse } from 'next/server';

interface ImageGenerationRequest {
    userId: string;
    imageUrl: string[];
    prompt: string;
    numImages?: number;
    maxTokens?: number;
    temperature?: number;
}

export async function POST(request: NextRequest) {
    try {
        const body: ImageGenerationRequest = await request.json();
        const {
            userId,
            imageUrl,
            prompt,
            maxTokens = 2000,
            temperature = 0.8
        } = body;

        console.log(`[NewGen API] Processing image generation request`);
        console.log(`[NewGen API] Image URL: ${imageUrl.length}...`);
        console.log(`[NewGen API] Custom prompt length: ${prompt.length}`);

        const imageParts: any[] = [];
        for (let i = 0; i < imageUrl.length; i++) {
            const img = imageUrl[i];
            if (img.length === 0) {
                continue;
            }
            const imageName = `Image ${i + 1}`;
            const mimeType = 'image/jpeg';
            const imageBase64 = await urlToFile(img, imageName, mimeType).then(fileToBase64);
            imageParts.push({ inline_data: { mime_type: mimeType, data: imageBase64 } });
        }

        const messages: GeminiChatMessage[] = [
            {
                role: 'user',
                parts: [{ text: prompt }, ...imageParts]
            },

        ];
        
        // Generate styled images
        const generatedImages = await generateChatCompletionWithGemini(userId, {
            messages: messages,
            maxOutputTokens: 1000,
            temperature: 0.7,
        });

        console.log(`[NewGen API] Generated ${generatedImages.images?.length} images successfully`);


        return NextResponse.json({
            success: true,
            message: "Image generation completed",
            data: {
                images: generatedImages.images,
                numImages: generatedImages.images?.length,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('[NewGen API] Error processing image generation:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to generate images',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
