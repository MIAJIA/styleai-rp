import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';
import { type Job } from '@/lib/ai';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { jobId } = body;

    if (!jobId) {
      return NextResponse.json({ error: 'Missing jobId parameter' }, { status: 400 });
    }

    // Get the current job
    const job = await kv.hgetall<Job>(jobId);

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Check if job is already completed or failed
    if (job.status === 'succeed' || job.status === 'completed' || job.status === 'failed') {
      return NextResponse.json({ error: 'Job is already finished and cannot be cancelled' }, { status: 400 });
    }

    // Mark the job as cancelled
    await kv.hset(jobId, {
      cancelled: true,
      status: 'cancelled',
      statusMessage: '用户取消了生成任务',
      updatedAt: new Date().toISOString()
    });

    console.log(`[API_CANCEL] Job ${jobId} has been cancelled by user`);

    return NextResponse.json({
      success: true,
      message: 'Job cancelled successfully',
      jobId
    });

  } catch (error) {
    console.error('Error cancelling job:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to cancel job', details: errorMessage }, { status: 500 });
  }
}