import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { put } from '@vercel/blob';
import {
  getStyleSuggestionFromAI,
  executeAdvancedScenePipeline,
  executeSimpleScenePipeline,
  executeTryOnOnlyPipeline,
  type Job,
  type GenerationMode,
} from '@/lib/ai';
import { saveLookToDB, type PastLook } from '@/lib/database';

// This background function now ONLY handles the long-running image generation
async function runImageGenerationPipeline(jobId: string) {
  let job: Job | null = null;
  try {
    job = await kv.hgetall<Job>(jobId);
    if (!job) {
      throw new Error(`Job with ID ${jobId} not found.`);
    }
     if (!job.suggestion) {
        throw new Error(`Job ${jobId} is missing the style suggestion needed for the pipeline.`);
    }

    console.log(`[Job ${jobId}] Starting image generation pipeline for mode: ${job.generationMode}`);

    // Execute the selected generation pipeline
    let finalImageUrl: string;
    switch (job.generationMode) {
      case 'tryon-only':
        finalImageUrl = await executeTryOnOnlyPipeline(job);
        break;
      case 'simple-scene':
        finalImageUrl = await executeSimpleScenePipeline(job);
        break;
      case 'advanced-scene':
        finalImageUrl = await executeAdvancedScenePipeline(job);
        break;
      default:
        throw new Error(`Unknown generation mode: ${job.generationMode}`);
    }

    // Mark job as complete
    console.log(`[Job ${jobId}] Pipeline completed. Final URL: ${finalImageUrl}`);
    await kv.hset(jobId, {
      status: 'completed',
      statusMessage: 'Your new look is ready!',
      result: { imageUrl: finalImageUrl },
      updatedAt: new Date().toISOString(),
    });

    // Save the final look to the primary database
    try {
      const finalJobState = await kv.hgetall<Job>(jobId);
      if (!finalJobState) {
        throw new Error("Job data not found for saving to DB.");
      }

      const lookToSave: PastLook = {
        id: finalJobState.jobId,
        imageUrl: finalImageUrl,
        style: finalJobState.suggestion?.style_alignment || 'AI Generated',
        timestamp: Date.now(),
        originalHumanSrc: finalJobState.humanImage.url,
        originalGarmentSrc: finalJobState.garmentImage.url,
        garmentDescription: finalJobState.suggestion?.material_silhouette,
        personaProfile: null,
        processImages: {
          humanImage: finalJobState.humanImage.url,
          garmentImage: finalJobState.garmentImage.url,
          finalImage: finalImageUrl,
          styleSuggestion: finalJobState.suggestion,
        },
      };
      await saveLookToDB(lookToSave, 'default');
      console.log(`[Job ${jobId}] Successfully saved final look to primary DB.`);
    } catch (dbError) {
        console.error(`[Job ${jobId}] CRITICAL: Pipeline succeeded but failed to save look to DB.`, dbError);
    }

  } catch (error) {
    console.error(`[Job ${jobId}] Background image pipeline failed:`, error);
    if (jobId) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      await kv.hset(jobId, {
        status: 'failed',
        statusMessage: `Generation failed: ${errorMessage}`,
        error: errorMessage,
        updatedAt: new Date().toISOString(),
      });
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

    if (!humanImageFile || !garmentImageFile || !occasion || !generationMode) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!['tryon-only', 'simple-scene', 'advanced-scene'].includes(generationMode)) {
        return NextResponse.json({ error: 'Invalid generation mode' }, { status: 400 });
    }

    // Upload images to Vercel Blob
    const humanImageBlob = await put(humanImageFile.name, humanImageFile, {
      access: 'public',
      addRandomSuffix: true,
    });
    const garmentImageBlob = await put(garmentImageFile.name, garmentImageFile, {
      access: 'public',
      addRandomSuffix: true,
    });

    // --- REFACTORED LOGIC ---
    // Step 1: Get Style Suggestion immediately
    const suggestion = await getStyleSuggestionFromAI({
      humanImageUrl: humanImageBlob.url,
      garmentImageUrl: garmentImageBlob.url,
      occasion: occasion,
    });
     console.log(`[Job] Suggestion generated for new job.`);

    // Step 2: Create the job record in KV with the suggestion included
    const jobId = randomUUID();
    const jobData: Job = {
      jobId,
      status: 'suggestion_generated', // Start with this status
      statusMessage: 'Style advice generated. Preparing to create your look...',
      humanImage: {
        url: humanImageBlob.url,
        type: humanImageFile.type,
        name: humanImageFile.name,
      },
      garmentImage: {
        url: garmentImageBlob.url,
        type: garmentImageFile.type,
        name: garmentImageFile.name,
      },
      occasion,
      generationMode,
      suggestion, // Include suggestion from the start
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await kv.hset(jobId, jobData);

    // Step 3: Fire and forget the background process for image generation.
    runImageGenerationPipeline(jobId);

    // Step 4: Return immediately.
    return NextResponse.json({ jobId });
  } catch (error) {
    console.error('Error starting generation job:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ error: 'Failed to start generation job', details: errorMessage }, { status: 500 });
  }
}