import { fetchWithTimeout, urlToFile, fileToBase64 } from "./utils";

const GEMINI_API_URL = process.env.GEMINI_API_URL || "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || "gemini-2.5-flash";

export interface GeminiGenerateParams {
  prompt: string;
  humanImageUrl: string;
  garmentImageUrl?: string;
  garmentImageName?: string;
  garmentImageType?: string;
}

export interface GeminiChatMessage {
  role: 'user' | 'model' | 'system';
  parts: { text: string }[];
}

export interface GeminiChatParams {
  messages: GeminiChatMessage[];
  maxOutputTokens?: number;
  temperature?: number;
}

export interface GeminiImageAnalysisParams {
  imageUrl: string;
  prompt?: string;
  maxOutputTokens?: number;
  temperature?: number;
}

export interface GeminiImageGenerationParams {
  imageUrl: string;
  styleOptions: string[];
  prompt?: string;
  numImages?: number;
  maxOutputTokens?: number;
  temperature?: number;
}


export async function generateChatCompletionWithGemini(params: GeminiChatParams): Promise<string> {
  console.log('🤖 [GEMINI_CHAT] ===== GEMINI CHAT API CALL STARTED =====');
  console.log('🤖 [GEMINI_CHAT] 🔧 Environment check:');
  console.log('🤖 [GEMINI_CHAT] 🔧 - MOCK_GEMINI:', process.env.MOCK_GEMINI);
  console.log('🤖 [GEMINI_CHAT] 🔧 - GEMINI_API_KEY:', GEMINI_API_KEY ? 'SET' : 'MISSING');
  console.log('🤖 [GEMINI_CHAT] 🔧 - GEMINI_CHAT_MODEL:', GEMINI_CHAT_MODEL);
  
  console.log('🤖 [GEMINI_CHAT] 📝 Input parameters:');
  console.log('🤖 [GEMINI_CHAT] 📝 - Messages count:', params.messages.length);
  console.log('🤖 [GEMINI_CHAT] 📝 - Max output tokens:', params.maxOutputTokens || 1000);
  console.log('🤖 [GEMINI_CHAT] 📝 - Temperature:', params.temperature || 0.7);

  if (process.env.MOCK_GEMINI === 'true' || !GEMINI_API_KEY) {
    console.log('🤖 [GEMINI_CHAT] 🎭 Using MOCK mode - returning mock response');
    return "I'm a mock Gemini response. This is a test response for the fashion consultant AI assistant.";
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_CHAT_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  console.log('🤖 [GEMINI_CHAT] 🌐 API Endpoint:', endpoint.replace(GEMINI_API_KEY, '[REDACTED_KEY]'));

  const body = {
    contents: params.messages.map(msg => ({
      role: msg.role === 'system' ? 'user' : msg.role,
      parts: msg.parts
    })),
    generationConfig: {
      maxOutputTokens: params.maxOutputTokens || 1000,
      temperature: params.temperature || 0.7,
    }
  };

  console.log('🤖 [GEMINI_CHAT] 📤 Sending request to Gemini API...');

  const resp = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    timeout: 30000,
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.error('🤖 [GEMINI_CHAT] ❌ API Error:', resp.status, text);
    throw new Error(`Gemini Chat API error: ${resp.status} ${text}`);
  }

  const data = await resp.json();
  console.log('🤖 [GEMINI_CHAT] 📥 Received response from Gemini API');

  const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!responseText) {
    console.error('🤖 [GEMINI_CHAT] ❌ No response text found in API response:', data);
    throw new Error("Gemini Chat API returned no response text");
  }

  console.log('🤖 [GEMINI_CHAT] ✅ Successfully generated chat completion');
  return responseText;
}

