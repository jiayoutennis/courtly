/**
 * Stripe Configuration
 * Central configuration for all Stripe-related constants and settings
 */

export const STRIPE_CONFIG = {
  // Platform subscription plans
  plans: {
    free: {
      id: 'free',
      name: 'Free',
      price: 0,
      stripePriceId: null,
      features: [
        'Up to 50 members',
        'Basic court scheduling',
        'Email support',
        '1 club only',
      ],
      limits: {
        maxMembers: 50,
        maxCourts: 5,
        maxClubs: 1,
      },
    },
    basic: {
      id: 'basic',
      name: 'Basic',
      price: 49,
      stripePriceId: 'price_1SK8P3K6ar4U5SCn5gggtkmK',
      features: [
        'Up to 100 members',
        'Advanced court scheduling',
        'Member management',
        'Basic analytics',
        'Priority email support',
      ],
      limits: {
        maxMembers: 100,
        maxCourts: 10,
        maxClubs: 1,
      },
    },
    pro: {
      id: 'pro',
      name: 'Pro',
      price: 149,
      stripePriceId: 'price_1SK8PsK6ar4U5SCnQpLHEi3s',
      features: [
        'Up to 500 members',
        'Advanced scheduling & analytics',
        'Lesson management',
        'Custom branding',
        'Payment processing',
        'Priority support',
      ],
      limits: {
        maxMembers: 500,
        maxCourts: 25,
        maxClubs: 3,
      },
    },
    enterprise: {
      id: 'enterprise',
      name: 'Enterprise',
      price: 499,
      stripePriceId: 'price_1SK8QzK6ar4U5SCnqdDWVrHT',
      features: [
        'Unlimited members',
        'All Pro features',
        'Multi-club management',
        'API access',
        'Custom integrations',
        'Dedicated support',
        'Custom contracts',
      ],
      limits: {
        maxMembers: Infinity,
        maxCourts: Infinity,
        maxClubs: Infinity,
      },
    },
  },

  // Platform fee percentage (applied to club transactions)
  platformFeePercent: parseFloat(process.env.NEXT_PUBLIC_PLATFORM_FEE_PERCENT || '5'),

  // Currency
  currency: 'usd',

  // Stripe Connect settings
  connect: {
    // Amount of time clubs have to complete onboarding (in days)
    onboardingExpirationDays: 7,
    // Countries allowed for Connect accounts
    allowedCountries: ['US', 'CA'],
  },

  // Payment settings
  payment: {
    // Minimum charge amount in cents (Stripe requirement)
    minimumAmount: 50, // $0.50
    // Default payment method types
    paymentMethodTypes: ['card'],
  },

  // Webhooks
  webhooks: {
    // Webhook events to listen for
    events: [
      'payment_intent.succeeded',
      'payment_intent.payment_failed',
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'charge.refunded',
      'account.updated',
      'account.external_account.created',
    ],
  },
} as const;

// Type exports
export type PlanId = keyof typeof STRIPE_CONFIG.plans;
export type Plan = typeof STRIPE_CONFIG.plans[PlanId];
