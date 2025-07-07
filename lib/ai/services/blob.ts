import { put } from "@vercel/blob";

/**
 * FINALIZATION STEP: Saves the final image to blob storage.
 */
export async function saveFinalImageToBlob(finalImageUrl: string, jobId: string): Promise<string> {
  console.log("[FINAL_STEP] Saving final image to blob storage...");
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