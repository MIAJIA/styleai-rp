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

// Heroku/服务器环境的超时配置
const FORMDATA_TIMEOUT = process.env.NODE_ENV === 'production' ? 25000 : 60000; // Heroku: 25s, 开发: 60s
const UPLOAD_TIMEOUT = process.env.NODE_ENV === 'production' ? 20000 : 45000; // 文件上传超时
const MAX_RETRIES = 3; // 最大重试次数
const BASE_RETRY_DELAY = 1000; // 基础重试延迟 1秒

// 🔍 NEW: 重试统计追踪
interface RetryStats {
  formDataRetries: number;
  humanUploadRetries: number;
  garmentUploadRetries: number;
  totalRetryTime: number;
}

let requestRetryStats: RetryStats = {
  formDataRetries: 0,
  humanUploadRetries: 0,
  garmentUploadRetries: 0,
  totalRetryTime: 0
};

// 带超时和重试的 formData 解析函数
async function parseFormDataWithTimeoutAndRetry(request: Request, attempt: number = 1): Promise<FormData> {
  const timeoutMs = FORMDATA_TIMEOUT - (attempt - 1) * 2000; // 每次重试减少2秒超时时间
  
  console.log(`[FORMDATA_PARSE] Attempt ${attempt}/${MAX_RETRIES}, timeout: ${timeoutMs}ms`);
  
  // 🔍 NEW: 记录重试统计
  if (attempt > 1) {
    requestRetryStats.formDataRetries = attempt - 1;
  }
  
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`FormData parsing timeout after ${timeoutMs}ms on attempt ${attempt}`));
    }, timeoutMs);

    request.formData()
      .then((formData) => {
        clearTimeout(timeoutId);
        console.log(`[FORMDATA_PARSE] ✅ Success on attempt ${attempt}`);
        resolve(formData);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        console.error(`[FORMDATA_PARSE] ❌ Failed on attempt ${attempt}:`, error.message);
        reject(error);
      });
  });
}

// 带重试的文件上传函数
async function uploadFileWithRetry(
  fileName: string, 
  file: File, 
  fileType: 'human' | 'garment',
  attempt: number = 1
): Promise<any> {
  const timeoutMs = UPLOAD_TIMEOUT - (attempt - 1) * 3000; // 每次重试减少3秒超时时间
  
  console.log(`[BLOB_UPLOAD] ${fileType} image attempt ${attempt}/${MAX_RETRIES}, timeout: ${timeoutMs}ms, size: ${file.size} bytes`);
  
  try {
    const result = await Promise.race([
      put(fileName, file, { access: 'public', addRandomSuffix: true }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`${fileType} image upload timeout after ${timeoutMs}ms on attempt ${attempt}`)), timeoutMs)
      )
    ]);
    
    console.log(`[BLOB_UPLOAD] ✅ ${fileType} image uploaded successfully on attempt ${attempt}`);
    return result;
  } catch (error) {
    console.error(`[BLOB_UPLOAD] ❌ ${fileType} image upload failed on attempt ${attempt}:`, error);
    throw error;
  }
}

