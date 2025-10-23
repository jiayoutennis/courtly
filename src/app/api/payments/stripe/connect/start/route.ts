import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover' as any,
});

/**
 * Create or fetch Stripe Express account for club
 * POST /api/payments/stripe/connect/start
 */
export async function POST(request: NextRequest) {
  try {
    const { clubId } = await request.json();

    if (!clubId) {
      return NextResponse.json(
        { error: 'Missing clubId' },
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
    
    // Check if user is club admin
    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    if (userData?.userType !== 'admin' || userData?.clubId !== clubId) {
      return NextResponse.json(
        { error: 'Unauthorized: Must be club admin' },
        { status: 403 }
      );
    }

    // Get or create club document
    const clubRef = adminDb.collection('orgs').doc(clubId);
    const clubDoc = await clubRef.get();
    
    if (!clubDoc.exists) {
      return NextResponse.json(
        { error: 'Club not found' },
        { status: 404 }
      );
    }

    const clubData = clubDoc.data();
    let stripeAccountId = clubData?.stripeAccountId;

    // If no existing account, create a new Express account
    if (!stripeAccountId) {
      console.log('Creating new Stripe Express account for club:', clubId);
      
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'US',
        email: decodedToken.email,
        metadata: {
          clubId: clubId,
          clubName: clubData?.name || '',
          userId: decodedToken.uid,
        },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });

      stripeAccountId = account.id;
      console.log('Created Stripe Express account:', stripeAccountId);

      // Update club document with new account ID
      await clubRef.update({
        stripeAccountId: stripeAccountId,
        stripeStatus: 'onboarding',
        stripeOnboardingComplete: false,
        payoutsEnabled: false,
        chargesEnabled: false,
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      console.log('Using existing Stripe account:', stripeAccountId);
    }

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/club/${clubId}/stripe-setup?refresh=1`,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/club/${clubId}/stripe-setup?connected=1`,
      type: 'account_onboarding',
    });

    console.log('Created account link:', accountLink.url);

    return NextResponse.json({
      url: accountLink.url,
      stripeAccountId: stripeAccountId,
    });

  } catch (error: any) {
    console.error('Error creating Stripe Connect account link:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create account link' },
      { status: 500 }
    );
  }
}
