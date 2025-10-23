import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover' as any,
});

/**
 * Create a Stripe Connect Account Link for club onboarding
 * POST /api/stripe/connect/create-account-link
 */
export async function POST(request: NextRequest) {
  try {
    const { clubId, userId, clubName, userEmail } = await request.json();
    
    console.log('Received request:', { clubId, userId, clubName, userEmail });

    if (!clubId || !userId) {
      console.log('Missing required fields');
      return NextResponse.json(
        { error: 'Missing clubId or userId' },
        { status: 400 }
      );
    }

    // Check if user already has a Stripe account with Connect enabled
    // If not, redirect to Connect signup
    console.log('Checking Stripe Connect status for club:', clubId);
    
    try {
      // Try to create a Connect account - this will fail if Connect is not enabled
      const account = await stripe.accounts.create({
        type: 'express', // Express accounts are easier to set up
        country: 'US',
        email: userEmail || undefined,
        metadata: {
          clubId: clubId,
          clubName: clubName || '',
          userId: userId,
        },
      });

      const stripeAccountId = account.id;
      console.log('Created Stripe Connect account:', stripeAccountId);

      // Create an account link for onboarding
      console.log('Creating account link...');
      const accountLink = await stripe.accountLinks.create({
        account: stripeAccountId,
        refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/club/${clubId}/stripe-setup?refresh=true`,
        return_url: `${process.env.NEXT_PUBLIC_APP_URL}/club/${clubId}/stripe-setup?success=true`,
        type: 'account_onboarding',
      });

      console.log('Created account link:', accountLink.url);

      return NextResponse.json({
        url: accountLink.url,
        stripeAccountId: stripeAccountId,
      });

    } catch (stripeError: any) {
      console.log('Stripe Connect not enabled, redirecting to signup:', stripeError.message);
      
      // If Connect is not enabled, redirect to Connect signup
      const connectSignupUrl = 'https://stripe.com/docs/connect';
      
      return NextResponse.json({
        url: connectSignupUrl,
        stripeAccountId: null,
        message: 'Please sign up for Stripe Connect first, then return to complete the connection.'
      });
    }

  } catch (error: any) {
    console.error('Error creating Stripe Connect account link:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create account link' },
      { status: 500 }
    );
  }
}
