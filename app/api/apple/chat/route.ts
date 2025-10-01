import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { Job } from '@/lib/types';
import { generateChatCompletionWithGemini, GeminiChatMessage } from '@/lib/apple/gemini';
import { fileToBase64, urlToFile } from '@/lib/utils';

interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: string;
}

interface ChatRequest {
    userId: string;
    jobId: string;
    imageUrl?: string;
    message: string;
    sessionId?: string;
    includeJobContext?: boolean;
}

// Build system prompt with JOB context
function buildSystemPromptWithJobContext(job: Job): string {
    const { input, suggestions } = job;
    const { userProfile, occasion, generationMode, customPrompt, stylePrompt } = input;

    let contextPrompt = `You are a professional fashion consultant AI assistant. The current conversation is related to a fashion styling task. Here is the task context information:

## Task Basic Information
- Occasion: ${occasion}
- Generation Mode: ${generationMode}
- Custom Requirements: ${customPrompt || 'None'}
- Style Prompt: ${stylePrompt || 'None'}

## User Profile Information
- Body Type: ${userProfile?.bodyType || 'Not provided'}
- Skin Tone: ${userProfile?.skinTone || 'Not provided'}
- Body Structure: ${userProfile?.bodyStructure || 'Not provided'}
- Face Shape: ${userProfile?.faceShape || 'Not provided'}
- Style Preferences: ${userProfile?.stylePreferences?.join(', ') || 'Not provided'}

## Generated Style Suggestions
${suggestions.length > 0 ? suggestions.map((suggestion, index) => {
        const outfit = suggestion.styleSuggestion?.outfit_suggestion;
        return `Suggestion ${index + 1}: ${outfit?.outfit_title || 'No title'}
- Styling Description: ${outfit?.explanation || 'No description'}
- Status: ${suggestion.status}`;
    }).join('\n') : 'No style suggestions yet'}

## Your Role
Based on the above context information, please provide professional fashion advice and styling guidance to users. You can:
1. Analyze current style suggestions
2. Provide personalized styling advice
3. Answer questions about fashion and styling
4. Adjust styling plans according to user needs

Please communicate with users in English with a friendly and professional tone, and provide practical and specific advice.`;

    return contextPrompt;
}

// Get JOB information
async function getJobContext(jobId: string): Promise<Job | null> {
    try {
        const job = await kv.get(jobId) as Job;
        return job;
    } catch (error) {
        console.error('[Chat API] Error fetching job context:', error);
        return null;
    }
}

// Save chat history (optional)
async function saveChatMessage(sessionId: string, message: ChatMessage): Promise<void> {
    try {
        const messageKey = `chat:message:${sessionId}:${Date.now()}`;
        await kv.set(messageKey, message);

        // Add to session message list
        const messagesListKey = `chat:messages:${sessionId}`;
        await kv.lpush(messagesListKey, messageKey);

        // Limit history length
        await kv.ltrim(messagesListKey, 0, 99);
    } catch (error) {
        console.error('[Chat API] Error saving chat message:', error);
    }
}

// Get chat history
async function getChatHistory(sessionId: string, limit: number = 10): Promise<ChatMessage[]> {
    try {
        const messagesListKey = `chat:messages:${sessionId}`;
        const messageKeys = await kv.lrange(messagesListKey, 0, limit - 1);

        const messages: ChatMessage[] = [];
        for (const key of messageKeys) {
            const message = await kv.get(key) as ChatMessage;
            if (message) {
                messages.push(message);
            }
        }

        return messages.reverse(); // Sort in chronological order
    } catch (error) {
        console.error('[Chat API] Error fetching chat history:', error);
        return [];
    }
}

