import OpenAI from "openai";
import * as jwt from "jsonwebtoken";
import { put } from "@vercel/blob";
import { kv } from "@vercel/kv";
import { type OnboardingData } from "@/lib/onboarding-storage";
import { systemPrompt } from "./prompts";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

const PROMPT_APPENDIX = `#图片格式
9:16，竖版，全身照，街拍质感`;

// `# Image Generation Information
// Image Format

// 9:16 Vertical Composition
// Two-thirds or full-body, model standing naturally or slightly sideways, with clear body proportions;
// Natural small movements (e.g., one hand in pocket/holding a bag), but the body outline must be clearly discernible;
// Street photography texture, suitable for outfit display.

// Lens Suggestions
// The lens should be two-thirds to full-body, avoiding too far or too close to prevent loss of outfit details;
// The model's posture should avoid covering key areas of the outfit (such as waistline, pants shape, neckline);
// Posture suggestions: natural standing, slightly sideways, hand in pocket or lightly holding a bag strap;
// Recommended angle: front with a slight side, lens slightly tilted down to highlight the upper garment structure;
// Keep the clothing naturally draped, avoiding exaggerated movements that affect fabric texture presentation.

// Lighting Suggestions
// Natural light or outdoor soft light, emphasizing real texture and color;
// Avoid strong backlight, silhouette, and other effects that obscure the outfit.

// Background and Scene
// The background should match the occasion, have a sense of life but not steal the focus, and it is recommended to include some still life elements (such as green plants, chairs, fallen leaves, etc.) to enhance the atmosphere.
// `;

// Initialize the OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Zod schema for structured output, matching the format in lib/prompts.ts
const itemDetailSchema = z.object({
  item_name: z.string().describe('The name of the clothing item or accessory.'),
  style_details: z.string().describe('The style details of the clothing item or accessory.'),
  wearing_details: z.string().describe('The wearing details of the clothing item or accessory.'),
  effect_description: z.string().optional().describe('The effect description of the clothing item or accessory.'),
});

const hairstyleSchema = z.object({
  style_name: z.string().describe("The name of the hairstyle."),
  description: z.string().describe("A brief description of the hairstyle and why it complements the outfit.")
});

const outfitItemsSchema = z.object({
  tops: z.array(itemDetailSchema).describe("An array of top items, which can include layers."),
  bottoms: itemDetailSchema.describe("The bottom item."),
  shoes: itemDetailSchema.describe("The shoes."),
  bag: itemDetailSchema.describe("The bag or purse."),
  accessories: z.array(itemDetailSchema).describe("An array of accessories like jewelry, hats, etc."),
  layering_description: z.string().optional().describe("A description of layering relationships, including the order of wearing, the details of exposure, and the role of layers in style, atmosphere, or structural shaping."),
  hairstyle: hairstyleSchema.describe("The suggested hairstyle."),
});

const outfitSuggestionSchema = z.object({
  outfit_title: z.string().describe("A short, catchy title for the outfit."),
  items: outfitItemsSchema,
  explanation: z.string().describe("A detailed explanation of why this outfit works for the user, providing styling tips and emotional value."),
});

const styleSuggestionsSchema = z.object({
  outfit_suggestion: outfitSuggestionSchema.describe("A single complete outfit suggestion."),
  image_prompt: z.string().describe("A creative, English-only prompt for AI image generator to create visual representation of the 视觉化穿搭建议的背景与场景，图片的气质描述 based on user profile and target scene."),
});

// Convert Zod schema to JSON schema for the tool
// By not providing a name, we get a more direct schema without the top-level $ref, which is what OpenAI expects.
const styleSuggestionsJsonSchema = zodToJsonSchema(styleSuggestionsSchema);

interface StyleSuggestionInput {
  humanImageUrl: string;
  garmentImageUrl: string;
  occasion: string;
  userProfile?: OnboardingData; // optional but encouraged for better personalization
}

