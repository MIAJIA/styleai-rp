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
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

// 用户job数量限制
const MAX_USER_JOBS = process.env.MAX_USER_JOBS ? parseInt(process.env.MAX_USER_JOBS) : 10;
const JOB_LIMIT_KEY = 'job_limit_key';

// 获取用户活跃job数量的函数（只计算非完成状态的job）
async function getUserActiveJobCount(jobLimitKey: string): Promise<number> {
  try {
    const jobLimit = await kv.get<number>(jobLimitKey);
    if (jobLimit === null) {
      await kv.set(jobLimitKey, 0);
      return 0;
    }
    return jobLimit;
  } catch (error) {
    console.error(`[USER_ACTIVE_JOB_COUNT] Error counting active jobs for user ${jobLimitKey}:`, error);
    return 0;
  }
}

// 使用Redis事务确保原子性操作
async function createJobWithAtomicCheck(userId: string, jobId: string, newJob: Job): Promise<boolean> {
  const jobLimitKey = `${JOB_LIMIT_KEY}_${userId}`;
  try {
    // 1. 获取用户当前活跃job数量（只计算非完成状态的job）
    const userActiveJobCount = await getUserActiveJobCount(jobLimitKey);
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id || 'default';
    console.log(`[GENERATION_START] User ID for job ${jobId.slice(-8)}: ${userId}`);
    if (session?.user?.isGuest) {
      if (userActiveJobCount >= (MAX_USER_JOBS)/2) {
        console.log(`[ATOMIC_CHECK] User ${userId} has ${userActiveJobCount} active jobs, limit exceeded`);
        return false;
      }
    }
    
    // 2. 如果超过限制，直接返回false
    if (userActiveJobCount >= MAX_USER_JOBS) {
      console.log(`[ATOMIC_CHECK] User ${userId} has ${userActiveJobCount} active jobs, limit exceeded`);
      return false;
    }

    // 3. 保存新job
    // await kv.incr(jobLimitKey);

    console.log(`[ATOMIC_CHECK] Successfully created job ${jobId} for user ${userId}. User now has ${userActiveJobCount + 1} active jobs`);
    return true;
  } catch (error) {
    console.error(`[ATOMIC_CHECK] Error in atomic job creation:`, error);
    return false;
  }
}

