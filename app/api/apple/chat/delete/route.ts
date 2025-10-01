import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

/**
 * Request body interface for batch delete operation
 */
interface BatchDeleteRequest {
    sessionIds: string[];
}

/**
 * Response interface for batch delete operation
 */
interface BatchDeleteResponse {
    success: boolean;
    totalRequested: number;
    successCount: number;
    failureCount: number;
    details: DeleteDetail[];
    error?: string;
}

/**
 * Individual deletion detail
 */
interface DeleteDetail {
    sessionId: string;
    success: boolean;
    messagesDeleted: number;
    error?: string;
}

/**
 * Delete chat history for a single session
 */
async function deleteChatSession(sessionId: string): Promise<DeleteDetail> {
    try {
        const messagesListKey = `chat:messages:${sessionId}`;
        const messageKeys = await kv.lrange(messagesListKey, 0, -1);

        // Delete all messages
        if (messageKeys.length > 0) {
            const deletePromises = messageKeys.map(key => kv.del(key));
            await Promise.all(deletePromises);
        }

        // Clear message list
        await kv.del(messagesListKey);

        console.log(`[Batch Delete API] Chat history cleared for session: ${sessionId}, messages deleted: ${messageKeys.length}`);

        return {
            sessionId,
            success: true,
            messagesDeleted: messageKeys.length
        };
    } catch (error) {
        console.error(`[Batch Delete API] Error deleting session ${sessionId}:`, error);
        return {
            sessionId,
            success: false,
            messagesDeleted: 0,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * POST - Batch delete chat history for multiple sessions
 */
export async function POST(request: NextRequest): Promise<NextResponse<BatchDeleteResponse>> {
    try {
        const body: BatchDeleteRequest = await request.json();
        const { sessionIds } = body;

        // Validate input
        if (!sessionIds || !Array.isArray(sessionIds)) {
            return NextResponse.json({
                success: false,
                totalRequested: 0,
                successCount: 0,
                failureCount: 0,
                details: [],
                error: 'sessionIds must be a non-empty array'
            }, { status: 200 });
        }

        if (sessionIds.length === 0) {
            return NextResponse.json({
                success: false,
                totalRequested: 0,
                successCount: 0,
                failureCount: 0,
                details: [],
                error: 'sessionIds array cannot be empty'
            }, { status: 200 });
        }


        console.log(`[Batch Delete API] Processing batch delete for ${sessionIds.length} sessions`);

        // Delete all sessions in parallel
        const deletePromises = sessionIds.map(sessionId => deleteChatSession(sessionId));
        const results = await Promise.all(deletePromises);

        // Calculate statistics
        const successCount = results.filter(r => r.success).length;
        const failureCount = results.filter(r => !r.success).length;
        const totalMessagesDeleted = results.reduce((sum, r) => sum + r.messagesDeleted, 0);

        console.log(`[Batch Delete API] Batch delete completed: ${successCount} succeeded, ${failureCount} failed, ${totalMessagesDeleted} messages deleted`);

        return NextResponse.json({
            success: failureCount === 0,
            totalRequested: sessionIds.length,
            successCount,
            failureCount,
            details: results
        });

    } catch (error) {
        console.error('[Batch Delete API] Error processing batch delete request:', error);
        return NextResponse.json({
            success: false,
            totalRequested: 0,
            successCount: 0,
            failureCount: 0,
            details: [],
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        }, { status: 500 });
    }
}

/**
 * DELETE - Delete all chat sessions (use with caution)
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
    try {
        const { searchParams } = new URL(request.url);
        const confirmDelete = searchParams.get('confirm');

        // Require explicit confirmation
        if (confirmDelete !== 'true') {
            return NextResponse.json({
                success: false,
                error: 'Confirmation required. Add ?confirm=true to delete all sessions'
            }, { status: 400 });
        }

        console.log('[Batch Delete API] WARNING: Deleting all chat sessions');

        // Get all chat message list keys
        const pattern = 'chat:messages:*';
        let cursor: string | number = 0;
        const sessionKeys: string[] = [];

        // Scan for all chat session keys
        do {
            const result = await kv.scan(cursor, { match: pattern, count: 100 }) as [string | number, string[]];
            cursor = result[0];
            sessionKeys.push(...result[1]);
        } while (cursor !== 0);

        console.log(`[Batch Delete API] Found ${sessionKeys.length} chat sessions to delete`);

        let totalDeleted = 0;

        // Delete each session
        for (const sessionKey of sessionKeys) {
            const messageKeys = await kv.lrange(sessionKey, 0, -1);
            
            if (messageKeys.length > 0) {
                await Promise.all(messageKeys.map(key => kv.del(key)));
                totalDeleted += messageKeys.length;
            }
            
            await kv.del(sessionKey);
        }

        console.log(`[Batch Delete API] Deleted ${sessionKeys.length} sessions and ${totalDeleted} messages`);

        return NextResponse.json({
            success: true,
            message: 'All chat sessions deleted successfully',
            sessionsDeleted: sessionKeys.length,
            messagesDeleted: totalDeleted
        });

    } catch (error) {
        console.error('[Batch Delete API] Error deleting all sessions:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to delete all sessions',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