export async function POST(request: NextRequest) {
    try {
        const body: ChatRequest = await request.json();
        const { userId, jobId, message, imageUrl, sessionId, includeJobContext = true } = body;

        console.log(`[Chat API] Processing chat request for job: ${userId}  -> ${jobId}`);

        // Get JOB context information
        let job: Job | null = null;
        let systemPrompt = "You are a professional fashion consultant AI assistant. Please provide professional fashion advice and styling guidance to users in English.";

        if (includeJobContext) {
            job = await getJobContext(jobId);
            if (job) {
                systemPrompt = buildSystemPromptWithJobContext(job);
                console.log(`[Chat API] Job context loaded for job: ${jobId}`);
            } else {
                console.warn(`[Chat API] Job not found: ${jobId}, using default system prompt`);
            }
        }

        // Get chat history
        let imageBase64: string | undefined = undefined;
        const chatHistory = await getChatHistory(sessionId || '');
        if (imageUrl && imageUrl.length > 0) {
            imageBase64 = await urlToFile(imageUrl, 'image.jpg', 'image/jpeg').then(fileToBase64);
            console.log('🤖 [GEMINI_IMAGE_GENERATION] 🔄 Image converted, size:', imageBase64?.length, 'chars');
        }
        const parts: any[] = [{ text: message }];
        if (imageBase64) {
            parts.push({ inline_data: { mime_type: 'image/jpeg', data: imageBase64 } });
        }
        // Build message array for Gemini
        const messages: GeminiChatMessage[] = [
            {
                role: 'user',
                parts: [{ text: systemPrompt }]
            },
            // Add historical conversation
            ...chatHistory.map(msg => ({
                role: msg.role === 'assistant' ? 'model' : 'user' as 'user' | 'model',
                parts: [{ text: msg.content }]
            })),
            // Add current user message
            {
                role: 'user',
                parts: parts
            },
            
        ];

        console.log(`[Chat API] Sending request to Gemini with ${messages.length} messages`);

        // Call Gemini API
        const aiResponse = await generateChatCompletionWithGemini(userId, {
            messages: messages,
            maxOutputTokens: 1000,
            temperature: 0.7,
        });

        console.log(`[Chat API] Received response from Gemini`);

        // Save chat history
        const userMessage: ChatMessage = {
            role: 'user',
            content: message,
            timestamp: new Date().toISOString()
        };

        const assistantMessage: ChatMessage = {
            role: 'assistant',
            content: aiResponse.text,
            timestamp: new Date().toISOString()
        };
        console.log(`[Chat API] Assistant message: ${assistantMessage.content}`);
        await saveChatMessage(sessionId || '', userMessage);
        await saveChatMessage(sessionId || '', assistantMessage);

        // Return response
        return NextResponse.json({
            success: true,
            message: aiResponse,
            sessionId: sessionId,
        });

    } catch (error) {
        console.error('[Chat API] Error processing chat request:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to process chat request',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

// GET - Get chat history
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get('sessionId');

        if (!sessionId) {
            return NextResponse.json({
                error: 'sessionId is required'
            }, { status: 400 });
        }

        const chatHistory = await getChatHistory(sessionId, 20);

        return NextResponse.json({
            success: true,
            messages: chatHistory,
            sessionId: sessionId
        });

    } catch (error) {
        console.error('[Chat API] Error fetching chat history:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to fetch chat history'
        }, { status: 500 });
    }
}

// DELETE - Clear chat history
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get('sessionId');

        if (!sessionId) {
            return NextResponse.json({
                error: 'sessionId is required'
            }, { status: 400 });
        }

        // Get all message keys
        const messagesListKey = `chat:messages:${sessionId}`;
        const messageKeys = await kv.lrange(messagesListKey, 0, -1);

        // Delete all messages
        if (messageKeys.length > 0) {
            const deletePromises = messageKeys.map(key => kv.del(key));
            await Promise.all(deletePromises);
        }

        // Clear message list
        await kv.del(messagesListKey);

        console.log(`[Chat API] Chat history cleared for session: ${sessionId}`);

        return NextResponse.json({
            success: true,
            message: 'Chat history cleared successfully'
        });

    } catch (error) {
        console.error('[Chat API] Error clearing chat history:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to clear chat history'
        }, { status: 500 });
    }
}
