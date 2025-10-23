import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      bookingId, 
      clubId, 
      paymentMethod, // 'charged' or 'balance'
      transactionId 
    } = body;

    // Validate required fields
    if (!bookingId || !clubId || !paymentMethod) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Use Firestore transaction to complete payment
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
      
      // Mark booking as paid
      transaction.update(bookingRef, {
        paid: true,
        paymentMethod,
        paymentCompletedAt: FieldValue.serverTimestamp(),
        paymentInProgress: false,
        transactionId: transactionId || null
      });
      
      return { bookingId, success: true };
    });

    return NextResponse.json({
      success: true,
      bookingId: result.bookingId,
      message: 'Payment completed successfully'
    });

  } catch (error: any) {
    console.error('Error completing payment:', error);
    
    if (error.message === 'Booking already paid') {
      return NextResponse.json(
        { error: 'This booking has already been paid for.' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to complete payment. Please try again.' },
      { status: 500 }
    );
  }
}
