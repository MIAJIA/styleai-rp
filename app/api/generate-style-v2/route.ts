import { NextResponse } from "next/server";
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

// --- Kling AI JWT Authentication ---
const getApiToken = (accessKey: string, secretKey: string): string => {
  const payload = {
    iss: accessKey,
    exp: Math.floor(Date.now() / 1000) + 1800, // 30 minutes expiration
    nbf: Math.floor(Date.now() / 1000) - 5, // 5 seconds tolerance
  };
  const token = jwt.sign(payload, secretKey, {
    algorithm: "HS256",
    header: { alg: "HS256", typ: "JWT" },
  });
  return token;
};

// --- Kling AI API Configuration ---
const KLING_ACCESS_KEY = process.env.KLING_AI_ACCESS_KEY;
const KLING_SECRET_KEY = process.env.KLING_AI_SECRET_KEY;

const KLING_API_BASE_URL = "https://api-beijing.klingai.com";
const IMAGE_GENERATION_SUBMIT_PATH = "/v1/images/generations";
const IMAGE_GENERATION_STATUS_PATH = "/v1/images/generations/";

const IMAGE_TRYON_SUBMIT_PATH = "/v1/images/kolors-virtual-try-on";
const KOLORS_VIRTUAL_TRYON_STATUS_PATH = "/v1/images/kolors-virtual-try-on/";

// --- Face Swap API Configuration (File-based, Final) ---
const FACE_SWAP_API_URL = "https://ai-face-swap2.p.rapidapi.com/public/process/files";
const FACE_SWAP_API_HOST = "ai-face-swap2.p.rapidapi.com";

