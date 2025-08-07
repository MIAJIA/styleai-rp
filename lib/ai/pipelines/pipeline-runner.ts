import { kv } from '@vercel/kv';
import { saveLookToDB, type PastLook } from '@/lib/database';
import { type Job } from '../types';
import { executeAdvancedScenePipeline } from './advanced-scene';
import { executeSimpleScenePipelineV2 } from './simple-scene';
import { executeTryOnOnlyPipeline } from './try-on-only';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

const JOB_LIMIT_KEY = 'job_limit_key';
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

    // 🔥 FIX: 添加pipeline运行锁机制，防止重复执行
    const pipelineLockKey = `pipeline_lock:${jobId}:${suggestionIndex}`;
    const existingLock = await kv.get(pipelineLockKey);
    if (existingLock) {
      console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] ⚠️ PIPELINE ALREADY RUNNING - Skipping duplicate execution`);
      console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] ⚠️ Lock found: ${existingLock}`);
      return;
    }

    // 设置pipeline运行锁 (5分钟过期)
    await kv.set(pipelineLockKey, `started_at_${Date.now()}`, { ex: 300 });
    console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] 🔒 Pipeline lock set for suggestion ${suggestionIndex}`);

    job = await kv.get<Job>(jobId);
    if (!job) {
      // 清理锁
      await kv.del(pipelineLockKey);
      throw new Error(`Job with ID ${jobId} not found.`);
    }

    const suggestionToProcess = job.suggestions[suggestionIndex];
    if (!suggestionToProcess) {
      // 清理锁
      await kv.del(pipelineLockKey);
      throw new Error(`Suggestion index ${suggestionIndex} not found in job ${jobId}.`);
    }

    // 🔥 FIX: 检查建议状态，如果已经在处理中或完成，则跳过
    if (suggestionToProcess.status === 'succeeded' || suggestionToProcess.status === 'failed') {
      console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] ⚠️ Suggestion ${suggestionIndex} already processed (${suggestionToProcess.status}) - Skipping`);
      await kv.del(pipelineLockKey);
      return;
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
        // executeTryOnOnlyPipeline expects the full job object with specific structure
        const tryOnJobAdapter = {
          ...job,
          humanImage: job.input.humanImage,
          garmentImage: job.input.garmentImage,
          suggestion: suggestionToProcess,
        };
        pipelineResult = await executeTryOnOnlyPipeline(tryOnJobAdapter as any);
        break;
      case 'simple-scene':
        console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] 🔀 Executing SIMPLE SCENE pipeline`);
        console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] 🔀 This will call: runStylizationMultiple -> /v1/images/generations`);
        console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] 🔀 Then call: runVirtualTryOnMultiple -> /v1/images/kolors-virtual-try-on`);
        // executeSimpleScenePipelineV2 expects the LegacyJobForPipeline format
        pipelineResult = await executeSimpleScenePipelineV2(pipelineAdapter);
        break;
      case 'advanced-scene':
        console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] 🔀 Executing ADVANCED SCENE pipeline`);
        console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] 🔀 This will call: runStylizationMultiple -> /v1/images/generations`);
        console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] 🔀 Then call: runVirtualTryOnMultiple -> /v1/images/kolors-virtual-try-on`);
        console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] 🔀 Then call: runFaceSwap -> Face replacement API`);
        // executeAdvancedScenePipeline expects the full job object with specific structure
        const advancedJobAdapter = {
          ...job,
          humanImage: job.input.humanImage,
          garmentImage: job.input.garmentImage,
          suggestion: suggestionToProcess,
        };
        pipelineResult = await executeAdvancedScenePipeline(advancedJobAdapter as any);
        break;
      default:
        throw new Error(`Unknown generation mode: ${job.input.generationMode}`);
    }
    const pipelineEndTime = Date.now();
    console.log(`[PERF_LOG | pipeline-runner] Pipeline execution finished. Elapsed: ${pipelineEndTime - pipelineStartTime}ms.`);
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id || 'default';
    const jobLimitKey = `${JOB_LIMIT_KEY}_${userId}`;
    await kv.incr(jobLimitKey)

    // 🔍 NEW: Pipeline result logging
    console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] 🎉 Pipeline completed successfully!`);
    console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] 🎉 Generated ${pipelineResult.imageUrls.length} final images`);
    console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] 🎉 Final prompt: ${pipelineResult.finalPrompt.substring(0, 100)}...`);
    if (pipelineResult.stylizedImageUrls && pipelineResult.stylizedImageUrls.length > 0) {
      console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] 🎨 Generated ${pipelineResult.stylizedImageUrls.length} intermediate images`);
      console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] 🎨 Intermediate images:`, pipelineResult.stylizedImageUrls.map(url => url.substring(0, 100) + '...'));
    }

    // Update the suggestion with the results
    // 🔧 FIX: 获取最新的job数据，保留在pipeline执行过程中添加的中间数据
    const updatedJob = await kv.get<Job>(jobId);
    if (updatedJob && updatedJob.suggestions[suggestionIndex]) {
      // 使用最新的suggestion数据，保留intermediateImageUrls等中间状态
      updatedJob.suggestions[suggestionIndex] = {
        ...updatedJob.suggestions[suggestionIndex], // 保留中间状态（如intermediateImageUrls）
        status: 'succeeded',
        imageUrls: pipelineResult.imageUrls,
        finalPrompt: pipelineResult.finalPrompt,
      };

      // 检查是否所有suggestions都完成了
      const allCompleted = updatedJob.suggestions.every(s => s.status === 'succeeded' || s.status === 'failed');
      if (allCompleted) {
        updatedJob.status = 'completed';
        updatedJob.updatedAt = Date.now();
        console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] 🎉 All suggestions completed. Job marked as completed.`);
      } else {
        updatedJob.updatedAt = Date.now();
        console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] 🎉 Job marked as completed (mode: ${updatedJob.input.generationMode})`);
      }

      // 保存更新的job回到KV
      await kv.set(updatedJob.jobId, updatedJob);
      job = updatedJob; // 更新本地job引用以供后续使用

      // 🔍 NEW: 验证中间图片数据是否被正确保留
      const finalSuggestion = updatedJob.suggestions[suggestionIndex];
      console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] ✅ Suggestion ${suggestionIndex} final state:`);
      console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] ✅ - Status: ${finalSuggestion.status}`);
      console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] ✅ - Final images: ${finalSuggestion.imageUrls?.length || 0}`);
      console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] ✅ - Intermediate images: ${finalSuggestion.intermediateImageUrls?.length || 0}`);
      if (finalSuggestion.intermediateImageUrls && finalSuggestion.intermediateImageUrls.length > 0) {
        console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] ✅ - Intermediate URLs:`, finalSuggestion.intermediateImageUrls.map(url => url.substring(0, 100) + '...'));
      }
    } else {
      console.error(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] ⚠️ Could not find updated job or suggestion to preserve intermediate data`);
      // Fallback to old logic if job retrieval fails
      job.suggestions[suggestionIndex] = {
        ...suggestionToProcess,
        status: 'succeeded',
        imageUrls: pipelineResult.imageUrls,
        finalPrompt: pipelineResult.finalPrompt,
      };

      const allCompleted = job.suggestions.every(s => s.status === 'succeeded' || s.status === 'failed');
      if (allCompleted) {
        job.status = 'completed';
        job.updatedAt = Date.now();
        console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] 🎉 All suggestions completed. Job marked as completed.`);
      } else {
        job.updatedAt = Date.now();
        console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] 🎉 Job marked as completed (mode: ${job.input.generationMode})`);
      }

      await kv.set(job.jobId, job);
    }

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
        // Use userId from job object instead of getSession()
        const userId = job.userId || 'default';
        console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] Saving look with userId: ${userId}`);
        await saveLookToDB(lookToSave, userId);
        console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] Successfully saved look for suggestion ${suggestionIndex} to database.`);
      }
    } catch (dbError) {
      // Use userId from job object instead of getSession()
      const userId = job.userId || 'default';
      console.error(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] Failed to save look for suggestion ${suggestionIndex} to DB:`, dbError);
      console.error(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] User ID: ${userId}`);
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
      console.error(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] Look to Save:`, JSON.stringify(lookToSave, null, 2));
    }

    // 🔥 FIX: 清理pipeline锁
    await kv.del(pipelineLockKey);
    console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] 🔓 Pipeline lock cleared for suggestion ${suggestionIndex}`);

  } catch (error) {
    // 🔥 FIX: 出错时也要清理锁
    const pipelineLockKey = `pipeline_lock:${jobId}:${suggestionIndex}`;
    await kv.del(pipelineLockKey);
    console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] 🔓 Pipeline lock cleared due to error`);

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