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
    job = await kv.get<Job>(jobId);
    if (!job) {
      throw new Error(`Job with ID ${jobId} not found.`);
    }

    const suggestionToProcess = job.suggestions[suggestionIndex];
    if (!suggestionToProcess) {
      throw new Error(`Suggestion index ${suggestionIndex} not found in job ${jobId}.`);
    }

    console.log(`[PIPELINE_RUNNER | Job ${jobId}] Starting image generation for suggestion ${suggestionIndex}...`);

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

    switch (job.input.generationMode) {
      case 'tryon-only':
        pipelineResult = await executeTryOnOnlyPipeline(pipelineAdapter as any);
        break;
      case 'simple-scene':
        pipelineResult = await executeSimpleScenePipelineV2(pipelineAdapter as any);
        break;
      case 'advanced-scene':
        pipelineResult = await executeAdvancedScenePipeline(pipelineAdapter as any);
        break;
      default:
        throw new Error(`Unknown generation mode: ${job.input.generationMode}`);
    }
    const pipelineEndTime = Date.now();
    console.log(`[PERF_LOG | pipeline-runner] Pipeline execution finished. Elapsed: ${pipelineEndTime - pipelineStartTime}ms.`);

    // --- Update the Job object with the successful result ---
    job = await kv.get<Job>(jobId); // Re-fetch to ensure we have the latest state
    if (!job) {
      throw new Error(`Job with ID ${jobId} disappeared during processing.`);
    }

    job.suggestions[suggestionIndex].status = 'succeeded';
    job.suggestions[suggestionIndex].imageUrls = pipelineResult.imageUrls;
    job.updatedAt = Date.now();

    // Check if all suggestions are complete
    const isJobComplete = job.suggestions.every(s => s.status === 'succeeded' || s.status === 'failed');
    if (isJobComplete) {
      job.status = 'completed';
    }

    await kv.set(jobId, job);
    console.log(`[PIPELINE_RUNNER | Job ${jobId}] Suggestion ${suggestionIndex} completed successfully.`);

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
        console.log(`[PIPELINE_RUNNER | Job ${jobId}] Successfully saved look for suggestion ${suggestionIndex} to database.`);
      }
    } catch (dbError) {
      console.error(`[PIPELINE_RUNNER | Job ${jobId}] Failed to save look for suggestion ${suggestionIndex} to DB:`, dbError);
    }

  } catch (error) {
    console.error(`[PIPELINE_RUNNER | Job ${jobId}] Background pipeline for suggestion ${suggestionIndex} failed:`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

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