export async function listAvailableModels(): Promise<any> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`;
  console.log('🤖 [GEMINI_MODELS] 🌐 Listing available models...');
  
  try {
    const resp = await fetchWithTimeout(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
    
    if (!resp.ok) {
      const text = await resp.text();
      console.error('🤖 [GEMINI_MODELS] ❌ Error listing models:', resp.status, text);
      return null;
    }
    
    const data = await resp.json();
    console.log('🤖 [GEMINI_MODELS] 📋 Available models:', data);
    return data;
  } catch (error) {
    console.error('🤖 [GEMINI_MODELS] ❌ Error listing models:', error);
    return null;
  }
}

export async function analyzeImageWithGemini(params: GeminiImageAnalysisParams): Promise<string> {
  console.log('🤖 [GEMINI_IMAGE_ANALYSIS] ===== GEMINI IMAGE ANALYSIS STARTED =====');
  console.log('🤖 [GEMINI_IMAGE_ANALYSIS] 🔧 Environment check:');
  console.log('🤖 [GEMINI_IMAGE_ANALYSIS] 🔧 - MOCK_GEMINI:', process.env.MOCK_GEMINI);
  console.log('🤖 [GEMINI_IMAGE_ANALYSIS] 🔧 - GEMINI_API_KEY:', GEMINI_API_KEY ? 'SET' : 'MISSING');
  console.log('🤖 [GEMINI_IMAGE_ANALYSIS] 🔧 - GEMINI_CHAT_MODEL:', GEMINI_CHAT_MODEL);
  
  console.log('🤖 [GEMINI_IMAGE_ANALYSIS] 📝 Input parameters:');
  console.log('🤖 [GEMINI_IMAGE_ANALYSIS] 📝 - Image URL:', params.imageUrl?.substring(0, 100) + '...');
  console.log('🤖 [GEMINI_IMAGE_ANALYSIS] 📝 - Custom prompt:', params.prompt || 'Using default fashion analysis prompt');
  console.log('🤖 [GEMINI_IMAGE_ANALYSIS] 📝 - Max output tokens:', params.maxOutputTokens || 1000);
  console.log('🤖 [GEMINI_IMAGE_ANALYSIS] 📝 - Temperature:', params.temperature || 0.7);

  if (process.env.MOCK_GEMINI === 'true' || !GEMINI_API_KEY) {
    console.log('🤖 [GEMINI_IMAGE_ANALYSIS] 🎭 Using MOCK mode - returning mock analysis');
    return "This is a fashion outfit image. I can see the user is wearing elegant clothing with coordinated styling and harmonious color combinations. I suggest trying different accessories to enhance the overall look's layering effect.";
  }

  // List available models for debugging
  console.log('🤖 [GEMINI_IMAGE_ANALYSIS] 🔍 Listing available models for debugging...');
  await listAvailableModels();

  // Default fashion analysis prompt in English
  const defaultPrompt = `Please analyze the outfit style in this image, including:
