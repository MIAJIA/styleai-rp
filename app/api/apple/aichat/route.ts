import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { Job } from '@/lib/types';
import { generateChatCompletionWithGemini, GeminiChatMessage } from '@/lib/apple/gemini';
import { fileToBase64, urlToFile } from '@/lib/utils';
import { checkAndIncrementLimit } from '@/lib/apple/checkLimit';
import { fetchWithTimeout } from '@/lib/ai/utils';


const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_API_VERSION = process.env.GEMINI_API_VERSION || 'v1beta';
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL;




interface TestChatRequest {
    userId: string;
    sessionId?: string;
    messages: GeminiChatMessage[];
}


/**
 * 只作为测试接口，用于测试Gemini API
 * @param request 
 * @returns 
 */
export async function POST(request: NextRequest) {

    console.log('[AI Chat API] ===== REQUEST RECEIVED =====');

    try {
        console.log('[AI Chat API] Parsing request body...');
        const body = await request.json();
        // Call Gemini API
        // console.log('[AI Chat API] Calling Gemini API...');
        // const aiResponse = await generateChatCompletionWithGemini(userId, {
        //     messages: messages,
        //     maxOutputTokens: 1000,
        //     temperature: 0.7,
        // });


        const endpoint = `https://generativelanguage.googleapis.com/${GEMINI_API_VERSION}/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
        console.log('🤖 [GEMINI_CHAT] 🌐 API Endpoint:', endpoint.replace(GEMINI_API_KEY, '[REDACTED_KEY]'));

        const resp = await fetchWithTimeout(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            timeout: 30000,
        });

        if (!resp.ok) {
            const text = await resp.text();
            console.error('🤖 [GEMINI_CHAT] ❌ API Error:', resp.status, text);
            throw new Error(`Gemini Chat API error: ${resp.status} ${text}`);
        }

        // const data = await resp.json();


        // Return response
        return resp

    } catch (error) {
        console.error('[AI Chat API] ❌ ERROR:', error);
        console.error('[AI Chat API] Error type:', error instanceof Error ? error.constructor.name : typeof error);
        console.error('[AI Chat API] Error message:', error instanceof Error ? error.message : String(error));
        return NextResponse.json({
            success: false,
            error: 'Failed to process chat request',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
