import { NextResponse } from "next/server";
import * as jwt from "jsonwebtoken";

// This map is now defined directly in the file to avoid import issues.
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
  ["/cloth/黑皮衣.png", "A classic black leather biker jacket, adding an edgy and cool vibe."],
]);

// TODO: The client-side image pre-processing is causing the AI to return cropped images.
// As an alternative, investigate implementing server-side image processing here using a
// library like `sharp`. This could provide more robust and consistent results.
// See OPEN_ISSUES.md for full context.

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
  const token = jwt.sign(payload, secretKey, {
    algorithm: "HS256",
    header: { alg: "HS256", typ: "JWT" },
  });
  return token;
};

// --- Kling AI API Configuration ---
const KLING_ACCESS_KEY = process.env.KLING_AI_ACCESS_KEY;
const KLING_SECRET_KEY = process.env.KLING_AI_SECRET_KEY;

// Corrected API endpoints based on the official documentation
const KLING_API_BASE_URL = "https://api-beijing.klingai.com";
const VIRTUAL_TRYON_SUBMIT_PATH = "/v1/images/kolors-virtual-try-on";
const VIRTUAL_TRYON_STATUS_PATH = "/v1/images/kolors-virtual-try-on/"; // Note the trailing slash for appending task_id

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

export async function POST(request: Request) {
  if (!KLING_ACCESS_KEY || !KLING_SECRET_KEY) {
    return NextResponse.json(
      { error: "AccessKey or SecretKey is not configured." },
      { status: 500 },
    );
  }

  try {
    const formData = await request.formData();
    // ● 支持上传服饰商品图或服饰白底图，支持上装upper、下装lower、与连体装dress
    // ● 支持传入图片Base64编码或图片URL（确保可访问）
    // ● 图片格式支持.jpg / .jpeg / .png
    // ● 图片文件大小不能超过10MB，图片宽高尺寸不小于300px
    // ● 其中 kolors - virtual -try-on - v1 - 5 模型不仅支持单个服装输入，还支持"上装 + 下装"形式服装组合输入，即：
    // 	○ 输入单个服饰图片（上装 or 下装 or 连体装）-> 生成试穿的单品图片
    // 	○ 输入组合服饰图片（您可以将多个单品服饰白底图拼接到同一张图片）
    // 		■ 模型检测为"上装 + 下装" -> 生成试穿的"上装 + 下装"图片
    // 		■ 模型检测为"上装 + 上装" -> 生成失败
    // 		■ 模型检测为"下装 + 下装" -> 生成失败
    // 		■ 模型检测为"连体装 + 连体装" -> 生成失败
    // 		■ 模型检测为"上装 + 连体装" -> 生成失败
    // 		■ 模型检测为"下装 + 连体装" -> 生成失败

    const humanImageBlob = formData.get("human_image") as Blob | null;
    const garmentImageBlob = formData.get("garment_image") as Blob | null;
    const garmentSrc = formData.get("garment_src") as string | null;
    const personaProfile = formData.get("persona_profile") as string | null;

    if (!humanImageBlob || !garmentImageBlob) {
      return NextResponse.json({ error: "Missing human_image or garment_image" }, { status: 400 });
    }

    // Step 0: Get the dynamic API Token
    const apiToken = getApiToken(KLING_ACCESS_KEY, KLING_SECRET_KEY);

    // Step 1 - Convert images to Base64
    const humanImageBase64 = await fileToBase64(new File([humanImageBlob], "human_image"));
    const garmentImageBase64 = await fileToBase64(new File([garmentImageBlob], "garment_image"));

    // Step 2: Look up the garment description using the source path
    const garmentDescription = garmentSrc ? garmentDescriptions.get(garmentSrc) : null;
    let prompt = `Fusion of a person and a garment.`;
    if (garmentDescription) {
      prompt += ` The clothing is a ${garmentDescription} and it must also remain identical.`;
    }

    const requestBody = {
      human_image: humanImageBase64,
      cloth_image: garmentImageBase64,
    };

    // Step 3 - Call Kling AI to submit the task
    console.log("Submitting task to Kling AI...");
    const submitResponse = await fetch(`${KLING_API_BASE_URL}${VIRTUAL_TRYON_SUBMIT_PATH}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      // @ts-ignore
      timeout: 60000, // 60-second timeout
    });

    if (!submitResponse.ok) {
      const errorBody = await submitResponse.text();
      throw new Error(`API Error on submit: ${submitResponse.status} ${errorBody}`);
    }

    const submitResult = await submitResponse.json();
    // According to the doc, the task_id is inside the data object
    const taskId = submitResult.data.task_id;
    console.log(`Task submitted successfully. Task ID: ${taskId}`);

    // Step 4 - Poll for the result
    let attempts = 0;
    const maxAttempts = 40;
    let finalImageUrl = "";

    while (attempts < maxAttempts) {
      console.log(`Polling attempt #${attempts + 1} for task: ${taskId}`);

      // Regenerate token for each poll request to ensure it's not expired
      const pollingToken = getApiToken(KLING_ACCESS_KEY, KLING_SECRET_KEY);

      const statusCheckResponse = await fetch(
        `${KLING_API_BASE_URL}${VIRTUAL_TRYON_STATUS_PATH}${taskId}`,
        {
          headers: {
            Authorization: `Bearer ${pollingToken}`,
          },
          // @ts-ignore
          timeout: 60000, // 60-second timeout for status check
        },
      );

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
        throw new Error(`AI generation failed. Reason: ${taskData.task_status_msg || "Unknown"}`);
      }

      attempts++;
      await sleep(3000);
    }

    if (!finalImageUrl) {
      throw new Error("AI generation timed out.");
    }

    // Step 5 - Return the final image URL and context to the frontend
    return NextResponse.json({
      imageUrl: finalImageUrl,
      garmentDescription,
      personaProfile,
    });
  } catch (error) {
    console.error("An error occurred in the generate API:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