export async function POST(request: Request) {
  const startTime = Date.now();
  let lastStepTime = Date.now();
  console.log(`XXX 111 - since start ${Date.now() - startTime}ms, since last step=${Date.now() - lastStepTime}ms`);
  console.log(`[PERF_LOG | start] Request received. Timestamp: ${startTime}`);
  try {
    lastStepTime = Date.now();
    console.log(`XXX 122 - since start ${Date.now() - startTime}ms, since last step=${Date.now() - lastStepTime}ms`);
    const formData = await request.formData();
    lastStepTime = Date.now();
    console.log(`XXX 133 - since start ${Date.now() - startTime}ms, since last step=${Date.now() - lastStepTime}ms`);
    lastStepTime = Date.now();
    console.log(`XXX 222 - since start ${Date.now() - startTime}ms, since last step=${Date.now() - lastStepTime}ms`);
    const formDataParseTime = Date.now();
    console.log(`[PERF_LOG | start] FormData parsed. Elapsed: ${formDataParseTime - startTime}ms`);
    const humanImageFile = formData.get('human_image') as File | null;
    const garmentImageFile = formData.get('garment_image') as File | null;
    const occasion = formData.get('occasion') as string | null;
    const generationMode = formData.get('generation_mode') as GenerationMode | null;
    const userProfileString = formData.get('user_profile') as string | null;
    const customPrompt = formData.get('custom_prompt') as string | null;
    const stylePrompt = formData.get('style_prompt') as string | null;

    lastStepTime = Date.now();
    console.log(`XXX 333 - since start ${Date.now() - startTime}ms, since last step=${Date.now() - lastStepTime}ms`); 
    // 🔍 LOG: 添加关键日志确认正确接收
    console.log(`[STYLE_PROMPT_LOG] 🎯 Received style_prompt from frontend:`, stylePrompt ? 'YES' : 'NO');
    if (stylePrompt) {
      console.log(`[STYLE_PROMPT_LOG] 📝 Style prompt content (first 100 chars):`, stylePrompt.substring(0, 100));
    }

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

    lastStepTime = Date.now();
    console.log(`XXX 444 - since start ${Date.now() - startTime}ms, since last step=${Date.now() - lastStepTime}ms`);
    const humanImageBlob = await put(humanImageFile.name, humanImageFile, { access: 'public', addRandomSuffix: true });

    lastStepTime = Date.now();
    console.log(`XXX 555 - since start ${Date.now() - startTime}ms, since last step=${Date.now() - lastStepTime}ms`);
    const humanUploadEndTime = Date.now();
    console.log(`[PERF_LOG | start] Human image uploaded. Elapsed: ${humanUploadEndTime - humanUploadStartTime}ms.`);

    const garmentUploadStartTime = Date.now();
    lastStepTime = Date.now();
    console.log(`XXX 666 - since start ${Date.now() - startTime}ms, since last step=${Date.now() - lastStepTime}ms`);
    const garmentImageBlob = await put(garmentImageFile.name, garmentImageFile, { access: 'public', addRandomSuffix: true });
    lastStepTime = Date.now();
    console.log(`XXX 777 - since start ${Date.now() - startTime}ms, since last step=${Date.now() - lastStepTime}ms`);
    const garmentUploadEndTime = Date.now();
    console.log(`[PERF_LOG | start] Garment image uploaded. Elapsed: ${garmentUploadEndTime - garmentUploadStartTime}ms.`);

    const jobId = randomUUID();
    const now = Date.now();

    // Get user session to store userId in job
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id || 'default';
    console.log(`[GENERATION_START] User ID for job ${jobId.slice(-8)}: ${userId}`);

    lastStepTime = Date.now();
    console.log(`XXX 888 - since start ${Date.now() - startTime}ms, since last step=${Date.now() - lastStepTime}ms`);
    const newJob: Job = {
      jobId,
      userId, // Store userId in job for pipeline access
      status: 'pending', // IMPORTANT: Status is now 'pending'
      suggestions: [], // Suggestions will be generated later
      input: {
        humanImage: { url: humanImageBlob.url, type: humanImageFile.type, name: humanImageFile.name },
        garmentImage: { url: garmentImageBlob.url, type: garmentImageFile.type, name: garmentImageFile.name },
        generationMode,
        occasion,
        userProfile,
        customPrompt: customPrompt?.trim() || undefined,
        stylePrompt: stylePrompt?.trim() || undefined, // 🔍 新增：存储 style_prompt
      },
      createdAt: now,
      updatedAt: now,
    };

    lastStepTime = Date.now();
    console.log(`XXX 999 - since start ${Date.now() - startTime}ms, since last step=${Date.now() - lastStepTime}ms`);
    // 🔍 LOG: 确认 style_prompt 已存储
    console.log(`[STYLE_PROMPT_LOG] 💾 Style prompt stored in job:`, newJob.input.stylePrompt ? 'YES' : 'NO');

    // 🔍 NEW: 使用原子操作保存job，确保数据一致性
    const kvSetStartTime = Date.now();

    // 使用原子操作创建job
    const jobCreated = await createJobWithAtomicCheck(userId, jobId, newJob);
    lastStepTime = Date.now();
    console.log(`XXX 1000 - since start ${Date.now() - startTime}ms, since last step=${Date.now() - lastStepTime}ms`);
    if (!jobCreated) {
      console.log(`[USER_JOB_LIMIT] Atomic check failed for user ${userId}. Request blocked.`);
      lastStepTime = Date.now();
      console.log(`XXX 1001 - since start ${Date.now() - startTime}ms, since last step=${Date.now() - lastStepTime}ms`);
      return NextResponse.json({
        error: 'User job limit exceeded',
        details: `You have reached the maximum limit of ${MAX_USER_JOBS} active jobs. Please wait for some jobs to complete before creating new ones.`
      }, { status: 429 });
    }else{
      lastStepTime = Date.now();
      console.log(`XXX 1002 - since start ${Date.now() - startTime}ms, since last step=${Date.now() - lastStepTime}ms`);
      await kv.set(jobId, newJob);
      lastStepTime = Date.now();
      console.log(`XXX 1003 - since start ${Date.now() - startTime}ms, since last step=${Date.now() - lastStepTime}ms`);
    }

    const kvSetEndTime = Date.now();
    lastStepTime = Date.now();
    console.log(`XXX 1004 - since start ${Date.now() - startTime}ms, since last step=${Date.now() - lastStepTime}ms`);
    console.log(`[PERF_LOG | start] Job set in KV. Elapsed: ${kvSetEndTime - kvSetStartTime}ms.`);
    console.log(`[Job ${jobId}] Initial job record created with status 'pending'. AI processing will start on first status poll.`);

    // runImageGenerationPipeline(jobId, 0);
    // console.log(`[Job ${jobId}] Background pipeline started for suggestion 0.`);

    const endTime = Date.now();
    console.log(`[PERF_LOG | start] Total request time before response: ${endTime - startTime}ms.`);
    lastStepTime = Date.now();
    console.log(`XXX 1006 - since start ${Date.now() - startTime}ms, since last step=${Date.now() - lastStepTime}ms`);
    return NextResponse.json({ jobId });
  } catch (error) {
    console.error('Error starting generation job:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    lastStepTime = Date.now();
    console.log(`XXX 1005 - since start ${Date.now() - startTime}ms, since last step=${Date.now() - lastStepTime}ms`);
    return NextResponse.json({ error: 'Failed to start generation job', details: errorMessage }, { status: 500 });
  }
}