export async function getStyleSuggestionFromAI({
  humanImageUrl,
  garmentImageUrl,
  occasion,
  userProfile,
}: StyleSuggestionInput): Promise<any> {
  if (!humanImageUrl || !garmentImageUrl || !occasion) {
    throw new Error("Missing required inputs for style suggestion.");
  }

  // do not change userProfile, only update the log, do not need to log the fullbodyphoto in userProfile
  const userProfileForLog = { ...userProfile };
  if (userProfileForLog?.fullBodyPhoto) {
    userProfileForLog.fullBodyPhoto = '***';
  }

  console.log("[AI DEBUG] Received userProfile for suggestion:", JSON.stringify(userProfileForLog, null, 2));

  try {
    // Fetch images and convert to base64 data URLs in parallel
    // This makes the process more robust by avoiding OpenAI timeout issues when fetching from our blob storage.
    const [humanImageResponse, garmentImageResponse] = await Promise.all([
      fetch(humanImageUrl),
      fetch(garmentImageUrl)
    ]);

    if (!humanImageResponse.ok || !garmentImageResponse.ok) {
      throw new Error('Failed to download one of the images for AI suggestion.');
    }

    const [humanImageBlob, garmentImageBlob] = await Promise.all([
      humanImageResponse.blob(),
      garmentImageResponse.blob()
    ]);

    const [humanImageBuffer, garmentImageBuffer] = await Promise.all([
      humanImageBlob.arrayBuffer(),
      garmentImageBlob.arrayBuffer()
    ]);

    const humanImageBase64 = `data:${humanImageBlob.type};base64,${Buffer.from(humanImageBuffer).toString('base64')}`;
    const garmentImageBase64 = `data:${garmentImageBlob.type};base64,${Buffer.from(garmentImageBuffer).toString('base64')}`;

    // Build the user prompt following the structured format defined in systemPrompt.
    const userProfileSection = userProfile
      ? `# User Profile\n\`\`\`json\n${JSON.stringify(userProfile, null, 2)}\n\`\`\``
      : "";

    const userMessageText = `Please provide styling suggestions based on the following information. My photo is the first image, and the garment is the second.\n\n${userProfileSection}\n\n# Essential Item\nThe garment in the second attached image is the "Essential Item".\n\n# Occasion\n${occasion}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: userMessageText,
            },
            {
              type: "image_url",
              image_url: {
                url: humanImageBase64,
              },
            },
            {
              type: "image_url",
              image_url: {
                url: garmentImageBase64,
              },
            },
          ],
        },
      ],
      max_tokens: 4000,
      tools: [
        {
          type: "function",
          function: {
            name: "get_style_suggestions",
            description: "Get one complete outfit suggestions in a structured JSON format.",
            parameters: styleSuggestionsJsonSchema,
          },
        },
      ],
      tool_choice: {
        type: "function",
        function: { name: "get_style_suggestions" },
      },
    });

    const message = response.choices[0].message;

    if (!message.tool_calls || message.tool_calls.length === 0) {
      console.error("[AI DEBUG] OpenAI response did not include a tool call. Finish reason:", response.choices[0].finish_reason);
      throw new Error(`AI did not return a structured suggestion. Finish reason: ${response.choices[0].finish_reason}`);
    }

    const toolCall = message.tool_calls[0];

    if (toolCall.function.name !== 'get_style_suggestions') {
      console.error(`[AI DEBUG] Unexpected tool call: ${toolCall.function.name}`);
      throw new Error(`AI returned an unexpected tool: ${toolCall.function.name}`);
    }

    const suggestion = JSON.parse(toolCall.function.arguments);
    return suggestion;

  } catch (error) {
    console.error("Error getting style suggestion from OpenAI:", error);
    // Re-throw the error to be handled by the caller
    throw error;
  }
}

// --- Helper Functions ---

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithTimeout(
  resource: RequestInfo,
  options: RequestInit & { timeout: number },
): Promise<Response> {
  const { timeout } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  const response = await fetch(resource, {
    ...options,
    signal: controller.signal,
  });
  clearTimeout(id);
  return response;
}

// File API polyfill utility
function createFilePolyfill(blob: Blob, filename: string, options?: FilePropertyBag): File {
  // Check if native File constructor exists and works
  if (typeof File !== 'undefined') {
    try {
      return new File([blob], filename, options);
    } catch (error) {
      console.warn('Native File constructor failed, using polyfill:', error);
    }
  }

  // Polyfill: Create a Blob with File-like properties
  const fileBlob = new Blob([blob], { type: options?.type || blob.type });

  // Add File-specific properties
  Object.defineProperty(fileBlob, 'name', {
    value: filename,
    writable: false,
    configurable: false
  });

  Object.defineProperty(fileBlob, 'lastModified', {
    value: options?.lastModified || Date.now(),
    writable: false,
    configurable: false
  });

  Object.defineProperty(fileBlob, 'webkitRelativePath', {
    value: '',
    writable: false,
    configurable: false
  });

  return fileBlob as File;
}

// Utility to check if we're in a browser environment
function isBrowserEnvironment(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

// Helper function to create a data URL to File converter that works cross-environment
function dataURLtoFile(dataUrl: string, filename: string): File | null {
  if (!dataUrl) {
    return null;
  }

  try {
    const arr = dataUrl.split(',');
    if (arr.length < 2) return null;

    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) return null;

    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);

    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }

    const blob = new Blob([u8arr], { type: mime });
    return createFilePolyfill(blob, filename, { type: mime });
  } catch (error) {
    console.error('Failed to convert data URL to file:', error);
    return null;
  }
}

// Helper function to convert a File to a Base64 string
const fileToBase64 = async (file: File): Promise<string> => {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  return buffer.toString("base64");
};

// --- Kling AI ---
const KLING_ACCESS_KEY = process.env.KLING_AI_ACCESS_KEY;
const KLING_SECRET_KEY = process.env.KLING_AI_SECRET_KEY;
// const KLING_API_BASE_URL = "https://api-beijing.klingai.com";
const KLING_API_BASE_URL = "https://api-singapore.klingai.com";

// Paths for Virtual Try-on
const KOLORS_VIRTUAL_TRYON_SUBMIT_PATH = "/v1/images/kolors-virtual-try-on";
const KOLORS_VIRTUAL_TRYON_STATUS_PATH = "/v1/images/kolors-virtual-try-on/";
// Paths for Image Stylization - CORRECTED
const KOLORS_STYLIZE_SUBMIT_PATH = "/v1/images/generations";
const KOLORS_STYLIZE_STATUS_PATH = "/v1/images/generations/";

const getApiToken = (accessKey: string, secretKey: string): string => {
  const payload = {
    iss: accessKey,
    exp: Math.floor(Date.now() / 1000) + 1800,
    nbf: Math.floor(Date.now() / 1000) - 5,
  };
  return jwt.sign(payload, secretKey, {
    algorithm: "HS256",
    header: { alg: "HS256", typ: "JWT" },
  });
};

// This function is now more generic for building stylization request bodies
const buildStylizeRequestBody = (
  modelVersion: string,
  prompt: string,
  humanImageBase64: string
): object => {
  const baseBody = {
    prompt: prompt,
    aspect_ratio: "3:4",
    image: humanImageBase64,
  };
  console.log("Building stylize request for model:", modelVersion);
  console.log("!!! send final prompt:", prompt);

  switch (modelVersion) {
    case 'kling-v1-5':
      return {
        ...baseBody,
        image_reference: "face",
        human_fidelity: 1,
        n: 1,// number of images to generate
        model_name: "kling-v1-5",
      };
    case 'kling-v2':
      return {
        ...baseBody,
        model_name: "kling-v2",
      };
    default:
      console.warn(`Unknown modelVersion '${modelVersion}', defaulting to kling-v2.`);
      return {
        ...baseBody,
        model_name: "kling-v2",
      };
  }
};

// More robust, reusable polling function
async function executeKlingTask(submitPath: string, queryPathPrefix: string, requestBody: object): Promise<string[]> {
  if (!KLING_ACCESS_KEY || !KLING_SECRET_KEY) {
    throw new Error("Kling AI API keys are not configured.");
  }
  const apiToken = getApiToken(KLING_ACCESS_KEY, KLING_SECRET_KEY);
  let taskId = '';

  const maxSubmitRetries = 3;
  for (let attempt = 0; attempt < maxSubmitRetries; attempt++) {
    try {
      console.log(`[Kling] Submit attempt ${attempt + 1}/${maxSubmitRetries}...`);
      // 1. Submit the task
      const submitResponse = await fetchWithTimeout(`${KLING_API_BASE_URL}${submitPath}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        timeout: 180000, // Increased to 3 minutes for submit
      });

      if (!submitResponse.ok) {
        const errorBody = await submitResponse.text();
        throw new Error(`Kling API Error on submit to ${submitPath}: ${submitResponse.status} ${errorBody}`);
      }

      const submitResult = await submitResponse.json();
      taskId = submitResult.data.task_id;
      console.log(`Kling task submitted to ${submitPath}. Task ID: ${taskId}`);
      break; // Success, exit retry loop
    } catch (error) {
      console.error(`[Kling] Submit attempt ${attempt + 1} failed:`, error);
      if (attempt === maxSubmitRetries - 1) {
        throw new Error(`Failed to submit Kling task after ${maxSubmitRetries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      const waitTime = Math.pow(2, attempt) * 2000; // 2s, 4s
      console.log(`[Kling] Waiting ${waitTime}ms before next submit attempt...`);
      await sleep(waitTime);
    }
  }

  // 2. Poll for the result
  let attempts = 0;
  const maxAttempts = 60; // Increased max attempts
  let finalImageUrls: string[] = [];

  while (attempts < maxAttempts) {
    await sleep(5000); // Increased to 5-second interval
    attempts++;
    console.log(`Polling attempt #${attempts} for task: ${taskId} (max ${maxAttempts})`);

    const pollingToken = getApiToken(KLING_ACCESS_KEY, KLING_SECRET_KEY);

    try {
      const statusCheckResponse = await fetchWithTimeout(`${KLING_API_BASE_URL}${queryPathPrefix}${taskId}`, {
        headers: { 'Authorization': `Bearer ${pollingToken}` },
        timeout: 120000, // Increased to 2 minutes for status check
      });

      if (!statusCheckResponse.ok) {
        console.warn(`Kling polling failed on attempt ${attempts} with status ${statusCheckResponse.status}, continuing...`);
        continue;
      }

      const statusResult = await statusCheckResponse.json();
      const taskData = statusResult.data;

      if (taskData.task_status === "succeed") {
        console.log("Kling task succeeded. Full response:", JSON.stringify(statusResult, null, 2));

        // Handle multiple images from the response
        if (taskData.task_result?.images?.length > 0) {
          finalImageUrls = taskData.task_result.images.map((img: any) => img.url);
          console.log(`Task ${taskId} succeeded! Found ${finalImageUrls.length} images:`, finalImageUrls);
        } else if (taskData.task_result?.url) {
          // Fallback for single image response
          finalImageUrls = [taskData.task_result.url];
          console.log(`Task ${taskId} succeeded! Single image URL:`, finalImageUrls[0]);
        } else {
          throw new Error("Task succeeded, but the response structure for the image URL is unexpected.");
        }

        console.log(`Task ${taskId} succeeded! Total images: ${finalImageUrls.length}`);
        break;
      } else if (taskData.task_status === "failed") {
        throw new Error(`Kling task failed. Reason: ${taskData.task_status_msg || 'Unknown'}`);
      }
    } catch (pollError) {
      console.warn(`Polling attempt ${attempts} encountered error:`, pollError);
      // Continue to next attempt unless it's the last one
      if (attempts >= maxAttempts) {
        throw pollError;
      }
    }
  }

  if (finalImageUrls.length === 0) {
    throw new Error(`Kling task ${taskId} timed out after ${maxAttempts} attempts (${maxAttempts * 5} seconds).`);
  }

  return finalImageUrls;
}

// --- Face Swap ---
const FACE_SWAP_API_URL = "https://ai-face-swap2.p.rapidapi.com/public/process/files";
const FACE_SWAP_API_HOST = "ai-face-swap2.p.rapidapi.com";

async function runFaceSwap(sourceFile: File, targetFile: File, retries: number = 2): Promise<string> {
  const rapidApiKey = process.env.RAPIDAPI_KEY;
  if (!rapidApiKey) {
    throw new Error("RAPIDAPI_KEY is not set.");
  }

  const formData = new FormData();
  formData.append("source", sourceFile);
  formData.append("target", targetFile);

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      console.log(`Face swap attempt ${attempt + 1}/${retries + 1}...`);

      const response = await fetchWithTimeout(FACE_SWAP_API_URL, {
        method: "POST",
        headers: {
          accept: "application/json",
          "x-rapidapi-host": FACE_SWAP_API_HOST,
          "x-rapidapi-key": rapidApiKey,
        },
        body: formData,
        timeout: 180000, // Increased to 3 minutes
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Face swap API request failed: ${response.status} ${errorBody}`);
      }

      const result = await response.json();
      const swappedImageUrl = result.file_url;

      if (!swappedImageUrl) {
        throw new Error("Face swap API did not return a valid 'file_url'.");
      }

      console.log(`Face swap successful on attempt ${attempt + 1}`);
      return swappedImageUrl;

    } catch (error) {
      console.error(`Face swap attempt ${attempt + 1} failed:`, error);

      if (attempt === retries) {
        // Last attempt failed, throw the error
        throw new Error(`Face swap failed after ${retries + 1} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Wait before retrying (exponential backoff)
      const waitTime = Math.pow(2, attempt) * 5000; // 5s, 10s, 20s...
      console.log(`Waiting ${waitTime}ms before retry...`);
      await sleep(waitTime);
    }
  }

  throw new Error("Face swap failed: Maximum retries exceeded");
}


// --- Main Job Interface and Atomic Steps ---

// This interface needs to be in sync with the one in the status route and the frontend
export type GenerationMode = "tryon-only" | "simple-scene" | "advanced-scene";

export interface Job {
  jobId: string;
  humanImage: { url: string; type: string; name: string };
  garmentImage: { url: string; type: string; name: string };
  generationMode: GenerationMode;
  occasion: string;
  status: string;
  statusMessage: string;
  createdAt: string;
  updatedAt: string;
  userProfile?: any; // User profile data
  customPrompt?: string; // Custom prompt for stylization
  suggestion?: {
    outfit_suggestion: any; // Single outfit suggestion
    image_prompt: string; // Single image prompt
    [key: string]: any;
  };
  processImages?: {
    styledImages?: string[];  // Changed to array
    styledImage?: string;     // Keep for backward compatibility
    tryOnImages?: string[];   // Changed to array
    tryOnImage?: string;      // Keep for backward compatibility
  };
  result?: {
    imageUrls?: string[];     // Added array version
    imageUrl?: string;        // Keep for backward compatibility
    totalImages?: number;     // Added count
  };
  error?: string;
  [key: string]: any; // Index signature for Vercel KV compatibility
}

/**
 * ATOMIC STEP: Generates a stylized base image using a specific model.
 * Returns multiple images.
 */
async function runStylizationMultiple(modelVersion: 'kling-v1-5' | 'kling-v2', suggestion: Job['suggestion'], humanImageUrl: string, humanImageName: string, humanImageType: string, job?: Job): Promise<string[]> {
  console.log(`[ATOMIC_STEP] Running Stylization with ${modelVersion}...`);
  console.log(`[ATOMIC_STEP] Received job parameter:`, !!job);
  console.log(`[ATOMIC_STEP] Job customPrompt:`, job?.customPrompt);
  console.log(`[ATOMIC_STEP] Job customPrompt type:`, typeof job?.customPrompt);
  console.log(`[ATOMIC_STEP] Job customPrompt length:`, job?.customPrompt?.length || 0);

  let finalPrompt: string;

  // Check if custom prompt is provided and prioritize it
  if (job?.customPrompt && job.customPrompt.trim()) {
    finalPrompt = job.customPrompt.trim();
    console.log(`[ATOMIC_STEP] Using custom prompt: ${finalPrompt}`);
  } else {
    // Use default prompt construction logic
    console.log(`[ATOMIC_STEP] No custom prompt found, using default logic`);
    if (!suggestion?.image_prompt) {
      throw new Error("Cannot generate styled image without a 'prompt'.");
    }
    const outfitSuggestionString = suggestion.outfit_suggestion ? JSON.stringify(suggestion.outfit_suggestion) : '';
    finalPrompt = suggestion.image_prompt + ' ' + outfitSuggestionString + PROMPT_APPENDIX;
    console.log(`[ATOMIC_STEP] Using generated prompt: ${finalPrompt.substring(0, 200)}...`);
  }

  // Check prompt length to prevent API errors
  if (finalPrompt.length > 2500) {
    console.warn(`[ATOMIC_STEP] Prompt too long (${finalPrompt.length} chars), truncating to 2500 chars`);
    finalPrompt = finalPrompt.substring(0, 2500);
  }

  // print the final prompt
  console.log(`!!![ATOMIC_STEP] Final prompt: ${finalPrompt}`);

  const humanImageFile = await urlToFile(humanImageUrl, humanImageName, humanImageType);
  const humanImageBase64 = await fileToBase64(humanImageFile);

  const stylizeRequestBody = buildStylizeRequestBody(modelVersion, finalPrompt, humanImageBase64);
  const styledImageUrls = await executeKlingTask(KOLORS_STYLIZE_SUBMIT_PATH, KOLORS_STYLIZE_STATUS_PATH, stylizeRequestBody);

  console.log(`[ATOMIC_STEP] Stylization with ${modelVersion} complete: ${styledImageUrls.length} images generated`);
  styledImageUrls.forEach((url, index) => {
    console.log(`[ATOMIC_STEP] Image ${index + 1} URL:`, url.substring(0, 100));
  });

  return styledImageUrls;
}

/**
 * ATOMIC STEP: Generates stylized images for multiple prompts in parallel.
 * Returns an array of image arrays, where each sub-array contains images for one prompt.
 */
async function runStylizationParallel(
  modelVersion: 'kling-v1-5' | 'kling-v2',
  prompts: string[],
  humanImageUrl: string,
  humanImageName: string,
  humanImageType: string,
  job?: Job
): Promise<string[][]> {
  console.log(`[ATOMIC_STEP] Running Parallel Stylization with ${modelVersion} for ${prompts.length} prompts...`);

  // Execute all prompts in parallel
  const allPromises = prompts.map((prompt, index) => {
    console.log(`[PARALLEL] Starting stylization ${index + 1}/${prompts.length} for prompt: ${prompt.substring(0, 50)}...`);
    const suggestion: Job['suggestion'] = { image_prompt: prompt, outfit_suggestion: '' };
    return runStylizationMultiple(modelVersion, suggestion, humanImageUrl, humanImageName, humanImageType, job);
  });

  const results = await Promise.all(allPromises);

  console.log(`[ATOMIC_STEP] Parallel Stylization complete: Generated ${results.length} groups with total ${results.flat().length} images`);
  results.forEach((group, index) => {
    console.log(`[ATOMIC_STEP] Group ${index + 1}: ${group.length} images`);
  });

  return results;
}

/**
 * ATOMIC STEP: Generates stylized base image using a specific model.
 * Legacy version that returns only the first image for backward compatibility.
 */
async function runStylization(modelVersion: 'kling-v1-5' | 'kling-v2', prompt: string, humanImageUrl: string, humanImageName: string, humanImageType: string, job?: Job): Promise<string> {
  const suggestion: Job['suggestion'] = { image_prompt: prompt, outfit_suggestion: '' };
  const styledImageUrls = await runStylizationMultiple(modelVersion, suggestion, humanImageUrl, humanImageName, humanImageType, job);
  return styledImageUrls[0];
}

/**
 * ATOMIC STEP: Performs virtual try-on.
 * Returns multiple images.
 * @param canvasImageUrl The URL of the image to apply the clothing to.
 * @param garmentImageUrl The URL of the clothing item.
 */
async function runVirtualTryOnMultiple(canvasImageUrl: string, garmentImageUrl: string, garmentImageName: string, garmentImageType: string): Promise<string[]> {
  console.log("[ATOMIC_STEP] Running Virtual Try-On...");

  // Convert canvas image and garment to files/base64 in parallel
  const [canvasImageBase64, garmentImageBase64] = await Promise.all([
    urlToFile(canvasImageUrl, "canvas.jpg", "image/jpeg").then(fileToBase64),
    urlToFile(garmentImageUrl, garmentImageName, garmentImageType).then(fileToBase64)
  ]);

  const tryOnRequestBody = {
    model_name: "kolors-virtual-try-on-v1-5",
    human_image: canvasImageBase64,
    cloth_image: garmentImageBase64,
    n: 1, // Generate 1 images
  };

  const tryOnImageUrls = await executeKlingTask(KOLORS_VIRTUAL_TRYON_SUBMIT_PATH, KOLORS_VIRTUAL_TRYON_STATUS_PATH, tryOnRequestBody);

  console.log(`[ATOMIC_STEP] Virtual Try-On complete: ${tryOnImageUrls.length} images generated`);
  tryOnImageUrls.forEach((url, index) => {
    console.log(`[ATOMIC_STEP] Try-on image ${index + 1} URL:`, url.substring(0, 100));
  });

  return tryOnImageUrls;
}

/**
 * ATOMIC STEP: Performs virtual try-on.
 * Legacy version that returns only the first image for backward compatibility.
 * @param canvasImageUrl The URL of the image to apply the clothing to.
 * @param garmentImageUrl The URL of the clothing item.
 */
async function runVirtualTryOn(canvasImageUrl: string, garmentImageUrl: string, garmentImageName: string, garmentImageType: string): Promise<string> {
  const tryOnImageUrls = await runVirtualTryOnMultiple(canvasImageUrl, garmentImageUrl, garmentImageName, garmentImageType);
  return tryOnImageUrls[0];
}

/**
 * ATOMIC STEP: Performs face swap.
 */
async function runAndPerformFaceSwap(humanImageUrl: string, humanImageName: string, humanImageType: string, tryOnImageUrl: string): Promise<string> {
  console.log("[ATOMIC_STEP] Running Face Swap...");

  // Convert images to files in parallel
  const [humanImageFile, tryOnImageFile] = await Promise.all([
    urlToFile(humanImageUrl, humanImageName, humanImageType),
    urlToFile(tryOnImageUrl, "tryon.jpg", "image/jpeg")
  ]);

  // Perform face swap
  const swappedHttpUrl = await runFaceSwap(humanImageFile, tryOnImageFile);
  console.log("[ATOMIC_STEP] Face Swap complete:", swappedHttpUrl.substring(0, 100));
  return swappedHttpUrl;
}

/**
 * FINALIZATION STEP: Saves the final image to blob storage.
 */
async function saveFinalImageToBlob(finalImageUrl: string, jobId: string): Promise<string> {
  console.log("[FINAL_STEP] Saving final image to blob storage...");
  const finalImageResponse = await fetch(finalImageUrl);
  if (!finalImageResponse.ok) {
    throw new Error(`Failed to fetch final image from URL: ${finalImageUrl}`);
  }
  const finalImageBlob = await finalImageResponse.blob();
  const finalImageName = `final-look-${jobId}.png`;

  const { url: finalSecureUrl } = await put(finalImageName, finalImageBlob, {
    access: 'public',
    addRandomSuffix: true,
  });

  console.log("[FINAL_STEP] Final image saved:", finalSecureUrl);
  return finalSecureUrl;
}


// --- Pipeline Orchestration Functions ---

/**
 * PIPELINE 1: Performs virtual try-on only.
 * Now returns multiple images.
 */
export async function executeTryOnOnlyPipeline(job: Job): Promise<string[]> {
  console.log(`[PIPELINE_START] Executing "Try-On Only" pipeline for job ${job.jobId}`);

  // Step 1: Virtual Try-On on the original human image
  // The 'canvas' is the user's original photo.
  const tryOnImageUrls = await runVirtualTryOnMultiple(
    job.humanImage.url,
    job.garmentImage.url,
    job.garmentImage.name,
    job.garmentImage.type
  );

  await kv.hset(job.jobId, {
    tryOnImages: tryOnImageUrls,
    tryOnImage: tryOnImageUrls[0] // Keep for backward compatibility
  });

  // Step 2: Save all results to blob storage
  const finalUrls: string[] = [];
  for (let i = 0; i < tryOnImageUrls.length; i++) {
    const finalUrl = await saveFinalImageToBlob(tryOnImageUrls[i], `${job.jobId}-${i + 1}`);
    finalUrls.push(finalUrl);
  }

  console.log(`[PIPELINE_END] "Try-On Only" pipeline finished for job ${job.jobId}. Generated ${finalUrls.length} images.`);
  return finalUrls;
}

/**
 * PIPELINE 2: Generates a simple scene with the user, with improved clothing fidelity.
 * Now returns multiple images.
 */
export async function executeSimpleScenePipeline(job: Job): Promise<string[]> {
  console.log(`[PIPELINE_START] Executing "Simple Scene" pipeline for job ${job.jobId}`);
  if (!job.suggestion?.image_prompt) {
    throw new Error("Cannot run simple scene pipeline without 'image_prompt'.");
  }

  if (!job.suggestion?.outfit_suggestion) {
    throw new Error("Cannot run simple scene pipeline without 'outfit_suggestion'.");
  }

  // Step 1: Stylize the image using the simpler, faster model to get a new scene and pose.
  const styledImageUrls = await runStylizationMultiple(
    'kling-v1-5',
    job.suggestion,
    job.humanImage.url,
    job.humanImage.name,
    job.humanImage.type,
    job
  );

  await kv.hset(job.jobId, {
    status: 'stylization_completed',
    statusMessage: '场景已生成，正在进行虚拟试穿...',
    processImages: {
      styledImages: styledImageUrls,
      styledImage: styledImageUrls[0] // Keep for backward compatibility
    }
  });

  // Step 2: Perform virtual try-on on each new scene to ensure high clothing fidelity.
  const allTryOnImageUrls: string[] = [];

  for (let i = 0; i < styledImageUrls.length; i++) {
    console.log(`[PIPELINE] Processing virtual try-on for styled image ${i + 1}/${styledImageUrls.length}`);
    const tryOnImageUrls = await runVirtualTryOnMultiple(
      styledImageUrls[i],
      job.garmentImage.url,
      job.garmentImage.name,
      job.garmentImage.type
    );
    allTryOnImageUrls.push(...tryOnImageUrls);
  }

  const existingProcessImages: any = await kv.hget(job.jobId, 'processImages') || {};

  await kv.hset(job.jobId, {
    processImages: {
      ...existingProcessImages,
      tryOnImages: allTryOnImageUrls,
      tryOnImage: allTryOnImageUrls[0] // Keep for backward compatibility
    }
  });

  // Step 3: Save all results to blob storage
  const finalUrls: string[] = [];
  for (let i = 0; i < allTryOnImageUrls.length; i++) {
    const finalUrl = await saveFinalImageToBlob(allTryOnImageUrls[i], `${job.jobId}-${i + 1}`);
    finalUrls.push(finalUrl);
  }

  console.log(`[PIPELINE_END] "Simple Scene" pipeline finished for job ${job.jobId}. Generated ${finalUrls.length} images.`);
  return finalUrls;
}

/**
 * PIPELINE 3: Performs the full advanced scene generation.
 * Now returns multiple images.
 */
export async function executeAdvancedScenePipeline(job: Job): Promise<string[]> {
  console.log(`[PIPELINE_START] Executing "Advanced Scene" pipeline for job ${job.jobId}`);
  if (!job.suggestion?.image_prompt) {
    throw new Error("Cannot run advanced scene pipeline without 'image_prompt'.");
  }
  if (!job.suggestion?.outfit_suggestion) {
    throw new Error("Cannot run advanced scene pipeline without 'outfit_suggestion'.");
  }
  // Step 1: Generate the stylized background/pose with the advanced model
  const styledImageUrls = await runStylizationMultiple(
    'kling-v2',
    job.suggestion,
    job.humanImage.url,
    job.humanImage.name,
    job.humanImage.type,
    job
  );

  await kv.hset(job.jobId, {
    status: 'stylization_completed',
    statusMessage: '场景已生成，正在进行虚拟试穿...',
    processImages: {
      styledImages: styledImageUrls,
      styledImage: styledImageUrls[0] // Keep for backward compatibility
    }
  });

  // Step 2: Perform virtual try-on using each newly stylized image as the canvas
  const allTryOnImageUrls: string[] = [];

  for (let i = 0; i < styledImageUrls.length; i++) {
    console.log(`[PIPELINE] Processing virtual try-on for styled image ${i + 1}/${styledImageUrls.length}`);
    const tryOnImageUrls = await runVirtualTryOnMultiple(
      styledImageUrls[i],
      job.garmentImage.url,
      job.garmentImage.name,
      job.garmentImage.type
    );
    allTryOnImageUrls.push(...tryOnImageUrls);
  }

  const existingProcessImages: any = await kv.hget(job.jobId, 'processImages') || {};

  await kv.hset(job.jobId, {
    processImages: {
      ...existingProcessImages,
      tryOnImages: allTryOnImageUrls,
      tryOnImage: allTryOnImageUrls[0] // Keep for backward compatibility
    }
  });

  // Step 3: Perform face swap on all try-on images to put the user's face back onto the generated body
  const allSwappedImageUrls: string[] = [];

  for (let i = 0; i < allTryOnImageUrls.length; i++) {
    console.log(`[PIPELINE] Processing face swap for try-on image ${i + 1}/${allTryOnImageUrls.length}`);
    const swappedImageUrl = await runAndPerformFaceSwap(
      job.humanImage.url,
      job.humanImage.name,
      job.humanImage.type,
      allTryOnImageUrls[i]
    );
    allSwappedImageUrls.push(swappedImageUrl);
  }

  // Step 4: Save all final, face-swapped images to blob storage
  const finalUrls: string[] = [];
  for (let i = 0; i < allSwappedImageUrls.length; i++) {
    const finalUrl = await saveFinalImageToBlob(allSwappedImageUrls[i], `${job.jobId}-${i + 1}`);
    finalUrls.push(finalUrl);
  }

  console.log(`[PIPELINE_END] "Advanced Scene" pipeline finished for job ${job.jobId}. Generated ${finalUrls.length} images.`);
  return finalUrls;
}

/**
 * PIPELINE V2: Enhanced Simple Scene with parallel generation for single outfit.
 * Generates multiple variations of the same outfit suggestion.
 */
export async function executeSimpleScenePipelineV2(job: Job): Promise<string[]> {
  console.log(`[PIPELINE_START] Executing "Simple Scene V2" pipeline for job ${job.jobId}`);
  if (!job.suggestion?.image_prompt) {
    throw new Error("Cannot run simple scene pipeline V2 without 'image_prompt'.");
  }
  if (!job.suggestion?.outfit_suggestion) {
    throw new Error("Cannot run simple scene pipeline V2 without 'outfit_suggestion'.");
  }

  // Step 1: Generate multiple styled images from the same prompt
  const styledImageUrls = await runStylizationMultiple(
    'kling-v1-5',
    job.suggestion,
    job.humanImage.url,
    job.humanImage.name,
    job.humanImage.type,
    job
  );

  // Update job with intermediate results
  await kv.hset(job.jobId, {
    status: 'stylization_completed',
    statusMessage: 'Scenes generated, proceeding with virtual try-on...',
    processImages: {
      styledImages: styledImageUrls,
      styledImage: styledImageUrls[0] // Keep for backward compatibility
    }
  });

  // Step 2: Parallel virtual try-on for all styled images
  const allTryOnPromises = styledImageUrls.map((styledImage, index) => {
    console.log(`[PIPELINE] Processing virtual try-on for styled image ${index + 1}/${styledImageUrls.length}`);
    return runVirtualTryOnMultiple(
      styledImage,
      job.garmentImage.url,
      job.garmentImage.name,
      job.garmentImage.type
    );
  });

  const allTryOnGroups = await Promise.all(allTryOnPromises);
  const allTryOnImages = allTryOnGroups.flat();

  const existingProcessImages: any = await kv.hget(job.jobId, 'processImages') || {};

  await kv.hset(job.jobId, {
    processImages: {
      ...existingProcessImages,
      tryOnImages: allTryOnImages,
      tryOnImage: allTryOnImages[0] // Keep for backward compatibility
    }
  });

  // Step 3: Save all final images to blob storage
  const finalImages: string[] = [];
  for (let i = 0; i < allTryOnImages.length; i++) {
    const finalUrl = await saveFinalImageToBlob(
      allTryOnImages[i],
      `${job.jobId}-${i + 1}`
    );
    finalImages.push(finalUrl);
  }

  console.log(`[PIPELINE_END] "Simple Scene V2" pipeline finished for job ${job.jobId}. Generated ${finalImages.length} images.`);
  return finalImages;
}

// Helper to convert a URL to a File object
async function urlToFile(url: string, filename: string, mimeType: string): Promise<File> {
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`Converting URL to file (attempt ${attempt + 1}/${maxRetries}): ${url.substring(0, 100)}...`);

      const response = await fetchWithTimeout(url, {
        timeout: 120000 // 2 minutes timeout for file downloads
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.blob();

      // Use our polyfill utility that handles cross-environment compatibility
      return createFilePolyfill(data, filename, { type: mimeType });

    } catch (error) {
      console.error(`URL to file conversion attempt ${attempt + 1} failed:`, error);

      if (attempt === maxRetries - 1) {
        throw new Error(`Failed to convert URL to file after ${maxRetries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Wait before retrying
      const waitTime = (attempt + 1) * 2000; // 2s, 4s, 6s
      console.log(`Waiting ${waitTime}ms before retry...`);
      await sleep(waitTime);
    }
  }

  throw new Error("URL to file conversion failed: Maximum retries exceeded");
}