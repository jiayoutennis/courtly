import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      clubId, 
      courtId, 
      courtName, 
      date, 
      startTime, 
      endTime, 
      userId, 
      userName, 
      notes, 
      cost,
      userType 
    } = body;

    // Validate required fields
    if (!clubId || !courtId || !date || !startTime || !endTime || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Use Firestore transaction to prevent race conditions
    const result = await adminDb.runTransaction(async (transaction) => {
      // Check for existing bookings in the same time slot
      const bookingsRef = adminDb
        .collection('orgs')
        .doc(clubId)
        .collection('bookings');
      
      const existingBookingsQuery = bookingsRef
        .where('courtId', '==', courtId)
        .where('date', '==', date)
        .where('status', '==', 'confirmed');
      
      const existingBookings = await transaction.get(existingBookingsQuery);
      
      // Check for time conflicts
      const startHour = parseInt(startTime.split(':')[0]);
      const endHour = parseInt(endTime.split(':')[0]);
      
      for (const bookingDoc of existingBookings.docs) {
        const booking = bookingDoc.data();
        const existingStartHour = parseInt(booking.startTime.split(':')[0]);
        const existingEndHour = parseInt(booking.endTime.split(':')[0]);
        
        // Check for overlap
        if (!(endHour <= existingStartHour || startHour >= existingEndHour)) {
          throw new Error('Time slot is already booked');
        }
      }

      // Create unique booking ID to prevent duplicates
      const bookingId = `${userId}_${courtId}_${date}_${startTime}_${Date.now()}`;
      
      // Create booking document
      const bookingData = {
        courtId,
        courtName: courtName || '',
        date,
        startTime,
        endTime,
        userId,
        memberId: userId, // Required by Firestore security rules
        userName: userName || '',
        notes: notes || '',
        status: 'confirmed',
        cost: cost || 0,
        paid: false,
        createdAt: FieldValue.serverTimestamp(),
        bookingId, // Unique identifier
        userType: userType || 'member'
      };

      // Add booking to Firestore
      const bookingRef = bookingsRef.doc(bookingId);
      transaction.set(bookingRef, bookingData);

      return { bookingId, success: true };
    });

    return NextResponse.json({
      success: true,
      bookingId: result.bookingId,
      message: 'Booking created successfully'
    });

  } catch (error: any) {
    console.error('Error creating booking:', error);
    
    if (error.message === 'Time slot is already booked') {
      return NextResponse.json(
        { error: 'This time slot is already booked. Please choose a different time.' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create booking. Please try again.' },
      { status: 500 }
    );
  }
}