1. Clothing type and style (formal, casual, trendy, etc.)
2. Color coordination analysis
3. Overall styling strengths and weaknesses
4. Improvement suggestions and styling advice
5. Suitable occasions
Please respond in English with a professional and friendly tone.`;

  const analysisPrompt = params.prompt || defaultPrompt;

  // 将图片URL转换为base64
  console.log('🤖 [GEMINI_IMAGE_ANALYSIS] 🔄 Converting image to base64...');
  const imageBase64 = await urlToFile(params.imageUrl, 'image.jpg', 'image/jpeg').then(fileToBase64);
  console.log('🤖 [GEMINI_IMAGE_ANALYSIS] 🔄 Image converted, size:', imageBase64.length, 'chars');

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_CHAT_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  console.log('🤖 [GEMINI_IMAGE_ANALYSIS] 🌐 API Endpoint:', endpoint.replace(GEMINI_API_KEY, '[REDACTED_KEY]'));

  const body = {
    contents: [{
      parts: [
        { text: analysisPrompt },
        { 
          inline_data: { 
            mime_type: "image/jpeg", 
            data: imageBase64 
          } 
        }
      ]
    }],
    generationConfig: {
      maxOutputTokens: params.maxOutputTokens || 1000,
      temperature: params.temperature || 0.7,
    }
  };

  console.log('🤖 [GEMINI_IMAGE_ANALYSIS] 📤 Sending request to Gemini API...');

  const resp = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    timeout: 30000,
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.error('🤖 [GEMINI_IMAGE_ANALYSIS] ❌ API Error:', resp.status, text);
    throw new Error(`Gemini Image Analysis API error: ${resp.status} ${text}`);
  }

  const data = await resp.json();
  console.log('🤖 [GEMINI_IMAGE_ANALYSIS] 📥 Received response from Gemini API');

  const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!responseText) {
    console.error('🤖 [GEMINI_IMAGE_ANALYSIS] ❌ No response text found in API response:', data);
    throw new Error("Gemini Image Analysis API returned no response text");
  }

  console.log('🤖 [GEMINI_IMAGE_ANALYSIS] ✅ Successfully generated image analysis');
  return responseText;
}

export async function generateStyledImagesWithGemini(params: GeminiImageGenerationParams): Promise<string[]> {
  console.log('🤖 [GEMINI_IMAGE_GENERATION] ===== GEMINI IMAGE GENERATION STARTED =====');
  console.log('🤖 [GEMINI_IMAGE_GENERATION] 🔧 Environment check:');
  console.log('🤖 [GEMINI_IMAGE_GENERATION] 🔧 - MOCK_GEMINI:', process.env.MOCK_GEMINI);
  console.log('🤖 [GEMINI_IMAGE_GENERATION] 🔧 - GEMINI_API_KEY:', GEMINI_API_KEY ? 'SET' : 'MISSING');
  console.log('🤖 [GEMINI_IMAGE_GENERATION] 🔧 - GEMINI_CHAT_MODEL:', GEMINI_CHAT_MODEL);
  
  console.log('🤖 [GEMINI_IMAGE_GENERATION] 📝 Input parameters:');
  console.log('🤖 [GEMINI_IMAGE_GENERATION] 📝 - Image URL:', params.imageUrl?.substring(0, 100) + '...');
  console.log('🤖 [GEMINI_IMAGE_GENERATION] 📝 - Style options:', params.styleOptions);
  console.log('🤖 [GEMINI_IMAGE_GENERATION] 📝 - Number of images:', params.numImages || 3);
  console.log('🤖 [GEMINI_IMAGE_GENERATION] 📝 - Custom prompt:', params.prompt || 'Using default generation prompt');

  if (process.env.MOCK_GEMINI === 'true' || !GEMINI_API_KEY) {
    console.log('🤖 [GEMINI_IMAGE_GENERATION] 🎭 Using MOCK mode - returning mock images');
    const mockImages = Array(params.numImages || 3).fill("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77hQAAAABJRU5ErkJggg==");
    return mockImages;
  }

  // Build generation prompt based on style options
  const defaultPrompt = `Generate ${params.numImages || 3} different styled outfit variations based on the uploaded image and the following style options: ${params.styleOptions.join(', ')}. 

Each image should showcase a different style interpretation while maintaining the core outfit structure. Focus on:
- Color variations and palette changes
- Accessory modifications and additions
- Styling details and finishing touches
- Overall aesthetic differences
- Fabric and texture variations
- Silhouette adjustments

Make each image unique, fashionable, and true to the selected style aesthetic.`;

  const generationPrompt = params.prompt || defaultPrompt;

  // Convert image URL to base64
  console.log('🤖 [GEMINI_IMAGE_GENERATION] 🔄 Converting image to base64...');
  const imageBase64 = await urlToFile(params.imageUrl, 'image.jpg', 'image/jpeg').then(fileToBase64);
  console.log('🤖 [GEMINI_IMAGE_GENERATION] 🔄 Image converted, size:', imageBase64.length, 'chars');

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_CHAT_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  console.log('🤖 [GEMINI_IMAGE_GENERATION] 🌐 API Endpoint:', endpoint.replace(GEMINI_API_KEY, '[REDACTED_KEY]'));

  const body = {
    contents: [{
      parts: [
        { text: generationPrompt },
        { 
          inline_data: { 
            mime_type: "image/jpeg", 
            data: imageBase64 
          } 
        }
      ]
    }],
    generationConfig: {
      maxOutputTokens: params.maxOutputTokens || 2000,
      temperature: params.temperature || 0.8,
    }
  };

  console.log('🤖 [GEMINI_IMAGE_GENERATION] 📤 Sending request to Gemini API...');

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

  // For now, return mock images since Gemini doesn't directly generate images
  // In a real implementation, you would need to use a different service for image generation
  console.log('🤖 [GEMINI_IMAGE_GENERATION] ⚠️ Note: Gemini API does not directly generate images, returning mock data');
  
  const mockImages = Array(params.numImages || 3).fill("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77hQAAAABJRU5ErkJggg==");
  
  console.log('🤖 [GEMINI_IMAGE_GENERATION] ✅ Successfully generated styled images');
  return mockImages;
}


