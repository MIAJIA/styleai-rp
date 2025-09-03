import { fetchWithTimeout, urlToFile, fileToBase64 } from "../utils";

const GEMINI_API_URL = process.env.GEMINI_API_URL || "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

export interface GeminiGenerateParams {
  prompt: string;
  humanImageUrl: string;
  garmentImageUrl?: string;
  garmentImageName?: string;
  garmentImageType?: string;
}

export async function generateFinalImagesWithGemini(params: GeminiGenerateParams): Promise<string[]> {
  if (process.env.MOCK_GEMINI === 'true' || !GEMINI_API_URL || !GEMINI_API_KEY) {
    // Minimal mock data URI to avoid network
    return [
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77hQAAAABJRU5ErkJggg=="
    ];
  }

  // Prepare optional garment image as base64 if provided
  let garmentImageBase64: string | undefined = undefined;
  if (params.garmentImageUrl && params.garmentImageName && params.garmentImageType) {
    garmentImageBase64 = await urlToFile(params.garmentImageUrl, params.garmentImageName, params.garmentImageType).then(fileToBase64);
  }

  const body: Record<string, unknown> = {
    prompt: params.prompt,
    human_image_url: params.humanImageUrl,
  };
  if (garmentImageBase64) {
    body["garment_image_base64"] = garmentImageBase64;
  }

  const resp = await fetchWithTimeout(GEMINI_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GEMINI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    timeout: 120000,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Gemini API error: ${resp.status} ${text}`);
  }

  const data = await resp.json();
  // Expecting { images: [{ url: string }, ...] } or { url: string }
  let urls: string[] = [];
  if (Array.isArray(data?.images)) {
    urls = data.images.map((x: any) => x.url).filter(Boolean);
  } else if (data?.url) {
    urls = [data.url];
  }
  if (!urls.length) {
    throw new Error("Gemini API returned no images");
  }
  return urls;
}


