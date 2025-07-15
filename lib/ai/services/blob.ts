import { put } from "@vercel/blob";

/**
 * FINALIZATION STEP: Saves the final image to blob storage.
 */
export async function saveFinalImageToBlob(finalImageUrl: string, jobId: string): Promise<string> {
  console.log("[FINAL_STEP] Saving final image to blob storage...");

  // 🔍 NEW: Handle development environment mock images
  if (process.env.NODE_ENV === 'development') {
    console.log(`[FINAL_STEP] 🎭 Development environment detected`);
    console.log(`[FINAL_STEP] 🎭 Input URL: ${finalImageUrl.substring(0, 100)}...`);

    // Check if this is a mock image (placeholder URLs or data URIs)
    if (finalImageUrl.includes('via.placeholder.com') ||
      finalImageUrl.includes('placeholder') ||
      finalImageUrl.startsWith('data:image/')) {
      console.log(`[FINAL_STEP] 🎭 Mock image detected - skipping blob storage`);
      console.log(`[FINAL_STEP] 🎭 Mock image type: ${finalImageUrl.startsWith('data:') ? 'base64 data URI' : 'placeholder URL'}`);
      console.log(`[FINAL_STEP] 🎭 Returning original mock URL`);
      return finalImageUrl; // Return the mock URL directly
    }
  }

  // 🔍 Production environment or non-mock images - normal processing
  console.log(`[FINAL_STEP] 🚀 Processing real image for blob storage`);
  console.log(`[FINAL_STEP] 🚀 Fetching image from: ${finalImageUrl.substring(0, 100)}...`);

  const finalImageResponse = await fetch(finalImageUrl);
  if (!finalImageResponse.ok) {
    throw new Error(`Failed to fetch final image from URL: ${finalImageUrl}`);
  }
  const finalImageBlob = await finalImageResponse.blob();
  const finalImageName = `final-look-${jobId}.png`;

  const { url: finalSecureUrl } = await put(finalImageName, finalImageBlob, {
    access: 'public',
    addRandomSuffix: true,
  });

  console.log("[FINAL_STEP] Final image saved:", finalSecureUrl);
  return finalSecureUrl;
}