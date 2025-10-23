import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover' as any,
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

/**
 * Stripe Webhook Handler
 * POST /api/payments/stripe/webhook
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      console.error('Missing stripe-signature header');
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    // Check if we've already processed this event
    const eventId = event.id;
    const eventDoc = await adminDb.collection('stripeWebhookEvents').doc(eventId).get();
    
    if (eventDoc.exists) {
      console.log('Event already processed:', eventId);
      return NextResponse.json({ received: true });
    }

    // Store event to prevent duplicate processing
    await adminDb.collection('stripeWebhookEvents').doc(eventId).set({
      eventId: eventId,
      type: event.type,
      processed: true,
      processedAt: FieldValue.serverTimestamp(),
    });

    console.log('Processing webhook event:', event.type, eventId);

    // Route event to appropriate handler
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
        
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;
        
      case 'account.updated':
        await handleAccountUpdated(event.data.object as Stripe.Account);
        break;
        
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
        
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
        
      default:
        console.log('Unhandled event type:', event.type);
    }

    return NextResponse.json({ received: true });

  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  try {
    console.log('Processing checkout.session.completed:', session.id);
    
    const metadata = session.metadata;
    const clubId = metadata?.clubId;
    const reservationId = metadata?.reservationId;
    const subscriptionId = metadata?.subscriptionId;

    if (!clubId) {
      console.error('No clubId in session metadata');
      return;
    }

    // Handle reservation payment
    if (reservationId) {
      const reservationRef = adminDb.collection('reservations').doc(reservationId);
      await reservationRef.update({
        status: 'confirmed',
        paymentStatus: 'paid',
        checkoutSessionId: session.id,
        paymentIntentId: session.payment_intent as string,
        paidAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      console.log('Updated reservation:', reservationId);
    }

    // Handle membership subscription
    if (subscriptionId) {
      const subscriptionRef = adminDb.collection('membershipSubscriptions').doc(subscriptionId);
      await subscriptionRef.update({
        status: 'active',
        paymentStatus: 'paid',
        checkoutSessionId: session.id,
        subscriptionId: session.subscription as string,
        customerId: session.customer as string,
        activatedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      console.log('Updated membership subscription:', subscriptionId);
    }

  } catch (error) {
    console.error('Error handling checkout.session.completed:', error);
  }
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  try {
    console.log('Processing payment_intent.payment_failed:', paymentIntent.id);
    
    const metadata = paymentIntent.metadata;
    const reservationId = metadata?.reservationId;

    if (reservationId) {
      const reservationRef = adminDb.collection('reservations').doc(reservationId);
      await reservationRef.update({
        status: 'cancelled',
        paymentStatus: 'failed',
        paymentIntentId: paymentIntent.id,
        failedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      console.log('Updated reservation payment status to failed:', reservationId);
    }

  } catch (error) {
    console.error('Error handling payment_intent.payment_failed:', error);
  }
}

async function handleAccountUpdated(account: Stripe.Account) {
  try {
    console.log('Processing account.updated:', account.id);
    
    // Find club by stripeAccountId
    const clubsQuery = await adminDb.collection('orgs')
      .where('stripeAccountId', '==', account.id)
      .limit(1)
      .get();

    if (clubsQuery.empty) {
      console.log('No club found for account:', account.id);
      return;
    }

    const clubDoc = clubsQuery.docs[0];
    if (!clubDoc) {
      console.log('No club document found for account:', account.id);
      return;
    }
    const clubId = clubDoc.id;

    // Update club with account status
    await clubDoc.ref.update({
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      stripeStatus: account.details_submitted ? 'active' : 'onboarding',
      stripeOnboardingComplete: account.details_submitted,
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log('Updated club account status:', clubId);

  } catch (error) {
    console.error('Error handling account.updated:', error);
  }
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  try {
    console.log('Processing invoice.paid:', invoice.id);
    
    if (invoice.subscription) {
      // Find membership subscription by Stripe subscription ID
      const subscriptionsQuery = await adminDb.collection('membershipSubscriptions')
        .where('subscriptionId', '==', invoice.subscription)
        .limit(1)
        .get();

      if (!subscriptionsQuery.empty) {
        const subscriptionDoc = subscriptionsQuery.docs[0];
        if (subscriptionDoc) {
          await subscriptionDoc.ref.update({
            status: 'active',
            paymentStatus: 'paid',
            latestInvoiceId: invoice.id,
            updatedAt: FieldValue.serverTimestamp(),
          });
          console.log('Updated membership subscription to active:', subscriptionDoc.id);
        }
      }
    }

  } catch (error) {
    console.error('Error handling invoice.paid:', error);
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  try {
    console.log('Processing invoice.payment_failed:', invoice.id);
    
    if (invoice.subscription) {
      // Find membership subscription by Stripe subscription ID
      const subscriptionsQuery = await adminDb.collection('membershipSubscriptions')
        .where('subscriptionId', '==', invoice.subscription)
        .limit(1)
        .get();

      if (!subscriptionsQuery.empty) {
        const subscriptionDoc = subscriptionsQuery.docs[0];
        if (subscriptionDoc) {
          await subscriptionDoc.ref.update({
            status: 'past_due',
            paymentStatus: 'failed',
            latestInvoiceId: invoice.id,
            updatedAt: FieldValue.serverTimestamp(),
          });
          console.log('Updated membership subscription to past_due:', subscriptionDoc.id);
        }
      }
    }

  } catch (error) {
    console.error('Error handling invoice.payment_failed:', error);
  }
}
