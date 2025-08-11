import { kv } from "@vercel/kv";
import { fetchWithTimeout, sleep } from "../utils";
import { Job, Suggestion } from "../types";
import * as jwt from "jsonwebtoken";
import { IMAGE_FORMAT_DESCRIPTION, STRICT_REALISM_PROMPT_BLOCK } from "../../prompts";
import { fileToBase64, urlToFile } from "../utils";
import { saveFinalImageToBlob } from "../services/blob";
// --- Kling AI ---
const KLING_ACCESS_KEY = process.env.KLING_AI_ACCESS_KEY;
const KLING_SECRET_KEY = process.env.KLING_AI_SECRET_KEY;
const KLING_ACCESS_KEY_TRYON = process.env.KLING_AI_ACCESS_KEY_TRYON;
const KLING_SECRET_KEY_TRYON = process.env.KLING_AI_SECRET_KEY_TRYON;
// const KLING_API_BASE_URL = "https://api-beijing.klingai.com";
const KLING_API_BASE_URL = "https://api-singapore.klingai.com";

// 图像 生成 与 查询 路径
const KLING_IMAGE_PATH = "/v1/images/generations/";
const KOLORS_VIRTUAL_TRYON_SUBMIT_PATH = "/v1/images/kolors-virtual-try-on/";



const getApiToken = (): string => {
    // 根据路径判断是试穿还是生成
    const path = String(KLING_IMAGE_PATH)
    const path1 = String(KOLORS_VIRTUAL_TRYON_SUBMIT_PATH)
    const isTryOn = path === path1;
    console.log(`isTryOn: ${isTryOn}`);
    const accessKey = isTryOn ? KLING_ACCESS_KEY_TRYON : KLING_ACCESS_KEY;
    const secretKey = isTryOn ? KLING_SECRET_KEY_TRYON : KLING_SECRET_KEY;

    const payload = {
        iss: accessKey,
        exp: Math.floor(Date.now() / 1000) + 1800,
        nbf: Math.floor(Date.now() / 1000) - 5,
    };
    return jwt.sign(payload, secretKey || "", {
        algorithm: "HS256",
        header: { alg: "HS256", typ: "JWT" },
    });
};



export class KlingError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'KlingError';
    }
}


interface KlingRequestBody {
    model_name: string;
    image_reference?: string;
    human_fidelity?: number;
    image_fidelity?: number;
    n?: number;
}

const buildStylizeRequestBody = (
    modelVersion: string,
    prompt: string,
    humanImageBase64: string
): KlingRequestBody => {
    const baseBody = {
        prompt: prompt,
        aspect_ratio: "3:4",
        image: humanImageBase64,
    };

    switch (modelVersion) {
        case 'kling-v1-5':
            return {
                ...baseBody,
                image_reference: "subject",// "face" or "subject"?
                human_fidelity: 0.6,
                image_fidelity: 0.4,
                n: 1,// number of images to generate
                model_name: "kling-v1-5",
            };
        case 'kling-v2':
            return {
                ...baseBody,
                model_name: "kling-v2",
            };
        default:
            return {
                ...baseBody,
                model_name: "kling-v2",
            };
    }
};

interface ErrorInfo {
    definition: string;
    explanation: string;
    solution: string;
}

interface ErrorCodes {
    [httpStatus: string]: {
        [businessCode: string]: ErrorInfo;
    };
}

