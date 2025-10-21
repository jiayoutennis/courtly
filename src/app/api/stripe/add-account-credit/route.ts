import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover' as any,
});

/**
 * Create a Stripe Checkout session for adding funds to account balance
 * POST /api/stripe/add-account-credit
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, clubId, amount, successUrl, cancelUrl } = await request.json();

    if (!userId || !clubId || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (amount < 1000) { // Minimum $10
      return NextResponse.json(
        { error: 'Minimum credit amount is $10.00' },
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
      return NextResponse.json(
        { error: 'Club has not connected Stripe account yet' },
        { status: 400 }
      );
    }

    // Check if Stripe account is active
    const stripeConnectStatus = clubData?.stripeConnectStatus;
    if (stripeConnectStatus !== 'active') {
      return NextResponse.json(
        { error: 'Club Stripe account is not fully set up' },
        { status: 400 }
      );
    }

    // Get user's email for receipt
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userEmail = userDoc.exists ? userDoc.data()?.email : undefined;

    // Calculate application fee (platform fee - e.g., 2.9% + 30¢ to cover Stripe fees)
    // This goes to your platform account
    const platformFeePercent = clubData?.platformFeePercent || 0;
    const applicationFee = Math.round(amount * (platformFeePercent / 100));

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Account Balance Credit',
              description: `Add $${(amount / 100).toFixed(2)} to your ${clubData.name || 'club'} account`,
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl || `${process.env.NEXT_PUBLIC_APP_URL}/club/${clubId}/dashboard?payment=success`,
      cancel_url: cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL}/club/${clubId}/dashboard?payment=canceled`,
      customer_email: userEmail,
      metadata: {
        type: 'account_credit',
        userId: userId,
        clubId: clubId,
        amount: amount.toString(),
      },
      payment_intent_data: {
        application_fee_amount: applicationFee,
        transfer_data: {
          destination: stripeAccountId,
        },
        metadata: {
          type: 'account_credit',
          userId: userId,
          clubId: clubId,
        },
      },
    });

    console.log('Created checkout session for account credit:', {
      sessionId: session.id,
      amount: amount,
      clubId: clubId,
      userId: userId,
      stripeAccountId: stripeAccountId,
      applicationFee: applicationFee,
    });

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });

  } catch (error: any) {
    console.error('Error creating account credit checkout session:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
