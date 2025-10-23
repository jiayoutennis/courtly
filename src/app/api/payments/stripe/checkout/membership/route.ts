import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover' as any,
});

const PLATFORM_FEE_BASIS_POINTS = parseInt(process.env.PLATFORM_FEE_BASIS_POINTS || '300'); // 3%

/**
 * Create Checkout Session for Membership Payment
 * POST /api/payments/stripe/checkout/membership
 */
export async function POST(request: NextRequest) {
  try {
    const { clubId, planId } = await request.json();

    if (!clubId || !planId) {
      return NextResponse.json(
        { error: 'Missing clubId or planId' },
        { status: 400 }
      );
    }

    // Verify Firebase ID token
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const idToken = authHeader.split('Bearer ')[1];
    if (!idToken) {
      return NextResponse.json(
        { error: 'Invalid authorization header format' },
        { status: 401 }
      );
    }
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    // Get club data
    const clubRef = adminDb.collection('orgs').doc(clubId);
    const clubDoc = await clubRef.get();
    
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
        { error: 'Club has no connected Stripe account' },
        { status: 400 }
      );
    }

    if (!clubData?.chargesEnabled) {
      return NextResponse.json(
        { error: 'Club cannot accept payments yet' },
        { status: 400 }
      );
    }

    // Find membership plan
    const membershipPlans = clubData.membershipPlans || [];
    const plan = membershipPlans.find((p: any) => p.id === planId);

    if (!plan) {
      return NextResponse.json(
        { error: 'Membership plan not found' },
        { status: 404 }
      );
    }

    if (!plan.active) {
      return NextResponse.json(
        { error: 'Membership plan is not active' },
        { status: 400 }
      );
    }

    let session;

    if (plan.interval === 'one_time') {
      // One-time payment
      const platformFee = Math.round((plan.priceCents * PLATFORM_FEE_BASIS_POINTS) / 10000);

      session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: clubData.currency || 'usd',
              product_data: {
                name: plan.name,
                description: `One-time membership payment`,
              },
              unit_amount: plan.priceCents,
            },
            quantity: 1,
          },
        ],
        payment_intent_data: {
          application_fee_amount: platformFee,
          transfer_data: {
            destination: stripeAccountId,
          },
          metadata: {
            clubId: clubId,
            planId: planId,
            userId: decodedToken.uid,
          },
        },
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/club/${clubId}/membership?success=1`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/club/${clubId}/membership?canceled=1`,
        metadata: {
          clubId: clubId,
          planId: planId,
          userId: decodedToken.uid,
        },
      });
    } else {
      // Recurring subscription
      let stripePriceId = plan.stripePriceId;

      // If no Stripe price exists, create one
      if (!stripePriceId) {
        // Create product in connected account
        const product = await stripe.products.create({
          name: plan.name,
          description: `Monthly membership for ${clubData.name}`,
          metadata: {
            clubId: clubId,
            planId: planId,
          },
        }, {
          stripeAccount: stripeAccountId,
        });

        // Create price in connected account
        const price = await stripe.prices.create({
          product: product.id,
          unit_amount: plan.priceCents,
          currency: clubData.currency || 'usd',
          recurring: {
            interval: plan.interval === 'month' ? 'month' : 'year',
          },
          metadata: {
            clubId: clubId,
            planId: planId,
          },
        }, {
          stripeAccount: stripeAccountId,
        });

        stripePriceId = price.id;

        // Update plan with price ID
        const updatedPlans = membershipPlans.map((p: any) => 
          p.id === planId ? { ...p, stripePriceId: stripePriceId } : p
        );
        
        await clubRef.update({
          membershipPlans: updatedPlans,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      // Create subscription in connected account
      session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [
          {
            price: stripePriceId,
            quantity: 1,
          },
        ],
        subscription_data: {
          application_fee_percent: PLATFORM_FEE_BASIS_POINTS / 100,
          transfer_data: {
            destination: stripeAccountId,
          },
          metadata: {
            clubId: clubId,
            planId: planId,
            userId: decodedToken.uid,
          },
        },
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/club/${clubId}/membership?success=1`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/club/${clubId}/membership?canceled=1`,
        metadata: {
          clubId: clubId,
          planId: planId,
          userId: decodedToken.uid,
        },
      }, {
        stripeAccount: stripeAccountId,
      });
    }

    // Create membership subscription record
    const subscriptionRef = adminDb.collection('membershipSubscriptions').doc();
    await subscriptionRef.set({
      clubId: clubId,
      userId: decodedToken.uid,
      planId: planId,
      status: 'incomplete',
      priceCents: plan.priceCents,
      interval: plan.interval,
      currency: clubData.currency || 'usd',
      checkoutSessionId: session.id,
      paymentStatus: 'requires_payment',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log('Created checkout session for membership:', planId);

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });

  } catch (error: any) {
    console.error('Error creating membership checkout session:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