// 通用重试函数，支持指数退避
async function retryWithExponentialBackoff<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = MAX_RETRIES
): Promise<T> {
  let lastError: Error | null = null;
  const retryStartTime = Date.now();
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const attemptStartTime = Date.now();
    
    try {
      const result = await operation();
      
      // 🔍 NEW: 记录重试成功的统计信息
      if (attempt > 1) {
        console.log(`[RETRY_SUCCESS] ${operationName} succeeded on attempt ${attempt}/${maxRetries}`);
        console.log(`[RETRY_SUCCESS] Total retry time: ${Date.now() - retryStartTime}ms`);
        console.log(`[RETRY_SUCCESS] Final attempt time: ${Date.now() - attemptStartTime}ms`);
      }
      
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      console.error(`[RETRY] ${operationName} attempt ${attempt}/${maxRetries} failed after ${Date.now() - attemptStartTime}ms`);
      console.error(`[RETRY] Error: ${lastError.message}`);
      
      if (attempt === maxRetries) {
        console.error(`[RETRY_FAILED] ${operationName} exhausted all ${maxRetries} attempts. Total time: ${Date.now() - retryStartTime}ms`);
        console.error(`[RETRY_FAILED] Final error: ${lastError.message}`);
        throw lastError;
      }
      
      // 指数退避：1s, 2s, 4s...
      const delay = BASE_RETRY_DELAY * Math.pow(2, attempt - 1);
      console.log(`[RETRY] ${operationName} attempt ${attempt} failed, retrying in ${delay}ms...`);
      console.log(`[RETRY] Failure reason: ${lastError.message}`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// 带超时的 formData 解析函数
async function parseFormDataWithTimeout(request: Request): Promise<FormData> {
  return retryWithExponentialBackoff(
    () => parseFormDataWithTimeoutAndRetry(request, 1),
    'FormData parsing'
  );
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
  
  // 🔍 NEW: Heroku 环境下的全局超时保护
  const HEROKU_TIMEOUT = process.env.NODE_ENV === 'production' ? 28000 : 300000; // Heroku: 28s, 其他: 5min
  const globalTimeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Global request timeout after ${HEROKU_TIMEOUT}ms - likely Heroku platform limit`));
    }, HEROKU_TIMEOUT);
  });
  
  try {
    // 🔍 NEW: 将整个请求处理包装在超时竞赛中
    const result = await Promise.race([
      processGenerationRequest(request, startTime, lastStepTime),
      globalTimeoutPromise
    ]);
    
    return result;
  } catch (error) {
    console.error('Error starting generation job:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    
    // 🔍 NEW: 区分不同类型的错误
    if (errorMessage.includes('FormData parsing timeout') || errorMessage.includes('upload timeout')) {
      console.error(`[TIMEOUT_ERROR] Request timeout detected: ${errorMessage}`);
      
      // 🔍 NEW: 分析超时原因
      if (errorMessage.includes('after 3 attempts') || errorMessage.includes('failed after')) {
        console.error(`[TIMEOUT_ERROR] ⚠️ RETRY EXHAUSTED - All ${MAX_RETRIES} attempts failed`);
        console.error(`[TIMEOUT_ERROR] 📊 This suggests persistent network/server issues, not just temporary congestion`);
      }
      
      lastStepTime = Date.now();
      console.log(`XXX 1005_TIMEOUT - since start ${Date.now() - startTime}ms, since last step=${Date.now() - lastStepTime}ms`);
      return NextResponse.json({ 
        error: 'Request timeout', 
        details: 'The request took too long to process. Please try uploading smaller images or try again later.',
        errorType: 'timeout',
        retryAttempted: errorMessage.includes('after 3 attempts')
      }, { status: 504 }); // 504 Gateway Timeout 更准确
    }
    
    // 🔍 NEW: 检查是否是 Heroku 平台超时
    if (process.env.NODE_ENV === 'production' && (Date.now() - startTime > 28000 || errorMessage.includes('Global request timeout'))) {
      console.error(`[HEROKU_TIMEOUT] Request approaching/exceeded Heroku 30s limit: ${Date.now() - startTime}ms`);
      console.error(`[HEROKU_TIMEOUT] 📊 Platform timeout analysis:`);
      console.error(`[HEROKU_TIMEOUT] - Total time: ${Date.now() - startTime}ms`);
      console.error(`[HEROKU_TIMEOUT] - Error type: ${errorMessage.includes('Global request timeout') ? 'Global timeout' : 'Natural timeout'}`);
      
      return NextResponse.json({ 
        error: 'Server timeout', 
        details: 'The server took too long to process your request. Please try again with smaller images.',
        errorType: 'platform_timeout',
        totalTime: Date.now() - startTime
      }, { status: 503 });
    }
    
    lastStepTime = Date.now();
    console.log(`XXX 1005 - since start ${Date.now() - startTime}ms, since last step=${Date.now() - lastStepTime}ms`);
    return NextResponse.json({ error: 'Failed to start generation job', details: errorMessage }, { status: 500 });
  }
}

// 🔍 NEW: 将主要的请求处理逻辑提取为单独函数
async function processGenerationRequest(request: Request, startTime: number, lastStepTime: number) {
  lastStepTime = Date.now();
  console.log(`XXX 122 - since start ${Date.now() - startTime}ms, since last step=${Date.now() - lastStepTime}ms`);
  
  // 🔍 NEW: 环境和性能因素分析
  const isProduction = process.env.NODE_ENV === 'production';
  const memoryUsage = process.memoryUsage();
  console.log(`[ENV_ANALYSIS] Environment: ${process.env.NODE_ENV}`);
  console.log(`[ENV_ANALYSIS] Memory usage: RSS=${Math.round(memoryUsage.rss/1024/1024)}MB, Heap=${Math.round(memoryUsage.heapUsed/1024/1024)}MB`);
  console.log(`[ENV_ANALYSIS] Platform: ${process.env.VERCEL ? 'Vercel' : process.env.DYNO ? 'Heroku' : 'Unknown'}`);
  
  // 🔍 NEW: 使用带超时和重试的 formData 解析，防止在 Heroku 上超时
  console.log(`[FORMDATA_PARSE] Starting formData parsing with ${FORMDATA_TIMEOUT}ms timeout and ${MAX_RETRIES} retries...`);
  const formData = await parseFormDataWithTimeout(request);
  
  lastStepTime = Date.now();
  console.log(`XXX 133 - since start ${Date.now() - startTime}ms, since last step=${Date.now() - lastStepTime}ms`);
  console.log(`[FORMDATA_PARSE] ✅ FormData parsed successfully in ${Date.now() - lastStepTime}ms`);
  
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

  // 🔍 NEW: 详细的文件分析，帮助理解超时变化原因
  if (humanImageFile) {
    console.log(`[FILE_ANALYSIS] Human image: ${humanImageFile.name}, size: ${humanImageFile.size} bytes (${Math.round(humanImageFile.size/1024)}KB), type: ${humanImageFile.type}`);
  }
  if (garmentImageFile) {
    console.log(`[FILE_ANALYSIS] Garment image: ${garmentImageFile.name}, size: ${garmentImageFile.size} bytes (${Math.round(garmentImageFile.size/1024)}KB), type: ${garmentImageFile.type}`);
  }

  // 🔍 NEW: 验证文件大小，防止超大文件导致超时
  if (humanImageFile && humanImageFile.size > 10 * 1024 * 1024) { // 10MB limit
    console.error(`[FORMDATA_PARSE] Human image too large: ${humanImageFile.size} bytes`);
    return NextResponse.json({ 
      error: 'Human image file too large', 
      details: 'Please upload an image smaller than 10MB' 
    }, { status: 413 });
  }
  
  if (garmentImageFile && garmentImageFile.size > 10 * 1024 * 1024) { // 10MB limit
    console.error(`[FORMDATA_PARSE] Garment image too large: ${garmentImageFile.size} bytes`);
    return NextResponse.json({ 
      error: 'Garment image file too large', 
      details: 'Please upload an image smaller than 10MB' 
    }, { status: 413 });
  }

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
  
  // 🔍 NEW: 带超时的文件上传
  console.log(`[BLOB_UPLOAD] Starting human image upload with ${UPLOAD_TIMEOUT}ms timeout...`);
  const humanImageBlob = await retryWithExponentialBackoff(
    () => uploadFileWithRetry('human_image', humanImageFile, 'human'),
    'Human image upload'
  );

  lastStepTime = Date.now();
  console.log(`XXX 555 - since start ${Date.now() - startTime}ms, since last step=${Date.now() - lastStepTime}ms`);
  const humanUploadEndTime = Date.now();
  console.log(`[PERF_LOG | start] Human image uploaded. Elapsed: ${humanUploadEndTime - humanUploadStartTime}ms.`);

  const garmentUploadStartTime = Date.now();
  lastStepTime = Date.now();
  console.log(`XXX 666 - since start ${Date.now() - startTime}ms, since last step=${Date.now() - lastStepTime}ms`);
  
  console.log(`[BLOB_UPLOAD] Starting garment image upload with ${UPLOAD_TIMEOUT}ms timeout...`);
  const garmentImageBlob = await retryWithExponentialBackoff(
    () => uploadFileWithRetry('garment_image', garmentImageFile, 'garment'),
    'Garment image upload'
  );
  
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
  
  // 🔍 NEW: 输出重试统计信息
  const hasRetries = requestRetryStats.formDataRetries > 0 || requestRetryStats.humanUploadRetries > 0 || requestRetryStats.garmentUploadRetries > 0;
  if (hasRetries) {
    console.log(`[RETRY_STATS] 📊 Request completed with retries:`);
    console.log(`[RETRY_STATS] - FormData retries: ${requestRetryStats.formDataRetries}`);
    console.log(`[RETRY_STATS] - Human upload retries: ${requestRetryStats.humanUploadRetries}`);
    console.log(`[RETRY_STATS] - Garment upload retries: ${requestRetryStats.garmentUploadRetries}`);
    console.log(`[RETRY_STATS] - Total request time: ${endTime - startTime}ms`);
  } else {
    console.log(`[RETRY_STATS] ✅ Request completed without any retries in ${endTime - startTime}ms`);
  }
  
  return NextResponse.json({ 
    jobId,
    // 🔍 NEW: 在响应中包含重试统计（用于前端监控）
    ...(hasRetries && {
      retryStats: {
        formDataRetries: requestRetryStats.formDataRetries,
        humanUploadRetries: requestRetryStats.humanUploadRetries,
        garmentUploadRetries: requestRetryStats.garmentUploadRetries,
        totalTime: endTime - startTime
      }
    })
  });
}