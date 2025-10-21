import { NextRequest, NextResponse } from 'next/server';
import { createSubscriptionCheckoutSession } from '@/lib/stripe/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { priceId, customerId, customerEmail, clubId } = body;

    console.log('Received checkout session request:', {
      priceId: priceId ? 'present' : 'missing',
      clubId: clubId ? 'present' : 'missing',
      customerEmail: customerEmail ? 'present' : 'missing',
      customerId: customerId ? 'present' : 'missing',
      fullBody: body,
    });

    if (!priceId || !clubId || !customerEmail) {
      console.error('Missing required fields:', { priceId, clubId, customerEmail });
      return NextResponse.json(
        { error: `Missing required fields: ${!priceId ? 'priceId ' : ''}${!clubId ? 'clubId ' : ''}${!customerEmail ? 'customerEmail' : ''}` },
        { status: 400 }
      );
    }

    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const successUrl = `${origin}/club/${clubId}/subscription?success=true&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}/club/${clubId}/subscription?canceled=true`;

    const result = await createSubscriptionCheckoutSession(
      priceId,
      customerId,
      customerEmail,
      clubId,
      successUrl,
      cancelUrl
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    // Save the customer ID to Firestore if it was newly created
    if (result.customerId && result.customerId !== customerId) {
      try {
        const orgRef = adminDb.collection('orgs').doc(clubId);
        await orgRef.update({
          stripeCustomerId: result.customerId,
          updatedAt: FieldValue.serverTimestamp(),
        });
        console.log('Updated org with Stripe customer ID:', result.customerId);
      } catch (error) {
        console.error('Error updating org with customer ID:', error);
        // Don't fail the request if this update fails
      }
    }

    return NextResponse.json({ sessionId: result.sessionId, url: result.url });
  } catch (error) {
    console.error('Error in create-checkout-session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
