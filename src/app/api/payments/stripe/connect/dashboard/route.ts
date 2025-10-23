import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb, adminAuth } from '@/lib/firebase-admin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover' as any,
});

/**
 * Generate Stripe Express Dashboard login link for club
 * POST /api/payments/stripe/connect/dashboard
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

    // Get club document
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

    // Create login link for Express dashboard
    const loginLink = await stripe.accounts.createLoginLink(stripeAccountId);

    console.log('Created login link for account:', stripeAccountId);

    return NextResponse.json({
      url: loginLink.url,
    });

  } catch (error: any) {
    console.error('Error creating Stripe dashboard login link:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create dashboard link' },
      { status: 500 }
    );
  }
}
