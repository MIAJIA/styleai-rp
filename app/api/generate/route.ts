import { NextResponse } from "next/server";
import * as jwt from "jsonwebtoken";

// Helper function to convert a file to a Base64 string
const fileToBase64 = async (file: File): Promise<string> => {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  // Return raw base64 string, not a Data URL, as expected by many APIs
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

// Corrected API endpoints based on the official documentation
const KLING_API_BASE_URL = "https://api-beijing.klingai.com";
const VIRTUAL_TRYON_SUBMIT_PATH = "/v1/images/kolors-virtual-try-on";
const VIRTUAL_TRYON_STATUS_PATH = "/v1/images/kolors-virtual-try-on/"; // Note the trailing slash for appending task_id

export async function POST(request: Request) {
  if (!KLING_ACCESS_KEY || !KLING_SECRET_KEY) {
    return NextResponse.json({ error: "AccessKey or SecretKey is not configured." }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const humanImageFile = formData.get("human_image") as File | null;
    const garmentImageFile = formData.get("garment_image") as File | null;

    if (!humanImageFile || !garmentImageFile) {
      return NextResponse.json(
        { error: "Missing human_image or garment_image" },
        { status: 400 }
      );
    }

    // Step 0: Get the dynamic API Token
    const apiToken = getApiToken(KLING_ACCESS_KEY, KLING_SECRET_KEY);

    // Step 1 - Convert images to Base64
    const humanImageBase64 = await fileToBase64(humanImageFile);
    const garmentImageBase64 = await fileToBase64(garmentImageFile);

    // Step 2 - Call Kling AI to submit the task
    console.log("Submitting task to Kling AI...");
    const submitResponse = await fetch(`${KLING_API_BASE_URL}${VIRTUAL_TRYON_SUBMIT_PATH}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Corrected parameters based on documentation
        human_image: humanImageBase64,
        cloth_image: garmentImageBase64,
      }),
    });

    if (!submitResponse.ok) {
      const errorBody = await submitResponse.text();
      throw new Error(`API Error on submit: ${submitResponse.status} ${errorBody}`);
    }

    const submitResult = await submitResponse.json();
    // According to the doc, the task_id is inside the data object
    const taskId = submitResult.data.task_id;
    console.log(`Task submitted successfully. Task ID: ${taskId}`);

    // Step 3 - Poll for the result
    let attempts = 0;
    const maxAttempts = 40;
    let finalImageUrl = "";

    while (attempts < maxAttempts) {
        console.log(`Polling attempt #${attempts + 1} for task: ${taskId}`);

        // Regenerate token for each poll request to ensure it's not expired
        const pollingToken = getApiToken(KLING_ACCESS_KEY, KLING_SECRET_KEY);

        const statusCheckResponse = await fetch(`${KLING_API_BASE_URL}${VIRTUAL_TRYON_STATUS_PATH}${taskId}`, {
          headers: {
            'Authorization': `Bearer ${pollingToken}`,
          },
        });

        if (!statusCheckResponse.ok) {
            const errorBody = await statusCheckResponse.text();
            throw new Error(`API Error on status check: ${statusCheckResponse.status} ${errorBody}`);
        }

        const statusResult = await statusCheckResponse.json();
        const taskData = statusResult.data; // Data is nested

        if (taskData.task_status === "succeed") {
            finalImageUrl = taskData.task_result.images[0].url;
            console.log("Task succeeded! Image URL:", finalImageUrl);
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

    // Step 4 - Return the final image URL to the frontend
    return NextResponse.json({ imageUrl: finalImageUrl });

  } catch (error) {
    console.error("An error occurred in the generate API:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}