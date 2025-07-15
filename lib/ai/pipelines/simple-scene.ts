import { kv } from "@vercel/kv";
import { Job, Suggestion } from "../types";
import { runStylizationMultiple, runVirtualTryOnMultiple } from "../services/kling";
import { saveFinalImageToBlob } from "../services/blob";

/**
 * PIPELINE V2: Enhanced Simple Scene with parallel generation for single outfit.
 * Generates multiple variations of the same outfit suggestion.
 */
interface LegacyJobForPipeline {
  jobId: string;
  suggestion: Suggestion;
  suggestionIndex: number;
  humanImage: { url: string; name: string; type: string };
  garmentImage: { url: string; name: string; type: string };
  // Add input field to access stylePrompt and other job parameters
  input?: {
    customPrompt?: string;
    stylePrompt?: string;
    occasion?: string;
    generationMode?: string;
    userProfile?: any;
    humanImage?: { url: string; type: string; name: string };
    garmentImage?: { url: string; type: string; name: string };
  };
}

export async function executeSimpleScenePipelineV2(
  job: LegacyJobForPipeline
): Promise<{ imageUrls: string[], finalPrompt: string, stylizedImageUrls: string[] }> {
  console.log(`[PIPELINE_START] Executing "Simple Scene V2" pipeline for job ${job.jobId}`);

  if (!job.suggestion?.finalPrompt) {
    throw new Error("Cannot run simple scene pipeline V2 without 'finalPrompt' in suggestion.");
  }

  const stylizationResult = await runStylizationMultiple(
    'kling-v1-5',
    job.suggestion,
    job.humanImage.url,
    job.humanImage.name,
    job.humanImage.type,
    {
      jobId: job.jobId,
      input: job.input || {
        customPrompt: undefined,
        stylePrompt: undefined,
        occasion: undefined,
        generationMode: undefined,
        userProfile: undefined,
        humanImage: job.humanImage,
        garmentImage: job.garmentImage,
      }
    } as any // Pass a compatible job object to access stylePrompt
  );

  const tempStyledImageUrls = stylizationResult.imageUrls;
  const finalPrompt = stylizationResult.finalPrompt;

  // --- NEW: Save stylized images to our own blob storage ---
  const stylizedImageUrls: string[] = [];
  for (let i = 0; i < tempStyledImageUrls.length; i++) {
    const finalUrl = await saveFinalImageToBlob(
      tempStyledImageUrls[i],
      `${job.jobId}-${job.suggestionIndex}-stylized-${i + 1}` // Unique name
    );
    stylizedImageUrls.push(finalUrl);
  }
  // --- END NEW ---

  console.log(`[PIPELINE] Storing ${stylizedImageUrls.length} intermediate images for job ${job.jobId}, suggestion ${job.suggestionIndex}`);
  const jobToUpdate = await kv.get<Job>(job.jobId);
  if (jobToUpdate && jobToUpdate.suggestions[job.suggestionIndex]) {
    jobToUpdate.suggestions[job.suggestionIndex].intermediateImageUrls = stylizedImageUrls;
    jobToUpdate.updatedAt = Date.now();
    await kv.set(job.jobId, jobToUpdate);
    console.log(`[PIPELINE] Successfully stored intermediate images.`);
  }

  const allTryOnPromises = stylizedImageUrls.map((styledImage, index) => {
    console.log(`[PIPELINE] Processing virtual try-on for styled image ${index + 1}/${stylizedImageUrls.length}`);
    return runVirtualTryOnMultiple(
      styledImage,
      job.garmentImage.url,
      job.garmentImage.name,
      job.garmentImage.type
    );
  });

  const allTryOnGroups = await Promise.all(allTryOnPromises);
  const allTryOnImages = allTryOnGroups.flat();

  const finalImages: string[] = [];
  for (let i = 0; i < allTryOnImages.length; i++) {
    const finalUrl = await saveFinalImageToBlob(
      allTryOnImages[i],
      `${job.jobId}-${job.suggestionIndex}-${i + 1}`
    );
    finalImages.push(finalUrl);
  }

  console.log(`[PIPELINE_END] "Simple Scene V2" pipeline finished for job ${job.jobId}. Generated ${finalImages.length} images.`);
  return { imageUrls: finalImages, finalPrompt, stylizedImageUrls };
}