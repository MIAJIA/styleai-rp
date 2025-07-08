import { kv } from '@vercel/kv';
import { NextResponse, type NextRequest } from 'next/server';
import { type Job } from '@/lib/ai';


export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get('jobId');

  if (!jobId) {
    return NextResponse.json({ error: 'Missing jobId parameter' }, { status: 400 });
  }

  try {
    const job = await kv.hgetall<Job>(jobId);

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
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
