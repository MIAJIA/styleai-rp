import { NextResponse } from 'next/server';
import * as jwt from "jsonwebtoken";

// --- Helper Functions from Reference ---

// Helper function to convert a File to a Base64 string
const fileToBase64 = async (file: File): Promise<string> => {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  return buffer.toString("base64");
};

// Helper function to convert URL to Base64
const urlToBase64 = async (url: string): Promise<string> => {
  const response = await fetchWithTimeout(url, { timeout: 60000 });
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return buffer.toString("base64");
};

// Helper function for delaying execution, to be used in polling
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// A robust fetch function with a timeout
async function fetchWithTimeout(
  resource: RequestInfo,
  options: RequestInit & { timeout: number }
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

// --- Kling AI JWT Authentication ---
const getApiToken = (accessKey: string, secretKey: string): string => {
  const payload = {
    iss: accessKey,
    exp: Math.floor(Date.now() / 1000) + 1800, // 30 minutes expiration
    nbf: Math.floor(Date.now() / 1000) - 5, // 5 seconds tolerance
  };
  const token = jwt.sign(payload, secretKey, { algorithm: 'HS256', header: { alg: "HS256", typ: "JWT" } });
  return token;
}

// --- Kling AI API Configuration ---
const KLING_ACCESS_KEY = process.env.KLING_AI_ACCESS_KEY;
const KLING_SECRET_KEY = process.env.KLING_AI_SECRET_KEY;

const KLING_API_BASE_URL = "https://api-beijing.klingai.com";
const IMAGE_GENERATION_SUBMIT_PATH = "/v1/images/generations";
const IMAGE_GENERATION_STATUS_PATH = "/v1/images/generations/";

const IMAGE_TRYON_SUBMIT_PATH = "/v1/images/kolors-virtual-try-on";
const KOLORS_VIRTUAL_TRYON_STATUS_PATH = "/v1/images/kolors-virtual-try-on/";

// --- Dynamic request body builder ---
const buildRequestBody = (
  modelVersion: string,
  prompt: string,
  humanImageBase64: string
): object => {
  // Base parameters common to most models
  const baseBody = {
    prompt: prompt,
    aspect_ratio: "3:4",
    image: humanImageBase64,
  };
  console.log("!!! build request body with modelVersion:", modelVersion);
  switch (modelVersion) {
    case 'kling-v1-5':
      return {
        ...baseBody,
        image_reference: "face", // This model supports image_reference
        human_fidelity: 1,
        model_name: "kling-v1-5",
      };
    case 'kling-v2':
      return {
        ...baseBody,
        model_name: "kling-v2", // This model does NOT support image_reference
      };
    default:
      // Defaulting to v2 as a sensible choice, which doesn't use image_reference
      return {
        ...baseBody,
        model_name: "kling-v2",
      };
  }
};

// --- Generic Kling Task Executor ---
async function executeKlingTask(submitPath: string, queryPathPrefix: string, requestBody: object): Promise<string> {
  // 1. Submit the task
  const apiToken = getApiToken(KLING_ACCESS_KEY!, KLING_SECRET_KEY!);
  const submitResponse = await fetchWithTimeout(`${KLING_API_BASE_URL}${submitPath}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
    timeout: 60000,
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
  const maxAttempts = 40;
  let finalImageUrl = "";

  while (attempts < maxAttempts) {
      console.log(`Polling attempt #${attempts + 1} for task: ${taskId}`);
      const pollingToken = getApiToken(KLING_ACCESS_KEY!, KLING_SECRET_KEY!);
      const statusCheckResponse = await fetchWithTimeout(`${KLING_API_BASE_URL}${queryPathPrefix}${taskId}`, {
          headers: { 'Authorization': `Bearer ${pollingToken}` },
          timeout: 60000,
      });

      if (!statusCheckResponse.ok) {
          throw new Error(`Kling API Error on status check: ${await statusCheckResponse.text()}`);
      }

      const statusResult = await statusCheckResponse.json();
      const taskData = statusResult.data;

      if (taskData.task_status === "succeed") {
          console.log("Task succeeded. Full task_result data:", JSON.stringify(taskData.task_result, null, 2));

          // Defensive parsing for different possible success structures
          if (taskData.task_result && taskData.task_result.images && taskData.task_result.images.length > 0) {
              finalImageUrl = taskData.task_result.images[0].url;
          } else if (taskData.task_result && taskData.task_result.url) {
              // Handle cases where the URL is directly in the task_result object
              finalImageUrl = taskData.task_result.url;
          } else {
              throw new Error("Task succeeded, but the response structure for the image URL is unexpected. Check the server logs for the 'Full task_result data' output to see the actual structure.");
          }

          console.log(`Task ${taskId} succeeded! Image URL:`, finalImageUrl);
          break;
      } else if (taskData.task_status === "failed") {
          throw new Error(`Kling task failed. Reason: ${taskData.task_status_msg || 'Unknown'}`);
      }

      attempts++;
      await sleep(3000);
  }

  if (!finalImageUrl) {
      throw new Error("Kling task timed out after multiple attempts.");
  }

  return finalImageUrl;
}

async function getStyledImageUrl(humanImageBase64: string, prompt: string, modelVersion: string): Promise<string> {
    console.log(`--- Starting Step 4: Styled Image Generation ---`);
    console.log(`Submitting task to Kling AI using model: ${modelVersion}...`);
    console.log("～～～ Kling Prompt:", prompt);
    const requestBody = buildRequestBody(modelVersion, prompt, humanImageBase64);
    return executeKlingTask(IMAGE_GENERATION_SUBMIT_PATH, IMAGE_GENERATION_STATUS_PATH, requestBody);
}

async function getTryOnImageUrl(generatedImageUrl: string, garmentImageFile: File): Promise<string> {
    console.log("--- Starting Step 5: Try-On Task ---");

    const generatedImageBase64 = await urlToBase64(generatedImageUrl);
    const garmentImageBase64 = await fileToBase64(garmentImageFile);

    const tryOnRequestBody = {
        human_image: generatedImageBase64,
        cloth_image: garmentImageBase64,
        model_name: "kolors-virtual-try-on-v1-5"
    };

    return executeKlingTask(IMAGE_TRYON_SUBMIT_PATH, KOLORS_VIRTUAL_TRYON_STATUS_PATH, tryOnRequestBody);
}

export async function POST(request: Request) {
  if (!KLING_ACCESS_KEY || !KLING_SECRET_KEY) {
    return NextResponse.json({ error: "Kling AccessKey or SecretKey is not configured." }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const humanImageFile = formData.get('human_image') as File | null;
    const garmentImageFile = formData.get('garment_image') as File | null;
    const prompt = formData.get('prompt') as string | null;
    const modelVersion = formData.get('modelVersion') as string | null;

    if (!humanImageFile || !garmentImageFile || !prompt || !modelVersion) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Step 1: Convert human image to Base64
    const humanImageBase64 = await fileToBase64(humanImageFile);

    // --- Step 4: Call the Styled Image Generation Function ---
    const styledImageUrl = await getStyledImageUrl(humanImageBase64, prompt, modelVersion);

    // --- Step 5: Call the Try-On API with the generated image and the garment ---
    const finalTryOnUrl = await getTryOnImageUrl(styledImageUrl, garmentImageFile);

    // Step 6: Return the final image URL to the frontend
    return NextResponse.json({ imageUrl: finalTryOnUrl });

  } catch (error) {
    console.error('Error in /api/generate-style-v2:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status: 500 });
  }
}