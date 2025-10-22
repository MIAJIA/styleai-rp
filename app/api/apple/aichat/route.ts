import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { Job } from '@/lib/types';
import { generateChatCompletionWithGemini, GeminiChatMessage } from '@/lib/apple/gemini';
import { fileToBase64, urlToFile } from '@/lib/utils';
import { checkAndIncrementLimit } from '@/lib/apple/checkLimit';



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
        const body: TestChatRequest = await request.json();
        const { userId,messages,sessionId } = body;

        console.log('[AI Chat API] Request parsed successfully');
        console.log(`[AI Chat API] UserId: ${userId}`);
        console.log(`[AI Chat API] SessionId: ${sessionId}`);
        console.log(`[AI Chat API] Messages count: ${messages?.length || 0}`);
        console.log(`[AI Chat API] Sending request to Gemini with ${messages.length} messages`);

        messages.forEach(message => {
            console.log(`[AI Chat API] Message: ${message.role} - ${message.parts.map(part => part.text).join(' ')}`);
        });
        
        // Call Gemini API
        console.log('[AI Chat API] Calling Gemini API...');
        const aiResponse = await generateChatCompletionWithGemini(userId, {
            messages: messages,
            maxOutputTokens: 1000,
            temperature: 0.7,
        });

        console.log('[AI Chat API] Gemini response received');
        console.log('[AI Chat API] Response text length:', aiResponse.text?.length || 0);
        console.log('[AI Chat API] Response images count:', aiResponse.images?.length || 0);

        // Return response
        return NextResponse.json({
            success: true,
            message: aiResponse,
            sessionId: sessionId,
        });

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
