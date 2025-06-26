import { NextRequest, NextResponse } from 'next/server';
import { migrateLooksFromLocalStorage, type PastLook } from '@/lib/database';

// POST /api/looks/migrate - Migrate data from localStorage to the database
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { looks, userId = 'default' } = body;

    if (!looks || !Array.isArray(looks)) {
      return NextResponse.json(
        { success: false, error: 'Invalid looks data' },
        { status: 400 }
      );
    }

    console.log(`Starting migration of ${looks.length} looks for user ${userId}`);

    let successCount = 0;
    let failureCount = 0;
    const errors: string[] = [];

    // Migrate each look one by one
    for (const look of looks as PastLook[]) {
      try {
        const { saveLookToDB } = await import('@/lib/database');
        await saveLookToDB(look, userId);
        successCount++;
        console.log(`Successfully migrated look: ${look.id}`);
      } catch (error) {
        failureCount++;
        const errorMessage = `Failed to migrate look ${look.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMessage);
        errors.push(errorMessage);
      }
    }

    const result = {
      success: successCount > 0,
      message: `Migration completed. ${successCount} successful, ${failureCount} failed.`,
      successCount,
      failureCount,
      errors: errors.length > 0 ? errors : undefined
    };

    console.log('Migration result:', result);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Migration failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
