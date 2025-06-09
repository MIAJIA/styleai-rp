import { NextResponse } from "next/server";
import * as jwt from "jsonwebtoken";

// Helper function to convert a file to a Base64 string
const fileToBase64 = async (file: File): Promise<string> => {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  return buffer.toString("base64");
};

// Helper function to convert URL to Base64
const urlToBase64 = async (url: string): Promise<string> => {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return buffer.toString("base64");
};

// Helper function for delaying execution, to be used in polling
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

// Style prompts mapping
const stylePrompts = {
  "date-night": "romantic evening setting, elegant restaurant or cozy cafe background, warm ambient lighting, sophisticated atmosphere",
  "beach-day": "beautiful beach background, ocean waves, sandy shore, bright sunny day, tropical paradise setting",
  "work-interview": "professional office environment, clean modern workspace, corporate setting, business atmosphere",
  "casual-chic": "trendy urban setting, modern city background, stylish street scene, contemporary lifestyle",
  "party-glam": "glamorous party venue, elegant ballroom or upscale nightclub, festive lighting, celebration atmosphere"
};

export async function POST(request: Request) {
  if (!KLING_ACCESS_KEY || !KLING_SECRET_KEY) {
    return NextResponse.json({ error: "AccessKey or SecretKey is not configured." }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { imageUrl, style } = body;

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Missing imageUrl" },
        { status: 400 }
      );
    }

    // Step 0: Get the dynamic API Token
    const apiToken = getApiToken(KLING_ACCESS_KEY, KLING_SECRET_KEY);

    // Step 1 - Convert image URL to Base64
    const imageBase64 = await urlToBase64(imageUrl);

    // Step 2 - Prepare the prompt based on style
    const stylePrompt = style ? stylePrompts[style as keyof typeof stylePrompts] : "";
    const prompt = stylePrompt ? 
      `A person in ${stylePrompt}, professional photo, high quality, well-lit` :
      "A person in a beautiful setting, professional photo, high quality, well-lit";

    // Step 3 - Call Kling AI to submit the image generation task
    console.log("Submitting image generation task to Kling AI...");
    
    const requestBody = {
      model_name: "kling-v1-5",
      prompt: prompt,
      image: imageBase64,
      image_reference: {
        mode: "character_reference"
      },
      cfg_scale: 4,
      aspect_ratio: "3:4",
      negative_prompt: "blurry, low quality, distorted face, deformed, extra limbs, different person"
    };
    
    // Fallback body for V1 model if V1.5 fails
    const fallbackRequestBody = {
      prompt: prompt,
      image: imageBase64,
      cfg_scale: 4,
      aspect_ratio: "3:4",
      negative_prompt: "blurry, low quality, distorted face, deformed, extra limbs, different person"
    };
    
    console.log("Request body structure:", JSON.stringify(requestBody, null, 2).substring(0, 500) + "...");
    
    let submitResponse = await fetch(`${KLING_API_BASE_URL}${IMAGE_GENERATION_SUBMIT_PATH}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    // If V1.5 fails, try with V1 model (fallback)
    if (!submitResponse.ok) {
      console.log("V1.5 failed, trying with V1 model...");
      const fallbackToken = getApiToken(KLING_ACCESS_KEY, KLING_SECRET_KEY);
      submitResponse = await fetch(`${KLING_API_BASE_URL}${IMAGE_GENERATION_SUBMIT_PATH}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${fallbackToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fallbackRequestBody),
      });
    }

    if (!submitResponse.ok) {
      const errorBody = await submitResponse.text();
      throw new Error(`API Error on submit: ${submitResponse.status} ${errorBody}`);
    }

    const submitResult = await submitResponse.json();
    const taskId = submitResult.data.task_id;
    console.log(`Image generation task submitted successfully. Task ID: ${taskId}`);

    // Step 4 - Poll for the result
    let attempts = 0;
    const maxAttempts = 40;
    let finalImageUrl = "";

    while (attempts < maxAttempts) {
        console.log(`Polling attempt #${attempts + 1} for task: ${taskId}`);

        // Regenerate token for each poll request to ensure it's not expired
        const pollingToken = getApiToken(KLING_ACCESS_KEY, KLING_SECRET_KEY);

        const statusCheckResponse = await fetch(`${KLING_API_BASE_URL}${IMAGE_GENERATION_STATUS_PATH}${taskId}`, {
          headers: {
            'Authorization': `Bearer ${pollingToken}`,
          },
        });

        if (!statusCheckResponse.ok) {
            const errorBody = await statusCheckResponse.text();
            throw new Error(`API Error on status check: ${statusCheckResponse.status} ${errorBody}`);
        }

        const statusResult = await statusCheckResponse.json();
        const taskData = statusResult.data;

        if (taskData.task_status === "succeed") {
            finalImageUrl = taskData.task_result.images[0].url;
            console.log("Image generation succeeded! Image URL:", finalImageUrl);
            break;
        } else if (taskData.task_status === "failed") {
            throw new Error(`AI generation failed. Reason: ${taskData.task_status_msg || 'Unknown'}`);
        }

        attempts++;
        await sleep(3000);
    }

    if (!finalImageUrl) {
        throw new Error("AI generation timed out.");
    }

    // Step 5 - Return the final image URL to the frontend
    return NextResponse.json({ imageUrl: finalImageUrl });

  } catch (error) {
    console.error("An error occurred in the generate-style API:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 