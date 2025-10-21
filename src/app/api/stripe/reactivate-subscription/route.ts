import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb, adminAuth } from '@/lib/firebase-admin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover' as any,
});

export async function POST(request: NextRequest) {
  try {
    const { clubId } = await request.json();

    if (!clubId) {
      return NextResponse.json(
        { error: 'Club ID is required' },
        { status: 400 }
      );
    }

    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized - No token provided' },
        { status: 401 }
      );
    }

    const token = authHeader.split('Bearer ')[1];
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token format' },
        { status: 401 }
      );
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (error) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      );
    }

    const userId = decodedToken.uid;

    // Get the org document to find the subscription ID
    const orgRef = adminDb.collection('orgs').doc(clubId);
    const orgDoc = await orgRef.get();

    if (!orgDoc.exists) {
      return NextResponse.json(
        { error: 'Club not found' },
        { status: 404 }
      );
    }

    const orgData = orgDoc.data();

    // Check if user is the owner of this organization
    const staff = orgData?.staff || [];
    const userStaffRecord = staff.find((s: any) => s.userId === userId);
    
    if (!userStaffRecord || userStaffRecord.role !== 'owner') {
      return NextResponse.json(
        { error: 'Forbidden - Only the club owner can manage subscriptions' },
        { status: 403 }
      );
    }
    const subscriptionId = orgData?.subscription?.stripeSubscriptionId;

    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'No subscription found' },
        { status: 400 }
      );
    }

    // Reactivate the subscription by setting cancel_at_period_end to false
    const reactivatedSubscription = await stripe.subscriptions.update(
      subscriptionId,
      {
        cancel_at_period_end: false,
      }
    );

    console.log(`✅ Subscription ${subscriptionId} reactivated, will continue after current period`);

    return NextResponse.json({
      success: true,
      message: 'Subscription reactivated successfully',
      subscription: {
        id: reactivatedSubscription.id,
        status: reactivatedSubscription.status,
        currentPeriodEnd: reactivatedSubscription.current_period_end,
        cancelAtPeriodEnd: reactivatedSubscription.cancel_at_period_end,
      },
    });
  } catch (error) {
    console.error('Error reactivating subscription:', error);
    return NextResponse.json(
      {
        error: 'Failed to reactivate subscription',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
