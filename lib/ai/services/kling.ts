import * as jwt from "jsonwebtoken";
import { fetchWithTimeout, fileToBase64, sleep, urlToFile } from "../utils";
import { IMAGE_GENERATION_MODEL, IMAGE_FORMAT_DESCRIPTION, STRICT_REALISM_PROMPT_BLOCK } from "@/lib/prompts";
import { Job } from "../types";

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
  console.log(`[${IMAGE_GENERATION_MODEL}] Building stylize request for model:`, modelVersion);
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


/**
 * ATOMIC STEP: Generates a stylized base image using a specific model.
 * Returns multiple images and the final prompt used.
 */
export async function runStylizationMultiple(modelVersion: 'kling-v1-5' | 'kling-v2', suggestion: Job['suggestion'], humanImageUrl: string, humanImageName: string, humanImageType: string, job?: Job): Promise<{ imageUrls: string[], finalPrompt: string }> {
  console.log(`[ATOMIC_STEP] Running Stylization with ${modelVersion}...`);
  console.log(`[ATOMIC_STEP] Job customPrompt:`, job?.customPrompt);

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
    finalPrompt = suggestion.image_prompt + ' ' + IMAGE_FORMAT_DESCRIPTION + ' ' + STRICT_REALISM_PROMPT_BLOCK;
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

  return { imageUrls: styledImageUrls, finalPrompt };
}

/**
 * ATOMIC STEP: Generates stylized images for multiple prompts in parallel.
 * Returns an array of results, where each result contains images and the final prompt.
 */
export async function runStylizationParallel(
  modelVersion: 'kling-v1-5' | 'kling-v2',
  prompts: string[],
  humanImageUrl: string,
  humanImageName: string,
  humanImageType: string,
  job?: Job
): Promise<{ imageUrls: string[], finalPrompt: string }[]> {
  console.log(`[ATOMIC_STEP] Running Parallel Stylization with ${modelVersion} for ${prompts.length} prompts...`);

  // Execute all prompts in parallel
  const allPromises = prompts.map((prompt, index) => {
    console.log(`[PARALLEL] Starting stylization ${index + 1}/${prompts.length} for prompt: ${prompt.substring(0, 50)}...`);
    const suggestion: Job['suggestion'] = { image_prompt: prompt, outfit_suggestion: '' };
    return runStylizationMultiple(modelVersion, suggestion, humanImageUrl, humanImageName, humanImageType, job);
  });

  const results = await Promise.all(allPromises);

  console.log(`[ATOMIC_STEP] Parallel Stylization complete: Generated ${results.length} groups with total ${results.reduce((sum, result) => sum + result.imageUrls.length, 0)} images`);
  results.forEach((result, index) => {
    console.log(`[ATOMIC_STEP] Group ${index + 1}: ${result.imageUrls.length} images`);
  });

  return results;
}

/**
 * ATOMIC STEP: Generates stylized base image using a specific model.
 * Legacy version that returns only the first image for backward compatibility.
 */
export async function runStylization(modelVersion: 'kling-v1-5' | 'kling-v2', prompt: string, humanImageUrl: string, humanImageName: string, humanImageType: string, job?: Job): Promise<string> {
  const suggestion: Job['suggestion'] = { image_prompt: prompt, outfit_suggestion: '' };
  const result = await runStylizationMultiple(modelVersion, suggestion, humanImageUrl, humanImageName, humanImageType, job);
  return result.imageUrls[0];
}

/**
 * ATOMIC STEP: Performs virtual try-on.
 * Returns multiple images.
 * @param canvasImageUrl The URL of the image to apply the clothing to.
 * @param garmentImageUrl The URL of the clothing item.
 */
export async function runVirtualTryOnMultiple(canvasImageUrl: string, garmentImageUrl: string, garmentImageName: string, garmentImageType: string): Promise<string[]> {
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
export async function runVirtualTryOn(canvasImageUrl: string, garmentImageUrl: string, garmentImageName: string, garmentImageType: string): Promise<string> {
  const tryOnImageUrls = await runVirtualTryOnMultiple(canvasImageUrl, garmentImageUrl, garmentImageName, garmentImageType);
  return tryOnImageUrls[0];
}