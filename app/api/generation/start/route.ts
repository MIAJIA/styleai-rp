import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { put } from '@vercel/blob';
import {
  getStyleSuggestionFromAI,
  runImageGenerationPipeline,
  type Job,
  type Suggestion,
  type GenerationMode,
} from '@/lib/ai';
import { type OnboardingData } from '@/lib/onboarding-storage';

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

    const humanImageBlob = await put(humanImageFile.name, humanImageFile, { access: 'public', addRandomSuffix: true });
    const garmentImageBlob = await put(garmentImageFile.name, garmentImageFile, { access: 'public', addRandomSuffix: true });

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

    const jobId = randomUUID();
    const now = Date.now();

    const suggestions: Suggestion[] = aiSuggestions.map((suggestion: any, index: number) => ({
      index,
      status: index === 0 ? 'generating_images' : 'pending',
      styleSuggestion: suggestion,
      personaProfile: {},
      finalPrompt: suggestion.image_prompt,
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

    await kv.set(jobId, newJob);
    console.log(`[Job ${jobId}] Initial job record created with 3 suggestions.`);

    runImageGenerationPipeline(jobId, 0);
    console.log(`[Job ${jobId}] Background pipeline started for suggestion 0.`);

    return NextResponse.json({ jobId });
  } catch (error) {
    console.error('Error starting generation job:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ error: 'Failed to start generation job', details: errorMessage }, { status: 500 });
  }
}