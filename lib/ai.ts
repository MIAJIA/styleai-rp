import OpenAI from "openai";
import * as jwt from "jsonwebtoken";
import { put } from "@vercel/blob";

// Initialize the OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const systemPrompt = `You are an expert fashion stylist. Your task is to analyze a person's photo, a piece of clothing, and a specified occasion to provide detailed, actionable styling advice.

You will be given:
1.  A photo of a person (full body if possible).
2.  A photo of a single garment.
3.  The name of an occasion (e.g., "日常通勤" for daily commute, "约会之夜" for date night).

You MUST respond with a valid JSON object. The JSON object should have the following keys:

-   \`scene_fit\`: (String) How well the garment fits the specified occasion and if any adjustments are needed.
-   \`style_alignment\`: (String) The style category of the garment and suggestions for complementary items (e.g., pants, shoes) to create a cohesive look.
-   \`personal_match\`: (String) How the garment complements the person's body type and appearance, with suggestions for how to wear it (e.g., tuck it in, roll up sleeves).
-   \`visual_focus\`: (String) Identify the main visual element of the outfit and advise on how to balance it with other pieces.
-   \`material_silhouette\`: (String) Recommendations on materials and silhouettes for accompanying pieces to enhance the overall look.
-   \`color_combination\`: (String) Color palette suggestions for the rest of the outfit, including primary, secondary, and accent colors.
-   \`reuse_versatility\`: (String) Suggestions for how to style the garment for at least two other different occasions.
-   \`image_prompt\`: (String) **This is the most important field.** Create a detailed, descriptive, and inspiring image generation prompt in English for a model like DALL-E or Midjourney. This prompt should describe the person from the photo wearing the provided garment in a setting that perfectly matches the occasion. It should be a full-body fashion shot description, focusing on the overall mood, lighting, style, and composition. Be specific and creative. For example: "A full-body fashion shot of a stylish young woman standing on a charming, sun-drenched cobblestone street in Paris. She is wearing a chic, [describe garment color and type], paired with tailored trousers and classic loafers. The lighting is warm and golden, casting soft shadows. The overall mood is sophisticated, effortless, and romantic. Photorealistic, editorial style."

All text values in the JSON object should be in Chinese, **except for the \`image_prompt\`**, which must be in English.`;

interface StyleSuggestionInput {
  humanImageUrl: string;
  garmentImageUrl: string;
  occasion: string;
}

