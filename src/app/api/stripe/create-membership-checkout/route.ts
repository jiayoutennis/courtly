import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/server';
import { adminDb } from '@/lib/firebase-admin';

/**
 * POST /api/stripe/create-membership-checkout
 * Creates a Stripe checkout session for club membership purchase
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      clubId, 
      clubName,
      membershipPlan, // { id, name, tier, price, stripePriceId, features }
      userId 
    } = body;

    // Validate required fields
    if (!clubId || !membershipPlan || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!membershipPlan.stripePriceId) {
      return NextResponse.json(
        { error: 'Invalid membership plan: missing stripePriceId' },
        { status: 400 }
      );
    }

    // Get club data to access Stripe Connect account
    const clubDoc = await adminDb.collection('orgs').doc(clubId).get();
    if (!clubDoc.exists) {
      return NextResponse.json(
        { error: 'Club not found' },
        { status: 404 }
      );
    }

    const clubData = clubDoc.data();
    if (!clubData) {
      return NextResponse.json(
        { error: 'Club data not found' },
        { status: 404 }
      );
    }

    const stripeAccountId = clubData.stripeAccountId;
    if (!stripeAccountId) {
      return NextResponse.json(
        { error: 'Club must complete Stripe Connect setup first' },
        { status: 400 }
      );
    }

    // Create Stripe customer on club's account
    const customer = await stripe.customers.create({
      metadata: {
        userId: userId,
        clubId: clubId,
      },
    }, {
      stripeAccount: stripeAccountId,
    });
    const stripeCustomerId = customer.id;

    // Determine if this is a recurring membership or one-time
    const isRecurring = membershipPlan.tier === 'monthly' || membershipPlan.tier === 'annual';
    const mode = isRecurring ? 'subscription' : 'payment';

    // Create checkout session
    const sessionConfig: any = {
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: membershipPlan.stripePriceId,
          quantity: 1,
        },
      ],
      mode: mode,
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/club/${clubId}/membership?membership=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/club/${clubId}/membership?membership=canceled`,
      metadata: {
        type: 'membership',
        userId: userId,
        clubId: clubId,
        clubName: clubName || '',
        membershipPlanId: membershipPlan.id,
        membershipTier: membershipPlan.tier,
      },
    };

    // For subscriptions, add subscription_data
    if (isRecurring) {
      sessionConfig.subscription_data = {
        metadata: {
          userId: userId,
          clubId: clubId,
          membershipPlanId: membershipPlan.id,
          membershipTier: membershipPlan.tier,
        },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionConfig, {
      stripeAccount: stripeAccountId,
    });

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
