import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { put } from '@vercel/blob';
import {
  getStyleSuggestionFromAI,
  executeAdvancedScenePipeline,
  executeSimpleScenePipeline,
  executeSimpleScenePipelineV2,
  executeTryOnOnlyPipeline,
  type Job,
  type GenerationMode,
} from '@/lib/ai';
import { saveLookToDB, type PastLook } from '@/lib/database';
import { type OnboardingData } from '@/lib/onboarding-storage';

// This background function now ONLY handles the long-running image generation
async function runImageGenerationPipeline(jobId: string) {
  let job: Job | null = null;
  try {
    job = await kv.hgetall<Job>(jobId);
    if (!job) {
      throw new Error(`Job with ID ${jobId} not found.`);
    }

    console.log(`[Job ${jobId}] Starting AI style suggestion generation...`);
    console.log(`[Job ${jobId}] Retrieved job from KV with customPrompt:`, job.customPrompt);
    console.log(`[Job ${jobId}] CustomPrompt type:`, typeof job.customPrompt);
    console.log(`[Job ${jobId}] CustomPrompt length:`, job.customPrompt?.length || 0);

    // --- FIX: The suggestion generation is now part of the background job ---
    const suggestion = await getStyleSuggestionFromAI({
      humanImageUrl: job.humanImage.url,
      garmentImageUrl: job.garmentImage.url,
      occasion: job.occasion,
      userProfile: job.userProfile, // Pass user profile to the AI
    });
    console.log(`[Job ${jobId}] Suggestion generated.`);

    // Update job with suggestion
    await kv.hset(jobId, {
      suggestion: suggestion,
      status: 'suggestion_generated',
      statusMessage: 'Style advice generated. Preparing to create your look...',
      updatedAt: new Date().toISOString(),
    });

    // To avoid KV race conditions, update the local job object instead of re-fetching.
    if (!job) {
      throw new Error("Job context was lost unexpectedly after suggestion generation.");
    }
    job.suggestion = suggestion;
    job.status = 'suggestion_generated';

    console.log(`[Job ${jobId}] Starting image generation pipeline for mode: ${job.generationMode}`);

    // Execute the selected generation pipeline
    let finalImageUrls: string[];
    switch (job.generationMode) {
      case 'tryon-only':
        finalImageUrls = await executeTryOnOnlyPipeline(job);
        break;
      case 'simple-scene':
        // Use V2 pipeline for enhanced parallel generation
        finalImageUrls = await executeSimpleScenePipelineV2(job);
        break;
      case 'advanced-scene':
        finalImageUrls = await executeAdvancedScenePipeline(job);
        break;
      default:
        throw new Error(`Unknown generation mode: ${job.generationMode}`);
    }

    // Mark job as complete with all images
    console.log(`[Job ${jobId}] Pipeline completed. Generated ${finalImageUrls.length} images:`, finalImageUrls);
    await kv.hset(jobId, {
      status: 'completed',
      statusMessage: 'Your new look is ready!',
      result: {
        imageUrls: finalImageUrls,
        imageUrl: finalImageUrls[0], // Keep for backward compatibility
        totalImages: finalImageUrls.length,
      },
      updatedAt: new Date().toISOString(),
    });

    // Save the final look to the primary database
    try {
      const finalJobState = await kv.hgetall<Job>(jobId);
      if (!finalJobState) {
        throw new Error("Job data not found for saving to DB.");
      }

      // --- FIX: Save all generated images to the database ---
      for (let i = 0; i < finalImageUrls.length; i++) {
        const imageUrl = finalImageUrls[i];
        // Create a unique ID for each look by appending an index
        const lookId = `${finalJobState.jobId}-${i}`;

        const lookToSave: PastLook = {
          id: lookId, // Use the unique ID
          imageUrl: imageUrl, // Use the current image URL
          style: finalJobState.suggestion?.style_alignment || 'AI Generated',
          timestamp: Date.now(),
          originalHumanSrc: finalJobState.humanImage.url,
          originalGarmentSrc: finalJobState.garmentImage.url,
          garmentDescription: finalJobState.suggestion?.material_silhouette,
          personaProfile: null,
          processImages: {
            humanImage: finalJobState.humanImage.url,
            garmentImage: finalJobState.garmentImage.url,
            finalImage: imageUrl, // Use the current image URL
            styleSuggestion: finalJobState.suggestion,
          },
        };
        await saveLookToDB(lookToSave, 'default');
        console.log(`[Job ${jobId}] Successfully saved look ${i + 1}/${finalImageUrls.length} to DB with ID: ${lookId}`);
      }
      console.log(`[Job ${jobId}] All ${finalImageUrls.length} looks saved to primary DB.`);

    } catch (dbError) {
      console.error(`[Job ${jobId}] CRITICAL: Pipeline succeeded but failed to save look(s) to DB.`, dbError);
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
    const userProfileString = formData.get('user_profile') as string | null;
    const customPrompt = formData.get('custom_prompt') as string | null;

    // Debug log for customPrompt
    console.log('[GENERATION START API] Received customPrompt:', customPrompt);
    console.log('[GENERATION START API] CustomPrompt type:', typeof customPrompt);
    console.log('[GENERATION START API] CustomPrompt length:', customPrompt?.length || 0);

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
    // Step 1: Create the initial job record in KV.
    const jobId = randomUUID();
    const jobData: Job = {
      jobId,
      status: 'pending', // Start with a generic 'pending' status
      statusMessage: 'Kicking off the magic... ✨',
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
      userProfile, // Store user profile
      customPrompt: customPrompt || undefined, // Store custom prompt, convert null to undefined
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await kv.hset(jobId, jobData);
    console.log(`[Job ${jobId}] Initial job record created. Status: pending.`);
    console.log(`[Job ${jobId}] Stored customPrompt:`, jobData.customPrompt);

    // Step 2: Fire and forget the background process for the entire pipeline.
    runImageGenerationPipeline(jobId);
    console.log(`[Job ${jobId}] Background pipeline started. API is returning response now.`);

    // Step 3: Return immediately.
    return NextResponse.json({ jobId });
  } catch (error) {
    console.error('Error starting generation job:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ error: 'Failed to start generation job', details: errorMessage }, { status: 500 });
  }
}