import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover' as any,
});

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

    // Get club's Stripe account ID
    const clubDoc = await adminDb.collection('orgs').doc(clubId).get();
    if (!clubDoc.exists) {
      return NextResponse.json(
        { error: 'Club not found' },
        { status: 404 }
      );
    }

    const clubData = clubDoc.data();
    const stripeAccountId = clubData?.stripeAccountId;

    if (!stripeAccountId) {
      return NextResponse.json({
        connected: false,
        status: 'not_created',
        message: 'Stripe account not created yet',
      });
    }

    // Retrieve account details from Stripe
    const account = await stripe.accounts.retrieve(stripeAccountId);

    const isFullyOnboarded = account.details_submitted && 
                             account.charges_enabled && 
                             account.payouts_enabled;

    // Update club document with current status
    await adminDb.collection('orgs').doc(clubId).update({
      stripeConnectStatus: isFullyOnboarded ? 'active' : 'pending',
      stripeChargesEnabled: account.charges_enabled,
      stripePayoutsEnabled: account.payouts_enabled,
      updatedAt: new Date(),
    });

    return NextResponse.json({
      connected: isFullyOnboarded,
      status: isFullyOnboarded ? 'active' : 'pending',
      stripeAccountId: stripeAccountId,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      requiresAction: !isFullyOnboarded,
      email: account.email,
      country: account.country,
    });

  } catch (error: any) {
    console.error('Error checking Stripe Connect account status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check account status' },
      { status: 500 }
    );
  }
}
