import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

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

    // Verify user authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      );
    }

    // Ensure the userId matches the authenticated user
    if (decodedToken.uid !== userId) {
      return NextResponse.json(
        { error: 'User ID mismatch' },
        { status: 403 }
      );
    }

    // Get or create Stripe customer
    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    let stripeCustomerId = userData?.stripeCustomerId;

    // Create Stripe customer if doesn't exist
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: userData?.email || decodedToken.email,
        metadata: {
          userId: userId,
          clubId: clubId,
        },
      });
      stripeCustomerId = customer.id;
      
      // Save customer ID to Firestore
      await userRef.update({
        stripeCustomerId: customer.id,
      });
    }

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
