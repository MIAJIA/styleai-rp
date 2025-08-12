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

// 🔍 PERF_LOG: 添加性能日志工具函数
function logPerfStep(step: string, jobId: string, startTime?: number): number {
    const now = Date.now();
    if (startTime) {
        const elapsed = now - startTime;
        console.log(`[PERF_LOG | Job ${jobId.slice(-8)}] ✅ ${step} COMPLETED - Elapsed: ${elapsed}ms`);
    } else {
        console.log(`[PERF_LOG | Job ${jobId.slice(-8)}] 🚀 ${step} STARTED - Timestamp: ${now}`);
    }
    return now;
}

export async function POST(request: NextRequest) {
    // 🔍 PERF_LOG: 记录请求开始时间
    const requestStartTime = Date.now();
    console.log(`[PERF_LOG | REQUEST] 📥 POST /api/generation/new - Request received at: ${requestStartTime}`);

    // Get user session to store userId in job
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id || 'default';
    const jobLimitKey = `${JOB_LIMIT_KEY}_${userId}`;
    let jobId: string, suggestionIndex: number, newJob: Job;

    try {
        // 🔍 PERF_LOG: FormData 解析开始
        const formDataStartTime = logPerfStep("FormData parsing", "TEMP", undefined);
        const formData = await request.formData();
        logPerfStep("FormData parsing", "TEMP", formDataStartTime);

        jobId = formData.get('job_id') as string ||'';
        suggestionIndex = formData.get('suggestion_index') as unknown as number || 0;

        if (jobId && suggestionIndex) {
            // 🔍 PERF_LOG: 现有Job获取
            const jobFetchStartTime = logPerfStep("Existing job fetch", jobId, undefined);
            const job = await kv.get<Job>(jobId);
            logPerfStep("Existing job fetch", jobId, jobFetchStartTime);

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

            // 🔍 PERF_LOG: 生成 jobId
            jobId = randomUUID();
            console.log(`[PERF_LOG | Job ${jobId.slice(-8)}] 🆔 JobId generated: ${jobId}`);

            // 🔍 PERF_LOG: Human image 上传开始
            const humanUploadStartTime = logPerfStep("Human image upload to Vercel Blob", jobId, undefined);
            const humanImageBlob = await put(humanImageFile.name, humanImageFile, { access: 'public', addRandomSuffix: true });
            logPerfStep("Human image upload to Vercel Blob", jobId, humanUploadStartTime);

            // 🔍 PERF_LOG: Garment image 上传开始
            const garmentUploadStartTime = logPerfStep("Garment image upload to Vercel Blob", jobId, undefined);
            const garmentImageBlob = await put(garmentImageFile.name, garmentImageFile, { access: 'public', addRandomSuffix: true });
            logPerfStep("Garment image upload to Vercel Blob", jobId, garmentUploadStartTime);

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

            // 🔍 PERF_LOG: 原子性检查开始
            const atomicCheckStartTime = logPerfStep("Atomic job creation check", jobId, undefined);
            const jobCreated = await createJobWithAtomicCheck(userId, jobId, newJob);
            logPerfStep("Atomic job creation check", jobId, atomicCheckStartTime);

            if (!jobCreated) {
                console.log(`[USER_JOB_LIMIT] Atomic check failed for user ${userId}. Request blocked.`);
                return NextResponse.json({
                    error: 'User job limit exceeded',
                    details: `You have reached the maximum limit of ${MAX_USER_JOBS} active jobs. Please wait for some jobs to complete before creating new ones.`
                }, { status: 429 });
            }
        }

        // 🔍 PERF_LOG: Pipeline lock 检查开始
        const pipelineLockStartTime = logPerfStep("Pipeline lock check", jobId, undefined);
        const pipelineLockKey = `pipeline_lock:${jobId}`;
        const existingLock = await kv.get(pipelineLockKey);
        if (existingLock) {
          console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] ⚠️ PIPELINE ALREADY RUNNING - Skipping duplicate execution`);
          console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] ⚠️ Lock found: ${existingLock}`);
          return NextResponse.json({ error: 'Job already exists' }, { status: 400 });
        }
        await kv.set(pipelineLockKey, `started_at_${Date.now()}`, { ex: 300 });
        logPerfStep("Pipeline lock check", jobId, pipelineLockStartTime);
        console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] 🔒 Pipeline lock set for suggestion ${suggestionIndex}`);

        // 🔍 PERF_LOG: SSE Stream 创建开始
        const sseStreamStartTime = logPerfStep("SSE Stream creation", jobId, undefined);

        // 创建SSE响应
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                // 🔍 PERF_LOG: SSE连接建立
                logPerfStep("SSE Stream creation", jobId, sseStreamStartTime);
                const connectionEstablishedTime = logPerfStep("SSE connection establishment", jobId, undefined);

                // 发送连接建立消息
                controller.enqueue(encoder.encode('data: {"type": "connected", "message": "SSE connection established"}\n\n'));
                logPerfStep("SSE connection establishment", jobId, connectionEstablishedTime);

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
                    // 🔍 PERF_LOG: 1. 任务创建成功
                    const jobSaveStartTime = logPerfStep("Job save to KV", jobId, undefined);
                    kv.set(jobId, newJob);
                    logPerfStep("Job save to KV", jobId, jobSaveStartTime);

                    const progressData1 = {
                        type: 'create_job_success',
                        message: jobId,
                        timestamp: new Date().toISOString()
                    };

                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(progressData1)}\n\n`));

                    if (suggestionIndex == 0) {
                        // 🔍 PERF_LOG: 2. 获取AI风格建议
                        const styleSuggestionStartTime = logPerfStep("AI style suggestion generation", jobId, undefined);
                        await getApiStyleSuggestion(newJob, session);
                        logPerfStep("AI style suggestion generation", jobId, styleSuggestionStartTime);
                    }
                    const progressData2 = {
                        type: 'api_style_suggestion_success',
                        message: newJob.suggestions[suggestionIndex].styleSuggestion,
                        timestamp: new Date().toISOString()
                    };

                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(progressData2)}\n\n`));

                    // 🔍 PERF_LOG: 3. 生成风格建议图片
                    const stylizationStartTime = logPerfStep("Kling stylization task", jobId, undefined);
                    const klingTaskHandler = new KlingTaskHandler(newJob, suggestionIndex);
                    const stylizedImageUrl = await klingTaskHandler.runStylizationMultiple("kling-v1-5");
                    logPerfStep("Kling stylization task", jobId, stylizationStartTime);

                    const progressData3 = {
                        type: 'api_stylization_success',
                        message: stylizedImageUrl,
                        timestamp: new Date().toISOString()
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(progressData3)}\n\n`));

                    // 🔍 PERF_LOG: 4. 生成虚拟穿搭图片
                    const tryOnStartTime = logPerfStep("Kling virtual try-on task", jobId, undefined);
                    const tryOnImageUrls = await klingTaskHandler.runVirtualTryOnMultiple();
                    logPerfStep("Kling virtual try-on task", jobId, tryOnStartTime);

                    const progressData4 = {
                        type: 'api_tryon_success',
                        message: tryOnImageUrls,
                        timestamp: new Date().toISOString()
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(progressData4)}\n\n`));

                    // 🔍 PERF_LOG: Job limit 更新
                    const jobLimitUpdateStartTime = logPerfStep("Job limit counter update", jobId, undefined);
                    await kv.incr(jobLimitKey);
                    logPerfStep("Job limit counter update", jobId, jobLimitUpdateStartTime);

                    // 🔍 PERF_LOG: 保存 Look 到数据库
                    const saveLookStartTime = logPerfStep("Save look to database", jobId, undefined);
                    await saveLook(newJob, suggestionIndex);
                    logPerfStep("Save look to database", jobId, saveLookStartTime);

                    // 🔍 PERF_LOG: 清理资源
                    const cleanupStartTime = logPerfStep("Pipeline cleanup", jobId, undefined);
                    kv.del(pipelineLockKey);
                    logPerfStep("Pipeline cleanup", jobId, cleanupStartTime);

                    // 🔍 PERF_LOG: 整个请求完成
                    const totalElapsed = Date.now() - requestStartTime;
                    console.log(`[PERF_LOG | Job ${jobId.slice(-8)}] 🎉 ENTIRE PIPELINE COMPLETED - Total elapsed: ${totalElapsed}ms`);
                    console.log(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] ✅ Generation completed successfully`);
                } catch (error) {
                    console.error(`[PIPELINE_RUNNER | Job ${jobId.slice(-8)}] ❌ Error during generation:`, error);

                    // 🔍 PERF_LOG: 错误处理
                    const errorElapsed = Date.now() - requestStartTime;
                    console.log(`[PERF_LOG | Job ${jobId.slice(-8)}] ❌ PIPELINE FAILED - Total elapsed before error: ${errorElapsed}ms`);

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
        // 🔍 PERF_LOG: 外层错误
        const errorElapsed = Date.now() - requestStartTime;
        console.error(`[PERF_LOG | REQUEST] ❌ SSE Error after ${errorElapsed}ms:`, error);
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
    // 🔍 PERF_LOG: 获取用户资料
    const userProfileStartTime = logPerfStep("User profile retrieval from DB", job.jobId, undefined);
    const userId = (session?.user as { id?: string })?.id || 'default';
    const userProfile = await getOnboardingDataFromDB(userId);
    logPerfStep("User profile retrieval from DB", job.jobId, userProfileStartTime);

    // 🔍 PERF_LOG: AI 风格建议生成
    const aiSuggestionStartTime = logPerfStep("AI style suggestion generation", job.jobId, undefined);
    const aiSuggestions = await getStyleSuggestionFromAI(
        {
            humanImageUrl: job.input.humanImage.url,
            garmentImageUrl: job.input.garmentImage.url,
            occasion: job.input.occasion,
            userProfile: userProfile, // Fix: Await the Promise to get OnboardingData
            stylePrompt: job.input.stylePrompt, //  新增：传递 stylePrompt
            customPrompt: job.input.customPrompt, // 🔍 新增：传递 customPrompt
        },
        { count: 2 }
    );
    logPerfStep("AI style suggestion generation", job.jobId, aiSuggestionStartTime);

    // 🔍 PERF_LOG: Job 建议映射与状态更新
    const jobUpdateStartTime = logPerfStep("Job suggestions mapping and status update", job.jobId, undefined);
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
    logPerfStep("Job suggestions mapping and status update", job.jobId, jobUpdateStartTime);
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