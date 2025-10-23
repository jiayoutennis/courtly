import { NextRequest, NextResponse } from 'next/server';

// Note: This API route has been simplified to work without Firebase Admin SDK
// Full functionality will be restored when Firebase service account credentials are set up

/**
 * Create a Setup Intent for saving payment method
 * POST /api/stripe/create-setup-intent
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId' },
        { status: 400 }
      );
    }

    // For now, return an error since we don't have Firebase Admin SDK
    // This will be fixed when Firebase service account credentials are set up
    return NextResponse.json(
      { error: 'Setup intent creation requires Firebase Admin SDK setup' },
      { status: 503 }
    );

  } catch (error: any) {
    console.error('Error creating setup intent:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create setup intent' },
      { status: 500 }
    );
  }
}