const ERROR_CODES: ErrorCodes = {
    "200": {
        "0": {
            "definition": "请求成功",
            "explanation": "-",
            "solution": "-"
        }
    },
    "401": {
        "1000": {
            "definition": "身份验证失败",
            "explanation": "身份验证失败",
            "solution": "检查Authorization是否正确"
        },
        "1001": {
            "definition": "身份验证失败",
            "explanation": "Authorization为空",
            "solution": "在Request Header中填写正确的Authorization"
        },
        "1002": {
            "definition": "身份验证失败",
            "explanation": "Authorization值非法",
            "solution": "在Request Header中填写正确的Authorization"
        },
        "1003": {
            "definition": "身份验证失败",
            "explanation": "Authorization未到有效时间",
            "solution": "检查token的开始生效时间，等待生效或重新签发"
        },
        "1004": {
            "definition": "身份验证失败",
            "explanation": "Authorization已失效",
            "solution": "检查token的有效期，重新签发"
        }
    },
    "429": {
        "1100": {
            "definition": "账户异常",
            "explanation": "账户异常",
            "solution": "检查账户配置信息"
        },
        "1101": {
            "definition": "账户异常",
            "explanation": "账户欠费（后付费场景）",
            "solution": "进行账户充值，确保余额充足"
        },
        "1102": {
            "definition": "账户异常",
            "explanation": "资源包已用完/已过期（预付费场景）",
            "solution": "购买额外的资源包，或开通后付费服务（如有）"
        },
        "1302": {
            "definition": "触发策略",
            "explanation": "API请求过快，超过平台速率限制",
            "solution": "降低请求频率、稍后重试，或联系客服增加限额"
        },
        "1303": {
            "definition": "触发策略",
            "explanation": "并发或QPS超出预付费资源包限制",
            "solution": "降低请求频率、稍后重试，或联系客服增加限额"
        },
        "1304": {
            "definition": "触发策略",
            "explanation": "触发平台的IP白名单策略",
            "solution": "联系客服"
        }
    },
    "403": {
        "1103": {
            "definition": "账户异常",
            "explanation": "请求的资源无权限，如接口/模型",
            "solution": "检查账户权限"
        }
    },
    "400": {
        "1200": {
            "definition": "请求参数非法",
            "explanation": "请求参数非法",
            "solution": "检查请求参数是否正确"
        },
        "1201": {
            "definition": "请求参数非法",
            "explanation": "参数非法，如key写错或value非法",
            "solution": "参考返回体中message字段的具体信息，修改请求参数"
        },
        "1300": {
            "definition": "触发策略",
            "explanation": "触发平台策略",
            "solution": "检查是否触发平台策略"
        },
        "1301": {
            "definition": "触发策略",
            "explanation": "触发平台的内容安全策略",
            "solution": "检查输入内容，修改后重新发起请求"
        }
    },
    "404": {
        "1202": {
            "definition": "请求参数非法",
            "explanation": "请求的method无效",
            "solution": "查看接口文档，使用正确的request method"
        },
        "1203": {
            "definition": "请求参数非法",
            "explanation": "请求的资源不存在，如模型",
            "solution": "参考返回体中message字段的具体信息，修改请求参数"
        }
    },
    "500": {
        "5000": {
            "definition": "内部错误",
            "explanation": "服务器内部错误",
            "solution": "稍后重试，或联系客服"
        }
    },
    "503": {
        "5001": {
            "definition": "内部错误",
            "explanation": "服务器暂时不可用，通常是在维护",
            "solution": "稍后重试，或联系客服"
        }
    },
    "504": {
        "5002": {
            "definition": "内部错误",
            "explanation": "服务器内部超时，通常是发生积压",
            "solution": "稍后重试，或联系客服"
        }
    }
};

// Helper function to get error information
export function getErrorInfo(httpStatus: string, businessCode: string) {
    return ERROR_CODES[httpStatus]?.[businessCode] || null;
}

// Helper function to get all errors for a specific HTTP status
export function getErrorsByHttpStatus(httpStatus: string) {
    return ERROR_CODES[httpStatus] || {};
}

// Helper function to get all error codes
export function getAllErrorCodes() {
    return ERROR_CODES;
}


export class KlingTaskHandler {
    job: Job;
    suggestionIndex: number;

    constructor(job: Job, suggestionIndex: number) {
        this.job = job;
        this.suggestionIndex = suggestionIndex;
    }

