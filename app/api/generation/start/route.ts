import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { put } from '@vercel/blob';
import {
  runImageGenerationPipeline,
  type Job,
  type Suggestion,
  type GenerationMode,
} from '@/lib/ai';
import { type OnboardingData } from '@/lib/onboarding-storage';

export async function POST(request: Request) {
  const startTime = Date.now();
  console.log(`[PERF_LOG | start] Request received. Timestamp: ${startTime}`);
  try {
    const formData = await request.formData();
    const formDataParseTime = Date.now();
    console.log(`[PERF_LOG | start] FormData parsed. Elapsed: ${formDataParseTime - startTime}ms`);
    const humanImageFile = formData.get('human_image') as File | null;
    const garmentImageFile = formData.get('garment_image') as File | null;
    const occasion = formData.get('occasion') as string | null;
    const generationMode = formData.get('generation_mode') as GenerationMode | null;
    const userProfileString = formData.get('user_profile') as string | null;
    const customPrompt = formData.get('custom_prompt') as string | null;
    const stylePrompt = formData.get('style_prompt') as string | null;

    console.log(`[DEBUG] Received occasion: ${occasion}`);
    console.log(`[DEBUG] Received style_prompt: ${stylePrompt ? stylePrompt.substring(0, 100) + '...' : 'null'}`);

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

    const humanUploadStartTime = Date.now();
    const humanImageBlob = await put(humanImageFile.name, humanImageFile, { access: 'public', addRandomSuffix: true });
    const humanUploadEndTime = Date.now();
    console.log(`[PERF_LOG | start] Human image uploaded. Elapsed: ${humanUploadEndTime - humanUploadStartTime}ms.`);

    const garmentUploadStartTime = Date.now();
    const garmentImageBlob = await put(garmentImageFile.name, garmentImageFile, { access: 'public', addRandomSuffix: true });
    const garmentUploadEndTime = Date.now();
    console.log(`[PERF_LOG | start] Garment image uploaded. Elapsed: ${garmentUploadEndTime - garmentUploadStartTime}ms.`);

    const jobId = randomUUID();
    const now = Date.now();

    const newJob: Job = {
      jobId,
      status: 'pending', // IMPORTANT: Status is now 'pending'
      suggestions: [], // Suggestions will be generated later
      input: {
        humanImage: { url: humanImageBlob.url, type: humanImageFile.type, name: humanImageFile.name },
        garmentImage: { url: garmentImageBlob.url, type: garmentImageFile.type, name: garmentImageFile.name },
        generationMode,
        occasion,
        userProfile,
        customPrompt: customPrompt?.trim() || undefined,
        stylePrompt: stylePrompt?.trim() || undefined,
      },
      createdAt: now,
      updatedAt: now,
    };

    const kvSetStartTime = Date.now();
    await kv.set(jobId, newJob);
    const kvSetEndTime = Date.now();
    console.log(`[PERF_LOG | start] Job set in KV. Elapsed: ${kvSetEndTime - kvSetStartTime}ms.`);
    console.log(`[Job ${jobId}] Initial job record created with status 'pending'. AI processing will start on first status poll.`);

    // runImageGenerationPipeline(jobId, 0);
    // console.log(`[Job ${jobId}] Background pipeline started for suggestion 0.`);

    const endTime = Date.now();
    console.log(`[PERF_LOG | start] Total request time before response: ${endTime - startTime}ms.`);
    return NextResponse.json({ jobId });
  } catch (error) {
    console.error('Error starting generation job:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ error: 'Failed to start generation job', details: errorMessage }, { status: 500 });
  }
}