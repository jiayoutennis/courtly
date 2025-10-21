import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover' as any,
});

/**
 * Create a Setup Intent for saving payment method
 * POST /api/stripe/create-setup-intent
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, clubId } = await request.json();

    if (!userId || !clubId) {
      return NextResponse.json(
        { error: 'Missing userId or clubId' },
        { status: 400 }
      );
    }

    // Get or create Stripe customer for this user
    const userDoc = await adminDb.collection('users').doc(userId).get();
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
        email: userData?.email,
        name: userData?.name,
        metadata: {
          userId: userId,
        },
      });

      stripeCustomerId = customer.id;

      // Save customer ID to user document
      await adminDb.collection('users').doc(userId).update({
        stripeCustomerId: stripeCustomerId,
        updatedAt: new Date(),
      });

      console.log('Created Stripe customer:', stripeCustomerId);
    }

    // Create Setup Intent
    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      metadata: {
        userId: userId,
        clubId: clubId,
      },
    });

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
      customerId: stripeCustomerId,
    });

  } catch (error: any) {
    console.error('Error creating setup intent:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create setup intent' },
      { status: 500 }
    );
  }
}
