import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';
import { type Job } from '@/lib/ai';


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');

  if (!jobId) {
    return NextResponse.json({ error: 'Missing jobId parameter' }, { status: 400 });
  }

  try {
    const job = await kv.hgetall<Job>(jobId);

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Log the entire job object to see what's being fetched from KV
    console.log(`[API_STATUS] Fetched job ${jobId}:`, JSON.stringify(job.jobId, null, 2));

    // 🔍 DEBUG: Add detailed logging for styled images
    if (job.status === 'stylization_completed' && job.processImages?.styledImages) {
      console.log(`[API_STATUS DEBUG] ✅ Job has stylization_completed status`);
      console.log(`[API_STATUS DEBUG] - Styled images count: ${job.processImages.styledImages.length}`);
      console.log(`[API_STATUS DEBUG] - Styled images:`, job.processImages.styledImages.map(url => url.substring(0, 100) + '...'));
      console.log(`[API_STATUS DEBUG] - Full processImages:`, job.processImages);
    } else {
      console.log(`[API_STATUS DEBUG] Job status: ${job.status}, has processImages: ${!!job.processImages}`);
      if (job.processImages) {
        console.log(`[API_STATUS DEBUG] processImages keys:`, Object.keys(job.processImages));
      }
    }

    // The job's status is continuously updated by the background process.
    // This endpoint simply returns the current state of the job from the KV store.
    return NextResponse.json(job);

  } catch (error) {
    console.error('Unhandled error in GET /api/generation/status:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown server error occurred.';
    return NextResponse.json({ error: 'Failed to process job status', details: errorMessage }, { status: 500 });
  }
}
