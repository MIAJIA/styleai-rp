import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';
import {
  getStyleSuggestionFromAI,
  generateStyledImage,
  generateTryOnImage,
  performFaceSwapAndSave
} from '@/lib/ai';
import { saveLookToDB, PastLook } from '@/lib/database';

// Define the Job Statuses for our state machine
type JobStatus =
  | 'pending'
  | 'processing' // General initial processing state
  | 'suggestion_generated'
  | 'processing_stylization'
  | 'stylization_completed'
  | 'processing_tryon'
  | 'tryon_completed'
  | 'processing_faceswap'
  | 'completed'
  | 'failed';

// Define the Job type for better type safety
interface Job {
  jobId: string;
  status: JobStatus;
  statusMessage: string;
  humanImage: { url: string; type: string; name: string };
  garmentImage: { url: string; type: string; name: string };
  occasion: string;
  suggestion?: {
      image_prompt: string;
      [key: string]: any;
  };
  processImages?: {
    styledImage?: string;
    tryOnImage?: string;
  };
  result?: {
    imageUrl: string;
  };
  error?: string;
  createdAt: string;
  updatedAt: string;
}

// Helper to handle errors consistently
async function handleJobError(job: Job, error: any, message: string, status: JobStatus = 'failed') {
    const jobId = job.jobId;
    console.error(`[Job ${jobId}] Error during '${job.status}':`, error);
    job.status = status;
    job.statusMessage = message;
    job.error = error instanceof Error ? error.message : 'An unknown error occurred';
    job.updatedAt = new Date().toISOString();
    await kv.set(jobId, job);
    return NextResponse.json(job, { status: 500 });
}


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');

  if (!jobId) {
    return NextResponse.json({ error: 'Missing jobId parameter' }, { status: 400 });
  }

  try {
    let job = await kv.get<Job>(jobId);

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // If job is already in a terminal state, just return it.
    if (job.status === 'completed' || job.status === 'failed') {
        return NextResponse.json(job);
    }

    // --- State Machine ---
    switch (job.status) {
        case 'pending':
            try {
                console.log(`[Job ${jobId}] Status 'pending'. Starting suggestion generation.`);
                job.status = 'processing';
                job.statusMessage = 'Analyzing your images and occasion...';
                await kv.set(jobId, job);

                const suggestion = await getStyleSuggestionFromAI({
                    humanImageUrl: job.humanImage.url,
                    garmentImageUrl: job.garmentImage.url,
                    occasion: job.occasion,
                });

                job.status = 'suggestion_generated';
                job.statusMessage = 'Style advice generated. Preparing to create your look...';
                job.suggestion = suggestion;
                job.updatedAt = new Date().toISOString();
                await kv.set(jobId, job);
                console.log(`[Job ${jobId}] Status 'suggestion_generated'. Suggestion stored.`);
            } catch (err) {
                return handleJobError(job, err, 'Failed to generate style advice.');
            }
            break;

        case 'suggestion_generated':
            try {
                console.log(`[Job ${jobId}] Status 'suggestion_generated'. Starting stylization.`);
                job.status = 'processing_stylization';
                job.statusMessage = 'Step 1: Creating a stylized scene...';
                await kv.set(jobId, job);

                const styledImageUrl = await generateStyledImage(job);

                job.status = 'stylization_completed';
                job.statusMessage = 'Stylized scene created.';
                job.processImages = { ...job.processImages, styledImage: styledImageUrl };
                job.updatedAt = new Date().toISOString();
                await kv.set(jobId, job);
            } catch (err) {
                return handleJobError(job, err, 'Failed during image stylization.');
            }
            break;

        case 'stylization_completed':
            try {
                console.log(`[Job ${jobId}] Status 'stylization_completed'. Starting virtual try-on.`);
                job.status = 'processing_tryon';
                job.statusMessage = 'Step 2: Performing virtual try-on...';
                await kv.set(jobId, job);

                const tryOnImageUrl = await generateTryOnImage(job);

                job.status = 'tryon_completed';
                job.statusMessage = 'Virtual try-on complete.';
                job.processImages = { ...job.processImages, tryOnImage: tryOnImageUrl };
                job.updatedAt = new Date().toISOString();
                await kv.set(jobId, job);
            } catch (err) {
                return handleJobError(job, err, 'Failed during virtual try-on.');
            }
            break;

        case 'tryon_completed':
            try {
                console.log(`[Job ${jobId}] Status 'tryon_completed'. Starting face swap.`);
                job.status = 'processing_faceswap';
                job.statusMessage = 'Step 3: Adding the final magic touch...';
                await kv.set(jobId, job);

                const finalImageUrl = await performFaceSwapAndSave(job);

                job.status = 'completed';
                job.statusMessage = 'Your new look is ready!';
                job.result = { imageUrl: finalImageUrl };
                job.updatedAt = new Date().toISOString();

                // Save to DB
                try {
                    const lookToSave: PastLook = {
                        id: job.jobId,
                        imageUrl: finalImageUrl,
                        style: job.suggestion?.style_alignment || 'AI Generated',
                        timestamp: Date.now(),
                        originalHumanSrc: job.humanImage.url,
                        originalGarmentSrc: job.garmentImage.url,
                        garmentDescription: job.suggestion?.material_silhouette,
                        personaProfile: null,
                        processImages: {
                          humanImage: job.humanImage.url,
                          garmentImage: job.garmentImage.url,
                          finalImage: finalImageUrl,
                          styleSuggestion: job.suggestion,
                        },
                      };
                    await saveLookToDB(lookToSave, 'default');
                    console.log(`[Job ${jobId}] Successfully saved to My Looks.`);
                } catch(dbError) {
                    console.error(`[Job ${jobId}] Failed to save look to DB, but continuing.`, dbError);
                }

                await kv.set(jobId, job);
            } catch (err) {
                return handleJobError(job, err, 'Failed during the final step.');
            }
            break;
    }

    return NextResponse.json(job);

  } catch (error) {
    console.error('Unhandled error in GET /api/generation/status:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown server error occurred.';
    return NextResponse.json({ error: 'Failed to process job status', details: errorMessage }, { status: 500 });
  }
}