import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover' as any,
});

/**
 * Charge a user's saved payment method for court booking or balance top-up
 * POST /api/stripe/charge-payment-method
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, clubId, amount, description, metadata } = await request.json();

    if (!userId || !clubId || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (amount < 50) { // Minimum $0.50
      return NextResponse.json(
        { error: 'Minimum charge amount is $0.50' },
        { status: 400 }
      );
    }

    // Get user's Stripe customer ID and default payment method
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    const stripeCustomerId = userData?.stripeCustomerId;

    if (!stripeCustomerId) {
      return NextResponse.json(
        { error: 'No payment method on file. Please add a payment method first.' },
        { status: 400 }
      );
    }

    // Get customer's default payment method
    let customer;
    try {
      customer = await stripe.customers.retrieve(stripeCustomerId);
    } catch (stripeError: any) {
      // If customer doesn't exist in Stripe, clear the invalid customer ID
      if (stripeError.type === 'StripeInvalidRequestError' && 
          stripeError.code === 'resource_missing') {
        await adminDb.collection('users').doc(userId).update({
          stripeCustomerId: null,
        });
        return NextResponse.json(
          { error: 'Customer account not found. Please add a payment method.' },
          { status: 404 }
        );
      }
      throw stripeError;
    }

    if (customer.deleted) {
      await adminDb.collection('users').doc(userId).update({
        stripeCustomerId: null,
      });
      return NextResponse.json(
        { error: 'Customer account not found. Please add a payment method.' },
        { status: 404 }
      );
    }

    const defaultPaymentMethod = customer.invoice_settings?.default_payment_method;
    if (!defaultPaymentMethod) {
      return NextResponse.json(
        { error: 'No default payment method set. Please add a payment method.' },
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

    // Calculate application fee (platform fee)
    const platformFeePercent = clubData?.platformFeePercent || 0;
    const applicationFee = Math.round(amount * (platformFeePercent / 100));

    // Create payment intent with destination charge
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'usd',
      customer: stripeCustomerId,
      payment_method: defaultPaymentMethod as string,
      off_session: true, // Charge without customer present
      confirm: true, // Immediately confirm the payment
      description: description || 'Court booking charge',
      metadata: {
        userId: userId,
        clubId: clubId,
        ...metadata,
      },
      application_fee_amount: applicationFee,
      transfer_data: {
        destination: stripeAccountId,
      },
    });

    console.log('Payment intent created:', {
      paymentIntentId: paymentIntent.id,
      amount: amount,
      status: paymentIntent.status,
    });

    // If payment succeeded, update account balance
    if (paymentIntent.status === 'succeeded') {
      const balanceRef = adminDb
        .collection('users')
        .doc(userId)
        .collection('accountBalances')
        .doc(clubId);
      
      const balanceDoc = await balanceRef.get();
      const currentBalance = balanceDoc.exists ? (balanceDoc.data()?.balance || 0) : 0;
      const newBalance = currentBalance + amount;

      await balanceRef.set(
        {
          balance: newBalance,
          clubId: clubId,
          userId: userId,
          currency: 'usd',
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // Create transaction record
      const transactionRef = balanceRef.collection('transactions').doc();
      await transactionRef.set({
        type: 'credit',
        amount: amount,
        description: description || 'Automatic charge for court booking',
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
        stripePaymentIntentId: paymentIntent.id,
        paymentMethod: 'card',
        createdAt: FieldValue.serverTimestamp(),
      });

      console.log(`✅ Charged ${amount} cents to user ${userId} for club ${clubId}`);
    }

    return NextResponse.json({
      success: paymentIntent.status === 'succeeded',
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      amount: amount,
    });

  } catch (error: any) {
    console.error('Error charging payment method:', error);
    
    // Handle specific Stripe errors
    if (error.type === 'StripeCardError') {
      return NextResponse.json(
        { error: `Payment failed: ${error.message}` },
        { status: 402 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to charge payment method' },
      { status: 500 }
    );
  }
}
