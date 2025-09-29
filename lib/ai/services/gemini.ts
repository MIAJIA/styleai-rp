import { fetchWithTimeout, urlToFile, fileToBase64 } from "../utils";
import { put } from '@vercel/blob';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_API_VERSION = process.env.GEMINI_API_VERSION || 'v1beta';
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image-preview';

export interface GeminiGenerateParams {
  prompt: string;
  humanImageUrl: string;
  humanImageName: string;
  humanImageType: string;
  garmentImageUrl?: string;
  garmentImageName?: string;
  garmentImageType?: string;
  userId?: string;
}

export async function generateFinalImagesWithGemini(params: GeminiGenerateParams): Promise<string[]> {
  console.log('🤖 [GEMINI_SERVICE] ===== GEMINI API CALL STARTED =====');
  console.log('🤖 [GEMINI_SERVICE] 🔧 Environment check:');
  console.log('🤖 [GEMINI_SERVICE] 🔧 - MOCK_GEMINI:', process.env.MOCK_GEMINI);
  console.log('🤖 [GEMINI_SERVICE] 🔧 - GEMINI_API_KEY:', GEMINI_API_KEY ? 'SET' : 'MISSING');
  console.log('🤖 [GEMINI_SERVICE] 🔧 - GEMINI_IMAGE_MODEL:', GEMINI_IMAGE_MODEL);
  
  console.log('🤖 [GEMINI_SERVICE] 📝 Input parameters:');
  console.log('🤖 [GEMINI_SERVICE] 📝 - Prompt length:', params.prompt?.length || 0);
  console.log('🤖 [GEMINI_SERVICE] 📝 - Human image URL:', params.humanImageUrl?.substring(0, 100) + '...');
  console.log('🤖 [GEMINI_SERVICE] 📝 - Garment image URL:', params.garmentImageUrl?.substring(0, 100) + '...' || 'N/A');
  
  console.log('🤖 [GEMINI_SERVICE] ===== COMPLETE PROMPT =====');
  console.log('🤖 [GEMINI_SERVICE] 📄 PROMPT:', params.prompt);
  console.log('🤖 [GEMINI_SERVICE] ===== END PROMPT =====');

  if (process.env.MOCK_GEMINI === 'true' || !GEMINI_API_KEY) {
    console.log('🤖 [GEMINI_SERVICE] 🎭 Using MOCK mode - returning placeholder image');
    // Minimal mock data URI to avoid network
    return [
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77hQAAAABJRU5ErkJggg=="
    ];
  }

  // Prepare images as base64 inline_data
  console.log('🤖 [GEMINI_SERVICE] 🔄 Converting images to base64...');
  const humanImageBase64 = await urlToFile(params.humanImageUrl, params.humanImageName, params.humanImageType).then(fileToBase64);
  console.log('🤖 [GEMINI_SERVICE] 🔄 Human image converted, size:', humanImageBase64.length, 'chars');
  
  let garmentImageBase64: string | undefined = undefined;
  if (params.garmentImageUrl && params.garmentImageName && params.garmentImageType) {
    garmentImageBase64 = await urlToFile(params.garmentImageUrl, params.garmentImageName, params.garmentImageType).then(fileToBase64);
    console.log('🤖 [GEMINI_SERVICE] 🔄 Garment image converted, size:', garmentImageBase64?.length || 0, 'chars');
  }

  const endpoint = `https://generativelanguage.googleapis.com/${GEMINI_API_VERSION}/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  console.log('🤖 [GEMINI_SERVICE] 🌐 API Endpoint:', endpoint.replace(GEMINI_API_KEY, '[REDACTED_KEY]'));

  const parts: any[] = [
    { text: params.prompt },
    { inline_data: { mime_type: params.humanImageType, data: humanImageBase64 } },
  ];
  if (garmentImageBase64) {
    parts.push({ inline_data: { mime_type: params.garmentImageType, data: garmentImageBase64 } });
  }

  const body = {
    contents: [ { parts } ],
    // Request both to ensure we can parse either; server may still return subset
    generationConfig: { responseModalities: ["TEXT", "IMAGE"] }
  };
  
  console.log('🤖 [GEMINI_SERVICE] 📦 Request body structure:');
  console.log('🤖 [GEMINI_SERVICE] 📦 - Contents count:', body.contents.length);
  console.log('🤖 [GEMINI_SERVICE] 📦 - Parts count:', parts.length);
  console.log('🤖 [GEMINI_SERVICE] 📦 - Response modalities:', body.generationConfig.responseModalities);
  console.log('🤖 [GEMINI_SERVICE] 📦 - Parts types:', parts.map(p => Object.keys(p)).join(', '));

  console.log('🤖 [GEMINI_SERVICE] 🚀 Sending request to Gemini API...');
  const resp = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    timeout: 180000,
  });

  console.log('🤖 [GEMINI_SERVICE] 📡 Response received:');
  console.log('🤖 [GEMINI_SERVICE] 📡 - Status:', resp.status);
  console.log('🤖 [GEMINI_SERVICE] 📡 - Status text:', resp.statusText);
  console.log('🤖 [GEMINI_SERVICE] 📡 - OK:', resp.ok);

  if (!resp.ok) {
    const text = await resp.text();
    console.log('🤖 [GEMINI_SERVICE] ❌ Error response body:', text);
    throw new Error(`Gemini API error: ${resp.status} ${text}`);
  }

  const data = await resp.json();
  console.log('🤖 [GEMINI_SERVICE] 📥 Success response received');
  console.log('🤖 [GEMINI_SERVICE] 📥 Response keys:', Object.keys(data));
  // Extract inline image data and optional text
  console.log('🤖 [GEMINI_SERVICE] 🔍 Parsing response for images and text...');
  const candidates = data?.candidates || [];
  console.log('🤖 [GEMINI_SERVICE] 🔍 Candidates count:', candidates.length);

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
  if (texts.length) {
    console.log('🤖 [GEMINI_SERVICE] 📝 Collected text parts length:', texts.map(t => t.length));
  }
  
  console.log('🤖 [GEMINI_SERVICE] ✅ Total images extracted:', images.length);
  
  if (!images.length) {
    console.log('🤖 [GEMINI_SERVICE] ❌ No images found in response');
    console.log('🤖 [GEMINI_SERVICE] ❌ Text parts summary:', texts.length ? texts.slice(0,1)[0].substring(0, 200) + '...' : 'NONE');
    console.log('🤖 [GEMINI_SERVICE] ❌ Full response data:', JSON.stringify(data, null, 2));
    throw new Error("Gemini API returned no inline images");
  }
  
  // Save images to Vercel Blob storage
  console.log('🤖 [GEMINI_SERVICE] 💾 Saving images to Vercel Blob storage...');
  const userId = params.userId || 'anonymous';
  const savedUrls: string[] = [];
  const savedPaths: string[] = [];
  
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
      
      savedUrls.push(blob.url);
      savedPaths.push(`/api/apple/upload?key=gemini_${fileName}`);
      
      console.log('🤖 [GEMINI_SERVICE] 💾 Image saved:', blob.url);
    } catch (error) {
      console.error('🤖 [GEMINI_SERVICE] ❌ Failed to save image:', error);
      throw new Error(`Failed to save image ${i + 1} to Vercel Blob: ${error}`);
    }
  }
  
  console.log('🤖 [GEMINI_SERVICE] ===== GEMINI API CALL COMPLETED =====');
  return savedUrls;
}


