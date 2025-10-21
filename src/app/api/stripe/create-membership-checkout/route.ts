import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

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

    // Verify user authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      );
    }

    // Ensure the userId matches the authenticated user
    if (decodedToken.uid !== userId) {
      return NextResponse.json(
        { error: 'User ID mismatch' },
        { status: 403 }
      );
    }

    // Get or create Stripe customer
    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    let stripeCustomerId = userData?.stripeCustomerId;

    // Create Stripe customer if doesn't exist
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: userData?.email || decodedToken.email,
        metadata: {
          userId: userId,
          clubId: clubId,
        },
      });
      stripeCustomerId = customer.id;
      
      // Save customer ID to Firestore
      await userRef.update({
        stripeCustomerId: customer.id,
      });
    }

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
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/club/${clubId}?membership=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/club/${clubId}?membership=canceled`,
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

    const session = await stripe.checkout.sessions.create(sessionConfig);

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
