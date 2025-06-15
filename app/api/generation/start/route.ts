import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { put } from '@vercel/blob';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const humanImageFile = formData.get('human_image') as File | null;
    const garmentImageFile = formData.get('garment_image') as File | null;
    const occasion = formData.get('occasion') as string | null;

    if (!humanImageFile || !garmentImageFile || !occasion) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Upload images to Vercel Blob
    const humanImageBlob = await put(humanImageFile.name, humanImageFile, {
      access: 'public',
    });
    const garmentImageBlob = await put(garmentImageFile.name, garmentImageFile, {
      access: 'public',
    });

    const jobId = randomUUID();
    const job = {
      jobId,
      status: 'pending', // The 'status' endpoint will pick this up and start processing
      statusMessage: 'Your request has been received. Files uploaded.',
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // We have the URLs and metadata, now we create the job record in KV.
    await kv.set(jobId, job);

    // The status endpoint is responsible for starting the actual AI processing.
    // This endpoint returns immediately after creating the job.
    return NextResponse.json({ jobId });
  } catch (error) {
    console.error('Error starting generation job:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ error: 'Failed to start generation job', details: errorMessage }, { status: 500 });
  }
}