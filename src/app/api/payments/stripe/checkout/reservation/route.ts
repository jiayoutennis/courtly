import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb, adminAuth } from '@/lib/firebase-admin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover' as any,
});

const PLATFORM_FEE_BASIS_POINTS = parseInt(process.env.PLATFORM_FEE_BASIS_POINTS || '300'); // 3%

/**
 * Create Checkout Session for Reservation Payment
 * POST /api/payments/stripe/checkout/reservation
 */
export async function POST(request: NextRequest) {
  try {
    const { clubId, reservationId } = await request.json();

    if (!clubId || !reservationId) {
      return NextResponse.json(
        { error: 'Missing clubId or reservationId' },
        { status: 400 }
      );
    }

    // Verify Firebase ID token
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const idToken = authHeader.split('Bearer ')[1];
    if (!idToken) {
      return NextResponse.json(
        { error: 'Invalid authorization header format' },
        { status: 401 }
      );
    }
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    // Get reservation data
    const reservationRef = adminDb.collection('reservations').doc(reservationId);
    const reservationDoc = await reservationRef.get();
    
    if (!reservationDoc.exists) {
      return NextResponse.json(
        { error: 'Reservation not found' },
        { status: 404 }
      );
    }

    const reservation = reservationDoc.data();
    
    // Verify user owns this reservation
    if (reservation?.userId !== decodedToken.uid) {
      return NextResponse.json(
        { error: 'Unauthorized: Reservation does not belong to user' },
        { status: 403 }
      );
    }

    // Get club data
    const clubRef = adminDb.collection('orgs').doc(clubId);
    const clubDoc = await clubRef.get();
    
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
        { error: 'Club has no connected Stripe account' },
        { status: 400 }
      );
    }

    if (!clubData?.chargesEnabled) {
      return NextResponse.json(
        { error: 'Club cannot accept payments yet' },
        { status: 400 }
      );
    }

    // Calculate platform fee
    const amount = reservation.priceCents;
    const platformFee = Math.round((amount * PLATFORM_FEE_BASIS_POINTS) / 10000);

    // Create checkout session with destination charges
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: reservation.currency || 'usd',
            product_data: {
              name: `Court Reservation - ${reservation.courtName}`,
              description: `Reservation from ${new Date(reservation.start.seconds * 1000).toLocaleString()} to ${new Date(reservation.end.seconds * 1000).toLocaleString()}`,
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: platformFee,
        transfer_data: {
          destination: stripeAccountId,
        },
        metadata: {
          clubId: clubId,
          reservationId: reservationId,
          userId: decodedToken.uid,
        },
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/reservations/${reservationId}?success=1`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/reservations/${reservationId}?canceled=1`,
      metadata: {
        clubId: clubId,
        reservationId: reservationId,
        userId: decodedToken.uid,
      },
    });

    console.log('Created checkout session for reservation:', reservationId);

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });

  } catch (error: any) {
    console.error('Error creating reservation checkout session:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
