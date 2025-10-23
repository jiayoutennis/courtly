import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover' as any,
});

/**
 * List Stripe products and prices for a club
 * GET /api/stripe/list-products?clubId=xxx&userId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clubId = searchParams.get('clubId');
    const userId = searchParams.get('userId');
    const stripeAccountId = searchParams.get('stripeAccountId');

    if (!clubId || !userId || !stripeAccountId) {
      return NextResponse.json(
        { error: 'Missing required parameters (clubId, userId, stripeAccountId)' },
        { status: 400 }
      );
    }

    // List products from club's Stripe account
    const products = await stripe.products.list({
      limit: 100,
    }, {
      stripeAccount: stripeAccountId,
    });

    // Get prices for each product
    const productsWithPrices = await Promise.all(
      products.data.map(async (product) => {
        const prices = await stripe.prices.list({
          product: product.id,
          limit: 100,
        }, {
          stripeAccount: stripeAccountId,
        });

        return {
          id: product.id,
          name: product.name,
          description: product.description,
          active: product.active,
          metadata: product.metadata,
          prices: prices.data.map(price => ({
            id: price.id,
            unit_amount: price.unit_amount,
            currency: price.currency,
            recurring: price.recurring,
            active: price.active,
            metadata: price.metadata,
          })),
        };
      })
    );

    return NextResponse.json({
      success: true,
      products: productsWithPrices,
    });

  } catch (error: any) {
    console.error('Error listing Stripe products:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list products' },
      { status: 500 }
    );
  }
}
