import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { put } from '@vercel/blob';
import {
  getStyleSuggestionFromAI,
  executeAdvancedScenePipeline,
  executeSimpleScenePipelineV2,
  executeTryOnOnlyPipeline,
  type Job,
  type Suggestion,
  type GenerationMode,
} from '@/lib/ai';
import { saveLookToDB, type PastLook } from '@/lib/database';
import { type OnboardingData } from '@/lib/onboarding-storage';

// This background function now ONLY handles the long-running image generation
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

    console.log(`[Job ${jobId}] Starting image generation pipeline for suggestion ${suggestionIndex}...`);

    // 为了兼容旧的 pipeline 函数，我们创建一个临时的"旧版" job 对象
    // 这样就无需立刻重构所有 pipeline 函数
    const legacyJobForPipeline = {
      ...job.input,
      jobId: job.jobId,
      // pipeline 函数可能期望的是单个 suggestion 对象
      suggestion: suggestionToProcess.styleSuggestion,
      // HACK: 显式地将 image_prompt 提升到顶层，以兼容可能期望扁平结构的旧版 pipeline
      image_prompt: suggestionToProcess.styleSuggestion?.image_prompt,
      suggestionIndex: suggestionIndex,
    };

    let pipelineResult: { imageUrls: string[], finalPrompt: string };
    switch (job.input.generationMode) {
      case 'tryon-only':
        // HACK: as any is used here to bridge the gap between old and new types
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
    job = await kv.get<Job>(jobId); // 重新获取以确保我们有最新的状态
    if (!job) {
      throw new Error(`Job with ID ${jobId} disappeared during processing.`);
    }

    job.suggestions[suggestionIndex].status = 'succeeded';
    job.suggestions[suggestionIndex].imageUrls = pipelineResult.imageUrls;
    job.updatedAt = Date.now();

    // 检查是否所有 suggestion 都已完成
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
          // personaProfile and garmentDescription can be added if available
        };

        // We assume a 'default' user for now, this could be dynamic in a multi-user system
        await saveLookToDB(lookToSave, 'default');
        console.log(`[Job ${jobId}] Successfully saved look for suggestion ${suggestionIndex} to database.`);
      }
    } catch (dbError) {
      console.error(`[Job ${jobId}] Failed to save look for suggestion ${suggestionIndex} to DB:`, dbError);
      // We don't re-throw here, as failing to save to DB shouldn't fail the entire generation process.
    }
    // --- [END NEW] ---

  } catch (error) {
    console.error(`[Job ${jobId}] Background pipeline for suggestion ${suggestionIndex} failed:`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

    // 在指定的 suggestion 中更新错误信息
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
    const formData = await request.formData();
    const humanImageFile = formData.get('human_image') as File | null;
    const garmentImageFile = formData.get('garment_image') as File | null;
    const occasion = formData.get('occasion') as string | null;
    const generationMode = formData.get('generation_mode') as GenerationMode | null;
    const userProfileString = formData.get('user_profile') as string | null;
    const customPrompt = formData.get('custom_prompt') as string | null;

    let userProfile: OnboardingData | undefined = undefined;
    if (userProfileString) {
      try {
        userProfile = JSON.parse(userProfileString);
      } catch (e) {
        console.warn('Could not parse user_profile from FormData');
      }
    }

    if (!humanImageFile || !garmentImageFile || !occasion || !generationMode) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // --- 阶段二: 新逻辑 ---

    // 1. 上传图片
    const humanImageBlob = await put(humanImageFile.name, humanImageFile, { access: 'public', addRandomSuffix: true });
    const garmentImageBlob = await put(garmentImageFile.name, garmentImageFile, { access: 'public', addRandomSuffix: true });

    // 2. 从 AI 服务获取三个建议 (单次调用)
    console.log('[API | start] Requesting 3 style suggestions from AI in a single call...');
    const aiSuggestions = await getStyleSuggestionFromAI(
      {
        humanImageUrl: humanImageBlob.url,
        garmentImageUrl: garmentImageBlob.url,
        occasion,
        userProfile,
      },
      { count: 3 }
    );
    console.log(`[API | start] Successfully received ${aiSuggestions.length} suggestions from AI.`);

    // 3. 创建包含 3 个 suggestion 的 Job 对象
    const jobId = randomUUID();
    const now = Date.now();

    const suggestions: Suggestion[] = aiSuggestions.map((suggestion: any, index: number) => ({
      index,
      // 只有第一个 suggestion 会立刻开始生成图片
      status: index === 0 ? 'generating_images' : 'pending',
      styleSuggestion: suggestion, // 整个 AI 返回的 suggestion 对象
      personaProfile: {}, // 可以在 pipeline 中填充
      finalPrompt: suggestion.image_prompt, // 从 suggestion 中提取
    }));

    const newJob: Job = {
      jobId,
      status: 'processing',
      suggestions,
      input: {
        humanImage: { url: humanImageBlob.url, type: humanImageFile.type, name: humanImageFile.name },
        garmentImage: { url: garmentImageBlob.url, type: garmentImageFile.type, name: garmentImageFile.name },
        generationMode,
        occasion,
        userProfile,
        customPrompt: customPrompt?.trim() || undefined,
      },
      createdAt: now,
      updatedAt: now,
    };

    // 4. 将完整的 job 对象存入 KV
    await kv.set(jobId, newJob);
    console.log(`[Job ${jobId}] Initial job record created with 3 suggestions.`);

    // 5. 触发并忘记 (Fire-and-forget) 第一个 suggestion 的后台处理进程
    runImageGenerationPipeline(jobId, 0);
    console.log(`[Job ${jobId}] Background pipeline started for suggestion 0.`);

    // 6. 立刻返回
    return NextResponse.json({ jobId });
  } catch (error) {
    console.error('Error starting generation job:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ error: 'Failed to start generation job', details: errorMessage }, { status: 500 });
  }
}