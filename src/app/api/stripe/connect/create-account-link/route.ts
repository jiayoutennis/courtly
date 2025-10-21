import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover' as any,
});

/**
 * Create a Stripe Connect Account Link for club onboarding
 * POST /api/stripe/connect/create-account-link
 */
export async function POST(request: NextRequest) {
  try {
    const { clubId, userId } = await request.json();

    if (!clubId || !userId) {
      return NextResponse.json(
        { error: 'Missing clubId or userId' },
        { status: 400 }
      );
    }

    // Verify user is club owner
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
    
    const staff = clubData.staff || [];
    const userStaffRecord = staff.find((s: any) => s.userId === userId);

    if (!userStaffRecord || userStaffRecord.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only club owners can set up Stripe Connect' },
        { status: 403 }
      );
    }

    let stripeAccountId = clubData.stripeAccountId;

    // Create Stripe Connect account if it doesn't exist
    if (!stripeAccountId) {
      console.log('Creating new Stripe Connect account for club:', clubId);
      
      const account = await stripe.accounts.create({
        type: 'standard', // 'standard' gives clubs full control of their Stripe dashboard
        country: 'US',
        email: userStaffRecord.email || undefined,
        metadata: {
          clubId: clubId,
          clubName: clubData.name || '',
        },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });

      stripeAccountId = account.id;

      // Save the Stripe account ID to the club document
      await adminDb.collection('orgs').doc(clubId).update({
        stripeAccountId: stripeAccountId,
        stripeConnectStatus: 'pending',
        updatedAt: new Date(),
      });

      console.log('Created Stripe Connect account:', stripeAccountId);
    }

    // Create an account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/club/${clubId}/stripe-setup?refresh=true`,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/club/${clubId}/stripe-setup?success=true`,
      type: 'account_onboarding',
    });

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
