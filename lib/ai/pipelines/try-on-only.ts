import { kv } from "@vercel/kv";
import { Job } from "../types";
import { runVirtualTryOnMultiple } from "../services/kling";
import { saveFinalImageToBlob } from "../services/blob";

/**
 * PIPELINE 1: Performs virtual try-on only.
 * Now returns multiple images and empty finalPrompt.
 */
export async function executeTryOnOnlyPipeline(job: Job): Promise<{ imageUrls: string[], finalPrompt: string }> {
  console.log(`[PIPELINE_START] Executing "Try-On Only" pipeline for job ${job.jobId}`);

  // Step 1: Virtual Try-On on the original human image
  // The 'canvas' is the user's original photo.
  const tryOnImageUrls = await runVirtualTryOnMultiple(
    job.humanImage.url,
    job.garmentImage.url,
    job.garmentImage.name,
    job.garmentImage.type
  );

  // Get the full job from KV
  const currentJob = await kv.get<Job>(job.jobId);
  if (currentJob) {
    // This pipeline doesn't have a specific suggestion, so we can't update a single one.
    // This part of the logic needs to be re-evaluated in the context of the new data model.
    // For now, we are commenting out the direct update.
    // The parent function `runImageGenerationPipeline` is responsible for setting the final status.
    // currentJob.suggestions[0].tryOnImages = tryOnImageUrls; // Example of what might be done
    // await kv.set(job.jobId, currentJob);
  }

  // Step 2: Save all results to blob storage
  const finalUrls: string[] = [];
  for (let i = 0; i < tryOnImageUrls.length; i++) {
    const finalUrl = await saveFinalImageToBlob(tryOnImageUrls[i], `${job.jobId}-${i + 1}`);
    finalUrls.push(finalUrl);
  }

  console.log(`[PIPELINE_END] "Try-On Only" pipeline finished for job ${job.jobId}. Generated ${finalUrls.length} images.`);
  return { imageUrls: finalUrls, finalPrompt: "" }; // Empty finalPrompt for try-on only
}