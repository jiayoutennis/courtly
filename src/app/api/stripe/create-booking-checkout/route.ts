import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/server';

/**
 * POST /api/stripe/create-booking-checkout
 * Creates a Stripe checkout session for court booking payment
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      courtId, 
      courtName, 
      clubId, 
      clubName,
      date, 
      startTime, 
      endTime, 
      price, 
      notes,
      userId 
    } = body;

    // Validate required fields
    if (!courtId || !clubId || !date || !startTime || !endTime || !price || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // For now, we'll create a Stripe customer without Firebase Admin SDK
    // The client-side code should handle user authentication
    let stripeCustomerId: string | undefined;

    // Create Stripe customer
    const customer = await stripe.customers.create({
      metadata: {
        userId: userId,
        clubId: clubId,
      },
    });
    stripeCustomerId = customer.id;

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Court Booking - ${courtName || 'Court'}`,
              description: `${clubName}\n${date} • ${startTime} - ${endTime}`,
            },
            unit_amount: Math.round(price * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/club/${clubId}/court-schedule?booking=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/club/${clubId}/court-schedule?booking=canceled`,
      metadata: {
        type: 'booking',
        userId: userId,
        clubId: clubId,
        courtId: courtId,
        courtName: courtName || '',
        date: date,
        startTime: startTime,
        endTime: endTime,
        notes: notes || '',
      },
    });

    return NextResponse.json({ 
      sessionId: session.id,
      url: session.url,
    });

  } catch (error: any) {
    console.error('Error creating booking checkout session:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
