import { NextResponse } from 'next/server';
import * as jwt from "jsonwebtoken";

// --- Helper Functions from Reference ---

// Helper function to convert a File to a Base64 string
const fileToBase64 = async (file: File): Promise<string> => {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
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


export async function POST(request: Request) {
  if (!KLING_ACCESS_KEY || !KLING_SECRET_KEY) {
    return NextResponse.json({ error: "Kling AccessKey or SecretKey is not configured." }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const humanImageFile = formData.get('human_image') as File | null;
    // garmentImage is not used by the Kling API directly; its info is in the prompt.
    // const garmentImage = formData.get('garment_image') as File | null;
    const prompt = formData.get('prompt') as string | null;
    const modelVersion = formData.get('modelVersion') as string | null;

    if (!humanImageFile || !prompt || !modelVersion) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Step 1: Convert human image to Base64
    const humanImageBase64 = await fileToBase64(humanImageFile);

    // Step 2: Get API Token
    const apiToken = getApiToken(KLING_ACCESS_KEY, KLING_SECRET_KEY);

    // Step 3: Build the request body for the specified model
    const requestBody = buildRequestBody(modelVersion, prompt, humanImageBase64);
    console.log(`Submitting image generation task to Kling AI using model: ${modelVersion}...`);
    console.log("～～～Final Kling Prompt:", prompt);

    // Step 4: Submit the image generation task
    const submitResponse = await fetchWithTimeout(`${KLING_API_BASE_URL}${IMAGE_GENERATION_SUBMIT_PATH}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      timeout: 60000, // 60-second timeout
    });

    if (!submitResponse.ok) {
      const errorBody = await submitResponse.text();
      throw new Error(`Kling API Error on submit: ${submitResponse.status} ${errorBody}`);
    }

    const submitResult = await submitResponse.json();
    const taskId = submitResult.data.task_id;
    console.log(`Image generation task submitted successfully. Task ID: ${taskId}`);

    // Step 5: Poll for the result
    let attempts = 0;
    const maxAttempts = 40; // Approx 2 minutes (40 attempts * 3s sleep)
    let finalImageUrl = "";

    while (attempts < maxAttempts) {
        console.log(`Polling attempt #${attempts + 1} for task: ${taskId}`);
        const pollingToken = getApiToken(KLING_ACCESS_KEY, KLING_SECRET_KEY);

        const statusCheckResponse = await fetchWithTimeout(`${KLING_API_BASE_URL}${IMAGE_GENERATION_STATUS_PATH}${taskId}`, {
          headers: { 'Authorization': `Bearer ${pollingToken}` },
          timeout: 60000,
        });

        if (!statusCheckResponse.ok) {
            const errorBody = await statusCheckResponse.text();
            throw new Error(`Kling API Error on status check: ${statusCheckResponse.status} ${errorBody}`);
        }

        const statusResult = await statusCheckResponse.json();
        const taskData = statusResult.data;

        if (taskData.task_status === "succeed") {
            finalImageUrl = taskData.task_result.images[0].url;
            console.log("Image generation succeeded! Image URL:", finalImageUrl);
            break;
        } else if (taskData.task_status === "failed") {
            throw new Error(`Kling generation failed. Reason: ${taskData.task_status_msg || 'Unknown'}`);
        }

        attempts++;
        await sleep(3000); // Wait 3 seconds before the next poll
    }

    if (!finalImageUrl) {
        throw new Error("Kling generation timed out after multiple attempts.");
    }

    // Step 6: Return the final image URL to the frontend
    return NextResponse.json({ imageUrl: finalImageUrl });

  } catch (error) {
    console.error('Error in /api/generate-style-v2:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status: 500 });
  }
}