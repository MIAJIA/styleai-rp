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

  try {
    const job = await kv.get<Job>(jobId);

    if (!job) {
      console.error(`[API_STATUS | 404] Job not found in KV. Timestamp: ${new Date().toISOString()}, JobID: ${jobId}, kv.get() returned:`, job);
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // [NEW LOGIC] If job status is 'pending', it means we need to generate suggestions first.
    if (job.status === 'pending') {
      console.log(`[API_STATUS | Job ${job.jobId}] Job is 'pending'. Fetching AI style suggestions...`);

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
      console.log(`[API_STATUS | Job ${job.jobId}] Received ${aiSuggestions.length} suggestions.`);

      // 2. Populate the suggestions in the job object
      job.suggestions = aiSuggestions.map((suggestion: any, index: number): Suggestion => ({
        index,
        status: 'pending', // Each suggestion starts as pending
        styleSuggestion: suggestion,
        personaProfile: {},
        finalPrompt: suggestion.image_prompt,
      }));

      // 3. Update job status to 'processing' and save back to KV
      job.status = 'processing';
      job.updatedAt = Date.now();
      await kv.set(job.jobId, job);
      console.log(`[API_STATUS | Job ${job.jobId}] Job status updated to 'processing' with new suggestions. Ready for image generation.`);

      // Return the updated job immediately. The next poll will trigger image generation.
      return NextResponse.json(job);
    }

    // Check if the first suggestion is pending and trigger it.
    // This is the first time we see the job, so we kick off the generation.
    if (job.suggestions[0]?.status === 'pending') {
      console.log(`[API_STATUS | Job ${job.jobId.slice(-8)}] First suggestion is pending. Triggering image generation for suggestion 0.`);
      job.suggestions[0].status = 'generating_images';
      job.updatedAt = Date.now();

      // Save the updated job status back to KV
      await kv.set(job.jobId, job);

      // Start the pipeline in the background.
      runImageGenerationPipeline(job.jobId, 0);
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
    console.error('Unhandled error in GET /api/generation/status:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown server error occurred.';
    return NextResponse.json({ error: 'Failed to process job status', details: errorMessage }, { status: 500 });
  }
}
