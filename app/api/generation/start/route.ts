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
const MAX_RETRIES = 3; // 最大重试次数（仅用于文件上传）
const BASE_RETRY_DELAY = 1000; // 基础重试延迟 1秒

// 🔍 NEW: 重试统计追踪（仅用于文件上传）
interface RetryStats {
  humanUploadRetries: number;
  garmentUploadRetries: number;
  totalRetryTime: number;
}

let requestRetryStats: RetryStats = {
  humanUploadRetries: 0,
  garmentUploadRetries: 0,
  totalRetryTime: 0
};

// 🔍 FIXED: 简单的 formData 解析函数（不重试，因为 HTTP 流一次性可读）
async function parseFormDataWithTimeout(request: Request): Promise<FormData> {
  console.log(`[FORMDATA_PARSE] Starting formData parsing with ${FORMDATA_TIMEOUT}ms timeout (no retry - stream is one-time readable)...`);
  
  // 🔍 NEW: 简单的网络诊断
  const startTime = Date.now();
  const contentLength = request.headers.get('content-length');
  const contentType = request.headers.get('content-type');
  
  console.log(`[TIMEOUT_DIAG] Request headers - Content-Length: ${contentLength || 'unknown'}, Content-Type: ${contentType || 'unknown'}`);
  
  if (contentLength) {
    const sizeMB = parseInt(contentLength) / (1024 * 1024);
    console.log(`[TIMEOUT_DIAG] Request size: ${sizeMB.toFixed(2)}MB`);
    
    // 简单的大小vs超时预测
    if (sizeMB > 5) {
      console.log(`[TIMEOUT_DIAG] ⚠️ Large request detected (${sizeMB.toFixed(2)}MB) - high timeout risk`);
    } else if (sizeMB > 2) {
      console.log(`[TIMEOUT_DIAG] ⚠️ Medium request size (${sizeMB.toFixed(2)}MB) - moderate timeout risk`);
    } else {
      console.log(`[TIMEOUT_DIAG] ✅ Small request size (${sizeMB.toFixed(2)}MB) - if timeout occurs, likely network issue`);
    }
  }
  
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      const elapsedTime = Date.now() - startTime;
      
      // 🔍 NEW: 简单的超时原因分析
      let timeoutReason = 'unknown';
      if (contentLength) {
        const sizeMB = parseInt(contentLength) / (1024 * 1024);
        if (sizeMB > 3) {
          timeoutReason = 'likely_file_size';
        } else if (elapsedTime < 5000) {
          timeoutReason = 'likely_network_fast_fail';
        } else {
          timeoutReason = 'likely_network_slow';
        }
      } else {
        timeoutReason = elapsedTime < 5000 ? 'likely_network_fast_fail' : 'likely_network_slow';
      }
      
      console.log(`[TIMEOUT_DIAG] ❌ FormData timeout after ${elapsedTime}ms, reason: ${timeoutReason}`);
      reject(new Error(`FormData parsing timeout after ${FORMDATA_TIMEOUT}ms - HTTP request stream exhausted (reason: ${timeoutReason})`));
    }, FORMDATA_TIMEOUT);

    request.formData()
      .then((formData) => {
        clearTimeout(timeoutId);
        const elapsedTime = Date.now() - startTime;
        console.log(`[FORMDATA_PARSE] ✅ FormData parsed successfully in ${elapsedTime}ms`);
        
        // 🔍 NEW: 简单的性能分析
        if (contentLength) {
          const sizeMB = parseInt(contentLength) / (1024 * 1024);
          const mbPerSecond = sizeMB / (elapsedTime / 1000);
          console.log(`[TIMEOUT_DIAG] ✅ Parse speed: ${mbPerSecond.toFixed(2)} MB/s`);
          
          if (mbPerSecond < 0.1) {
            console.log(`[TIMEOUT_DIAG] ⚠️ Slow parsing speed - likely network congestion`);
          } else if (mbPerSecond > 1) {
            console.log(`[TIMEOUT_DIAG] ✅ Good parsing speed - network is healthy`);
          }
        }
        
        resolve(formData);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        const elapsedTime = Date.now() - startTime;
        console.error(`[FORMDATA_PARSE] ❌ FormData parsing failed after ${elapsedTime}ms:`, error.message);
        console.log(`[TIMEOUT_DIAG] ❌ Parse failure - elapsed: ${elapsedTime}ms, likely network error`);
        reject(error);
      });
  });
}

