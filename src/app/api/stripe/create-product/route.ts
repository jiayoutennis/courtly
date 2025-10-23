import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover' as any,
});

/**
 * Create a Stripe product for a club
 * POST /api/stripe/create-product
 */
export async function POST(request: NextRequest) {
  try {
    const { 
      clubId, 
      userId, 
      name,
      description,
      stripeAccountId,
      metadata = {} 
    } = await request.json();

    if (!clubId || !userId || !name || !stripeAccountId) {
      return NextResponse.json(
        { error: 'Missing required fields (clubId, userId, name, stripeAccountId)' },
        { status: 400 }
      );
    }

    // Create product on club's Stripe account
    const product = await stripe.products.create({
      name,
      description,
      metadata: {
        clubId,
        ...metadata,
      },
    }, {
      stripeAccount: stripeAccountId,
    });

    return NextResponse.json({
      success: true,
      product: {
        id: product.id,
        name: product.name,
        description: product.description,
        metadata: product.metadata,
      },
    });

  } catch (error: any) {
    console.error('Error creating Stripe product:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create product' },
      { status: 500 }
    );
  }
}
