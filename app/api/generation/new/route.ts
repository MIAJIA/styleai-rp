import { GenerationMode, Job, Suggestion } from '@/lib/ai/types';
import { put } from '@vercel/blob';
import { randomUUID } from 'crypto';
import { getServerSession, Session } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '../../auth/[...nextauth]/route';
import { OnboardingData } from '@/lib/onboarding-storage';
import { kv } from '@vercel/kv';
import { getOnboardingDataFromDB, PastLook, saveLookToDB } from '@/lib/database';
import { getStyleSuggestionFromAI } from '@/lib/ai';
import { KlingTaskHandler } from '@/lib/ai/services/klingTask';

const MAX_USER_JOBS = process.env.MAX_USER_JOBS ? parseInt(process.env.MAX_USER_JOBS) : 10;
const JOB_LIMIT_KEY = 'job_limit_key';


export async function POST(request: NextRequest) {
    // Get user session to store userId in job
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id || 'default';
    const jobLimitKey = `${JOB_LIMIT_KEY}_${userId}`;
    let jobId: string, suggestionIndex: number, newJob: Job;
    try {
        const formData = await request.formData();
        jobId = formData.get('job_id') as string ||'';
        suggestionIndex = formData.get('suggestion_index') as unknown as number || 0;
        if (jobId && suggestionIndex) {
            const job = await kv.get<Job>(jobId);
            if (job) {
                newJob = job;
            } else {
                return NextResponse.json({ error: 'Job not exists' }, { status: 400 });
            }
        } else {
            const humanImageFile = formData.get('human_image') as File | null;
            const garmentImageFile = formData.get('garment_image') as File | null;
            const occasion = formData.get('occasion') as string | null;
            const generationMode = formData.get('generation_mode') as GenerationMode | null;
            const userProfileString = formData.get('user_profile') as string | null;
            const customPrompt = formData.get('custom_prompt') as string | null;
            const stylePrompt = formData.get('style_prompt') as string | null;

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

            jobId = randomUUID();
            const now = Date.now();

            console.log(`[GENERATION_START] User ID for job ${jobId.slice(-8)}: ${userId}`);
            newJob = {
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

            const jobCreated = await createJobWithAtomicCheck(userId, jobId, newJob);
            if (!jobCreated) {
                console.log(`[USER_JOB_LIMIT] Atomic check failed for user ${userId}. Request blocked.`);
                return NextResponse.json({
                    error: 'User job limit exceeded',
                    details: `You have reached the maximum limit of ${MAX_USER_JOBS} active jobs. Please wait for some jobs to complete before creating new ones.`
                }, { status: 429 });
            }
        }
        const pipelineLockKey = `pipeline_lock:${jobId}`;
        const existingLock = await kv.get(pipelineLockKey);
        if (existingLock) {
          console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] ⚠️ PIPELINE ALREADY RUNNING - Skipping duplicate execution`);
          console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] ⚠️ Lock found: ${existingLock}`);
          return NextResponse.json({ error: 'Job already exists' }, { status: 400 });
        }
        await kv.set(pipelineLockKey, `started_at_${Date.now()}`, { ex: 300 });
        console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] 🔒 Pipeline lock set for suggestion ${suggestionIndex}`);

        // 创建SSE响应
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                // 发送连接建立消息
                controller.enqueue(encoder.encode('data: {"type": "connected", "message": "SSE connection established"}\n\n'));

                // 监听连接关闭事件
                const handleConnectionClose = () => {
                    console.log(`[SSE_CONNECTION] Client disconnected for job ${jobId.slice(-8)}`);
                    kv.del(pipelineLockKey);
                    console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] 🔒 Pipeline lock deleted due to connection close`);
                    controller.close();
                };

                // 监听请求中断信号
                request.signal.addEventListener('abort', () => {
                    console.log(`[SSE_CONNECTION] Request aborted for job ${jobId.slice(-8)}`);
                    handleConnectionClose();
                });

                // 监听客户端断开连接
                request.signal.addEventListener('close', () => {
                    console.log(`[SSE_CONNECTION] Request closed for job ${jobId.slice(-8)}`);
                    handleConnectionClose();
                });

                try {
                    // 1 任务创建成功
                    kv.set(jobId, newJob);
                    const progressData1 = {
                        type: 'create_job_success',
                        message: jobId,
                        timestamp: new Date().toISOString()
                    };

                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(progressData1)}\n\n`));

                    if (suggestionIndex == 0) {
                        // 2 获取AI风格建议
                        await getApiStyleSuggestion(newJob, session);
                    }
                    const progressData2 = {
                        type: 'api_style_suggestion_success',
                        message: newJob.suggestions[suggestionIndex].styleSuggestion,
                        timestamp: new Date().toISOString()
                    };

                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(progressData2)}\n\n`));

                    // 3 生成风格建议图片
                    const klingTaskHandler = new KlingTaskHandler(newJob, suggestionIndex);
                    const stylizedImageUrl = await klingTaskHandler.runStylizationMultiple("kling-v1-5");
                    const progressData3 = {
                        type: 'api_stylization_success',
                        message: stylizedImageUrl,
                        timestamp: new Date().toISOString()
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(progressData3)}\n\n`));

                    // 4 生成虚拟穿搭图片
                    const tryOnImageUrls = await klingTaskHandler.runVirtualTryOnMultiple();
                    const progressData4 = {
                        type: 'api_tryon_success',
                        message: tryOnImageUrls,
                        timestamp: new Date().toISOString()
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(progressData4)}\n\n`));
                    await kv.incr(jobLimitKey);

                    // // 发送完成消息
                    // const completionData = {
                    //     type: 'generation_complete',
                    //     message: 'Generation process completed successfully',
                    //     timestamp: new Date().toISOString()
                    // };
                    // controller.enqueue(encoder.encode(`data: ${JSON.stringify(completionData)}\n\n`));
                    await saveLook(newJob, suggestionIndex);
                    // 清理资源
                    kv.del(pipelineLockKey);
                    console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] ✅ Generation completed successfully`);
                } catch (error) {
                    console.error(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] ❌ Error during generation:`, error);
                    
                    // 发送错误消息
                    const errorData = {
                        type: 'generation_error',
                        message: error instanceof Error ? error.message : 'Unknown error occurred',
                        timestamp: new Date().toISOString()
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`));

                    // 清理资源
                    kv.del(pipelineLockKey);
                } finally {
                    // 确保连接关闭
                    controller.close();
                }
            }
        });

        return new NextResponse(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
        });

    } catch (error) {
        console.error('SSE Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// 处理OPTIONS请求（CORS预检）
export async function OPTIONS() {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
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
            if (userActiveJobCount >= (MAX_USER_JOBS) / 2) {
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


async function getApiStyleSuggestion(job: Job, session: Session) {
    const userId = (session?.user as { id?: string })?.id || 'default';
    const userProfile = await getOnboardingDataFromDB(userId);

    const aiSuggestions = await getStyleSuggestionFromAI(
        {
            humanImageUrl: job.input.humanImage.url,
            garmentImageUrl: job.input.garmentImage.url,
            occasion: job.input.occasion,
            userProfile: userProfile, // Fix: Await the Promise to get OnboardingData
            stylePrompt: job.input.stylePrompt, // �� 新增：传递 stylePrompt
            customPrompt: job.input.customPrompt, // 🔍 新增：传递 customPrompt
        },
        { count: 3 }
    );

    job.suggestions = aiSuggestions.map((suggestion: any, index: number): Suggestion => ({
        index,
        status: 'pending', // Each suggestion starts as pending
        styleSuggestion: suggestion,
        personaProfile: {},
        // 🔍 MINIMAL: 只设置一个占位符，真正的 prompt 构建完全在 kling.ts 中处理
        finalPrompt: "Generated styling suggestion",
    }));

    job.status = 'processing';
    job.updatedAt = Date.now();
    if (job.suggestions[0]) {
        job.suggestions[0].status = 'generating_images';
        job.updatedAt = Date.now();
    }
    await kv.set(job.jobId, job);
    return job;
}

async function saveLook(job: Job, suggestionIndex: number) {
    const lookToSave: PastLook = {
        id: `${job.jobId}-${suggestionIndex}`,
        imageUrl: job.suggestions[suggestionIndex].tryOnImageUrls || '',
        style: job.suggestions[suggestionIndex]?.styleSuggestion?.outfit_suggestion?.outfit_title || 'AI Generated Style',
        timestamp: Date.now(),
        originalHumanSrc: job.input.humanImage.url,
        originalGarmentSrc: job.input.garmentImage.url,
        processImages: {
          humanImage: job.input.humanImage.url,
          garmentImage: job.input.garmentImage.url,
          finalImage: job.suggestions[suggestionIndex].tryOnImageUrls || '',
          stylizedImageUrl: job.suggestions[suggestionIndex].stylizedImageUrls || '',
          styleSuggestion: job.suggestions[suggestionIndex]?.styleSuggestion,
          finalPrompt: job.suggestions[suggestionIndex]?.finalPrompt || '',
        },
      };
      // Use userId from job object instead of getSession()
      const userId = job.userId || 'default';
      console.log(`[PIPELINE_RUNNER | Job ${job.jobId.slice(-8)}] Saving look with userId: ${userId}`);
      await saveLookToDB(lookToSave, userId);
      console.log(`[PIPELINE_RUNNER | Job ${job.jobId.slice(-8)}] Successfully saved look for suggestion ${suggestionIndex} to database.`);

}