import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';
import { getStyleSuggestionFromAI, generateFinalImage } from '@/lib/ai';

// Define the Job type for better type safety
interface Job {
  jobId: string;
  status: 'pending' | 'processing' | 'suggestion_generated' | 'completed' | 'failed';
  statusMessage: string;
  humanImage: { url: string; type: string; name: string };
  garmentImage: { url: string; type: string; name: string };
  occasion: string;
  suggestion?: {
      image_prompt: string;
      [key: string]: any;
  };
  result?: {
    imageUrl: string;
  };
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');

  if (!jobId) {
    return NextResponse.json({ error: 'Missing jobId parameter' }, { status: 400 });
  }

  try {
    const job = await kv.get<Job>(jobId);

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // This is the core of the state machine.
    // We check the status and trigger the next step.
    if (job.status === 'pending') {
      try {
        // --- Step 1: Update status to 'processing' (Optimistic Update) ---
        console.log(`[Job ${jobId}] Status 'pending'. Starting suggestion generation.`);
        job.status = 'processing';
        job.statusMessage = 'Analyzing your images and occasion to generate personalized style advice...';
        job.updatedAt = new Date().toISOString();
        await kv.set(jobId, job);

        // --- Step 2: Perform the actual work ---
        const suggestion = await getStyleSuggestionFromAI({
          humanImageUrl: job.humanImage.url,
          garmentImageUrl: job.garmentImage.url,
          occasion: job.occasion,
        });

        // --- Step 3: Update job with result and new status ---
        job.status = 'suggestion_generated';
        job.statusMessage = 'Style advice generated. Preparing to create your final look...';
        job.suggestion = suggestion;
        job.updatedAt = new Date().toISOString();
        await kv.set(jobId, job);
        console.log(`[Job ${jobId}] Status 'suggestion_generated'. Suggestion stored.`);

        // Return the updated job so the client knows what's happening
        return NextResponse.json(job);

      } catch (aiError) {
        console.error(`[Job ${jobId}] AI Suggestion failed:`, aiError);
        job.status = 'failed';
        job.statusMessage = 'Failed to generate style advice.';
        job.error = aiError instanceof Error ? aiError.message : 'Unknown AI error';
        job.updatedAt = new Date().toISOString();
        await kv.set(jobId, job);
        return NextResponse.json(job, { status: 500 });
      }
    } else if (job.status === 'suggestion_generated') {
        try {
            // --- Step 1: Update status to 'processing' ---
            console.log(`[Job ${jobId}] Status 'suggestion_generated'. Starting final image generation.`);
            job.status = 'processing';
            job.statusMessage = 'Style advice complete. Generating your final, high-resolution look... this is the longest step.';
            job.updatedAt = new Date().toISOString();
            await kv.set(jobId, job);

            // --- Step 2: Perform the actual work ---
            if (!job.suggestion?.image_prompt) {
                throw new Error("Cannot generate final image without an 'image_prompt' in the job suggestion.");
            }
            const finalImageUrl = await generateFinalImage({
                jobId: job.jobId,
                humanImageUrl: job.humanImage.url,
                humanImageType: job.humanImage.type,
                humanImageName: job.humanImage.name,
                garmentImageUrl: job.garmentImage.url,
                garmentImageType: job.garmentImage.type,
                garmentImageName: job.garmentImage.name,
                imagePrompt: job.suggestion.image_prompt,
            });

            // --- Step 3: Update job with result and 'completed' status ---
            job.status = 'completed';
            job.statusMessage = 'Your new look is ready!';
            job.result = { imageUrl: finalImageUrl };
            job.updatedAt = new Date().toISOString();
            await kv.set(jobId, job);
            console.log(`[Job ${jobId}] Status 'completed'. Final image URL stored.`);

            return NextResponse.json(job);

        } catch (finalGenError) {
            console.error(`[Job ${jobId}] Final Image Generation failed:`, finalGenError);
            job.status = 'failed';
            job.statusMessage = 'There was an issue creating the final image.';
            job.error = finalGenError instanceof Error ? finalGenError.message : 'Unknown final generation error';
            job.updatedAt = new Date().toISOString();
            await kv.set(jobId, job);
            return NextResponse.json(job, { status: 500 });
        }
    }

    // If the status is not one that triggers an action,
    // just return the current job state.
    return NextResponse.json(job);

  } catch (error) {
    console.error('Error fetching job status:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ error: 'Failed to fetch job status', details: errorMessage }, { status: 500 });
  }
}