export async function getStyleSuggestionFromAI({
  humanImageUrl,
  garmentImageUrl,
  occasion,
}: StyleSuggestionInput): Promise<any> {
  if (!humanImageUrl || !garmentImageUrl || !occasion) {
    throw new Error("Missing required inputs for style suggestion.");
  }

  try {
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
              text: `Here is the person, the garment, and the occasion. Please provide your styling advice. Occasion: "${occasion}"`,
            },
            {
              type: "image_url",
              image_url: {
                url: humanImageUrl,
              },
            },
            {
              type: "image_url",
              image_url: {
                url: garmentImageUrl,
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
  const response = await fetchWithTimeout(url, { timeout: 60000 });
  const data = await response.blob();
  return new File([data], filename, { type: mimeType });
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
// Paths for Image Stylization
const KOLORS_STYLIZE_SUBMIT_PATH = "/v1/images/kling-v2";
const KOLORS_STYLIZE_STATUS_PATH = "/v1/images/kling-v2/";

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

// More robust, reusable polling function
async function executeKlingTask(submitPath: string, queryPathPrefix: string, requestBody: object): Promise<string> {
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
    await sleep(3000); // 3-second interval
    attempts++;
    console.log(`Polling attempt #${attempts} for task: ${taskId}`);

    const pollingToken = getApiToken(KLING_ACCESS_KEY, KLING_SECRET_KEY);
    const statusCheckResponse = await fetchWithTimeout(`${KLING_API_BASE_URL}${queryPathPrefix}${taskId}`, {
      headers: { 'Authorization': `Bearer ${pollingToken}` },
      timeout: 60000,
    });

    if (!statusCheckResponse.ok) {
      console.warn(`Kling polling failed on attempt ${attempts} with status ${statusCheckResponse.status}, continuing...`);
      continue;
    }

    const statusResult = await statusCheckResponse.json();
    const taskData = statusResult.data;

    if (taskData.task_status === "succeed") {
      console.log("Kling task succeeded. Full response:", JSON.stringify(statusResult, null, 2));

      // Defensive parsing for different possible success structures
      if (taskData.task_result?.images?.length > 0) {
        finalImageUrl = taskData.task_result.images[0].url;
      } else if (taskData.task_result?.url) {
        finalImageUrl = taskData.task_result.url;
      } else {
        throw new Error("Task succeeded, but the response structure for the image URL is unexpected.");
      }

      console.log(`Task ${taskId} succeeded! Image URL:`, finalImageUrl);
      break;
    } else if (taskData.task_status === "failed") {
      throw new Error(`Kling task failed. Reason: ${taskData.task_status_msg || 'Unknown'}`);
    }
  }

  if (!finalImageUrl) {
    throw new Error(`Kling task ${taskId} timed out after ${maxAttempts} attempts.`);
  }

  return finalImageUrl;
}

// --- Face Swap ---
const FACE_SWAP_API_URL = "https://ai-face-swap2.p.rapidapi.com/public/process/files";
const FACE_SWAP_API_HOST = "ai-face-swap2.p.rapidapi.com";

async function faceSwap(sourceFile: File, targetFile: File): Promise<string> {
  const rapidApiKey = process.env.RAPIDAPI_KEY;
  if (!rapidApiKey) {
    throw new Error("RAPIDAPI_KEY is not set.");
  }

  const formData = new FormData();
  formData.append("source", sourceFile);
  formData.append("target", targetFile);

  const response = await fetchWithTimeout(FACE_SWAP_API_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "x-rapidapi-host": FACE_SWAP_API_HOST,
      "x-rapidapi-key": rapidApiKey,
    },
    body: formData,
    timeout: 90000,
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

  return swappedImageUrl;
}


// --- Main Exported Orchestration Function ---

interface FinalImageInput {
  jobId: string;
  humanImageUrl: string;
  humanImageType: string;
  humanImageName: string;
  garmentImageUrl: string;
  garmentImageType: string;
  garmentImageName: string;
  imagePrompt: string;
}

export async function generateFinalImage({
  jobId,
  humanImageUrl,
  humanImageType,
  humanImageName,
  garmentImageUrl,
  garmentImageType,
  garmentImageName,
  imagePrompt,
}: FinalImageInput): Promise<string> {
  console.log("--- Starting final image generation pipeline ---");

  // Step 1: Convert input URLs to File objects for later use
  console.log("[1/7] Converting URLs to File objects...");
  const humanImageFile = await urlToFile(humanImageUrl, humanImageName, humanImageType);
  const garmentImageFile = await urlToFile(garmentImageUrl, garmentImageName, garmentImageType);

  // Step 2: Convert original human image to Base64 for the stylization step
  console.log("[2/7] Converting human image to Base64 for stylization...");
  const humanImageBase64 = await fileToBase64(humanImageFile);

  // Step 3: (NEW) Generate a stylized background/pose image using kling-v2
  console.log("[3/7] Generating stylized image with kling-v2...");
  const stylizeRequestBody = buildRequestBody("kling-v2", imagePrompt, humanImageBase64);
  const styledImageUrl = await executeKlingTask(KOLORS_STYLIZE_SUBMIT_PATH, KOLORS_STYLIZE_STATUS_PATH, stylizeRequestBody);

  // Step 4: Convert the new stylized image and the garment to Base64 for virtual try-on
  console.log("[4/7] Converting stylized image and garment to Base64 for try-on...");
  const styledImageFile = await urlToFile(styledImageUrl, "styled.jpg", "image/jpeg");
  const styledImageBase64 = await fileToBase64(styledImageFile);
  const garmentImageBase64 = await fileToBase64(garmentImageFile);

  // Step 5: Submit the virtual try-on task
  console.log("[5/7] Submitting virtual try-on task...");
  const tryOnRequestBody = {
    model_name: "kolors-virtual-try-on-v1.5",
    human_image: styledImageBase64,
    cloth_image: garmentImageBase64,
  };
  const tryOnImageUrl = await executeKlingTask(KOLORS_VIRTUAL_TRYON_SUBMIT_PATH, KOLORS_VIRTUAL_TRYON_STATUS_PATH, tryOnRequestBody);

  // Step 6: Perform face swap
  console.log("[6/7] Performing face swap...");
  const tryOnImageFile = await urlToFile(tryOnImageUrl, "tryon.jpg", "image/jpeg");
  // Use original human file for the face source, and the try-on result as the target
  const swappedHttpUrl = await faceSwap(humanImageFile, tryOnImageFile);

  // Step 7: Persist final image to Vercel Blob and get a secure URL
  console.log("[7/7] Persisting final image to secure storage...");
  const finalImageResponse = await fetch(swappedHttpUrl);
  const finalImageBlob = await finalImageResponse.blob();
  const finalImageName = `final-look-${jobId}.png`;
  const { url: finalSecureUrl } = await put(finalImageName, finalImageBlob, {
    access: 'public',
  });


  console.log("--- Final image generation pipeline complete ---");
  return finalSecureUrl;
}