// --- Dynamic request body builder ---
const buildRequestBody = (
  modelVersion: string,
  prompt: string,
  humanImageBase64: string,
): object => {
  // Base parameters common to most models
  const baseBody = {
    prompt: prompt,
    aspect_ratio: "3:4",
    image: humanImageBase64,
  };
  console.log("!!! build request body with modelVersion:", modelVersion);
  switch (modelVersion) {
    case "kling-v1-5":
      return {
        ...baseBody,
        image_reference: "face", // This model supports image_reference
        human_fidelity: 1,
        model_name: "kling-v1-5",
      };
    case "kling-v2":
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
async function executeKlingTask(
  submitPath: string,
  queryPathPrefix: string,
  requestBody: object,
): Promise<string> {
  // 1. Submit the task
  const apiToken = getApiToken(KLING_ACCESS_KEY!, KLING_SECRET_KEY!);
  const submitResponse = await fetchWithTimeout(`${KLING_API_BASE_URL}${submitPath}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
    timeout: 60000,
  });

  if (!submitResponse.ok) {
    const errorBody = await submitResponse.text();
    throw new Error(
      `Kling API Error on submit to ${submitPath}: ${submitResponse.status} ${errorBody}`,
    );
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
    const statusCheckResponse = await fetchWithTimeout(
      `${KLING_API_BASE_URL}${queryPathPrefix}${taskId}`,
      {
        headers: { Authorization: `Bearer ${pollingToken}` },
        timeout: 60000,
      },
    );

    if (!statusCheckResponse.ok) {
      throw new Error(`Kling API Error on status check: ${await statusCheckResponse.text()}`);
    }

    const statusResult = await statusCheckResponse.json();
    const taskData = statusResult.data;

    if (taskData.task_status === "succeed") {
      console.log(
        "Task succeeded. Full task_result data:",
        JSON.stringify(taskData.task_result, null, 2),
      );

      // Defensive parsing for different possible success structures
      if (
        taskData.task_result &&
        taskData.task_result.images &&
        taskData.task_result.images.length > 0
      ) {
        finalImageUrl = taskData.task_result.images[0].url;
      } else if (taskData.task_result && taskData.task_result.url) {
        // Handle cases where the URL is directly in the task_result object
        finalImageUrl = taskData.task_result.url;
      } else {
        throw new Error(
          "Task succeeded, but the response structure for the image URL is unexpected. Check the server logs for the 'Full task_result data' output to see the actual structure.",
        );
      }

      console.log(`Task ${taskId} succeeded! Image URL:`, finalImageUrl);
      break;
    } else if (taskData.task_status === "failed") {
      throw new Error(`Kling task failed. Reason: ${taskData.task_status_msg || "Unknown"}`);
    }

    attempts++;
    await sleep(3000);
  }

  if (!finalImageUrl) {
    throw new Error("Kling task timed out after multiple attempts.");
  }

  return finalImageUrl;
}

// --- Step 6: AI Face Swap Function (File-based multipart/form-data) ---
async function faceSwap(sourceFile: File, targetFile: File): Promise<string> {
  console.log("--- Starting Step 6: AI Face Swap (File Upload) ---");
  const rapidApiKey = process.env.RAPIDAPI_KEY;
  if (!rapidApiKey) {
    throw new Error("RAPIDAPI_KEY is not set in environment variables.");
  }

  // Use FormData to send files as multipart/form-data.
  const formData = new FormData();
  formData.append("source", sourceFile);
  formData.append("target", targetFile);

  const response = await fetchWithTimeout(FACE_SWAP_API_URL, {
    method: "POST",
    headers: {
      // DO NOT set Content-Type. The runtime will set it automatically
      // to multipart/form-data with the correct boundary.
      accept: "application/json",
      "x-rapidapi-host": FACE_SWAP_API_HOST,
      "x-rapidapi-key": rapidApiKey,
    },
    body: formData,
    timeout: 90000,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("Face Swap API Error Response:", errorBody);
    throw new Error(`Face swap API request failed: ${response.status} ${errorBody}`);
  }

  const result = await response.json();
  const swappedImageUrl = result.file_url; // The API returns a URL in the 'file_url' field

  if (!swappedImageUrl) {
    console.error(
      "Face Swap API Response did not contain 'file_url':",
      JSON.stringify(result, null, 2),
    );
    throw new Error("Face swap API did not return a valid image URL.");
  }

  console.log("Face swap completed successfully. Final URL:", swappedImageUrl);
  return swappedImageUrl;
}

async function getStyledImageUrl(
  humanImageBase64: string,
  prompt: string,
  modelVersion: string,
): Promise<string> {
  console.log(`--- Starting Step 4: Styled Image Generation ---`);
  console.log(`Submitting task to Kling AI using model: ${modelVersion}...`);
  console.log("～～～ Kling Prompt:", prompt);
  const requestBody = buildRequestBody(modelVersion, prompt, humanImageBase64);
  return executeKlingTask(IMAGE_GENERATION_SUBMIT_PATH, IMAGE_GENERATION_STATUS_PATH, requestBody);
}

async function getTryOnImageUrl(
  generatedImageUrl: string,
  garmentImageFile: File,
): Promise<string> {
  console.log("--- Starting Step 5: Try-On Task ---");

  const generatedImageBase64 = await urlToBase64(generatedImageUrl);
  const garmentImageBase64 = await fileToBase64(garmentImageFile);

  const tryOnRequestBody = {
    human_image: generatedImageBase64,
    cloth_image: garmentImageBase64,
    model_name: "kolors-virtual-try-on-v1-5",
  };

  return executeKlingTask(
    IMAGE_TRYON_SUBMIT_PATH,
    KOLORS_VIRTUAL_TRYON_STATUS_PATH,
    tryOnRequestBody,
  );
}

export async function POST(request: Request) {
  console.log("\n--- ENTERING /api/generate-style-v2 ---");
  if (!KLING_ACCESS_KEY || !KLING_SECRET_KEY) {
    console.error("generate-style-v2: Kling AccessKey or SecretKey is not configured.");
    return NextResponse.json(
      { error: "Kling AccessKey or SecretKey is not configured." },
      { status: 500 },
    );
  }

  try {
    const formData = await request.formData();
    console.log("generate-style-v2: FormData received from client.");

    const humanImageFile = formData.get("human_image") as File | null;
    const garmentImageFile = formData.get("garment_image") as File | null;
    const prompt = formData.get("prompt") as string | null;
    const modelVersion = formData.get("modelVersion") as string | null;

    // --- Detailed Logging of Received Fields ---
    console.log(
      `[SERVER-CHECK] Received human_image: ${humanImageFile ? `YES (name: ${humanImageFile.name}, size: ${humanImageFile.size})` : "NO"}`,
    );
    console.log(
      `[SERVER-CHECK] Received garment_image: ${garmentImageFile ? `YES (name: ${garmentImageFile.name}, size: ${garmentImageFile.size})` : "NO"}`,
    );
    console.log(
      `[SERVER-CHECK] Received prompt: ${prompt ? `YES (value: "${prompt.substring(0, 50)}...")` : "NO"}`,
    );
    console.log(
      `[SERVER-CHECK] Received modelVersion: ${modelVersion ? `YES (value: ${modelVersion})` : "NO"}`,
    );
    // --- End of Logging ---

    if (!humanImageFile || !garmentImageFile || !prompt || !modelVersion) {
      console.error("generate-style-v2: A required field was missing. Aborting with 400.");
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Step 1: Convert human image to Base64. This will be the "source" for the face swap.
    console.log("\n[STEP 1/7] Converting user image to Base64...");
    const humanImageBase64 = await fileToBase64(humanImageFile);
    console.log("[STEP 1/7] Conversion complete.");

    // --- Step 4: Call the Styled Image Generation Function ---
    console.log("\n[STEP 4/7] Starting styled image generation...");
    const styledImageUrl = await getStyledImageUrl(humanImageBase64, prompt, modelVersion);
    console.log("[STEP 4/7] Styled image generation complete. URL:", styledImageUrl);

    // --- Step 5: Call the Try-On API with the generated image and the garment ---
    console.log("\n[STEP 5/7] Starting virtual try-on...");
    const finalTryOnUrl = await getTryOnImageUrl(styledImageUrl, garmentImageFile);
    console.log("[STEP 5/7] Virtual try-on complete. URL:", finalTryOnUrl);

    // --- Step 6: Prepare for and Call the Face Swap API ---
    console.log("\n[STEP 6/7] Preparing files for face swap...");
    // Fetch the generated try-on image and create a File object from it.
    const tryOnImageResponse = await fetch(finalTryOnUrl);
    const tryOnImageBlob = await tryOnImageResponse.blob();
    const tryOnImageFile = new File([tryOnImageBlob], "target_image.png", {
      type: tryOnImageBlob.type,
    });

    console.log("[STEP 6/7] Performing face swap via file upload...");
    // Now, perform the swap using the original file and the newly created file.
    const finalImageUrl = await faceSwap(humanImageFile, tryOnImageFile);
    console.log("[STEP 6/7] Face swap complete.");

    // Step 7: Return the final image URL directly to the frontend
    console.log("\n[STEP 7/7] Process complete. Sending final URL to client...");
    return NextResponse.json({ imageUrl: finalImageUrl });
  } catch (error) {
    console.error("Error in /api/generate-style-v2:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { error: "Internal Server Error", details: errorMessage },
      { status: 500 },
    );
  }
}