    private async retryWrapper<T>(fn: () => Promise<T>, maxRetries: number): Promise<T> {
        let lastError: any = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error: any) {
                lastError = error;
                console.error(`Using Kling AI submit failed: ${error}`);

                if (error instanceof KlingError) {
                    throw error;
                }
                if (attempt === maxRetries) {
                    throw error;
                }
                let waitTime = Math.pow(2, attempt) * 2000;
                await sleep(waitTime);
            }
        }
        throw lastError;
    }

    async caretTask(requestBody: KlingRequestBody): Promise<Response> {
        let url: string;
        return this.retryWrapper(async () => {
            if (requestBody.model_name === "kolors-virtual-try-on-v1-5") {
                url = `${KLING_API_BASE_URL}${KOLORS_VIRTUAL_TRYON_SUBMIT_PATH}`;
            } else {
                url = `${KLING_API_BASE_URL}${KLING_IMAGE_PATH}`;
            }
            const submitResponse = await fetchWithTimeout(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getApiToken()}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
                timeout: 180000, // Increased to 3 minutes for submit
            });
            if (!submitResponse.ok) {
                const errorBody = await submitResponse.json();
                const errorInfo = getErrorInfo(submitResponse.status.toString(), errorBody.code);
                console.error(`Using Kling AI submit failed: ${errorInfo?.definition}`);
                throw new KlingError(errorBody.message);
            }
            return submitResponse;
        }, 5);
    }

    async getTask(taskId: string, requestBody: KlingRequestBody):Promise<string[]> {
        let url: string;
        return this.retryWrapper(async () => {
            if (requestBody.model_name === "kolors-virtual-try-on-v1-5") {
                url = `${KLING_API_BASE_URL}${KOLORS_VIRTUAL_TRYON_SUBMIT_PATH}${taskId}`;
            } else {
                url = `${KLING_API_BASE_URL}${KLING_IMAGE_PATH}${taskId}`;
            }
            const statusCheckResponse = await fetchWithTimeout(url, {
                headers: { 'Authorization': `Bearer ${getApiToken()}` },
                timeout: 120000, // Increased to 2 minutes for status check
            });
            if (!statusCheckResponse.ok) {
                const errorBody = await statusCheckResponse.json();
                const errorInfo = getErrorInfo(statusCheckResponse.status.toString(), errorBody.code);
                console.error(`Using Kling AI submit failed: ${errorInfo?.definition}`);
                throw new KlingError(errorBody.message);
            } else {
                const statusCheckResult = await statusCheckResponse.json();
                // console.log(`Using Kling AI get task : ${JSON.stringify(statusCheckResult)}`);
                switch (statusCheckResult.data.task_status) {
                    case "succeed":
                        return statusCheckResult.data.task_result.images.map((img: any) => img.url);
                    case "failed":
                        throw new KlingError(`Using Kling AI get task failed: ${JSON.stringify(statusCheckResult)}`);
                    default:
                        throw new Error(`Using Kling AI get task failed: ${JSON.stringify(statusCheckResult)}`);
                }
            }
        }, 20);
    }



    async executeKlingTask(requestBody: KlingRequestBody): Promise<string[]> {
        const submitResponse = await this.caretTask(requestBody);
        const submitResult = await submitResponse.json();
        const taskId = submitResult.data.task_id;
        console.log(`Using Kling AI submit success: ${taskId}`);
        await sleep(2000);
        const imagesResult = await this.getTask(taskId, requestBody);
        return imagesResult
    }


    async runStylizationMultiple(modelVersion: "kling-v1-5" | "kling-v2"): Promise<string> {
        let finalPrompt: string;
        // 1️⃣ 最高优先级：AI 生成的 image_prompt
        if (this.job.suggestions[this.suggestionIndex]?.styleSuggestion?.image_prompt) {
            finalPrompt = this.job.suggestions[this.suggestionIndex].styleSuggestion.image_prompt;
        }
        // 2️⃣ 次高优先级：根据 outfit 详情构建
        else if (this.job.suggestions[this.suggestionIndex]?.styleSuggestion?.outfit_suggestion) {
            const outfitDetails = this.job.suggestions[this.suggestionIndex].styleSuggestion.outfit_suggestion;
            const outfitDescription = outfitDetails.explanation || outfitDetails.style_summary || "A stylish outfit";
            finalPrompt = `${outfitDetails.outfit_title || "Stylish Look"}. ${outfitDescription}`;
        }
        // 3️⃣ 最低优先级：默认 fallback
        else {
            finalPrompt = "A full-body shot of a person in a stylish outfit, standing in a visually appealing, realistic setting. The image is well-lit, with a clear focus on the person and their clothing. The background is a real-world scene, like a chic city street, a modern interior, or a scenic outdoor location. The overall aesthetic is fashionable, clean, and high-quality.";
        }
        finalPrompt = `${finalPrompt}. ${IMAGE_FORMAT_DESCRIPTION} ${STRICT_REALISM_PROMPT_BLOCK}`;
        if (finalPrompt.length > 2500) {
            finalPrompt = finalPrompt.substring(0, 2500);
        }
        const humanImageBase64 = await fileToBase64(await urlToFile(this.job.input.humanImage.url, this.job.input.humanImage.name, this.job.input.humanImage.type));
        const requestBody = buildStylizeRequestBody(modelVersion, finalPrompt, humanImageBase64);
        const styledImageUrls = await this.executeKlingTask(requestBody);
        const stylizedImageUrls: string[] = [];
        for (let i = 0; i < styledImageUrls.length; i++) {
            const finalUrl = await saveFinalImageToBlob(
                styledImageUrls[i],
                `${this.job.jobId}-${this.suggestionIndex}-stylized-${i + 1}` // Unique name
            );
            stylizedImageUrls.push(finalUrl);
        }
        this.job.suggestions[this.suggestionIndex].stylizedImageUrls = stylizedImageUrls[0];
        this.job.suggestions[this.suggestionIndex].finalPrompt = finalPrompt;
        this.job.updatedAt = Date.now();
        await kv.set(this.job.jobId, this.job);
        return stylizedImageUrls[0];
    }

    async runVirtualTryOnMultiple(): Promise<string> {
        let styledImageUrls: string = this.job.suggestions[this.suggestionIndex].stylizedImageUrls || "";

        const [humanImageBase64, garmentImageBase64] = await Promise.all([
            urlToFile(styledImageUrls, "canvas.jpg", "image/jpeg").then(fileToBase64),
            urlToFile(this.job.input.garmentImage.url, this.job.input.garmentImage.name, this.job.input.garmentImage.type).then(fileToBase64)
        ]);

        const requestBody = {
            model_name: "kolors-virtual-try-on-v1-5",
            human_image: humanImageBase64,
            cloth_image: garmentImageBase64,
            n: 1,
        };
        const tryOnImageUrls = await this.executeKlingTask(requestBody);
        const tryOnImageUrlsResult: string[] = [];
        for (let i = 0; i < tryOnImageUrls.length; i++) {
            const finalUrl = await saveFinalImageToBlob(
                tryOnImageUrls[i],
                `${this.job.jobId}-${this.suggestionIndex}-stylized-${i + 1}` // Unique name
            );
            tryOnImageUrlsResult.push(finalUrl);
        }

        this.job.suggestions[this.suggestionIndex].tryOnImageUrls = tryOnImageUrlsResult[0];
        this.job.suggestions[this.suggestionIndex].status = 'succeeded';
        this.job.updatedAt = Date.now();
        await kv.set(this.job.jobId, this.job);
        return tryOnImageUrls[0];
    }

}
