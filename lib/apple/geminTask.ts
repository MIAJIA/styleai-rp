
import { put } from '@vercel/blob';
import { fetchWithTimeout } from '../utils';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_API_VERSION = process.env.GEMINI_API_VERSION || 'v1beta';
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image-preview';



export interface GeminiAnalysisResult {
    texts: string[];
    images: string[];
  }
  

// 对Gemini 请求 进行包装 
export async function geminiTask(
    userId: string, 
    prompt: string, 
    imagesBase64: string, 
    imagesMimeType: string,
): Promise<GeminiAnalysisResult> {
    console.log('🤖 [GEMINI_SERVICE] ===== GEMINI TASK STARTED =====');
    const endpoint = `https://generativelanguage.googleapis.com/${GEMINI_API_VERSION}/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    console.log('🤖 [GEMINI_SERVICE] 🌐 API Endpoint:', endpoint.replace(GEMINI_API_KEY, '[REDACTED_KEY]'));

    const parts: any[] = [
        { text: prompt },
    ];
    // 如果传入图片，则添加到body中
    if (imagesBase64) {
        console.log('🤖 [GEMINI_SERVICE] 🔍 Adding image to body', imagesMimeType);
        parts.push({ inline_data: { mime_type: imagesMimeType, data: imagesBase64 } });
    }

    const body = {
        contents: [{ parts }],
        generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
            maxOutputTokens: 3000,
            temperature: 0.7,
        }
    };

    const resp = await fetchWithTimeout(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        timeout: 60000, // Longer timeout for image generation
    });
    if (!resp.ok) {
        const text = await resp.text();
        console.error('🤖 [GEMINI_IMAGE_GENERATION] ❌ API Error:', resp.status, text);
        throw new Error(`Gemini Image Generation API error: ${resp.status} ${text}`);
    }
    const data = await resp.json();
    console.log('🤖 [GEMINI_IMAGE_GENERATION] 📥 Received response from Gemini API');

    console.log('🤖 [GEMINI_IMAGE_GENERATION] 📥 Response keys:', Object.keys(data));
    // Extract inline image data and optional text
    console.log('🤖 [GEMINI_IMAGE_GENERATION] 🔍 Parsing response for images and text...');
    const candidates = data?.candidates || [];
    console.log('🤖 [GEMINI_IMAGE_GENERATION] 🔍 Candidates count:', candidates.length);

    const images: string[] = [];
    const texts: string[] = [];
    for (const c of candidates) {
        const parts = c?.content?.parts || [];
        console.log('🤖 [GEMINI_SERVICE] 🔍 Parts in candidate:', parts.length);

        for (const p of parts) {
            if (typeof p?.text === 'string') {
                texts.push(p.text);
            }
            const inline = p.inlineData || p.inline_data;
            if (inline?.data) {
                const mime = inline.mimeType || inline.mime_type || 'image/png';
                images.push(`data:${mime};base64,${inline.data}`);
                console.log('🤖 [GEMINI_SERVICE] 🔍 Found image, mime type:', mime);
                console.log('🤖 [GEMINI_SERVICE] 🔍 Image data length:', inline.data.length, 'chars');
            }
        }
    }

    console.log('🤖 [GEMINI_SERVICE] ✅ Total texts extracted:', texts.length);
    console.log('🤖 [GEMINI_SERVICE] ✅ Total images extracted:', images.length);

    // 如果传入图片，则保存到Vercel Blob storage
    console.log('🤖 [GEMINI_SERVICE] 💾 Saving images to Vercel Blob storage...');
    const imagesUrls: string[] = [];

    for (let i = 0; i < images.length; i++) {
        const imageData = images[i];
        const base64Data = imageData.split(',')[1]; // Remove data:image/...;base64, prefix
        const buffer = Buffer.from(base64Data, 'base64');
        const fileName = `gemini_${Date.now()}_${i}.png`;

        try {
            const blob = await put(`app/users/${userId}/gemini_${fileName}`, buffer, {
                access: 'public',
                addRandomSuffix: false
            });

            imagesUrls.push(blob.url);

            console.log('🤖 [GEMINI_SERVICE] 💾 Image saved:', blob.url);
        } catch (error) {
            console.error('🤖 [GEMINI_SERVICE] ❌ Failed to save image:', error);
            throw new Error(`Failed to save image ${i + 1} to Vercel Blob: ${error}`);
        }
    }

    return {
        texts: texts,
        images: imagesUrls,
    };
}


