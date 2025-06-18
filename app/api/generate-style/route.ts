import { NextResponse } from "next/server";
import * as jwt from "jsonwebtoken";
import OpenAI from "openai";
import { OPENAI_STYLING_PROMPT } from "@/lib/prompts";

// Helper function to convert a file to a Base64 string
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

// --- OpenAI API Initialization ---
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

// --- Start: New garment description mapping ---
const garmentDescriptions = new Map<string, string>([
  ["/cloth/green-top.png", "A vibrant green casual knit top, perfect for a fresh, lively look."],
  ["/cloth/yellow-shirt.png", "A bright yellow short-sleeve button-up shirt with a relaxed fit."],
  ["/cloth/jean.png", "Classic blue denim jeans with a straight-leg cut."],
  ["/cloth/LEIVs-jean-short.png", "Light-wash denim cutoff shorts, ideal for a summer day."],
  ["/cloth/blue-dress.png", "An elegant, flowing light blue maxi dress with a simple silhouette."],
  ["/cloth/yellow-dress.png", "A cheerful yellow sundress with a fitted bodice and flared skirt."],
  [
    "/cloth/whiteblazer.png",
    "A sharp, tailored white blazer that adds sophistication to any outfit.",
  ],
  ["/cloth/black-leather-jacket.png", "A classic black leather biker jacket, adding an edgy and cool vibe."],
]);
// --- End: New garment description mapping ---

// Style prompts mapping
const stylePrompts = {
  "fashion-magazine":
    "standing in a semi-surreal environment blending organic shapes and architectural elements. " +
    "The background features dreamlike washes of indigo and burnt orange, with subtle floating geometric motifs inspired by Ukiyo-e clouds. " +
    "Lighting combines soft studio strobes with atmospheric glow, creating dimensional shadows. " +
    "Composition balances realistic human proportions with slightly exaggerated fabric movement, evoking a living oil painting. " +
    "Texture details: fine wool fibers visible, slight film grain. " +
    "Style fusion: Richard Avedon's fashion realism + Egon Schiele's expressive lines + niji's color vibrancy (but photorealistic), 4k resolution.",
  "running-outdoors":
    "A vibrant, sun-drenched hillside with lush greenery under a clear blue sky, capturing an adventure lifestyle mood. " +
    "The scene is bathed in soft, natural light, creating a sense of cinematic realism. " +
    "Shot with the professional quality of a Canon EOS R5, emphasizing realistic textures and high definition, 4k resolution.",
  "coffee-shop":
    "A cozy, sunlit coffee shop with the warm aroma of freshly ground beans. " +
    "The person is sitting at a rustic wooden table by a large window, holding a ceramic mug. " +
    "The background shows soft, blurred details of a barista and an espresso machine. " +
    "The style should be intimate and warm, with natural light creating soft shadows, reminiscent of a lifestyle magazine photograph, 4k resolution.",
  "casual-chic":
    "trendy Brooklyn street with colorful murals, chic coffee shop with exposed brick walls, " +
    "urban rooftop garden with city views, stylish boutique district, contemporary art gallery setting, " +
    "natural daylight with artistic shadows, street style fashion photography, 4k resolution",
  "music-show":
    "Group idol style, performing on stage, spotlight and dreamy lighting, high-definition portrait, " +
    "soft glow and bokeh, dynamic hair movement, glamorous makeup, K-pop inspired outfit (shiny, fashionable), " +
    "expressive pose, cinematic stage background, lens flare, fantasy concert vibe, ethereal lighting, 4k resolution.",
  "date-night":
    "A realistic romantic evening on a backyard patio--string lights overhead, wine glasses, laughing mid-conversation with friend. " +
    "Subtle body language, soft bokeh lights, hint of connection. " +
    "Created using: Sony Alpha A7R IV, cinematic lighting, shallow depth of field, natural expressions, sunset color grading " +
    "Shot in kodak gold 200 with a canon EOS R6, 4k resolution.",
  "beach-day":
    "On the beach, soft sunlight, gentle waves in the background, highly detailed, " +
    "lifelike textures, natural lighting, vivid colors, 4k resolution",
  "work-interview":
    "sleek modern corporate headquarters, floor-to-ceiling glass windows with city skyline views, " +
    "contemporary minimalist office design, professional studio lighting, executive boardroom with marble accents, " +
    "prestigious business district atmosphere, high-end architectural photography style, 4k resolution",
  "party-glam":
    "opulent ballroom with crystal chandeliers, luxurious velvet curtains and gold accents, " +
    "dramatic spotlight effects with rich jewel tones, champagne bar with marble countertops, " +
    "exclusive VIP lounge atmosphere, professional event photography with glamorous lighting, 4k resolution",
};

