import { kv } from "@vercel/kv";
import { Job } from "../types";
import { runStylizationMultiple, runVirtualTryOnMultiple } from "../services/kling";
import { runAndPerformFaceSwap } from "../services/face-swap";
import { saveFinalImageToBlob } from "../services/blob";

/**
 * PIPELINE 3: Performs the full advanced scene generation.
 * Now returns multiple images and finalPrompt.
 */
export async function executeAdvancedScenePipeline(job: Job): Promise<{ imageUrls: string[], finalPrompt: string }> {
  console.log(`[PIPELINE_START] Executing "Advanced Scene" pipeline for job ${job.jobId}`);
  if (!job.suggestion?.image_prompt) {
    throw new Error("Cannot run advanced scene pipeline without 'image_prompt'.");
  }
  if (!job.suggestion?.outfit_suggestion) {
    throw new Error("Cannot run advanced scene pipeline without 'outfit_suggestion'.");
  }
  // Step 1: Generate the stylized background/pose with the advanced model
  const stylizationResult = await runStylizationMultiple(
    'kling-v2',
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

  console.log(`[ADVANCED PIPELINE DEBUG] ✅ Stylization completed for job ${job.jobId}:`);
  console.log(`[ADVANCED PIPELINE DEBUG] - Status updated to: stylization_completed`);
  console.log(`[ADVANCED PIPELINE DEBUG] - Styled images count: ${styledImageUrls.length}`);
  console.log(`[ADVANCED PIPELINE DEBUG] - Styled image URLs:`, styledImageUrls.map(url => url.substring(0, 100) + '...'));
  console.log(`[ADVANCED PIPELINE DEBUG] - Final prompt: ${finalPrompt.substring(0, 100)}...`);
  console.log(`[ADVANCED PIPELINE DEBUG] - Process images object:`, {
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

  // Step 2: Perform virtual try-on using each newly stylized image as the canvas
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

  // Step 3: Perform face swap on all try-on images to put the user's face back onto the generated body
  const allSwappedImageUrls: string[] = [];

  for (let i = 0; i < allTryOnImageUrls.length; i++) {
    console.log(`[PIPELINE] Processing face swap for try-on image ${i + 1}/${allTryOnImageUrls.length}`);
    const swappedImageUrl = await runAndPerformFaceSwap(
      job.humanImage.url,
      job.humanImage.name,
      job.humanImage.type,
      allTryOnImageUrls[i]
    );
    allSwappedImageUrls.push(swappedImageUrl);
  }

  // Step 4: Save all final, face-swapped images to blob storage
  const finalUrls: string[] = [];
  for (let i = 0; i < allSwappedImageUrls.length; i++) {
    const finalUrl = await saveFinalImageToBlob(allSwappedImageUrls[i], `${job.jobId}-${i + 1}`);
    finalUrls.push(finalUrl);
  }

  console.log(`[PIPELINE_END] "Advanced Scene" pipeline finished for job ${job.jobId}. Generated ${finalUrls.length} images.`);
  return { imageUrls: finalUrls, finalPrompt };
}