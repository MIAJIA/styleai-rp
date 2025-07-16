import * as jwt from "jsonwebtoken";
import { fetchWithTimeout, fileToBase64, sleep, urlToFile } from "../utils";
import {
  IMAGE_GENERATION_MODEL,
  IMAGE_FORMAT_DESCRIPTION,
  STRICT_REALISM_PROMPT_BLOCK,
} from "@/lib/prompts";
import { Job, Suggestion } from "../types";

// --- Kling AI ---
const KLING_ACCESS_KEY = process.env.KLING_AI_ACCESS_KEY;
const KLING_SECRET_KEY = process.env.KLING_AI_SECRET_KEY;
const KLING_ACCESS_KEY_TRYON = process.env.KLING_AI_ACCESS_KEY_TRYON;
const KLING_SECRET_KEY_TRYON = process.env.KLING_AI_SECRET_KEY_TRYON;
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
  console.log(`[${IMAGE_GENERATION_MODEL}] Building stylize request for model:`, modelVersion);
  console.log("!!! send final prompt:", prompt);

  switch (modelVersion) {
    case 'kling-v1-5':
      return {
        ...baseBody,
        image_reference: "face",// "face" or "subject"?
        human_fidelity: 0.8,
        image_fidelity: 0.6,
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
  const isTryOn = submitPath === KOLORS_VIRTUAL_TRYON_SUBMIT_PATH;

  const accessKey = isTryOn ? KLING_ACCESS_KEY_TRYON : KLING_ACCESS_KEY;
  const secretKey = isTryOn ? KLING_SECRET_KEY_TRYON : KLING_SECRET_KEY;
  const keyType = isTryOn ? "TRY-ON" : "STYLIZATION";

  console.log(`[KLING_API] 🔑 Using ${keyType} keys for path: ${submitPath}`);

  if (!accessKey || !secretKey) {
    console.error(`[KLING_API] ❌ ${keyType} API keys are not configured.`);
    if (isTryOn) {
      console.error(`[KLING_API] ❌ Ensure KLING_AI_ACCESS_KEY_TRYON and KLING_AI_SECRET_KEY_TRYON are set in your environment.`);
    } else {
      console.error(`[KLING_API] ❌ Ensure KLING_AI_ACCESS_KEY and KLING_AI_SECRET_KEY are set in your environment.`);
    }
    throw new Error(`Kling AI ${keyType} API keys are not configured.`);
  }

  // 🔍 NEW: Enhanced logging for API calls
  console.log(`[KLING_API] 🔑 API keys check: ACCESS_KEY=${accessKey ? 'SET' : 'MISSING'}, SECRET_KEY=${secretKey ? 'SET' : 'MISSING'}`);
  console.log(`[KLING_API] 🌐 API Base URL: ${KLING_API_BASE_URL}`);
  console.log(`[KLING_API] 📞 Submit path: ${submitPath}`);
  console.log(`[KLING_API] 📞 Query path prefix: ${queryPathPrefix}`);
  console.log(`[KLING_API] 📦 Request body keys: ${Object.keys(requestBody).join(', ')}`);

  const apiToken = getApiToken(accessKey, secretKey);
  let taskId = '';

  const maxSubmitRetries = 3;
  for (let attempt = 0; attempt < maxSubmitRetries; attempt++) {
    try {
      console.log(`[KLING_API] 🔄 Submit attempt ${attempt + 1}/${maxSubmitRetries}...`);
      console.log(`[KLING_API] 🔄 Full submit URL: ${KLING_API_BASE_URL}${submitPath}`);

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

      console.log(`[KLING_API] 📡 Submit response status: ${submitResponse.status}`);
      console.log(`[KLING_API] 📡 Submit response ok: ${submitResponse.ok}`);

      if (!submitResponse.ok) {
        const errorBody = await submitResponse.text();
        console.error(`[KLING_API] ❌ Submit failed - Status: ${submitResponse.status}, Body: ${errorBody}`);

        // 🔍 NEW: Special handling for 429 balance error
        if (submitResponse.status === 429) {
          console.error(`[KLING_API] 💰 BALANCE ERROR DETECTED! Status 429 - Account balance not enough`);
          console.error(`[KLING_API] 💰 This is the exact error that causes the 503 response to users`);
          console.error(`[KLING_API] 💰 Error details: ${errorBody}`);
        }

        throw new Error(`Kling API Error on submit to ${submitPath}: ${submitResponse.status} ${errorBody}`);
      }

      const submitResult = await submitResponse.json();
      taskId = submitResult.data.task_id;
      console.log(`[KLING_API] ✅ Task submitted successfully to ${submitPath}. Task ID: ${taskId}`);
      break; // Success, exit retry loop
    } catch (error) {
      console.error(`[KLING_API] ❌ Submit attempt ${attempt + 1} failed:`, error);

      // 🔍 NEW: Enhanced error logging
      if (error instanceof Error) {
        console.error(`[KLING_API] ❌ Error type: ${error.constructor.name}`);
        console.error(`[KLING_API] ❌ Error message: ${error.message}`);
      }

      if (attempt === maxSubmitRetries - 1) {
        console.error(`[KLING_API] ❌ Final attempt failed. Giving up.`);
        throw new Error(`Failed to submit Kling task after ${maxSubmitRetries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      const waitTime = Math.pow(2, attempt) * 2000; // 2s, 4s
      console.log(`[KLING_API] ⏳ Waiting ${waitTime}ms before next submit attempt...`);
      await sleep(waitTime);
    }
  }

  // 2. Poll for the result
  let attempts = 0;
  const maxAttempts = 60; // Increased max attempts
  let finalImageUrls: string[] = [];

  console.log(`[KLING_API] 🔄 Starting polling for task ${taskId}...`);

  while (attempts < maxAttempts) {
    await sleep(5000); // Increased to 5-second interval
    attempts++;
    console.log(`[KLING_API] 🔄 Polling attempt #${attempts}/${maxAttempts} for task: ${taskId}`);

    const pollingToken = getApiToken(accessKey, secretKey);

    try {
      const statusCheckResponse = await fetchWithTimeout(`${KLING_API_BASE_URL}${queryPathPrefix}${taskId}`, {
        headers: { 'Authorization': `Bearer ${pollingToken}` },
        timeout: 120000, // Increased to 2 minutes for status check
      });

      console.log(`[KLING_API] 📡 Polling response status: ${statusCheckResponse.status}`);

      if (!statusCheckResponse.ok) {
        console.warn(`[KLING_API] ⚠️ Polling failed on attempt ${attempts} with status ${statusCheckResponse.status}, continuing...`);
        continue;
      }

      const statusResult = await statusCheckResponse.json();
      const taskData = statusResult.data;

      console.log(`[KLING_API] 📊 Task status: ${taskData.task_status}`);

      if (taskData.task_status === "succeed") {
        console.log(`[KLING_API] 🎉 Task succeeded! Full response:`, JSON.stringify(statusResult, null, 2));

        // Handle multiple images from the response
        if (taskData.task_result?.images?.length > 0) {
          finalImageUrls = taskData.task_result.images.map((img: any) => img.url);
          console.log(`[KLING_API] 🎉 Task ${taskId} succeeded! Found ${finalImageUrls.length} images:`, finalImageUrls);
        } else if (taskData.task_result?.url) {
          // Fallback for single image response
          finalImageUrls = [taskData.task_result.url];
          console.log(`[KLING_API] 🎉 Task ${taskId} succeeded! Single image URL:`, finalImageUrls[0]);
        } else {
          throw new Error("Task succeeded, but the response structure for the image URL is unexpected.");
        }

        console.log(`[KLING_API] 🎉 Task ${taskId} completed successfully! Total images: ${finalImageUrls.length}`);
        break;
      } else if (taskData.task_status === "failed") {
        console.error(`[KLING_API] ❌ Task failed. Status: ${taskData.task_status}, Message: ${taskData.task_status_msg || 'Unknown'}`);
        throw new Error(`Kling task failed. Reason: ${taskData.task_status_msg || 'Unknown'}`);
      }
    } catch (pollError) {
      console.warn(`[KLING_API] ⚠️ Polling attempt ${attempts} encountered error:`, pollError);
      // Continue to next attempt unless it's the last one
      if (attempts >= maxAttempts) {
        throw pollError;
      }
    }
  }

  if (finalImageUrls.length === 0) {
    console.error(`[KLING_API] ⏰ Task ${taskId} timed out after ${maxAttempts} attempts (${maxAttempts * 5} seconds).`);
    throw new Error(`Kling task ${taskId} timed out after ${maxAttempts} attempts (${maxAttempts * 5} seconds).`);
  }

  return finalImageUrls;
}

/**
 * ATOMIC STEP: Generates a stylized base image using a specific model.
 * Returns multiple images and the final prompt used.
 */
export async function runStylizationMultiple(
  modelVersion: "kling-v1-5" | "kling-v2",
  suggestion: Suggestion,
  humanImageUrl: string,
  humanImageName: string,
  humanImageType: string,
  job?: Job
): Promise<{ imageUrls: string[]; finalPrompt: string }> {
  const startTime = Date.now();
  console.log(`[PERF_LOG | Job ${job?.jobId}] [ATOMIC_STEP] Running Stylization with ${modelVersion}...`);
  console.log(`[ATOMIC_STEP] Job customPrompt:`, job?.input.customPrompt);

  // 🔍 NEW: Environment check logging
  console.log(`[ENV_CHECK | Job ${job?.jobId}] NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`[ENV_CHECK | Job ${job?.jobId}] Is development environment: ${process.env.NODE_ENV === 'development'}`);

  let finalPrompt: string;

  // 🔍 UNIFIED PROMPT CONSTRUCTION: 统一的 prompt 构建逻辑，明确优先级
  console.log(`[PROMPT_CONSTRUCTION] 🔧 Starting unified prompt construction...`);

  // 1️⃣ 最高优先级：用户自定义 prompt
  if (job?.input.customPrompt && job.input.customPrompt.trim()) {
    finalPrompt = job.input.customPrompt.trim();
    console.log(`[PROMPT_CONSTRUCTION] ✅ Using custom prompt (highest priority)`);
  }
  // 2️⃣ 次高优先级：AI 生成的 image_prompt
  else if (suggestion?.styleSuggestion?.image_prompt) {
    finalPrompt = suggestion.styleSuggestion.image_prompt;
    console.log(`[PROMPT_CONSTRUCTION]‼️‼️‼️ ✅ Using AI-generated image_prompt`);
  }
  // 3️⃣ 中等优先级：根据 outfit 详情构建
  else if (suggestion?.styleSuggestion?.outfit_suggestion) {
    const outfitDetails = suggestion.styleSuggestion.outfit_suggestion;
    const outfitDescription = outfitDetails.explanation || outfitDetails.style_summary || "A stylish outfit";
    finalPrompt = `${outfitDetails.outfit_title || "Stylish Look"}. ${outfitDescription}`;
    console.log(`[PROMPT_CONSTRUCTION]‼️‼️‼️ ✅ Using outfit details fallback`);
  }
  // 4️⃣ 最低优先级：默认 fallback
  else {
    finalPrompt = "A full-body shot of a person in a stylish outfit, standing in a visually appealing, realistic setting. The image is well-lit, with a clear focus on the person and their clothing. The background is a real-world scene, like a chic city street, a modern interior, or a scenic outdoor location. The overall aesthetic is fashionable, clean, and high-quality.";
    console.log(`[PROMPT_CONSTRUCTION]‼️‼️‼️ ⚠️ Using default fallback prompt`);
  }

  // 🔍 UNIFIED FORMATTING: 统一添加格式描述（只有非 custom prompt 才添加）
  if (!job?.input.customPrompt || !job.input.customPrompt.trim()) {
    finalPrompt = `${finalPrompt}. ${IMAGE_FORMAT_DESCRIPTION} ${STRICT_REALISM_PROMPT_BLOCK}`;
    console.log(`[PROMPT_CONSTRUCTION] ✅ Added format description and realism block`);
  }

  // 🔍 PROMPT VALIDATION: 长度检查和日志
  if (finalPrompt.length > 2500) {
    console.warn(`[PROMPT_CONSTRUCTION]‼️‼️‼️ ⚠️ Prompt too long (${finalPrompt.length} chars), truncating to 2500 chars`);
    // log the truncated part of the prompt
    console.log(`[PROMPT_CONSTRUCTION]‼️‼️‼️ ⚠️ Truncated prompt:`, finalPrompt.substring(2500));

    finalPrompt = finalPrompt.substring(0, 2500);
  }

  console.log(`[PROMPT_CONSTRUCTION] 🎯 Final prompt constructed (${finalPrompt.length} chars):`, finalPrompt);

  // 🔍 NEW: Always use real stylization API (even in development)
  // Only virtual try-on should be mocked, not stylization
  console.log(`[STYLIZATION_API | Job ${job?.jobId}] 🚀 Always using real Kling AI stylization API`);
  console.log(`[STYLIZATION_API | Job ${job?.jobId}] 🚀 API endpoint: ${KLING_API_BASE_URL}${KOLORS_STYLIZE_SUBMIT_PATH}`);
  console.log(`[STYLIZATION_API | Job ${job?.jobId}] 🚀 Model version: ${modelVersion}`);
  console.log(`[STYLIZATION_API | Job ${job?.jobId}] 🚀 Environment: ${process.env.NODE_ENV}`);

  // 🔍 NEW: Check API keys availability, especially in development
  if (!KLING_ACCESS_KEY || !KLING_SECRET_KEY) {
    console.error(`[STYLIZATION_API | Job ${job?.jobId}] ❌ API keys not configured`);
    console.error(`[STYLIZATION_API | Job ${job?.jobId}] ❌ ACCESS_KEY: ${KLING_ACCESS_KEY ? 'SET' : 'MISSING'}`);
    console.error(`[STYLIZATION_API | Job ${job?.jobId}] ❌ SECRET_KEY: ${KLING_SECRET_KEY ? 'SET' : 'MISSING'}`);

    if (process.env.NODE_ENV === 'development') {
      console.error(`[STYLIZATION_API | Job ${job?.jobId}] 💡 Development environment detected`);
      console.error(`[STYLIZATION_API | Job ${job?.jobId}] 💡 To use real stylization API, set KLING_AI_ACCESS_KEY and KLING_AI_SECRET_KEY`);
      console.error(`[STYLIZATION_API | Job ${job?.jobId}] 💡 For full mock experience, use tryon-only mode`);
    }

    throw new Error("Kling AI API keys are not configured. Please set KLING_AI_ACCESS_KEY and KLING_AI_SECRET_KEY environment variables.");
  }

  const humanImageBase64 = await fileToBase64(await urlToFile(humanImageUrl, humanImageName, humanImageType));
  const requestBody = buildStylizeRequestBody(modelVersion, finalPrompt, humanImageBase64);

  const styledImageUrls = await executeKlingTask(KOLORS_STYLIZE_SUBMIT_PATH, KOLORS_STYLIZE_STATUS_PATH, requestBody);

  const endTime = Date.now();
  console.log(`[PERF_LOG | Job ${job?.jobId}] [ATOMIC_STEP] Stylization with ${modelVersion} complete. Elapsed: ${endTime - startTime}ms.`);
  console.log(`[ATOMIC_STEP] Stylization with ${modelVersion} complete: ${styledImageUrls.length} images generated`);
  styledImageUrls.forEach((url, index) => {
    console.log(`[ATOMIC_STEP] Image ${index + 1} URL:`, url.substring(0, 100));
  });

  return { imageUrls: styledImageUrls, finalPrompt };
}

/**
 * ATOMIC STEP: Runs stylization for multiple prompts in parallel.
 */
export async function runStylizationParallel(
  modelVersion: 'kling-v1-5' | 'kling-v2',
  prompts: string[],
  humanImageUrl: string,
  humanImageName: string,
  humanImageType: string,
  job?: Job
): Promise<{ imageUrls: string[], finalPrompt: string }[]> {
  const startTime = Date.now();
  console.log(`[PERF_LOG | Job ${job?.jobId}] [ATOMIC_STEP] Running Parallel Stylization with ${modelVersion} for ${prompts.length} prompts...`);

  const humanImageBase64 = await fileToBase64(await urlToFile(humanImageUrl, humanImageName, humanImageType));

  const results = await Promise.all(
    prompts.map(async (prompt) => {
      const requestBody = buildStylizeRequestBody(modelVersion, prompt, humanImageBase64);
      const imageUrls = await executeKlingTask(KOLORS_STYLIZE_SUBMIT_PATH, KOLORS_STYLIZE_STATUS_PATH, requestBody);
      return { imageUrls, finalPrompt: prompt };
    })
  );

  const endTime = Date.now();
  console.log(`[PERF_LOG | Job ${job?.jobId}] [ATOMIC_STEP] Parallel Stylization complete. Elapsed: ${endTime - startTime}ms.`);
  console.log(`[ATOMIC_STEP] Parallel Stylization complete: Generated ${results.length} groups with total ${results.reduce((sum, result) => sum + result.imageUrls.length, 0)} images`);
  results.forEach((result, index) => {
    console.log(`[ATOMIC_STEP] Group ${index + 1}: ${result.imageUrls.length} images`);
  });
  return results;
}

export async function runStylization(modelVersion: 'kling-v1-5' | 'kling-v2', prompt: string, humanImageUrl: string, humanImageName: string, humanImageType: string, job?: Job): Promise<string> {
  const result = await runStylizationMultiple(modelVersion, { finalPrompt: prompt } as Suggestion, humanImageUrl, humanImageName, humanImageType, job);
  if (!result.imageUrls[0]) {
    throw new Error("Stylization did not return an image.");
  }
  return result.imageUrls[0];
}

/**
 * ATOMIC STEP: Performs virtual try-on, returning multiple images.
 */
export async function runVirtualTryOnMultiple(canvasImageUrl: string, garmentImageUrl: string, garmentImageName: string, garmentImageType: string, job?: Job): Promise<string[]> {
  const startTime = Date.now();
  console.log(`[PERF_LOG | Job ${job?.jobId}] [ATOMIC_STEP] Running Virtual Try-On...`);

  // 🔍 NEW: Environment check logging
  console.log(`[ENV_CHECK | Job ${job?.jobId}] NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`[ENV_CHECK | Job ${job?.jobId}] MOCK_VIRTUAL_TRYON: ${process.env.MOCK_VIRTUAL_TRYON}`);
  console.log(`[ENV_CHECK | Job ${job?.jobId}] Canvas image: ${canvasImageUrl.substring(0, 100)}...`);
  console.log(`[ENV_CHECK | Job ${job?.jobId}] Garment image: ${garmentImageUrl.substring(0, 100)}...`);

  // 🔍 NEW: Controlled mock for virtual try-on via environment flag
  if (process.env.MOCK_VIRTUAL_TRYON === 'true') {
    console.log(`[DEV_MOCK | Job ${job?.jobId}] 🎭 MOCK_VIRTUAL_TRYON is 'true' - Using mock virtual try-on images`);
    console.log(`[DEV_MOCK | Job ${job?.jobId}] 🎭 Skipping Kling AI virtual try-on API call (/v1/images/kolors-virtual-try-on)`);
    console.log(`[DEV_MOCK | Job ${job?.jobId}] 🎭 This would have called: ${KLING_API_BASE_URL}${KOLORS_VIRTUAL_TRYON_SUBMIT_PATH}`);
    console.log(`[DEV_MOCK | Job ${job?.jobId}] 🎭 Canvas image: ${canvasImageUrl.substring(0, 100)}...`);
    console.log(`[DEV_MOCK | Job ${job?.jobId}] 🎭 Garment: ${garmentImageName} (${garmentImageType})`);

    // Mock multiple try-on images with base64 data URIs (more reliable than external URLs)
    const mockTryOnImageUrls = [
      // Small 1x1 pixel images in base64 format to avoid network issues
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77hQAAAABJRU5ErkJggg==", // Mock Try-On 1
    ];

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000)); // Reduced mock time

    const endTime = Date.now();
    console.log(`[DEV_MOCK | Job ${job?.jobId}] 🎭 Mock virtual try-on complete. Elapsed: ${endTime - startTime}ms.`);
    console.log(`[DEV_MOCK | Job ${job?.jobId}] 🎭 Mock virtual try-on complete: ${mockTryOnImageUrls.length} images generated`);
    mockTryOnImageUrls.forEach((url, index) => {
      console.log(`[DEV_MOCK | Job ${job?.jobId}] 🎭 Mock try-on image ${index + 1}: base64 data URI (${url.length} chars)`);
    });

    return mockTryOnImageUrls;
  }

  // 🔍 Real API call (mocking is disabled)
  console.log(`[REAL_API | Job ${job?.jobId}] 🚀 MOCK_VIRTUAL_TRYON is not 'true' - Making real Kling AI virtual try-on API call`);
  console.log(`[REAL_API | Job ${job?.jobId}] 🚀 API endpoint: ${KLING_API_BASE_URL}${KOLORS_VIRTUAL_TRYON_SUBMIT_PATH}`);
  console.log(`[REAL_API | Job ${job?.jobId}] 🚀 Model: kolors-virtual-try-on-v1-5`);
  console.log(`[REAL_API | Job ${job?.jobId}] 🚀 Processing images for API request...`);

  const [humanImageBase64, garmentImageBase64] = await Promise.all([
    urlToFile(canvasImageUrl, "canvas.jpg", "image/jpeg").then(fileToBase64),
    urlToFile(garmentImageUrl, garmentImageName, garmentImageType).then(fileToBase64)
  ]);

  const requestBody = {
    model_name: "kolors-virtual-try-on-v1-5",
    human_image: humanImageBase64,
    cloth_image: garmentImageBase64,
    n: 1,
  };

  console.log(`[REAL_API | Job ${job?.jobId}] 🚀 Request body prepared, calling executeKlingTask...`);
  console.log(`[REAL_API | Job ${job?.jobId}] 🚀 Human image size: ${humanImageBase64.length} characters`);
  console.log(`[REAL_API | Job ${job?.jobId}] 🚀 Garment image size: ${garmentImageBase64.length} characters`);

  const tryOnImageUrls = await executeKlingTask(KOLORS_VIRTUAL_TRYON_SUBMIT_PATH, KOLORS_VIRTUAL_TRYON_STATUS_PATH, requestBody);

  const endTime = Date.now();
  console.log(`[PERF_LOG | Job ${job?.jobId}] [ATOMIC_STEP] Virtual Try-On complete. Elapsed: ${endTime - startTime}ms.`);
  console.log(`[ATOMIC_STEP] Virtual Try-On complete: ${tryOnImageUrls.length} images generated`);
  tryOnImageUrls.forEach((url, index) => {
    console.log(`[ATOMIC_STEP] Try-on image ${index + 1} URL:`, url.substring(0, 100));
  });
  return tryOnImageUrls;
}

export async function runVirtualTryOn(canvasImageUrl: string, garmentImageUrl: string, garmentImageName: string, garmentImageType: string, job?: Job): Promise<string> {
  const results = await runVirtualTryOnMultiple(canvasImageUrl, garmentImageUrl, garmentImageName, garmentImageType, job);
  if (!results[0]) {
    throw new Error("Virtual Try-On did not return an image.");
  }
  return results[0];
}