// --- Start: New dynamic request body builder ---
const buildRequestBody = (
  modelVersion: string,
  prompt: string,
  humanImageBase64: string,
): object => {
  const baseBody = {
    prompt: prompt,
    // cfg_scale: 4,
    aspect_ratio: "3:4",
    image: humanImageBase64, // The main image is the human portrait
    image_reference: "face",
  };

  switch (modelVersion) {
    case "kling-v1-5":
      return {
        ...baseBody,
        human_fidelity: 1,
        model_name: "kling-v1-5",
      };
    case "kling-v2":
      return {
        ...baseBody,
        model_name: "kling-v2",
      };
    case "kling-v1":
    default: // Default to v1 if version is unknown or not provided
      return {
        prompt: prompt,
        image: humanImageBase64, // Older models might only support the main image
        cfg_scale: 4,
        aspect_ratio: "3:4",
      };
  }
};
// --- End: New dynamic request body builder ---

export async function POST(request: Request) {
  if (!KLING_ACCESS_KEY || !KLING_SECRET_KEY) {
    return NextResponse.json(
      { error: "AccessKey or SecretKey is not configured." },
      { status: 500 },
    );
  }

  try {
    const {
      human_image_url,
      style_prompt,
      garment_type,
      garment_description,
      personaProfile,
      modelVersion = "kling-v1-5",
    } = await request.json();

    if (!human_image_url || !style_prompt) {
      return NextResponse.json(
        { error: "Missing required parameters: human_image_url, style_prompt" },
        { status: 400 },
      );
    }

    // Step 0: Get API Tokens and Keys
    const apiToken = getApiToken(KLING_ACCESS_KEY, KLING_SECRET_KEY);
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OpenAI API key is not configured." }, { status: 500 });
    }

    // Step 1 - Convert human image URL to Base64 (for Kling)
    // We will pass URLs directly to OpenAI
    const humanImageBase64 = await urlToBase64(human_image_url);

    // Step 2 - Prepare data for prompts
    const stylePromptText = stylePrompts[style_prompt as keyof typeof stylePrompts] || "";
    const finalGarmentDescription =
      garment_description || (garment_type ? garmentDescriptions.get(garment_type) : undefined);
    let styleSuggestion = "";

    // --- NEW: Step 2.5 - Get Style Suggestions from OpenAI if a persona is provided ---
    if (personaProfile) {
      console.log("Persona profile found, calling OpenAI for style suggestions...");
      try {
        // We need the absolute URL for the garment image to fetch it locally
        const host = request.headers.get("host") || "localhost:3000";
        const protocol = process.env.NODE_ENV === "development" ? "http" : "https";
        const garmentImageUrl = garment_type ? `${protocol}://${host}${garment_type}` : "";

        const openAIPrompt = OPENAI_STYLING_PROMPT.replace(
          "{personaProfile}",
          JSON.stringify(personaProfile, null, 2),
        );

        if (garmentImageUrl && garment_type) {
          // Instead of sending URLs to OpenAI, convert images to Base64 Data URIs,
          // which is more robust and avoids localhost accessibility issues.
          const humanImageB64 = await urlToBase64(human_image_url);
          const garmentImageB64 = await urlToBase64(garmentImageUrl);

          const getMimeType = (filePath: string) => {
            if (filePath.endsWith(".png")) return "image/png";
            if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
            return "image/jpeg"; // Default
          };

          const humanImageDataUri = `data:${getMimeType(human_image_url)};base64,${humanImageB64}`;
          const garmentImageDataUri = `data:${getMimeType(garment_type)};base64,${garmentImageB64}`;

          const visionResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: openAIPrompt },
                  { type: "image_url", image_url: { url: humanImageDataUri } },
                  { type: "image_url", image_url: { url: garmentImageDataUri } },
                ],
              },
            ],
            max_tokens: 500,
          });
          styleSuggestion = visionResponse.choices[0].message.content || "";
          console.log("～～～OpenAI Style Suggestion:", styleSuggestion);
        }
      } catch (e) {
        console.error("Error calling OpenAI API:", e);
        // Do not block the process if OpenAI fails, just log the error and proceed.
        styleSuggestion = "Could not retrieve style suggestions, proceeding with default prompt.";
      }
    }

    // Step 3 - Prepare the final prompt for Kling AI
    let prompt = "";
    if (styleSuggestion) {
      prompt =
        `A photorealistic image of a person, styled according to the following expert fashion advice: "${styleSuggestion}". ` +
        `The background should be a scene inspired by: '${stylePromptText}'. ` +
        `IMPORTANT: The person's face and original clothing item must be perfectly preserved. ` +
        `The only change is the overall styling, accessories, and background, according to the fashion advice.`;
    } else {
      // Fallback to original prompt logic if no suggestion is generated
      prompt = `Extremely important: The person's face must be identical to the original image.`;
      if (finalGarmentDescription) {
        prompt += ` The clothing is a ${finalGarmentDescription} and it must also remain identical.`;
      } else {
        prompt += ` The clothing must also remain identical.`;
      }
      prompt += ` Only change the background to: ${
        stylePromptText || "a beautiful setting"
      }. Do not alter the person or their attire in any way.`;
    }

    console.log("～～～Final Kling Prompt:", prompt);
    // Step 4 - Call Kling AI to submit the image generation task
    console.log(`Submitting image generation task to Kling AI using model: ${modelVersion}...`);
    const requestBody = buildRequestBody(modelVersion, prompt, humanImageBase64);

    // print all info in requestBody
    console.log(
      "Request body structure:",
      JSON.stringify(requestBody, null, 2).substring(0, 500) + "...",
    );

    const submitResponse = await fetchWithTimeout(
      `${KLING_API_BASE_URL}${IMAGE_GENERATION_SUBMIT_PATH}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        timeout: 60000, // 60-second timeout
      },
    );

    if (!submitResponse.ok) {
      const errorBody = await submitResponse.text();
      throw new Error(
        `API Error on submit (model: ${modelVersion}): ${submitResponse.status} ${errorBody}`,
      );
    }

    const submitResult = await submitResponse.json();
    const taskId = submitResult.data.task_id;
    console.log(`Image generation task submitted successfully. Task ID: ${taskId}`);

    // Step 5 - Poll for the result
    let attempts = 0;
    const maxAttempts = 40;
    let finalImageUrl = "";

    while (attempts < maxAttempts) {
      console.log(`Polling attempt #${attempts + 1} for task: ${taskId}`);

      // Regenerate token for each poll request to ensure it's not expired
      const pollingToken = getApiToken(KLING_ACCESS_KEY, KLING_SECRET_KEY);

      const statusCheckResponse = await fetchWithTimeout(
        `${KLING_API_BASE_URL}${IMAGE_GENERATION_STATUS_PATH}${taskId}`,
        {
          headers: {
            Authorization: `Bearer ${pollingToken}`,
          },
          timeout: 60000, // 60-second timeout
        },
      );

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
        throw new Error(`AI generation failed. Reason: ${taskData.task_status_msg || "Unknown"}`);
      }

      attempts++;
      await sleep(3000);
    }

    if (!finalImageUrl) {
      throw new Error("AI generation timed out.");
    }

    // Step 6 - Return the final image URL to the frontend
    return NextResponse.json({ imageUrl: finalImageUrl });
  } catch (error) {
    console.error("An error occurred in the generate-style API:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
