import { kv } from '@vercel/kv';
import {
  type Job,
  executeAdvancedScenePipeline,
  executeSimpleScenePipelineV2,
  executeTryOnOnlyPipeline,
} from '@/lib/ai';
import { saveLookToDB, type PastLook } from '@/lib/database';

/**
 * This is the single, shared background pipeline runner for all image generation tasks.
 * It is called via "fire-and-forget" from the API routes.
 */
export async function runImageGenerationPipeline(jobId: string, suggestionIndex: number) {
  let job: Job | null = null;
  try {
    // 🔍 NEW: Environment and flow logging
    console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] 🏃 Starting pipeline execution...`);
    console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] 🌍 Environment: ${process.env.NODE_ENV}`);
    console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] 📝 Suggestion index: ${suggestionIndex}`);

    job = await kv.get<Job>(jobId);
    if (!job) {
      throw new Error(`Job with ID ${jobId} not found.`);
    }

    const suggestionToProcess = job.suggestions[suggestionIndex];
    if (!suggestionToProcess) {
      throw new Error(`Suggestion index ${suggestionIndex} not found in job ${jobId}.`);
    }

    console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] 📋 Job details:`);
    console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] 📋 - Generation mode: ${job.input.generationMode}`);
    console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] 📋 - Human image: ${job.input.humanImage.url.substring(0, 50)}...`);
    console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] 📋 - Garment image: ${job.input.garmentImage.url.substring(0, 50)}...`);
    console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] 📋 - Suggestion status: ${suggestionToProcess.status}`);

    console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] Starting image generation for suggestion ${suggestionIndex}...`);

    // This adapter object is passed to the underlying pipeline implementations.
    // It flattens the structure to be compatible with older pipeline functions
    // while ensuring the correct data is passed.
    const pipelineAdapter = {
      ...job.input,
      jobId: job.jobId,
      // FIX: Pass the entire suggestion object. The pipeline function will
      // now have access to `suggestion.finalPrompt`.
      suggestion: suggestionToProcess,
      suggestionIndex: suggestionIndex,
    };

    let pipelineResult: {
      imageUrls: string[];
      finalPrompt: string;
      stylizedImageUrls?: string[];
    };
    const pipelineStartTime = Date.now();
    console.log(`[PERF_LOG | pipeline-runner] Starting pipeline for mode: ${job.input.generationMode}.`);

    // 🔍 NEW: Enhanced pipeline selection logging
    console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] 🔀 Pipeline selection: ${job.input.generationMode}`);

    switch (job.input.generationMode) {
      case 'tryon-only':
        console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] 🔀 Executing TRY-ON ONLY pipeline`);
        console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] 🔀 This will call: runVirtualTryOnMultiple -> /v1/images/kolors-virtual-try-on`);
        pipelineResult = await executeTryOnOnlyPipeline(pipelineAdapter as any);
        break;
      case 'simple-scene':
        console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] 🔀 Executing SIMPLE SCENE pipeline`);
        console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] 🔀 This will call: runStylizationMultiple -> /v1/images/generations`);
        console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] 🔀 Then call: runVirtualTryOnMultiple -> /v1/images/kolors-virtual-try-on`);
        pipelineResult = await executeSimpleScenePipelineV2(pipelineAdapter as any);
        break;
      case 'advanced-scene':
        console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] 🔀 Executing ADVANCED SCENE pipeline`);
        console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] 🔀 This will call: runStylizationMultiple -> /v1/images/generations`);
        console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] 🔀 Then call: runVirtualTryOnMultiple -> /v1/images/kolors-virtual-try-on`);
        console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] 🔀 Then call: runFaceSwap -> Face replacement API`);
        pipelineResult = await executeAdvancedScenePipeline(pipelineAdapter as any);
        break;
      default:
        throw new Error(`Unknown generation mode: ${job.input.generationMode}`);
    }
    const pipelineEndTime = Date.now();
    console.log(`[PERF_LOG | pipeline-runner] Pipeline execution finished. Elapsed: ${pipelineEndTime - pipelineStartTime}ms.`);

    // 🔍 NEW: Pipeline result logging
    console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] 🎉 Pipeline completed successfully!`);
    console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] 🎉 Generated ${pipelineResult.imageUrls.length} final images`);
    console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] 🎉 Final prompt: ${pipelineResult.finalPrompt.substring(0, 100)}...`);

    // --- Update the Job object with the successful result ---
    job = await kv.get<Job>(jobId); // Re-fetch to ensure we have the latest state
    if (!job) {
      throw new Error(`Job with ID ${jobId} disappeared during processing.`);
    }

    job.suggestions[suggestionIndex].status = 'succeeded';
    job.suggestions[suggestionIndex].imageUrls = pipelineResult.imageUrls;
    job.updatedAt = Date.now();

    // 🔍 FIX: 更智能的完成状态检查
    // 对于 simple-scene 模式，只要有一个 suggestion 成功就可以认为 job 完成
    // 对于其他模式，需要所有 suggestions 都完成
    const isJobComplete = job.input.generationMode === 'simple-scene'
      ? job.suggestions.some(s => s.status === 'succeeded')
      : job.suggestions.every(s => s.status === 'succeeded' || s.status === 'failed');

    if (isJobComplete) {
      job.status = 'completed';
      console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] 🎉 Job marked as completed (mode: ${job.input.generationMode})`);
    }

    await kv.set(jobId, job);
    console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] Suggestion ${suggestionIndex} completed successfully.`);

    // --- Save the successfully generated look to the database ---
    try {
      if (pipelineResult.imageUrls && pipelineResult.imageUrls.length > 0) {
        const lookToSave: PastLook = {
          id: `${job.jobId}-${suggestionIndex}`,
          imageUrl: pipelineResult.imageUrls[0],
          style: job.suggestions[suggestionIndex]?.styleSuggestion?.outfit_suggestion?.outfit_title || 'AI Generated Style',
          timestamp: Date.now(),
          originalHumanSrc: job.input.humanImage.url,
          originalGarmentSrc: job.input.garmentImage.url,
          processImages: {
            humanImage: job.input.humanImage.url,
            garmentImage: job.input.garmentImage.url,
            finalImage: pipelineResult.imageUrls[0],
            stylizedImageUrl: pipelineResult.stylizedImageUrls?.[0],
            styleSuggestion: job.suggestions[suggestionIndex]?.styleSuggestion,
            finalPrompt: pipelineResult.finalPrompt,
          },
        };

        await saveLookToDB(lookToSave, 'default');
        console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] Successfully saved look for suggestion ${suggestionIndex} to database.`);
      }
    } catch (dbError) {
      console.error(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] Failed to save look for suggestion ${suggestionIndex} to DB:`, dbError);
    }

  } catch (error) {
    console.error(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] 💥 Background pipeline for suggestion ${suggestionIndex} failed:`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

    // 🔍 NEW: Enhanced error logging
    console.error(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] 💥 Error type: ${error instanceof Error ? error.constructor.name : 'Unknown'}`);
    console.error(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] 💥 Error message: ${errorMessage}`);
    console.error(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] 💥 Environment: ${process.env.NODE_ENV}`);

    // Check if this is a balance-related error
    if (errorMessage.includes('429') || errorMessage.includes('balance') || errorMessage.includes('Account balance not enough')) {
      console.error(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] 💰 BALANCE ERROR DETECTED IN PIPELINE!`);
      console.error(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] 💰 This is why users see 503 errors - Kling AI account needs recharge`);
    }

    // Update the specific suggestion with the error
    const jobToUpdate = await kv.get<Job>(jobId);
    if (jobToUpdate) {
      jobToUpdate.suggestions[suggestionIndex].status = 'failed';
      jobToUpdate.suggestions[suggestionIndex].error = errorMessage;
      jobToUpdate.updatedAt = Date.now();
      await kv.set(jobId, jobToUpdate);
    }
  }
}