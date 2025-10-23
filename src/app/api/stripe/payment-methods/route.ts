import { NextRequest, NextResponse } from 'next/server';

// Note: This API route has been simplified to work without Firebase Admin SDK
// Full functionality will be restored when Firebase service account credentials are set up

/**
 * Get user's saved payment methods
 * GET /api/stripe/payment-methods?userId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId' },
        { status: 400 }
      );
    }

    // For now, return empty payment methods since we don't have Firebase Admin SDK
    // This will be fixed when Firebase service account credentials are set up
    return NextResponse.json({
      paymentMethods: [],
      defaultPaymentMethod: null,
    });

  } catch (error: any) {
    console.error('Error fetching payment methods:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch payment methods' },
      { status: 500 }
    );
  }
}

/**
 * Delete a payment method
 * DELETE /api/stripe/payment-methods
 */
export async function DELETE(request: NextRequest) {
  try {
    const { paymentMethodId, userId } = await request.json();

    if (!paymentMethodId || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // For now, return success since we don't have Firebase Admin SDK
    // This will be fixed when Firebase service account credentials are set up
    return NextResponse.json({
      success: true,
      message: 'Payment method removed (simulated)',
    });

  } catch (error: any) {
    console.error('Error deleting payment method:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete payment method' },
      { status: 500 }
    );
  }
}

/**
 * Set default payment method
 * PATCH /api/stripe/payment-methods
 */
export async function PATCH(request: NextRequest) {
  try {
    const { paymentMethodId, userId } = await request.json();

    if (!paymentMethodId || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // For now, return success since we don't have Firebase Admin SDK
    // This will be fixed when Firebase service account credentials are set up
    return NextResponse.json({
      success: true,
      message: 'Default payment method updated (simulated)',
    });

  } catch (error: any) {
    console.error('Error setting default payment method:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to set default payment method' },
      { status: 500 }
    );
  }
}
