import { NextRequest, NextResponse } from 'next/server';
import {
  getUserLooks,
  saveLookToDB,
  deleteLook,
  clearUserLooks,
  migrateLooksFromLocalStorage,
  dbLookToPastLook,
  type PastLook
} from '@/lib/database';

// GET /api/looks - Get all of a user's looks
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'default';
    const limit = parseInt(searchParams.get('limit') || '50');

    const dbLooks = await getUserLooks(userId, limit);

    // Convert to PastLook format for compatibility
    const pastLooks = dbLooks.map(dbLookToPastLook);

    return NextResponse.json({
      success: true,
      looks: pastLooks,
      count: pastLooks.length
    });
  } catch (error) {
    console.error('Error fetching looks:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch looks' },
      { status: 500 }
    );
  }
}

// POST /api/looks - Save a new look
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { look, userId = 'default' } = body;

    if (!look || !look.id) {
      return NextResponse.json(
        { success: false, error: 'Invalid look data' },
        { status: 400 }
      );
    }

    await saveLookToDB(look as PastLook, userId);

    return NextResponse.json({
      success: true,
      message: 'Look saved successfully'
    });
  } catch (error) {
    console.error('Error saving look:', error);

    // Check if it's a blob storage conflict error
    if (error instanceof Error && error.message.includes('blob already exists')) {
      console.log('Blob conflict detected, but this is expected for duplicate saves');
      return NextResponse.json({
        success: true,
        message: 'Look already exists, no action needed'
      });
    }

    // Check if it's a duplicate look error
    if (error instanceof Error && error.message.includes('already exists')) {
      return NextResponse.json({
        success: true,
        message: 'Look already exists in database'
      });
    }

    return NextResponse.json(
      { success: false, error: 'Failed to save look' },
      { status: 500 }
    );
  }
}

// DELETE /api/looks - Delete look(s)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lookId = searchParams.get('lookId');
    const userId = searchParams.get('userId') || 'default';
    const clearAll = searchParams.get('clearAll') === 'true';

    if (clearAll) {
      await clearUserLooks(userId);
      return NextResponse.json({
        success: true,
        message: 'All looks cleared successfully'
      });
    } else if (lookId) {
      await deleteLook(lookId, userId);
      return NextResponse.json({
        success: true,
        message: 'Look deleted successfully'
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'lookId or clearAll parameter required' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error deleting look(s):', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete look(s)' },
      { status: 500 }
    );
  }
}
