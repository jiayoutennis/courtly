import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      bookingId, 
      userId, 
      clubId, 
      amount
    } = body;

    // Validate required fields
    if (!bookingId || !userId || !clubId || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Use Firestore transaction to prevent double charging
    const result = await adminDb.runTransaction(async (transaction) => {
      // Get the booking document
      const bookingRef = adminDb
        .collection('orgs')
        .doc(clubId)
        .collection('bookings')
        .doc(bookingId);
      
      const bookingDoc = await transaction.get(bookingRef);
      
      if (!bookingDoc.exists) {
        throw new Error('Booking not found');
      }
      
      const booking = bookingDoc.data();
      
      if (!booking) {
        throw new Error('Booking data not found');
      }
      
      // Check if already paid
      if (booking.paid === true) {
        throw new Error('Booking already paid');
      }
      
      // Check if payment is in progress
      if (booking.paymentInProgress === true) {
        throw new Error('Payment already in progress');
      }
      
      // Mark payment as in progress
      transaction.update(bookingRef, {
        paymentInProgress: true,
        paymentAttemptedAt: FieldValue.serverTimestamp()
      });
      
      return { bookingId, success: true };
    });

    return NextResponse.json({
      success: true,
      bookingId: result.bookingId,
      message: 'Payment processing started'
    });

  } catch (error: any) {
    console.error('Error processing payment:', error);
    
    if (error.message === 'Booking already paid') {
      return NextResponse.json(
        { error: 'This booking has already been paid for.' },
        { status: 409 }
      );
    }
    
    if (error.message === 'Payment already in progress') {
      return NextResponse.json(
        { error: 'Payment is already being processed for this booking.' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to process payment. Please try again.' },
      { status: 500 }
    );
  }
}
