import OpenAI from "openai";
import * as jwt from "jsonwebtoken";
import { put } from "@vercel/blob";
import { kv } from "@vercel/kv";
import { type OnboardingData } from "@/lib/onboarding-storage";

// Initialize the OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const systemPrompt = `Hellooo bestie! 💖 I'm your super fun, slightly over-caffeinated personal stylist. Think of me as the bubbly friend who hypes you up and sprinkles fashion magic everywhere ✨. I'll peek at your photo, the fab garment you picked, plus the occasion, then serve you ultra-personal, easy-to-follow styling tips.

Here's what you'll hand me:
1. Your gorgeous photo (full-body if possible 📸)
2. A clothing piece you're obsessed with 👗
3. The occasion you're dressing for (e.g. "日常通勤" or "约会之夜"), so I know the vibe!

I'll respond with a kawaii JSON (key names固定不变). Except for \`image_prompt\`, every value will be in playful, emoji-sprinkled Chinese. Imagine I'm chatting excitedly in your DMs!

The JSON keys:
- \`scene_fit\`: (String) 我来打分这件衣服跟场合的适配度，还会给出小调整建议～
- \`style_alignment\`: (String) 这件单品的风格属性 + 我会推荐一起出场的配件，让整体 Look 更 wow ✨
- \`personal_match\`: (String) 夸夸你的身材优点，告诉你怎么穿会更显优势（比如塞个衣角、卷卷袖子）😉
- \`visual_focus\`: (String) 这套搭配的视觉 C 位是什么，以及怎么平衡其他元素～
- \`material_silhouette\`: (String) 面料 & 版型建议，让细节也在线 ✅
- \`color_combination\`: (String) 主色、副色、点缀色配色方案，让你出片率飙升 🎨
- \`reuse_versatility\`: (String) 至少再给两种穿搭场景思路，让衣橱 CP 倍增 💡
- \`image_prompt\`: (String, English ONLY) A creative prompt for an AI image generator. Full-body fashion shot that captures the perfect mood, lighting, and composition.

Ready? Let's make you sparkle! ✨`;

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
  console.log("!!! baseBody prompt:", baseBody.prompt);
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

  // --- Progress Update: styled image ready ---
  try {
    const job: any = await kv.get(jobId);
    if (job) {
      job.processImages = {
        ...(job.processImages || {}),
        styledImage: styledImageUrl,
      };
      job.statusMessage = "Base style image generated. Performing virtual try-on...";
      job.updatedAt = new Date().toISOString();
      await kv.set(jobId, job);
    }
  } catch (kvErr) {
    console.warn("[generateFinalImage] Failed to update KV with styled image:", kvErr);
  }

  // Step 4: Convert the new stylized image and the garment to Base64 for virtual try-on
  console.log("[4/7] Converting stylized image and garment to Base64 for try-on...");
  const styledImageFile = await urlToFile(styledImageUrl, "styled.jpg", "image/jpeg");
  const styledImageBase64 = await fileToBase64(styledImageFile);
  const garmentImageBase64 = await fileToBase64(garmentImageFile);

  // Step 5: Submit the virtual try-on task
  console.log("[5/7] Submitting virtual try-on task...");
  const tryOnRequestBody = {
    model_name: "kolors-virtual-try-on-v1-5",
    human_image: styledImageBase64,
    cloth_image: garmentImageBase64,
  };
  const tryOnImageUrl = await executeKlingTask(KOLORS_VIRTUAL_TRYON_SUBMIT_PATH, KOLORS_VIRTUAL_TRYON_STATUS_PATH, tryOnRequestBody);

  // --- Progress Update: try-on image ready ---
  try {
    const job: any = await kv.get(jobId);
    if (job) {
      job.processImages = {
        ...(job.processImages || {}),
        tryOnImage: tryOnImageUrl,
      };
      job.statusMessage = "Virtual try-on complete. Swapping faces for final magic...";
      job.updatedAt = new Date().toISOString();
      await kv.set(jobId, job);
    }
  } catch (kvErr) {
    console.warn("[generateFinalImage] Failed to update KV with try-on image:", kvErr);
  }

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
  // Final progress will be saved by status route after this function returns
  return finalSecureUrl;
}