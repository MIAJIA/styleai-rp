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
  // Add other fields that might be passed from the legacy adapter
}

export async function executeSimpleScenePipelineV2(
  job: LegacyJobForPipeline
): Promise<{ imageUrls: string[], finalPrompt: string, stylizedImageUrls: string[] }> {
  console.log(`[PIPELINE_START] Executing "Simple Scene V2" pipeline for job ${job.jobId}`);

  // 🔍 FIX: 移除不必要的 finalPrompt 检查
  // runStylizationMultiple 函数已经有完整的 fallback 逻辑来构建 prompt
  // 从 OpenAI 返回的 suggestion 对象中有 image_prompt 字段，这已经足够了
  console.log(`[PIPELINE_DEBUG] Suggestion object keys:`, Object.keys(job.suggestion || {}));
  console.log(`[PIPELINE_DEBUG] StyleSuggestion keys:`, Object.keys(job.suggestion?.styleSuggestion || {}));

  const stylizationResult = await runStylizationMultiple(
    'kling-v1-5',
    job.suggestion,
    job.humanImage.url,
    job.humanImage.name,
    job.humanImage.type
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
    // 🔍 FIX: 确保中间图片及时存储并更新状态
    jobToUpdate.suggestions[job.suggestionIndex].intermediateImageUrls = stylizedImageUrls;
    jobToUpdate.suggestions[job.suggestionIndex].status = 'processing_tryon'; // 更新状态表示正在处理虚拟试穿
    jobToUpdate.updatedAt = Date.now();
    await kv.set(job.jobId, jobToUpdate);
    console.log(`[PIPELINE] Successfully stored intermediate images and updated status to processing_tryon.`);
    console.log(`[PIPELINE] Intermediate images URLs:`, stylizedImageUrls.map(url => url.substring(0, 100) + '...'));
  } else {
    console.error(`[PIPELINE] Failed to update job ${job.jobId} with intermediate images - job or suggestion not found`);
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