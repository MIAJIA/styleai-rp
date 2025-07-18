import { kv } from '@vercel/kv';
import { NextResponse, type NextRequest } from 'next/server';
import {
  type Job,
  runImageGenerationPipeline,
  getStyleSuggestionFromAI,
  type Suggestion,
} from '@/lib/ai';


export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get('jobId');

  if (!jobId) {
    return NextResponse.json({ error: 'Missing jobId parameter' }, { status: 400 });
  }

  // 🔍 NEW: Environment and request logging
  console.log(`[API_STATUS | ${jobId.slice(-8)}] 🌍 Environment: ${process.env.NODE_ENV}`);
  console.log(`[API_STATUS | ${jobId.slice(-8)}] 📞 Status check request received`);
  console.log(`[API_STATUS | ${jobId.slice(-8)}] 📞 Full JobID: ${jobId}`);

  try {
    const job = await kv.get<Job>(jobId);

    if (!job) {
      console.error(`[API_STATUS | 404] Job not found in KV. Timestamp: ${new Date().toISOString()}, JobID: ${jobId}, kv.get() returned:`, job);
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // 🔍 NEW: Job state logging
    console.log(`[API_STATUS | ${jobId.slice(-8)}] 📋 Current job status: ${job.status}`);
    console.log(`[API_STATUS | ${jobId.slice(-8)}] 📋 Generation mode: ${job.input.generationMode}`);
    console.log(`[API_STATUS | ${jobId.slice(-8)}] 📋 Suggestions count: ${job.suggestions.length}`);

    // [NEW LOGIC] If job status is 'pending', it means we need to generate suggestions first.
    if (job.status === 'pending') {
      console.log(`[API_STATUS | Job ${job.jobId.slice(-8)}] 🔄 Job is 'pending'. Fetching AI style suggestions...`);
      console.log(`[API_STATUS | Job ${job.jobId.slice(-8)}] 🔄 This step does NOT call Kling AI yet`);

      // 🔍 LOG: 确认 style_prompt 传递
      console.log(`[STYLE_PROMPT_LOG] 🎯 Passing style_prompt to AI:`, job.input.stylePrompt ? 'YES' : 'NO');
      if (job.input.stylePrompt) {
        console.log(`[STYLE_PROMPT_LOG] 📝 Style prompt content (first 100 chars):`, job.input.stylePrompt.substring(0, 100));
      }

      // 1. Get style suggestions from AI
      const aiSuggestions = await getStyleSuggestionFromAI(
        {
          humanImageUrl: job.input.humanImage.url,
          garmentImageUrl: job.input.garmentImage.url,
          occasion: job.input.occasion,
          userProfile: job.input.userProfile,
          stylePrompt: job.input.stylePrompt, // 🔍 新增：传递 stylePrompt
        },
        { count: 3 }
      );
      console.log(`[API_STATUS | Job ${job.jobId.slice(-8)}] 🔄 Received ${aiSuggestions.length} suggestions.`);

      // 2. Populate the suggestions in the job object
      job.suggestions = aiSuggestions.map((suggestion: any, index: number): Suggestion => ({
        index,
        status: 'pending', // Each suggestion starts as pending
        styleSuggestion: suggestion,
        personaProfile: {},
        // 🔍 MINIMAL: 只设置一个占位符，真正的 prompt 构建完全在 kling.ts 中处理
        finalPrompt: "Generated styling suggestion",
      }));

      // 3. Update job status to 'processing' and save back to KV
      job.status = 'processing';
      job.updatedAt = Date.now();

      // 🔥 FIX: 立即触发第一个建议的图像生成，避免重复触发
      if (job.suggestions[0]) {
        console.log(`[API_STATUS | Job ${job.jobId.slice(-8)}] 🚀 Auto-triggering first suggestion after AI suggestions generated.`);
        job.suggestions[0].status = 'generating_images';

        // 立即启动pipeline
        runImageGenerationPipeline(job.jobId, 0);
        console.log(`[API_STATUS | Job ${job.jobId.slice(-8)}] 🚀 Pipeline started in background for suggestion 0.`);
      }

      await kv.set(job.jobId, job);
      console.log(`[API_STATUS | Job ${job.jobId.slice(-8)}] 🔄 Job status updated to 'processing' with pipeline already triggered.`);

      // Return the updated job immediately
      return NextResponse.json(job);
    }

    // 🔥 FIX: 只有当job状态仍然是'processing'且第一个建议仍然是'pending'时才触发
    // 但是我们需要确保这种情况不会发生，因为上面的逻辑已经处理了
    if (job.status === 'processing' && job.suggestions[0]?.status === 'pending') {
      console.log(`[API_STATUS | Job ${job.jobId.slice(-8)}] ⚠️ REDUNDANT TRIGGER DETECTED - This should not happen!`);
      console.log(`[API_STATUS | Job ${job.jobId.slice(-8)}] ⚠️ First suggestion is still pending after job moved to processing.`);
      console.log(`[API_STATUS | Job ${job.jobId.slice(-8)}] 🚀 Triggering image generation for suggestion 0 as fallback.`);

      job.suggestions[0].status = 'generating_images';
      job.updatedAt = Date.now();

      // Save the updated job status back to KV
      await kv.set(job.jobId, job);

      // 🔍 NEW: Pipeline trigger logging
      console.log(`[API_STATUS | Job ${job.jobId.slice(-8)}] 🚀 About to start pipeline in background...`);

      // Start the pipeline in the background.
      runImageGenerationPipeline(job.jobId, 0);

      console.log(`[API_STATUS | Job ${job.jobId.slice(-8)}] 🚀 Pipeline started in background.`);
    }

    const loggedStatusKey = `logged_status:${jobId}`;
    const previousStatus = await kv.get<string>(loggedStatusKey);

    if (job.status !== previousStatus) {
      console.log(`⚠️⚠️⚠️[API_STATUS] Job ${jobId.slice(-8)} status changed: ${previousStatus || 'null'} → ${job.status}`);
      // Set with expiration to avoid dangling keys
      await kv.set(loggedStatusKey, job.status, { ex: 60 * 10 }); // 10 minutes expiration
    }

    return NextResponse.json(job);

  } catch (error) {
    console.error(`[API_STATUS | ${jobId.slice(-8)}] 💥 Unhandled error in GET /api/generation/status:`, error);
    console.error(`[API_STATUS | ${jobId.slice(-8)}] 💥 Error type: ${error instanceof Error ? error.constructor.name : 'Unknown'}`);
    console.error(`[API_STATUS | ${jobId.slice(-8)}] 💥 Environment: ${process.env.NODE_ENV}`);

    // Check if this is a balance-related error
    if (error instanceof Error && (error.message.includes('429') || error.message.includes('balance') || error.message.includes('Account balance not enough'))) {
      console.error(`[API_STATUS | ${jobId.slice(-8)}] 💰 BALANCE ERROR DETECTED IN STATUS API!`);
      console.error(`[API_STATUS | ${jobId.slice(-8)}] 💰 This is why users see 503 errors - Kling AI account needs recharge`);
    }

    const errorMessage = error instanceof Error ? error.message : 'An unknown server error occurred.';
    return NextResponse.json({ error: 'Failed to process job status', details: errorMessage }, { status: 500 });
  }
}
