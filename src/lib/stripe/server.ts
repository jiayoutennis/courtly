/**
 * Server-side Stripe Instance
 * Use this for backend API routes and server components
 */

import Stripe from 'stripe';

let stripeInstance: Stripe | null = null;

/**
 * Get Stripe server instance
 * Lazily initializes Stripe only when needed (prevents build-time errors)
 */
export function getStripeInstance(): Stripe {
  if (!stripeInstance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not set in environment variables');
    }
    
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
      typescript: true,
      appInfo: {
        name: 'Courtly',
        version: '1.0.0',
      },
    });
  }
  
  return stripeInstance;
}

/**
 * Stripe server instance
 * Used for all server-side Stripe operations
 * @deprecated Use getStripeInstance() instead for lazy initialization
 */
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripeInstance() as any)[prop];
  }
});

/**
 * Create a Stripe Connect account for a club
 */
export async function createConnectAccount(email: string, country: string = 'US') {
  try {
    const account = await stripe.accounts.create({
      type: 'standard',
      email,
      country,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    return { success: true, accountId: account.id };
  } catch (error) {
    console.error('Error creating Connect account:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Create an onboarding link for a Connect account
 */
export async function createAccountLink(accountId: string, refreshUrl: string, returnUrl: string) {
  try {
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    return { success: true, url: accountLink.url };
  } catch (error) {
    console.error('Error creating account link:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Get Connect account details
 */
export async function getConnectAccount(accountId: string) {
  try {
    const account = await stripe.accounts.retrieve(accountId);
    
    return {
      success: true,
      account: {
        id: account.id,
        chargesEnabled: account.charges_enabled,
        detailsSubmitted: account.details_submitted,
        payoutsEnabled: account.payouts_enabled,
      },
    };
  } catch (error) {
    console.error('Error retrieving Connect account:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Create a payment intent for a club transaction
 * Uses Stripe Connect to split payment between club and platform
 */
export async function createPaymentIntent(
  amount: number,
  currency: string,
  clubStripeAccountId: string,
  platformFeePercent: number,
  metadata: Record<string, string>
) {
  try {
    const platformFee = Math.round(amount * (platformFeePercent / 100));

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      application_fee_amount: platformFee,
      transfer_data: {
        destination: clubStripeAccountId,
      },
      metadata,
    });

    return { success: true, clientSecret: paymentIntent.client_secret };
  } catch (error) {
    console.error('Error creating payment intent:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Create a subscription checkout session for club subscriptions to Courtly
 */
export async function createSubscriptionCheckoutSession(
  priceId: string,
  customerId: string | undefined,
  customerEmail: string,
  clubId: string,
  successUrl: string,
  cancelUrl: string
) {
  try {
    // Create or use existing customer
    let finalCustomerId = customerId;
    
    if (!finalCustomerId) {
      // Create a new customer if one doesn't exist
      const customer = await stripe.customers.create({
        email: customerEmail,
        metadata: {
          clubId,
        },
      });
      finalCustomerId = customer.id;
      
      console.log('Created new Stripe customer:', finalCustomerId, 'for club:', clubId);
    }
    
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      customer: finalCustomerId,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        clubId,
      },
      subscription_data: {
        metadata: {
          clubId,
        },
      },
    });

    return { 
      success: true, 
      sessionId: session.id, 
      url: session.url,
      customerId: finalCustomerId,
    };
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Create a billing portal session for subscription management
 */
export async function createBillingPortalSession(customerId: string, returnUrl: string) {
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return { success: true, url: session.url };
  } catch (error) {
    console.error('Error creating billing portal session:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(subscriptionId: string, cancelAtPeriodEnd: boolean = true) {
  try {
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: cancelAtPeriodEnd,
    });

    return { success: true, subscription };
  } catch (error) {
    console.error('Error canceling subscription:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Refund a payment
 */
export async function refundPayment(paymentIntentId: string, amount?: number) {
  try {
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount,
    });

    return { success: true, refund };
  } catch (error) {
    console.error('Error refunding payment:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
