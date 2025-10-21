/**
 * Client-side Stripe Instance
 * Use this for frontend payment forms and checkout
 */

import { loadStripe, Stripe } from '@stripe/stripe-js';

let stripePromise: Promise<Stripe | null>;

/**
 * Get the Stripe.js instance
 * This function is memoized so Stripe is only loaded once
 */
export const getStripe = (): Promise<Stripe | null> => {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    
    if (!key) {
      console.error('Stripe publishable key is missing');
      return Promise.resolve(null);
    }

    stripePromise = loadStripe(key);
  }
  
  return stripePromise;
};
