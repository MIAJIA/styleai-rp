import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';
import { type Job, runImageGenerationPipeline } from '@/lib/ai';

export async function POST(request: Request) {
  try {
    const { jobId, suggestionIndex } = await request.json();

    if (!jobId || typeof suggestionIndex !== 'number') {
      return NextResponse.json({ error: 'Missing or invalid jobId or suggestionIndex' }, { status: 400 });
    }

    console.log(`[API | start-image-task] Received request for job ${jobId}, suggestion ${suggestionIndex}`);

    const job = await kv.get<Job>(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (job.suggestions[suggestionIndex]?.status !== 'pending') {
      const currentStatus = job.suggestions[suggestionIndex]?.status || 'not found';
      console.log(`[API | start-image-task] Suggestion ${suggestionIndex} is not pending (status: ${currentStatus}). Ignoring request.`);
      return NextResponse.json({ message: `Suggestion is already being processed or is complete. Status: ${currentStatus}` });
    }

    job.suggestions[suggestionIndex].status = 'generating_images';
    job.updatedAt = Date.now();

    await kv.set(jobId, job);
    console.log(`[API | start-image-task] Updated suggestion ${suggestionIndex} status to 'generating_images'.`);

    // Use the shared pipeline runner
    runImageGenerationPipeline(jobId, suggestionIndex);
    console.log(`[API | start-image-task] Background pipeline started for suggestion ${suggestionIndex}.`);

    return NextResponse.json({ message: 'Image generation task started for suggestion.' });

  } catch (error) {
    console.error('Error in /api/generation/start-image-task:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ error: 'Failed to start image generation task', details: errorMessage }, { status: 500 });
  }
}