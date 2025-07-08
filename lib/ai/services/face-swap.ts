import { fetchWithTimeout, sleep, urlToFile } from "../utils";
import { Job } from '@/lib/ai/types';

// --- Face Swap ---
const FACE_SWAP_API_URL = "https://ai-face-swap2.p.rapidapi.com/public/process/files";
const FACE_SWAP_API_HOST = "ai-face-swap2.p.rapidapi.com";

async function _runFaceSwapWithRetry(sourceFile: File, targetFile: File, retries: number = 2): Promise<string> {
  const rapidApiKey = process.env.RAPIDAPI_KEY;
  if (!rapidApiKey) {
    throw new Error("RAPIDAPI_KEY is not set.");
  }

  const formData = new FormData();
  formData.append("source", sourceFile);
  formData.append("target", targetFile);

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      console.log(`Face swap attempt ${attempt + 1}/${retries + 1}...`);

      const response = await fetchWithTimeout(FACE_SWAP_API_URL, {
        method: "POST",
        headers: {
          accept: "application/json",
          "x-rapidapi-host": FACE_SWAP_API_HOST,
          "x-rapidapi-key": rapidApiKey,
        },
        body: formData,
        timeout: 180000, // Increased to 3 minutes
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

      console.log(`Face swap successful on attempt ${attempt + 1}`);
      return swappedImageUrl;

    } catch (error) {
      console.error(`Face swap attempt ${attempt + 1} failed:`, error);

      if (attempt === retries) {
        // Last attempt failed, throw the error
        throw new Error(`Face swap failed after ${retries + 1} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Wait before retrying (exponential backoff)
      const waitTime = Math.pow(2, attempt) * 5000; // 5s, 10s, 20s...
      console.log(`Waiting ${waitTime}ms before retry...`);
      await sleep(waitTime);
    }
  }

  throw new Error("Face swap failed: Maximum retries exceeded");
}


/**
 * ATOMIC STEP: Performs face swap.
 */
export async function runFaceSwap({
  targetImageUrl,
  faceImageUrl,
  jobId,
}: {
  targetImageUrl: string;
  faceImageUrl: string;
  jobId?: string;
}) {
  const startTime = Date.now();
  console.log(`[PERF_LOG | Job ${jobId}] [ATOMIC_STEP] Running Face Swap...`);

  // Convert images to files in parallel
  const [targetFile, faceFile] = await Promise.all([
    urlToFile(targetImageUrl, "target.jpg", "image/jpeg"),
    urlToFile(faceImageUrl, "face.jpg", "image/jpeg")
  ]);

  // Perform face swap
  const swappedHttpUrl = await _runFaceSwapWithRetry(faceFile, targetFile);

  const endTime = Date.now();
  console.log(`[PERF_LOG | Job ${jobId}] [ATOMIC_STEP] Face Swap complete. Elapsed: ${endTime - startTime}ms.`);
  console.log("[ATOMIC_STEP] Face Swap complete:", swappedHttpUrl.substring(0, 100));
  return swappedHttpUrl;
}