import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { OnboardingData } from '@/lib/onboarding-storage';
import { getOnboardingDataFromDB, saveOnboardingDataToDB } from '@/lib/database';

// POST /api/user/profile - 保存用户profile
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized - User not authenticated' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const body = await request.json();
    
    if (!body.onboardingData) {
      return NextResponse.json(
        { error: 'Missing onboardingData in request body' },
        { status: 400 }
      );
    }

    const onboardingData: OnboardingData = body.onboardingData;

    await saveOnboardingDataToDB(userId,JSON.stringify(onboardingData) );

    return NextResponse.json({ 
      success: true, 
      message: 'User profile saved successfully' 
    });

  } catch (error) {
    console.error('Error saving user profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/user/profile - 获取用户profile
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized - User not authenticated' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const onboardingData = await getOnboardingDataFromDB(userId);

    if (onboardingData == null) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ onboardingData });

  } catch (error) {
    console.error('Error fetching user onboardingData:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
