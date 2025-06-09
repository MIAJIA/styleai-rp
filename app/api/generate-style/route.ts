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

// --- Start: New garment description mapping ---
const garmentDescriptions = new Map<string, string>([
  ['/cloth/green-top.png', 'A vibrant green casual knit top, perfect for a fresh, lively look.'],
  ['/cloth/yellow-shirt.png', 'A bright yellow short-sleeve button-up shirt with a relaxed fit.'],
  ['/cloth/jean.png', 'Classic blue denim jeans with a straight-leg cut.'],
  ['/cloth/LEIVs-jean-short.png', 'Light-wash denim cutoff shorts, ideal for a summer day.'],
  ['/cloth/blue-dress.png', 'An elegant, flowing light blue maxi dress with a simple silhouette.'],
  ['/cloth/yellow-dress.png', 'A cheerful yellow sundress with a fitted bodice and flared skirt.'],
  ['/cloth/whiteblazer.png', 'A sharp, tailored white blazer that adds sophistication to any outfit.'],
  ['/cloth/黑皮衣.png', 'A classic black leather biker jacket, adding an edgy and cool vibe.']
]);
// --- End: New garment description mapping ---

// Style prompts mapping
const stylePrompts = {
  "running-outdoors": "A vibrant, sun-drenched hillside with lush greenery under a clear blue sky, capturing an adventure lifestyle mood. The scene is bathed in soft, natural light, creating a sense of cinematic realism. Shot with the professional quality of a Canon EOS R5, emphasizing realistic textures and high definition.",
  "date-night": "sultry romantic evening scene, luxurious candlelit restaurant with velvet textures, golden hour lighting casting warm shadows, sophisticated Parisian bistro atmosphere, elegant wine glasses and fresh roses, cinematic romantic lighting, high-end fashion photography style",
  "beach-day": "stunning tropical paradise, pristine turquoise waters with gentle waves, white sand beach with palm trees swaying, golden sunset lighting, vibrant coral reef colors, magazine-quality beach photography, luxurious resort setting with crystal-clear water reflections",
  "work-interview": "sleek modern corporate headquarters, floor-to-ceiling glass windows with city skyline views, contemporary minimalist office design, professional studio lighting, executive boardroom with marble accents, prestigious business district atmosphere, high-end architectural photography style",
  "casual-chic": "trendy Brooklyn street with colorful murals, chic coffee shop with exposed brick walls, urban rooftop garden with city views, stylish boutique district, contemporary art gallery setting, natural daylight with artistic shadows, street style fashion photography",
  "party-glam": "opulent ballroom with crystal chandeliers, luxurious velvet curtains and gold accents, dramatic spotlight effects with rich jewel tones, champagne bar with marble countertops, exclusive VIP lounge atmosphere, professional event photography with glamorous lighting",
};

// --- Start: New dynamic request body builder ---
const buildRequestBody = (modelVersion: string, prompt: string, imageBase64: string): object => {
  switch (modelVersion) {
    case 'kling-v2':
      return {
        model_name: "kling-v2",
        prompt: prompt,
        image: imageBase64,
        cfg_scale: 4,
        aspect_ratio: "3:4",
      };
    case 'kling-v1':
    default: // Default to v1 if version is unknown or not provided
      return {
        prompt: prompt,
        image: imageBase64,
        cfg_scale: 4,
        aspect_ratio: "3:4",
      };
    // Add more cases here for future model versions
  }
};
// --- End: New dynamic request body builder ---

export async function POST(request: Request) {
  if (!KLING_ACCESS_KEY || !KLING_SECRET_KEY) {
    return NextResponse.json({ error: "AccessKey or SecretKey is not configured." }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { imageUrl, style, modelVersion = 'kling-v2', garmentSrc } = body; // Default to v2

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
    const garmentDescription = garmentSrc ? garmentDescriptions.get(garmentSrc) : null;

    let prompt = `Extremely important: The person's face, body, and pose must be identical to the original image.`;

    if (garmentDescription) {
      prompt += ` The clothing is a ${garmentDescription} and it must also remain identical.`;
    } else {
      prompt += ` The clothing must also remain identical.`;
    }

    prompt += ` Only change the background to: ${stylePrompt || 'a beautiful setting'}. Do not alter the person or their attire in any way.`;

    // Step 3 - Call Kling AI to submit the image generation task
    console.log(`Submitting image generation task to Kling AI using model: ${modelVersion}...`);

    const requestBody = buildRequestBody(modelVersion, prompt, imageBase64);

    console.log("Request body structure:", JSON.stringify(requestBody, null, 2).substring(0, 500) + "...");

    const submitResponse = await fetch(`${KLING_API_BASE_URL}${IMAGE_GENERATION_SUBMIT_PATH}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      // @ts-ignore
      timeout: 60000, // 60-second timeout
    });

    if (!submitResponse.ok) {
      const errorBody = await submitResponse.text();
      throw new Error(`API Error on submit (model: ${modelVersion}): ${submitResponse.status} ${errorBody}`);
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
          // @ts-ignore
          timeout: 60000, // 60-second timeout
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