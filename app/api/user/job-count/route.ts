import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

const MAX_USER_JOBS = process.env.MAX_USER_JOBS ? parseInt(process.env.MAX_USER_JOBS) : 10;
const JOB_LIMIT_KEY = 'job_limit_key';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    let maxJobs = MAX_USER_JOBS;
    if (session?.user?.isGuest) {
      maxJobs = MAX_USER_JOBS/2;
    }
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized - User not authenticated' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const jobLimitKey = `${JOB_LIMIT_KEY}_${userId}`;

    // 获取用户当前活跃job数量
    const currentJobCount = await kv.get<number>(jobLimitKey) || 0;
    const remainingJobs = Math.max(0, maxJobs - currentJobCount);

    return NextResponse.json({
      success: true,
      data: {
        currentJobCount,
        maxJobs: maxJobs,
        remainingJobs,
        canStartNewJob: remainingJobs > 0
      }
    });

  } catch (error) {
    console.error('Error getting user job count:', error);
    return NextResponse.json(
      { error: 'Failed to get user job count' },
      { status: 500 }
    );
  }
} 