import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';
import {
  type Job,
  executeAdvancedScenePipeline,
  executeSimpleScenePipelineV2,
  executeTryOnOnlyPipeline,
} from '@/lib/ai';
import { saveLookToDB, type PastLook } from '@/lib/database';

// 这与 start/route.ts 中的背景函数几乎相同
// 在一个成熟的系统中，这部分逻辑可以被抽离到共享的服务中
async function runImageGenerationPipeline(jobId: string, suggestionIndex: number) {
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

    // 为了兼容旧的 pipeline 函数
    const legacyJobForPipeline = {
      ...job.input,
      jobId: job.jobId,
      suggestion: suggestionToProcess.styleSuggestion,
      // HACK: 显式地将 image_prompt 提升到顶层，以兼容可能期望扁平结构的旧版 pipeline
      image_prompt: suggestionToProcess.styleSuggestion?.image_prompt,
      suggestionIndex: suggestionIndex,
    };

    let pipelineResult: { imageUrls: string[], finalPrompt: string };
    switch (job.input.generationMode) {
      case 'tryon-only':
        pipelineResult = await executeTryOnOnlyPipeline(legacyJobForPipeline as any);
        break;
      case 'simple-scene':
        pipelineResult = await executeSimpleScenePipelineV2(legacyJobForPipeline as any);
        break;
      case 'advanced-scene':
        pipelineResult = await executeAdvancedScenePipeline(legacyJobForPipeline as any);
        break;
      default:
        throw new Error(`Unknown generation mode: ${job.input.generationMode}`);
    }

    // --- 在 Job 对象中更新指定的 suggestion ---
    job = await kv.get<Job>(jobId);
    if (!job) {
      throw new Error(`Job with ID ${jobId} disappeared during processing.`);
    }

    job.suggestions[suggestionIndex].status = 'succeeded';
    job.suggestions[suggestionIndex].imageUrls = pipelineResult.imageUrls;
    job.updatedAt = Date.now();

    const isJobComplete = job.suggestions.every(s => s.status === 'succeeded' || s.status === 'failed');
    if (isJobComplete) {
      job.status = 'completed';
    }

    await kv.set(jobId, job);
    console.log(`[Job ${jobId}] Suggestion ${suggestionIndex} completed successfully.`);

    // --- [NEW] Save the successfully generated look to the database ---
    try {
      if (pipelineResult.imageUrls && pipelineResult.imageUrls.length > 0) {
        const lookToSave: PastLook = {
          id: `${job.jobId}-${suggestionIndex}`, // Create a unique ID for this specific look
          imageUrl: pipelineResult.imageUrls[0], // Use the first generated image as the primary one
          style: job.suggestions[suggestionIndex]?.styleSuggestion?.outfit_suggestion?.outfit_title || 'AI Generated Style',
          timestamp: Date.now(),
          originalHumanSrc: job.input.humanImage.url,
          originalGarmentSrc: job.input.garmentImage.url,
          processImages: {
            humanImage: job.input.humanImage.url,
            garmentImage: job.input.garmentImage.url,
            finalImage: pipelineResult.imageUrls[0],
            styleSuggestion: job.suggestions[suggestionIndex]?.styleSuggestion,
            finalPrompt: pipelineResult.finalPrompt,
          },
        };

        await saveLookToDB(lookToSave, 'default');
        console.log(`[Job ${jobId}] Successfully saved look for suggestion ${suggestionIndex} to database.`);
      }
    } catch (dbError) {
      console.error(`[Job ${jobId}] Failed to save look for suggestion ${suggestionIndex} to DB:`, dbError);
    }
    // --- [END NEW] ---

  } catch (error) {
    console.error(`[Job ${jobId}] Background pipeline for suggestion ${suggestionIndex} failed:`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

    const jobToUpdate = await kv.get<Job>(jobId);
    if (jobToUpdate) {
      jobToUpdate.suggestions[suggestionIndex].status = 'failed';
      jobToUpdate.suggestions[suggestionIndex].error = errorMessage;
      jobToUpdate.updatedAt = Date.now();
      await kv.set(jobId, jobToUpdate);
    }
  }
}

export async function POST(request: Request) {
  try {
    const { jobId, suggestionIndex } = await request.json();

    if (!jobId || typeof suggestionIndex !== 'number') {
      return NextResponse.json({ error: 'Missing or invalid jobId or suggestionIndex' }, { status: 400 });
    }

    console.log(`[API | start-image-task] Received request for job ${jobId}, suggestion ${suggestionIndex}`);

    // --- "读取-修改-写入" 模式 ---
    const job = await kv.get<Job>(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // 幂等性检查
    if (job.suggestions[suggestionIndex]?.status !== 'pending') {
      const currentStatus = job.suggestions[suggestionIndex]?.status || 'not found';
      console.log(`[API | start-image-task] Suggestion ${suggestionIndex} is not pending (status: ${currentStatus}). Ignoring request.`);
      // 即使状态不是 pending，我们也返回成功，因为请求的最终目标（启动任务）已经或正在实现。
      return NextResponse.json({ message: `Suggestion is already being processed or is complete. Status: ${currentStatus}` });
    }

    // 修改状态
    job.suggestions[suggestionIndex].status = 'generating_images';
    job.updatedAt = Date.now();

    // 写入
    await kv.set(jobId, job);
    console.log(`[API | start-image-task] Updated suggestion ${suggestionIndex} status to 'generating_images'.`);

    // 触发并忘记 (Fire-and-forget) 后台任务
    runImageGenerationPipeline(jobId, suggestionIndex);
    console.log(`[API | start-image-task] Background pipeline started for suggestion ${suggestionIndex}.`);

    return NextResponse.json({ message: 'Image generation task started for suggestion.' });

  } catch (error) {
    console.error('Error in /api/generation/start-image-task:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ error: 'Failed to start image generation task', details: errorMessage }, { status: 500 });
  }
}