// 带重试的文件上传函数（保留重试，因为这是新的操作）
async function uploadFileWithRetry(
  fileName: string, 
  file: File, 
  fileType: 'human' | 'garment',
  attempt: number = 1
): Promise<any> {
  const timeoutMs = UPLOAD_TIMEOUT - (attempt - 1) * 3000; // 每次重试减少3秒超时时间
  const startTime = Date.now();
  
  console.log(`[BLOB_UPLOAD] ${fileType} image attempt ${attempt}/${MAX_RETRIES}, timeout: ${timeoutMs}ms, size: ${file.size} bytes`);
  
  // 🔍 NEW: 简单的文件上传诊断
  const fileSizeMB = file.size / (1024 * 1024);
  console.log(`[TIMEOUT_DIAG] Upload ${fileType} - Size: ${fileSizeMB.toFixed(2)}MB, Type: ${file.type}`);
  
  if (fileSizeMB > 2) {
    console.log(`[TIMEOUT_DIAG] ⚠️ Large file upload (${fileSizeMB.toFixed(2)}MB) - timeout risk due to size`);
  } else {
    console.log(`[TIMEOUT_DIAG] ✅ Normal file size (${fileSizeMB.toFixed(2)}MB) - if timeout occurs, likely network issue`);
  }
  
  // 🔍 NEW: 记录重试统计
  if (attempt > 1) {
    if (fileType === 'human') {
      requestRetryStats.humanUploadRetries = attempt - 1;
    } else {
      requestRetryStats.garmentUploadRetries = attempt - 1;
    }
  }
  
  try {
    const result = await Promise.race([
      put(fileName, file, { access: 'public', addRandomSuffix: true }),
      new Promise((_, reject) => 
        setTimeout(() => {
          const elapsedTime = Date.now() - startTime;
          
          // 🔍 NEW: 上传超时原因分析
          let timeoutReason = 'unknown';
          if (fileSizeMB > 2) {
            timeoutReason = 'likely_file_size';
          } else if (elapsedTime < 3000) {
            timeoutReason = 'likely_network_fast_fail';
          } else {
            timeoutReason = 'likely_network_slow';
          }
          
          console.log(`[TIMEOUT_DIAG] ❌ Upload timeout after ${elapsedTime}ms, reason: ${timeoutReason}`);
          reject(new Error(`${fileType} image upload timeout after ${timeoutMs}ms on attempt ${attempt} (reason: ${timeoutReason})`));
        }, timeoutMs)
      )
    ]);
    
    const elapsedTime = Date.now() - startTime;
    const mbPerSecond = fileSizeMB / (elapsedTime / 1000);
    console.log(`[BLOB_UPLOAD] ✅ ${fileType} image uploaded successfully on attempt ${attempt} in ${elapsedTime}ms`);
    console.log(`[TIMEOUT_DIAG] ✅ Upload speed: ${mbPerSecond.toFixed(2)} MB/s`);
    
    // 🔍 NEW: 简单的速度分析
    if (mbPerSecond < 0.05) {
      console.log(`[TIMEOUT_DIAG] ⚠️ Very slow upload speed - network congestion likely`);
    } else if (mbPerSecond > 0.5) {
      console.log(`[TIMEOUT_DIAG] ✅ Good upload speed - network is healthy`);
    }
    
    return result;
  } catch (error) {
    const elapsedTime = Date.now() - startTime;
    console.error(`[BLOB_UPLOAD] ❌ ${fileType} image upload failed on attempt ${attempt} after ${elapsedTime}ms:`, error);
    
    // 🔍 NEW: 失败原因快速诊断
    if (elapsedTime < 1000) {
      console.log(`[TIMEOUT_DIAG] ❌ Quick failure (${elapsedTime}ms) - likely network connection issue`);
    } else if (fileSizeMB > 2 && elapsedTime > 15000) {
      console.log(`[TIMEOUT_DIAG] ❌ Slow failure with large file - likely file size + network issue`);
    } else {
      console.log(`[TIMEOUT_DIAG] ❌ Standard timeout - likely network congestion`);
    }
    
    throw error;
  }
}

// 通用重试函数，支持指数退避（仅用于文件上传等可重复操作）
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

