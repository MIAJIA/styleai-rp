import * as jwt from "jsonwebtoken";
import { fetchWithTimeout, fileToBase64, sleep, urlToFile } from "../utils";
import {
  IMAGE_GENERATION_MODEL,
  IMAGE_FORMAT_DESCRIPTION,
  STRICT_REALISM_PROMPT_BLOCK,
} from "@/lib/prompts";
import { Job, Suggestion } from "../types";
import { kv } from "@vercel/kv";

// 🛡️ NEW: Custom error for terminal task failures to distinguish from transient network errors.
class TaskFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TaskFailedError';
  }
}
export class PolicyRiskError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PolicyRiskError';
  }
}

// --- Kling AI ---
const KLING_ACCESS_KEY = process.env.KLING_AI_ACCESS_KEY;
const KLING_SECRET_KEY = process.env.KLING_AI_SECRET_KEY;
const KLING_ACCESS_KEY_TRYON = process.env.KLING_AI_ACCESS_KEY_TRYON;
const KLING_SECRET_KEY_TRYON = process.env.KLING_AI_SECRET_KEY_TRYON;
// const KLING_API_BASE_URL = "https://api-beijing.klingai.com";
const KLING_API_BASE_URL = "https://api-singapore.klingai.com";

// 🔍 统一日志前缀
const KLING_LOG_PREFIX = '🎨 [KLING]';
const KLING_API_PREFIX = '🎨📡 [KLING_API]';
const KLING_PROMPT_PREFIX = '🎨📝 [KLING_PROMPT]';

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
  console.log(`${KLING_LOG_PREFIX} Building stylize request for model:`, modelVersion);
  console.log(`${KLING_PROMPT_PREFIX} Send final prompt:`, prompt);

  switch (modelVersion) {
    case 'kling-v1-5':
      return {
        ...baseBody,
        image_reference: "subject",// "face" or "subject"?
        human_fidelity: 0.65,
        image_fidelity: 0.25,
        n: 1,// number of images to generate
        model_name: "kling-v1-5",
      };
    case 'kling-v2':
      return {
        ...baseBody,
        model_name: "kling-v2",
      };
    default:
      console.warn(`${KLING_LOG_PREFIX} Unknown modelVersion '${modelVersion}', defaulting to kling-v2.`);
      return {
        ...baseBody,
        model_name: "kling-v2",
      };
  }
};

