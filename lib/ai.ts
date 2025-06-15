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
const KOLORS_VIRTUAL_TRYON_SUBMIT_PATH = "/v1/images/kolors-virtual-try-on";
const KOLORS_VIRTUAL_TRYON_STATUS_PATH = "/v1/images/kolors-virtual-try-on/";

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

// Private, reusable polling function
async function _pollKlingTask(taskId: string): Promise<string> {
    let attempts = 0;
    const maxAttempts = 40; // Approx 2 minutes

    while (attempts < maxAttempts) {
        await sleep(3000); // 3-second interval
        attempts++;
        console.log(`Polling attempt #${attempts} for task: ${taskId}`);

        if (!KLING_ACCESS_KEY || !KLING_SECRET_KEY) {
            throw new Error("Kling AI API keys are not configured for polling.");
        }
        const pollingToken = getApiToken(KLING_ACCESS_KEY, KLING_SECRET_KEY);

        try {
            const statusCheckResponse = await fetchWithTimeout(
                `${KLING_API_BASE_URL}${KOLORS_VIRTUAL_TRYON_STATUS_PATH}${taskId}`,
                { headers: { Authorization: `Bearer ${pollingToken}` }, timeout: 60000 }
            );

            if (!statusCheckResponse.ok) {
                console.warn(`Kling polling failed on attempt ${attempts} with status ${statusCheckResponse.status}, continuing...`);
                continue; // Don't fail the whole process for a single failed poll
            }

            const statusResult = await statusCheckResponse.json();
            const taskData = statusResult.data;

            if (taskData.task_status === "succeed") {
                console.log("Kling task succeeded. Full response:", JSON.stringify(statusResult, null, 2));
                const finalImageUrl = statusResult.data?.task_result?.images?.[0]?.url;
                if (!finalImageUrl) {
                    throw new Error("Kling task succeeded but a result URL was not found in the response.");
                }
                console.log(`Task ${taskId} succeeded! Image URL:`, finalImageUrl);
                return finalImageUrl;
            } else if (taskData.task_status === "failed") {
                throw new Error(`Kling task ${taskId} failed. Reason: ${taskData.task_status_msg || "Unknown"}`);
            }
            // If status is 'processing' or other, the loop continues
        } catch(pollError) {
             console.warn(`Error during polling attempt ${attempts}:`, pollError);
             // Continue to next attempt
        }
    }

    throw new Error(`Kling task ${taskId} timed out after ${maxAttempts} attempts.`);
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

  // Step 1: Convert input URLs to File objects. We need the File for FaceSwap later,
  // and the Base64 string for the initial Kling call.
  console.log("[1/5] Converting URLs to File objects...");
  const humanImageFile = await urlToFile(humanImageUrl, humanImageName, humanImageType);
  const garmentImageFile = await urlToFile(garmentImageUrl, garmentImageName, garmentImageType);

  // Step 2: Convert Files to Base64 for the JSON payload
  console.log("[2/5] Converting Files to Base64 for Kling API...");
  const humanImageBase64 = await fileToBase64(humanImageFile);
  const garmentImageBase64 = await fileToBase64(garmentImageFile);

  // Step 3: Submit the initial try-on task to Kling using a JSON payload
  console.log("[3/5] Submitting initial try-on task to Kling (as JSON)...");
  if (!KLING_ACCESS_KEY || !KLING_SECRET_KEY) {
      throw new Error("Kling AI API keys are not configured for submission.");
  }

  const klingRequestBody = {
    model_name: "kolors-virtual-try-on-v1-5",
    human_image: humanImageBase64,
    cloth_image: garmentImageBase64,
  };

  const apiToken = getApiToken(KLING_ACCESS_KEY, KLING_SECRET_KEY);
  const submitResponse = await fetchWithTimeout(`${KLING_API_BASE_URL}${KOLORS_VIRTUAL_TRYON_SUBMIT_PATH}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(klingRequestBody),
    timeout: 60000,
  });

  if (!submitResponse.ok) {
    const errorBody = await submitResponse.text();
    throw new Error(`Kling API submit failed: ${submitResponse.status} ${errorBody}`);
  }

  const submitResult = await submitResponse.json();
  const taskId = submitResult.data.task_id;
  console.log(`Kling task submitted. Task ID: ${taskId}`);

  // Step 4: Poll for the Kling task result
  console.log("[4/5] Polling for Kling task result...");
  const initialImageUrl = await _pollKlingTask(taskId);

  // Step 5: Perform face swap
  console.log("[5/6] Performing face swap...");
  const initialImageFile = await urlToFile(initialImageUrl, "initial.jpg", "image/jpeg");
  const swappedHttpUrl = await faceSwap(humanImageFile, initialImageFile);

  // Step 6: Persist final image to Vercel Blob and get a secure URL
  console.log("[6/6] Persisting final image to secure storage...");
  const finalImageResponse = await fetch(swappedHttpUrl);
  const finalImageBlob = await finalImageResponse.blob();
  const finalImageName = `final-look-${jobId}.png`;
  const { url: finalSecureUrl } = await put(finalImageName, finalImageBlob, {
    access: 'public',
  });

  console.log("--- Final image generation pipeline complete ---");
  return finalSecureUrl;
}