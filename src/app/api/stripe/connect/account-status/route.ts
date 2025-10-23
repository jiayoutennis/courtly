import { NextRequest, NextResponse } from 'next/server';

// Note: This API route has been simplified to work without Firebase Admin SDK
// Full functionality will be restored when Firebase service account credentials are set up

/**
 * Check Stripe Connect Account Status
 * GET /api/stripe/connect/account-status?clubId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clubId = searchParams.get('clubId');

    if (!clubId) {
      return NextResponse.json(
        { error: 'Missing clubId' },
        { status: 400 }
      );
    }

    // For now, return a default status since we don't have Firebase Admin SDK
    // This will be fixed when Firebase service account credentials are set up
    return NextResponse.json({
      connected: false,
      status: 'not_created',
      message: 'Stripe Connect setup required',
      requiresAction: true,
    });

  } catch (error: any) {
    console.error('Error checking Stripe Connect account status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check account status' },
      { status: 500 }
    );
  }
}