export async function POST_METHOD(request: Request) {
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
      
      // 🔍 FIXED: 分析超时原因（移除 formData 重试相关）
      if (errorMessage.includes('FormData parsing timeout')) {
        console.error(`[TIMEOUT_ERROR] ⚠️ FORMDATA TIMEOUT - HTTP request stream exhausted, cannot retry`);
        console.error(`[TIMEOUT_ERROR] 📊 This suggests slow network or large multipart data parsing`);
      } else if (errorMessage.includes('after 3 attempts') || errorMessage.includes('failed after')) {
        console.error(`[TIMEOUT_ERROR] ⚠️ UPLOAD RETRY EXHAUSTED - All ${MAX_RETRIES} upload attempts failed`);
        console.error(`[TIMEOUT_ERROR] 📊 This suggests persistent Blob storage or network issues`);
      }
      
      lastStepTime = Date.now();
      console.log(`XXX 1005_TIMEOUT - since start ${Date.now() - startTime}ms, since last step=${Date.now() - lastStepTime}ms`);
      return NextResponse.json({ 
        error: 'Request timeout', 
        details: errorMessage.includes('FormData parsing timeout') 
          ? 'Request data parsing took too long. Please try again or use smaller images.'
          : 'File upload took too long. Please try uploading smaller images or try again later.',
        errorType: 'timeout',
        retryAttempted: errorMessage.includes('after 3 attempts') && !errorMessage.includes('FormData')
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
  
  // 🔍 NEW: 使用带超时的 formData 解析（不重试，因为 HTTP 流一次性可读）
  console.log(`[FORMDATA_PARSE] Starting formData parsing with ${FORMDATA_TIMEOUT}ms timeout (no retry possible)...`);
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
  const hasRetries = requestRetryStats.humanUploadRetries > 0 || requestRetryStats.garmentUploadRetries > 0;
  if (hasRetries) {
    console.log(`[RETRY_STATS] 📊 Request completed with retries:`);
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
        humanUploadRetries: requestRetryStats.humanUploadRetries,
        garmentUploadRetries: requestRetryStats.garmentUploadRetries,
        totalTime: endTime - startTime
      }
    })
  });
}



export async function POST(request: Request) {
  const startTime = Date.now();
  console.log(`[PERF_LOG | start] Request received. Timestamp: ${startTime}`);
  try {
    const requestData = await request.json();
    const jsonParseTime = Date.now();
    console.log(`[PERF_LOG | start] JSON parsed. Elapsed: ${jsonParseTime - startTime}ms`);
    
    const { human_image, garment_image, occasion, generation_mode, user_profile, custom_prompt, style_prompt } = requestData;

    // 🔍 LOG: 添加关键日志确认正确接收
    console.log(`[STYLE_PROMPT_LOG] 🎯 Received style_prompt from frontend:`, style_prompt ? 'YES' : 'NO');
    if (style_prompt) {
      console.log(`[STYLE_PROMPT_LOG] 📝 Style prompt content (first 100 chars):`, style_prompt.substring(0, 100));
    }

    let userProfile: OnboardingData | undefined = user_profile;

    if (!human_image?.url || !garment_image?.url || !occasion || !generation_mode) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Use the uploaded blob URLs directly
    const humanImageBlob = { url: human_image.url };
    const garmentImageBlob = { url: garment_image.url };

    const jobId = randomUUID();
    const now = Date.now();

    // Get user session to store userId in job
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id || 'default';
    console.log(`[GENERATION_START] User ID for job ${jobId.slice(-8)}: ${userId}`);

    const newJob: Job = {
      jobId,
      userId, // Store userId in job for pipeline access
      status: 'pending', // IMPORTANT: Status is now 'pending'
      suggestions: [], // Suggestions will be generated later
      input: {
        humanImage: { url: humanImageBlob.url, type: human_image.type, name: human_image.name },
        garmentImage: { url: garmentImageBlob.url, type: garment_image.type, name: garment_image.name },
        generationMode: generation_mode,
        occasion,
        userProfile,
        customPrompt: custom_prompt?.trim() || undefined,
        stylePrompt: style_prompt?.trim() || undefined, // 🔍 新增：存储 style_prompt
      },
      createdAt: now,
      updatedAt: now,
    };

    // 🔍 LOG: 确认 style_prompt 已存储
    console.log(`[STYLE_PROMPT_LOG] 💾 Style prompt stored in job:`, newJob.input.stylePrompt ? 'YES' : 'NO');

    // 🔍 NEW: 使用原子操作保存job，确保数据一致性
    const kvSetStartTime = Date.now();

    // 使用原子操作创建job
    const jobCreated = await createJobWithAtomicCheck(userId, jobId, newJob);
    if (!jobCreated) {
      console.log(`[USER_JOB_LIMIT] Atomic check failed for user ${userId}. Request blocked.`);
      return NextResponse.json({
        error: 'User job limit exceeded',
        details: `You have reached the maximum limit of ${MAX_USER_JOBS} active jobs. Please wait for some jobs to complete before creating new ones.`
      }, { status: 429 });
    }else{
      await kv.set(jobId, newJob);
    }

    const kvSetEndTime = Date.now();
    console.log(`[PERF_LOG | start] Job set in KV. Elapsed: ${kvSetEndTime - kvSetStartTime}ms.`);
    console.log(`[Job ${jobId}] Initial job record created with status 'pending'. AI processing will start on first status poll.`);

    // runImageGenerationPipeline(jobId, 0);
    // console.log(`[Job ${jobId}] Background pipeline started for suggestion 0.`);

    const endTime = Date.now();
    console.log(`[PERF_LOG | start] Total request time before response: ${endTime - startTime}ms.`);
    return NextResponse.json({ jobId });
  } catch (error) {
    console.error('Error starting generation job:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ error: 'Failed to start generation job', details: errorMessage }, { status: 500 });
  }
}