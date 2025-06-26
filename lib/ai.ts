import OpenAI from "openai";
import * as jwt from "jsonwebtoken";
import { put } from "@vercel/blob";
import { kv } from "@vercel/kv";
import { type OnboardingData } from "@/lib/onboarding-storage";
import { systemPrompt } from "./prompts";

// Initialize the OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

    // Build additional context from user profile if provided
    const userProfileContext = userProfile
      ? `以下是我的风格档案 JSON：\n\n\`${JSON.stringify(userProfile)}\``
      : "";
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
              text: `Here is my photo, the garment I love, and the occasion (\"${occasion}\"). ${userProfileContext}`,
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
      max_tokens: 2000,
      // @ts-ignore
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("OpenAI returned an empty response.");
    }

    // Parse the JSON string and return it
    const suggestion = JSON.parse(content);
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
      return new File([data], filename, { type: mimeType });

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

// Helper function to convert a File to a Base64 string
const fileToBase64 = async (file: File): Promise<string> => {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  return buffer.toString("base64");
};

// --- Kling AI ---
const KLING_ACCESS_KEY = process.env.KLING_AI_ACCESS_KEY;
const KLING_SECRET_KEY = process.env.KLING_AI_SECRET_KEY;
const KLING_API_BASE_URL = "https://api-beijing.klingai.com";
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

  switch (modelVersion) {
    case 'kling-v1-5':
      return {
        ...baseBody,
        image_reference: "face",
        human_fidelity: 1,
        n: 2,// number of images to generate
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
  // 1. Submit the task
  const apiToken = getApiToken(KLING_ACCESS_KEY, KLING_SECRET_KEY);
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
  const taskId = submitResult.data.task_id;
  console.log(`Kling task submitted to ${submitPath}. Task ID: ${taskId}`);

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
  suggestion?: { image_prompt: string;[key: string]: any; };
  processImages?: {
    styledImage?: string;
    tryOnImage?: string;
  };
  result?: { imageUrl: string };
  error?: string;
  [key: string]: any; // Index signature for Vercel KV compatibility
}

/**
 * ATOMIC STEP: Generates a stylized base image using a specific model.
 */
async function runStylization(modelVersion: 'kling-v1-5' | 'kling-v2', prompt: string, humanImageUrl: string, humanImageName: string, humanImageType: string): Promise<string> {
  console.log(`[ATOMIC_STEP] Running Stylization with ${modelVersion}...`);
  if (!prompt) {
    throw new Error("Cannot generate styled image without a 'prompt'.");
  }

  const humanImageFile = await urlToFile(humanImageUrl, humanImageName, humanImageType);
  const humanImageBase64 = await fileToBase64(humanImageFile);

  const stylizeRequestBody = buildStylizeRequestBody(modelVersion, prompt, humanImageBase64);
  const styledImageUrls = await executeKlingTask(KOLORS_STYLIZE_SUBMIT_PATH, KOLORS_STYLIZE_STATUS_PATH, stylizeRequestBody);

  console.log(`[ATOMIC_STEP] Stylization with ${modelVersion} complete: ${styledImageUrls.length} images generated`);
  console.log(`[ATOMIC_STEP] First image URL:`, styledImageUrls[0].substring(0, 100));

  // Return the first image for backward compatibility
  return styledImageUrls[0];
}

/**
 * ATOMIC STEP: Performs virtual try-on.
 * @param canvasImageUrl The URL of the image to apply the clothing to.
 * @param garmentImageUrl The URL of the clothing item.
 */
async function runVirtualTryOn(canvasImageUrl: string, garmentImageUrl: string, garmentImageName: string, garmentImageType: string): Promise<string> {
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
  };

  const tryOnImageUrls = await executeKlingTask(KOLORS_VIRTUAL_TRYON_SUBMIT_PATH, KOLORS_VIRTUAL_TRYON_STATUS_PATH, tryOnRequestBody);

  console.log("[ATOMIC_STEP] Virtual Try-On complete:", tryOnImageUrls[0].substring(0, 100));

  // Return the first image for backward compatibility
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
 */
export async function executeTryOnOnlyPipeline(job: Job): Promise<string> {
  console.log(`[PIPELINE_START] Executing "Try-On Only" pipeline for job ${job.jobId}`);

  // Step 1: Virtual Try-On on the original human image
  // The 'canvas' is the user's original photo.
  const tryOnImageUrl = await runVirtualTryOn(
    job.humanImage.url,
    job.garmentImage.url,
    job.garmentImage.name,
    job.garmentImage.type
  );
  await kv.hset(job.jobId, { tryOnImage: tryOnImageUrl });


  // Step 2: Save the result to blob storage
  const finalUrl = await saveFinalImageToBlob(tryOnImageUrl, job.jobId);

  console.log(`[PIPELINE_END] "Try-On Only" pipeline finished for job ${job.jobId}`);
  return finalUrl;
}

/**
 * PIPELINE 2: Generates a simple scene with the user, with improved clothing fidelity.
 */
export async function executeSimpleScenePipeline(job: Job): Promise<string> {
  console.log(`[PIPELINE_START] Executing "Simple Scene" pipeline for job ${job.jobId}`);
  if (!job.suggestion?.image_prompt) {
    throw new Error("Cannot run simple scene pipeline without 'image_prompt'.");
  }

  // Step 1: Stylize the image using the simpler, faster model to get a new scene and pose.
  const styledImageUrl = await runStylization(
    'kling-v1-5',
    job.suggestion.image_prompt,
    job.humanImage.url,
    job.humanImage.name,
    job.humanImage.type
  );
  await kv.hset(job.jobId, {
    status: 'stylization_completed',
    statusMessage: '场景已生成，正在进行虚拟试穿...',
    styledImage: styledImageUrl
  });

  // Step 2: Perform virtual try-on on the new scene to ensure high clothing fidelity.
  const tryOnImageUrl = await runVirtualTryOn(
    styledImageUrl,
    job.garmentImage.url,
    job.garmentImage.name,
    job.garmentImage.type
  );
  await kv.hset(job.jobId, { tryOnImage: tryOnImageUrl });


  // Step 3: Save the result to blob storage
  const finalUrl = await saveFinalImageToBlob(tryOnImageUrl, job.jobId);

  console.log(`[PIPELINE_END] "Simple Scene" pipeline finished for job ${job.jobId}`);
  return finalUrl;
}


/**
 * PIPELINE 3: Performs the full advanced scene generation.
 */
export async function executeAdvancedScenePipeline(job: Job): Promise<string> {
  console.log(`[PIPELINE_START] Executing "Advanced Scene" pipeline for job ${job.jobId}`);
  if (!job.suggestion?.image_prompt) {
    throw new Error("Cannot run advanced scene pipeline without 'image_prompt'.");
  }

  // Step 1: Generate the stylized background/pose with the advanced model
  const styledImageUrl = await runStylization(
    'kling-v2',
    job.suggestion.image_prompt,
    job.humanImage.url,
    job.humanImage.name,
    job.humanImage.type
  );
  await kv.hset(job.jobId, {
    status: 'stylization_completed',
    statusMessage: '场景已生成，正在进行虚拟试穿...',
    styledImage: styledImageUrl
  });

  // Step 2: Perform virtual try-on using the newly stylized image as the canvas
  const tryOnImageUrl = await runVirtualTryOn(
    styledImageUrl,
    job.garmentImage.url,
    job.garmentImage.name,
    job.garmentImage.type
  );
  await kv.hset(job.jobId, { tryOnImage: tryOnImageUrl });


  // Step 3: Perform face swap to put the user's face back onto the generated body
  const swappedImageUrl = await runAndPerformFaceSwap(
    job.humanImage.url,
    job.humanImage.name,
    job.humanImage.type,
    tryOnImageUrl
  );

  // Step 4: Save the final, face-swapped image to blob storage
  const finalUrl = await saveFinalImageToBlob(swappedImageUrl, job.jobId);

  console.log(`[PIPELINE_END] "Advanced Scene" pipeline finished for job ${job.jobId}`);
  return finalUrl;
}
