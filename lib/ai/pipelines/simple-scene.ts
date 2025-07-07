import { kv } from "@vercel/kv";
import { Job } from "../types";
import { runStylizationMultiple, runVirtualTryOnMultiple } from "../services/kling";
import { saveFinalImageToBlob } from "../services/blob";

/**
 * PIPELINE 2: Generates a simple scene with the user, with improved clothing fidelity.
 * Now returns multiple images and finalPrompt.
 */
export async function executeSimpleScenePipeline(job: Job): Promise<{ imageUrls: string[], finalPrompt: string }> {
  console.log(`[PIPELINE_START] Executing "Simple Scene" pipeline for job ${job.jobId}`);
  if (!job.suggestion?.image_prompt) {
    throw new Error("Cannot run simple scene pipeline without 'image_prompt'.");
  }

  if (!job.suggestion?.outfit_suggestion) {
    throw new Error("Cannot run simple scene pipeline without 'outfit_suggestion'.");
  }

  // Step 1: Stylize the image using the simpler, faster model to get a new scene and pose.
  const stylizationResult = await runStylizationMultiple(
    'kling-v1-5',
    job.suggestion,
    job.humanImage.url,
    job.humanImage.name,
    job.humanImage.type,
    job
  );

  const styledImageUrls = stylizationResult.imageUrls;
  const finalPrompt = stylizationResult.finalPrompt;

  await kv.hset(job.jobId, {
    status: 'stylization_completed',
    statusMessage: '场景已生成，正在进行虚拟试穿...',
    processImages: {
      styledImages: styledImageUrls,
      styledImage: styledImageUrls[0] // Keep for backward compatibility
    }
  });

  console.log(`[PIPELINE DEBUG] ✅ Stylization completed for job ${job.jobId}:`);
  console.log(`[PIPELINE DEBUG] - Status updated to: stylization_completed`);
  console.log(`[PIPELINE DEBUG] - Styled images count: ${styledImageUrls.length}`);
  console.log(`[PIPELINE DEBUG] - Styled image URLs:`, styledImageUrls.map(url => url.substring(0, 100) + '...'));
  console.log(`[PIPELINE DEBUG] - Final prompt: ${finalPrompt.substring(0, 100)}...`);
  console.log(`[PIPELINE DEBUG] - Process images object:`, {
    styledImages: styledImageUrls,
    styledImage: styledImageUrls[0]
  });

  // Check if job was cancelled after stylization
  const updatedJob = await kv.hgetall<Job>(job.jobId);
  if (updatedJob?.cancelled) {
    console.log(`[PIPELINE] Job ${job.jobId} was cancelled, stopping pipeline execution`);
    await kv.hset(job.jobId, {
      status: 'cancelled',
      statusMessage: '用户取消了生成任务'
    });
    throw new Error('Job was cancelled by user');
  }

  // Step 2: Perform virtual try-on on each new scene to ensure high clothing fidelity.
  const allTryOnImageUrls: string[] = [];

  for (let i = 0; i < styledImageUrls.length; i++) {
    console.log(`[PIPELINE] Processing virtual try-on for styled image ${i + 1}/${styledImageUrls.length}`);
    const tryOnImageUrls = await runVirtualTryOnMultiple(
      styledImageUrls[i],
      job.garmentImage.url,
      job.garmentImage.name,
      job.garmentImage.type
    );
    allTryOnImageUrls.push(...tryOnImageUrls);
  }

  const existingProcessImages: any = await kv.hget(job.jobId, 'processImages') || {};

  await kv.hset(job.jobId, {
    processImages: {
      ...existingProcessImages,
      tryOnImages: allTryOnImageUrls,
      tryOnImage: allTryOnImageUrls[0] // Keep for backward compatibility
    }
  });

  // Step 3: Save all results to blob storage
  const finalUrls: string[] = [];
  for (let i = 0; i < allTryOnImageUrls.length; i++) {
    const finalUrl = await saveFinalImageToBlob(allTryOnImageUrls[i], `${job.jobId}-${i + 1}`);
    finalUrls.push(finalUrl);
  }

  console.log(`[PIPELINE_END] "Simple Scene" pipeline finished for job ${job.jobId}. Generated ${finalUrls.length} images.`);
  return { imageUrls: finalUrls, finalPrompt };
}

/**
 * PIPELINE V2: Enhanced Simple Scene with parallel generation for single outfit.
 * Generates multiple variations of the same outfit suggestion.
 */
export async function executeSimpleScenePipelineV2(job: Job): Promise<{ imageUrls: string[], finalPrompt: string }> {
  console.log(`[PIPELINE_START] Executing "Simple Scene V2" pipeline for job ${job.jobId}`);
  if (!job.suggestion?.image_prompt) {
    throw new Error("Cannot run simple scene pipeline V2 without 'image_prompt'.");
  }
  if (!job.suggestion?.outfit_suggestion) {
    throw new Error("Cannot run simple scene pipeline V2 without 'outfit_suggestion'.");
  }

  // Step 1: Generate multiple styled images from the same prompt
  const stylizationResult = await runStylizationMultiple(
    'kling-v1-5',
    job.suggestion,
    job.humanImage.url,
    job.humanImage.name,
    job.humanImage.type,
    job
  );

  const styledImageUrls = stylizationResult.imageUrls;
  const finalPrompt = stylizationResult.finalPrompt;

  // Update job with intermediate results
  await kv.hset(job.jobId, {
    status: 'stylization_completed',
    statusMessage: 'Scenes generated, proceeding with virtual try-on...',
    processImages: {
      styledImages: styledImageUrls,
      styledImage: styledImageUrls[0] // Keep for backward compatibility
    }
  });

  // Check if job was cancelled after stylization
  const updatedJob = await kv.hgetall<Job>(job.jobId);
  if (updatedJob?.cancelled) {
    console.log(`[PIPELINE] Job ${job.jobId} was cancelled, stopping pipeline execution`);
    await kv.hset(job.jobId, {
      status: 'cancelled',
      statusMessage: '用户取消了生成任务'
    });
    throw new Error('Job was cancelled by user');
  }

  // Step 2: Parallel virtual try-on for all styled images
  const allTryOnPromises = styledImageUrls.map((styledImage, index) => {
    console.log(`[PIPELINE] Processing virtual try-on for styled image ${index + 1}/${styledImageUrls.length}`);
    return runVirtualTryOnMultiple(
      styledImage,
      job.garmentImage.url,
      job.garmentImage.name,
      job.garmentImage.type
    );
  });

  const allTryOnGroups = await Promise.all(allTryOnPromises);
  const allTryOnImages = allTryOnGroups.flat();

  const existingProcessImages: any = await kv.hget(job.jobId, 'processImages') || {};

  await kv.hset(job.jobId, {
    processImages: {
      ...existingProcessImages,
      tryOnImages: allTryOnImages,
      tryOnImage: allTryOnImages[0] // Keep for backward compatibility
    }
  });

  // Step 3: Save all final images to blob storage
  const finalImages: string[] = [];
  for (let i = 0; i < allTryOnImages.length; i++) {
    const finalUrl = await saveFinalImageToBlob(
      allTryOnImages[i],
      `${job.jobId}-${i + 1}`
    );
    finalImages.push(finalUrl);
  }

  console.log(`[PIPELINE_END] "Simple Scene V2" pipeline finished for job ${job.jobId}. Generated ${finalImages.length} images.`);
  return { imageUrls: finalImages, finalPrompt };
}