// More robust, reusable polling function
async function executeKlingTask(submitPath: string, queryPathPrefix: string, requestBody: object, jobId: string, suggestionIndex: number): Promise<string[]> {
  const isTryOn = submitPath === KOLORS_VIRTUAL_TRYON_SUBMIT_PATH;

  const accessKey = isTryOn ? KLING_ACCESS_KEY_TRYON : KLING_ACCESS_KEY;
  const secretKey = isTryOn ? KLING_SECRET_KEY_TRYON : KLING_SECRET_KEY;
  const keyType = isTryOn ? "TRY-ON" : "STYLIZATION";

  console.log(`${KLING_API_PREFIX} 🔑 Using ${keyType} keys for path: ${submitPath}`);

  if (!accessKey || !secretKey) {
    console.error(`${KLING_API_PREFIX} ❌ ${keyType} API keys are not configured.`);
    if (isTryOn) {
      console.error(`${KLING_API_PREFIX} ❌ Ensure KLING_AI_ACCESS_KEY_TRYON and KLING_AI_SECRET_KEY_TRYON are set in your environment.`);
    } else {
      console.error(`${KLING_API_PREFIX} ❌ Ensure KLING_AI_ACCESS_KEY and KLING_AI_SECRET_KEY are set in your environment.`);
    }
    throw new Error(`Kling AI ${keyType} API keys are not configured.`);
  }

  // 🔍 NEW: Enhanced logging for API calls
  console.log(`${KLING_API_PREFIX} 🔑 API keys check: ACCESS_KEY=${accessKey ? 'SET' : 'MISSING'}, SECRET_KEY=${secretKey ? 'SET' : 'MISSING'}`);
  console.log(`${KLING_API_PREFIX} 🌐 API Base URL: ${KLING_API_BASE_URL}`);
  console.log(`${KLING_API_PREFIX} 📞 Submit path: ${submitPath}`);
  console.log(`${KLING_API_PREFIX} 📞 Query path prefix: ${queryPathPrefix}`);
  console.log(`${KLING_API_PREFIX} 📦 Request body keys: ${Object.keys(requestBody).join(', ')}`);

  // 🔍 NEW: 输出完整的请求体（但隐藏base64图片数据以避免日志过长）
  const requestBodyForLog = { ...requestBody };
  if ('image' in requestBodyForLog && typeof requestBodyForLog.image === 'string') {
    requestBodyForLog.image = `[BASE64_IMAGE_DATA_${(requestBodyForLog.image as string).length}_CHARS]`;
  }
  if ('human_image' in requestBodyForLog && typeof requestBodyForLog.human_image === 'string') {
    requestBodyForLog.human_image = `[BASE64_HUMAN_IMAGE_${(requestBodyForLog.human_image as string).length}_CHARS]`;
  }
  if ('cloth_image' in requestBodyForLog && typeof requestBodyForLog.cloth_image === 'string') {
    requestBodyForLog.cloth_image = `[BASE64_CLOTH_IMAGE_${(requestBodyForLog.cloth_image as string).length}_CHARS]`;
  }

  console.log(`${KLING_API_PREFIX} ===== COMPLETE REQUEST BODY =====`);
  console.log(`${KLING_API_PREFIX} 📤 FULL REQUEST:`, JSON.stringify(requestBodyForLog, null, 2));

  const apiToken = getApiToken(accessKey, secretKey);
  let taskId = '';

  const maxSubmitRetries = 3;
  for (let attempt = 0; attempt < maxSubmitRetries; attempt++) {
    try {
      console.log(`${KLING_API_PREFIX} 🔄 Submit attempt ${attempt + 1}/${maxSubmitRetries}...`);
      console.log(`${KLING_API_PREFIX} 🔄 Full submit URL: ${KLING_API_BASE_URL}${submitPath}`);

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

      console.log(`${KLING_API_PREFIX} 📡 Submit response status: ${submitResponse.status}`);
      console.log(`${KLING_API_PREFIX} 📡 Submit response ok: ${submitResponse.ok}`);

      if (!submitResponse.ok) {
        const errorBody = await submitResponse.text();

        // Parse error body to check for specific error codes
        let errorMessage = `Kling API Error on submit to ${submitPath}: ${submitResponse.status} ${errorBody}`;
        let shouldRetry = true;

        try {
          const errorData = JSON.parse(errorBody);
          if (errorData.code) {
            switch (errorData.code) {
              case 1102:
                // Account balance not enough - regardless of HTTP status code
                errorMessage = `💳 Sorry! Our AI designer is currently taking a coffee break due to insufficient account balance. We're working on topping up - please try again in a few minutes! ☕✨`;
                shouldRetry = false;
                break;
              default:
                // For other error codes, check if it's balance-related in the message
                if (errorData.message && errorData.message.toLowerCase().includes('balance')) {
                  errorMessage = `💳 Our AI stylist needs a quick recharge! We're working on resolving the balance issue. Please try again in a few minutes! 🔋✨`;
                  shouldRetry = false;
                } else {
                  errorMessage = `🚨 Kling API Error (${errorData.code}): ${errorData.message || errorBody}`;
                  // For non-balance errors, allow retry based on HTTP status
                  shouldRetry = submitResponse.status >= 500 || submitResponse.status === 429;
                }
            }
          } else if (submitResponse.status === 429) {
            // Rate limit without specific error code
            errorMessage = `⏰ Our AI designer is getting lots of requests! Taking a quick breather - will retry shortly! 🎨`;
            shouldRetry = true;
          }
        } catch (parseError) {
          // If we can't parse the error, use the original message
          console.warn('Could not parse Kling API error response:', parseError);
          // For 429 status, assume it's retryable
          shouldRetry = submitResponse.status >= 500 || submitResponse.status === 429;
        }

        console.error(`${KLING_API_PREFIX} ❌ Submit failed - Status: ${submitResponse.status}, Body: ${errorBody}`);

        // 🔍 NEW: Special handling for 429 balance error
        if (submitResponse.status === 429) {
          console.error(`${KLING_API_PREFIX} 💰 BALANCE ERROR DETECTED! Status 429 - Account balance not enough`);
          console.error(`${KLING_API_PREFIX} 💰 This is the exact error that causes the 503 response to users`);
          console.error(`${KLING_API_PREFIX} 💰 Error details: ${errorBody}`);
        }

        // 🔍 NEW: 输出完整的错误响应
        console.error(`${KLING_API_PREFIX} ===== COMPLETE ERROR RESPONSE =====`);
        console.error(`${KLING_API_PREFIX} 📥 ERROR RESPONSE BODY:`, errorBody);

        const error = new Error(errorMessage);
        if (!shouldRetry) {
          // For non-retryable errors like insufficient balance, throw immediately
          throw error;
        } else {
          // For retryable errors, let the retry logic handle it
          throw error;
        }
      }

      const submitResult = await submitResponse.json();

      // 🔍 NEW: 输出完整的成功响应
      console.log(`${KLING_API_PREFIX} ===== COMPLETE SUBMIT RESPONSE =====`);
      console.log(`${KLING_API_PREFIX} 📥 SUBMIT RESPONSE:`, JSON.stringify(submitResult, null, 2));

      taskId = submitResult.data.task_id;
      console.log(`${KLING_API_PREFIX} ✅ Task submitted successfully to ${submitPath}. Task ID: ${taskId}`);
      break; // Success, exit retry loop
    } catch (error) {
      console.error(`${KLING_API_PREFIX} ❌ Submit attempt ${attempt + 1} failed:`, error);

      // 🔍 NEW: Enhanced error logging
      if (error instanceof Error) {
        console.error(`${KLING_API_PREFIX} ❌ Error type: ${error.constructor.name}`);
        console.error(`${KLING_API_PREFIX} ❌ Error message: ${error.message}`);
      }

      if (attempt === maxSubmitRetries - 1) {
        console.error(`${KLING_API_PREFIX} ❌ Final attempt failed. Giving up.`);
        throw new Error(`Failed to submit Kling task after ${maxSubmitRetries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Determine wait time based on error type
      let waitTime = Math.pow(2, attempt) * 2000; // Default: 2s, 4s
      if (error instanceof Error) {
        if (error.message.includes('taking a quick breather') || error.message.includes('Rate limit')) {
          // For rate limit errors, use longer delays
          waitTime = Math.pow(2, attempt) * 10000; // 10s, 20s for rate limits
          console.log(`${KLING_API_PREFIX} Rate limit detected, using longer delay: ${waitTime}ms`);
        } else if (error.message.includes('getting lots of requests')) {
          // For high traffic situations, use moderate delays
          waitTime = Math.pow(2, attempt) * 5000; // 5s, 10s for high traffic
          console.log(`${KLING_API_PREFIX} High traffic detected, using moderate delay: ${waitTime}ms`);
        }
      }

      console.log(`${KLING_API_PREFIX} ⏳ Waiting ${waitTime}ms before next submit attempt...`);
      await sleep(waitTime);
    }
  }

  // 2. Poll for the result
  let attempts = 0;
  const maxAttempts = 60; // Increased max attempts
  let finalImageUrls: string[] = [];

  console.log(`${KLING_API_PREFIX} 🔄 Starting polling for task ${taskId}...`);

  while (attempts < maxAttempts) {
    await sleep(5000); // Increased to 5-second interval
    attempts++;
    console.log(`${KLING_API_PREFIX} 🔄 Polling attempt #${attempts}/${maxAttempts} for task: ${taskId}`);

    const pollingToken = getApiToken(accessKey, secretKey);

    try {
      const statusCheckResponse = await fetchWithTimeout(`${KLING_API_BASE_URL}${queryPathPrefix}${taskId}`, {
        headers: { 'Authorization': `Bearer ${pollingToken}` },
        timeout: 120000, // Increased to 2 minutes for status check
      });

      console.log(`${KLING_API_PREFIX} 📡 Polling response status: ${statusCheckResponse.status}`);

      if (!statusCheckResponse.ok) {
        const errorBody = await statusCheckResponse.text();
        console.warn(`${KLING_API_PREFIX} ⚠️ Polling failed on attempt ${attempts} with status ${statusCheckResponse.status}`);
        console.warn(`${KLING_API_PREFIX} ⚠️ Polling error body: ${errorBody}`);
        continue;
      }

      const statusResult = await statusCheckResponse.json();
      const taskData = statusResult.data;

      console.log(`${KLING_API_PREFIX} 📊 Task status: ${taskData.task_status}`);

      if (taskData.task_status === "succeed") {
        console.log(`${KLING_API_PREFIX} 🎉 Task succeeded! Full response:`, JSON.stringify(statusResult, null, 2));

        // Handle multiple images from the response
        if (taskData.task_result?.images?.length > 0) {
          finalImageUrls = taskData.task_result.images.map((img: any) => img.url);
          console.log(`${KLING_API_PREFIX} 🎉 Task ${taskId} succeeded! Found ${finalImageUrls.length} images:`, finalImageUrls);
        } else if (taskData.task_result?.url) {
          // Fallback for single image response
          finalImageUrls = [taskData.task_result.url];
          console.log(`${KLING_API_PREFIX} 🎉 Task ${taskId} succeeded! Single image URL:`, finalImageUrls[0]);
        } else {
          throw new Error("Task succeeded, but the response structure for the image URL is unexpected.");
        }

        console.log(`${KLING_API_PREFIX} 🎉 Task ${taskId} completed successfully! Total images: ${finalImageUrls.length}`);
        break;
      } else if (taskData.task_status === "failed") {
        const failureMsg = taskData.task_status_msg || 'Unknown';
        console.error(`${KLING_API_PREFIX} ❌ Task failed. Status: ${taskData.task_status}, Message: ${failureMsg}`);

        // 🔍 NEW: 输出完整的失败响应
        console.error(`${KLING_API_PREFIX} ===== COMPLETE FAILURE RESPONSE =====`);
        console.error(`${KLING_API_PREFIX} 📥 FAILURE RESPONSE:`, JSON.stringify(statusResult, null, 2));
        // 🛡️ NEW: Handle specific "risk control" failure with a user-friendly message
        if (failureMsg.includes("Failure to pass the risk control system")) {
          // Use the custom error to signal a terminal failure
          throw new PolicyRiskError(`Your request could not be processed due to our content policy. Please try a different image or prompt.`);
        }

        const job = await kv.get<Job>(jobId);
        if (job) {
          job.suggestions[suggestionIndex].status = 'failed';
          job.suggestions[suggestionIndex].error = failureMsg;
          await kv.set(jobId, job);
        }
        // Use the custom error for any terminal failure
        throw new TaskFailedError(`Kling task failed. Reason: ${failureMsg}`);
      }
    } catch (pollError) {
      // 🛡️ NEW: Differentiated error handling
      // If it's a terminal task failure, stop polling immediately by re-throwing.
      if (pollError instanceof TaskFailedError || pollError instanceof PolicyRiskError) {
        throw pollError;
      }

      // Otherwise, it's a transient error (network, temporary server issue). Log and continue polling.
      console.warn(`${KLING_API_PREFIX} ⚠️ Polling attempt ${attempts} encountered a transient error:`, pollError);

      // Continue to next attempt unless it's the last one
      if (attempts >= maxAttempts) {
        console.error(`${KLING_API_PREFIX} ❌ Exceeded max polling attempts after transient errors.`);
        throw pollError;
      }
    }
  }

  if (finalImageUrls.length === 0) {
    console.error(`${KLING_API_PREFIX} ⏰ Task ${taskId} timed out after ${maxAttempts} attempts (${maxAttempts * 5} seconds).`);
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
  jobId: string,
  suggestionIndex: number,
  suggestion: Suggestion,
  humanImageUrl: string,
  humanImageName: string,
  humanImageType: string,
  job?: Job
): Promise<{ imageUrls: string[]; finalPrompt: string }> {
  const startTime = Date.now();
  console.log(`${KLING_LOG_PREFIX} [ATOMIC_STEP] Running Stylization with ${modelVersion}...`);
  console.log(`${KLING_LOG_PREFIX} Job customPrompt:`, job?.input.customPrompt);

  // 🔍 NEW: Environment check logging
  console.log(`${KLING_LOG_PREFIX} NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`${KLING_LOG_PREFIX} Is development environment: ${process.env.NODE_ENV === 'development'}`);

  let finalPrompt: string;

  // 🔍 UNIFIED PROMPT CONSTRUCTION: 统一的 prompt 构建逻辑，明确优先级
  console.log(`${KLING_PROMPT_PREFIX} 🔧 Starting unified prompt construction...`);

  // 1️⃣ 最高优先级：AI 生成的 image_prompt
  if (suggestion?.styleSuggestion?.image_prompt) {
    finalPrompt = suggestion.styleSuggestion.image_prompt;
    console.log(`${KLING_PROMPT_PREFIX} ✅ Using AI-generated image_prompt (highest priority)`);
  }
  // 2️⃣ 次高优先级：根据 outfit 详情构建
  else if (suggestion?.styleSuggestion?.outfit_suggestion) {
    const outfitDetails = suggestion.styleSuggestion.outfit_suggestion;
    const outfitDescription = outfitDetails.explanation || outfitDetails.style_summary || "A stylish outfit";
    finalPrompt = `${outfitDetails.outfit_title || "Stylish Look"}. ${outfitDescription}`;
    console.log(`${KLING_PROMPT_PREFIX} ✅ Using outfit details fallback`);
  }
  // 3️⃣ 最低优先级：默认 fallback
  else {
    finalPrompt = "A full-body shot of a person in a stylish outfit, standing in a visually appealing, realistic setting. The image is well-lit, with a clear focus on the person and their clothing. The background is a real-world scene, like a chic city street, a modern interior, or a scenic outdoor location. The overall aesthetic is fashionable, clean, and high-quality.";
    console.log(`${KLING_PROMPT_PREFIX} ⚠️ Using default fallback prompt`);
  }

  // 🔍 UNIFIED FORMATTING: 统一添加格式描述
  finalPrompt = `${finalPrompt}. ${IMAGE_FORMAT_DESCRIPTION} ${STRICT_REALISM_PROMPT_BLOCK}`;
  console.log(`${KLING_PROMPT_PREFIX} ✅ Added format description and realism block`);

  // 🔍 PROMPT VALIDATION: 长度检查和日志
  if (finalPrompt.length > 2500) {
    console.warn(`${KLING_PROMPT_PREFIX} ⚠️ Prompt too long (${finalPrompt.length} chars), truncating to 2500 chars`);
    // log the truncated part of the prompt
    console.log(`${KLING_PROMPT_PREFIX} ⚠️ Truncated prompt:`, finalPrompt.substring(2500));

    finalPrompt = finalPrompt.substring(0, 2500);
  }

  console.log(`${KLING_PROMPT_PREFIX} 🎯 Final prompt constructed (${finalPrompt.length} chars):`, finalPrompt);

  // 🔍 NEW: Always use real stylization API (even in development)
  // Only virtual try-on should be mocked, not stylization
  console.log(`${KLING_LOG_PREFIX} 🚀 Always using real Kling AI stylization API`);
  console.log(`${KLING_LOG_PREFIX} 🚀 API endpoint: ${KLING_API_BASE_URL}${KOLORS_STYLIZE_SUBMIT_PATH}`);
  console.log(`${KLING_LOG_PREFIX} 🚀 Model version: ${modelVersion}`);
  console.log(`${KLING_LOG_PREFIX} 🚀 Environment: ${process.env.NODE_ENV}`);

  // 🔍 NEW: Check API keys availability, especially in development
  if (!KLING_ACCESS_KEY || !KLING_SECRET_KEY) {
    console.error(`${KLING_LOG_PREFIX} ❌ API keys not configured`);
    console.error(`${KLING_LOG_PREFIX} ❌ ACCESS_KEY: ${KLING_ACCESS_KEY ? 'SET' : 'MISSING'}`);
    console.error(`${KLING_LOG_PREFIX} ❌ SECRET_KEY: ${KLING_SECRET_KEY ? 'SET' : 'MISSING'}`);

    if (process.env.NODE_ENV === 'development') {
      console.error(`${KLING_LOG_PREFIX} 💡 Development environment detected`);
      console.error(`${KLING_LOG_PREFIX} 💡 To use real stylization API, set KLING_AI_ACCESS_KEY and KLING_AI_SECRET_KEY`);
      console.error(`${KLING_LOG_PREFIX} 💡 For full mock experience, use tryon-only mode`);
    }

    throw new Error("Kling AI API keys are not configured. Please set KLING_AI_ACCESS_KEY and KLING_AI_SECRET_KEY environment variables.");
  }

  const humanImageBase64 = await fileToBase64(await urlToFile(humanImageUrl, humanImageName, humanImageType));
  const requestBody = buildStylizeRequestBody(modelVersion, finalPrompt, humanImageBase64);

  const styledImageUrls = await executeKlingTask(KOLORS_STYLIZE_SUBMIT_PATH, KOLORS_STYLIZE_STATUS_PATH, requestBody, jobId, suggestionIndex);

  const endTime = Date.now();
  console.log(`${KLING_LOG_PREFIX} [ATOMIC_STEP] Stylization with ${modelVersion} complete. Elapsed: ${endTime - startTime}ms.`);
  console.log(`${KLING_LOG_PREFIX} Stylization with ${modelVersion} complete: ${styledImageUrls.length} images generated`);
  styledImageUrls.forEach((url, index) => {
    console.log(`${KLING_LOG_PREFIX} Image ${index + 1} URL:`, url.substring(0, 100));
  });

  return { imageUrls: styledImageUrls, finalPrompt };
}

/**
 * ATOMIC STEP: Runs stylization for multiple prompts in parallel.
 */
export async function runStylizationParallel(
  modelVersion: 'kling-v1-5' | 'kling-v2',
  jobId: string,
  suggestionIndex: number,
  prompts: string[],
  humanImageUrl: string,
  humanImageName: string,
  humanImageType: string,
  job?: Job
): Promise<{ imageUrls: string[], finalPrompt: string }[]> {
  const startTime = Date.now();
  console.log(`${KLING_LOG_PREFIX} [ATOMIC_STEP] Running Parallel Stylization with ${modelVersion} for ${prompts.length} prompts...`);

  const humanImageBase64 = await fileToBase64(await urlToFile(humanImageUrl, humanImageName, humanImageType));

  const results = await Promise.all(
    prompts.map(async (prompt) => {
      const requestBody = buildStylizeRequestBody(modelVersion, prompt, humanImageBase64);
      const imageUrls = await executeKlingTask(KOLORS_STYLIZE_SUBMIT_PATH, KOLORS_STYLIZE_STATUS_PATH, requestBody, jobId, suggestionIndex);
      return { imageUrls, finalPrompt: prompt };
    })
  );

  const endTime = Date.now();
  console.log(`${KLING_LOG_PREFIX} [ATOMIC_STEP] Parallel Stylization complete. Elapsed: ${endTime - startTime}ms.`);
  console.log(`${KLING_LOG_PREFIX} Parallel Stylization complete: Generated ${results.length} groups with total ${results.reduce((sum, result) => sum + result.imageUrls.length, 0)} images`);
  results.forEach((result, index) => {
    console.log(`${KLING_LOG_PREFIX} Group ${index + 1}: ${result.imageUrls.length} images`);
  });
  return results;
}

export async function runStylization(modelVersion: 'kling-v1-5' | 'kling-v2', jobId: string, suggestionIndex: number, prompt: string, humanImageUrl: string, humanImageName: string, humanImageType: string, job?: Job): Promise<string> {
  const result = await runStylizationMultiple(modelVersion, jobId, suggestionIndex, { finalPrompt: prompt } as Suggestion, humanImageUrl, humanImageName, humanImageType, job);
  if (!result.imageUrls[0]) {
    throw new Error("Stylization did not return an image.");
  }
  return result.imageUrls[0];
}

/**
 * ATOMIC STEP: Performs virtual try-on, returning multiple images.
 */
export async function runVirtualTryOnMultiple(jobId: string,
  suggestionIndex: number, canvasImageUrl: string, garmentImageUrl: string, garmentImageName: string, garmentImageType: string): Promise<string[]> {
  const startTime = Date.now();
  console.log(`${KLING_LOG_PREFIX} [ATOMIC_STEP] Running Virtual Try-On...`);

  // 🔍 NEW: Environment check logging
  console.log(`${KLING_LOG_PREFIX} NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`${KLING_LOG_PREFIX} MOCK_VIRTUAL_TRYON: ${process.env.MOCK_VIRTUAL_TRYON}`);
  console.log(`${KLING_LOG_PREFIX} Canvas image: ${canvasImageUrl.substring(0, 100)}...`);
  console.log(`${KLING_LOG_PREFIX} Garment image: ${garmentImageUrl.substring(0, 100)}...`);

  // 🔍 NEW: Controlled mock for virtual try-on via environment flag
  if (process.env.MOCK_VIRTUAL_TRYON === 'true') {
    console.log(`${KLING_LOG_PREFIX} 🎭 MOCK_VIRTUAL_TRYON is 'true' - Using mock virtual try-on images`);
    console.log(`${KLING_LOG_PREFIX} 🎭 Skipping Kling AI virtual try-on API call (/v1/images/kolors-virtual-try-on)`);
    console.log(`${KLING_LOG_PREFIX} 🎭 This would have called: ${KLING_API_BASE_URL}${KOLORS_VIRTUAL_TRYON_SUBMIT_PATH}`);
    console.log(`${KLING_LOG_PREFIX} 🎭 Canvas image: ${canvasImageUrl.substring(0, 100)}...`);
    console.log(`${KLING_LOG_PREFIX} 🎭 Garment: ${garmentImageName} (${garmentImageType})`);

    // Mock multiple try-on images with base64 data URIs (more reliable than external URLs)
    const mockTryOnImageUrls = [
      // Small 1x1 pixel images in base64 format to avoid network issues
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77hQAAAABJRU5ErkJggg==", // Mock Try-On 1
    ];

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000)); // Reduced mock time

    const endTime = Date.now();
    console.log(`${KLING_LOG_PREFIX} 🎭 Mock virtual try-on complete. Elapsed: ${endTime - startTime}ms.`);
    console.log(`${KLING_LOG_PREFIX} 🎭 Mock virtual try-on complete: ${mockTryOnImageUrls.length} images generated`);
    mockTryOnImageUrls.forEach((url, index) => {
      console.log(`${KLING_LOG_PREFIX} 🎭 Mock try-on image ${index + 1}: base64 data URI (${url.length} chars)`);
    });

    return mockTryOnImageUrls;
  }

  // 🔍 Real API call (mocking is disabled)
  console.log(`${KLING_LOG_PREFIX} 🚀 MOCK_VIRTUAL_TRYON is not 'true' - Making real Kling AI virtual try-on API call`);
  console.log(`${KLING_LOG_PREFIX} 🚀 API endpoint: ${KLING_API_BASE_URL}${KOLORS_VIRTUAL_TRYON_SUBMIT_PATH}`);
  console.log(`${KLING_LOG_PREFIX} 🚀 Model: kolors-virtual-try-on-v1-5`);
  console.log(`${KLING_LOG_PREFIX} 🚀 Processing images for API request...`);

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

  console.log(`${KLING_LOG_PREFIX} 🚀 Request body prepared, calling executeKlingTask...`);
  console.log(`${KLING_LOG_PREFIX} 🚀 Human image size: ${humanImageBase64.length} characters`);
  console.log(`${KLING_LOG_PREFIX} 🚀 Garment image size: ${garmentImageBase64.length} characters`);

  const tryOnImageUrls = await executeKlingTask(KOLORS_VIRTUAL_TRYON_SUBMIT_PATH, KOLORS_VIRTUAL_TRYON_STATUS_PATH, requestBody, jobId, suggestionIndex);

  const endTime = Date.now();
  console.log(`${KLING_LOG_PREFIX} [ATOMIC_STEP] Virtual Try-On complete. Elapsed: ${endTime - startTime}ms.`);
  console.log(`${KLING_LOG_PREFIX} Virtual Try-On complete: ${tryOnImageUrls.length} images generated`);
  tryOnImageUrls.forEach((url, index) => {
    console.log(`${KLING_LOG_PREFIX} Try-on image ${index + 1} URL:`, url.substring(0, 100));
  });
  return tryOnImageUrls;
}

export async function runVirtualTryOn(jobId: string, suggestionIndex: number, canvasImageUrl: string, garmentImageUrl: string, garmentImageName: string, garmentImageType: string): Promise<string> {
  const results = await runVirtualTryOnMultiple(jobId, suggestionIndex, canvasImageUrl, garmentImageUrl, garmentImageName, garmentImageType);
  if (!results[0]) {
    throw new Error("Virtual Try-On did not return an image.");
  }
  return results[0];
}