import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover' as any,
});

/**
 * Create a Stripe price for a club's product
 * POST /api/stripe/create-price
 */
export async function POST(request: NextRequest) {
  try {
    const { 
      clubId, 
      userId, 
      productId, 
      unitAmount, 
      currency = 'usd',
      recurring = null, // { interval: 'month' | 'year' } for subscriptions
      stripeAccountId,
      metadata = {} 
    } = await request.json();

    if (!clubId || !userId || !productId || !unitAmount || !stripeAccountId) {
      return NextResponse.json(
        { error: 'Missing required fields (clubId, userId, productId, unitAmount, stripeAccountId)' },
        { status: 400 }
      );
    }

    // Create price on club's Stripe account
    const priceData: Stripe.PriceCreateParams = {
      product: productId,
      unit_amount: Math.round(unitAmount * 100), // Convert to cents
      currency,
      metadata: {
        clubId,
        ...metadata,
      },
    };

    // Add recurring billing if specified
    if (recurring) {
      priceData.recurring = {
        interval: recurring.interval,
      };
    }

    const price = await stripe.prices.create(priceData, {
      stripeAccount: stripeAccountId,
    });

    return NextResponse.json({
      success: true,
      price: {
        id: price.id,
        product: price.product,
        unit_amount: price.unit_amount,
        currency: price.currency,
        recurring: price.recurring,
        metadata: price.metadata,
      },
    });

  } catch (error: any) {
    console.error('Error creating Stripe price:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create price' },
      { status: 500 }
    );
  }
}
