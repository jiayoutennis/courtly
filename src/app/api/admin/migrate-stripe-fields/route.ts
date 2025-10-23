import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { migrateAllClubsStripeFields, getMigrationStatus } from '@/lib/migrateStripeFields';

/**
 * Admin endpoint to migrate clubs to add Stripe Connect fields
 * POST /api/admin/migrate-stripe-fields
 */
export async function POST(request: NextRequest) {
  try {
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
    
    // Check if user is Courtly admin
    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    if (userData?.userType !== 'courtly') {
      return NextResponse.json(
        { error: 'Unauthorized: Must be Courtly admin' },
        { status: 403 }
      );
    }

    // Run migration
    await migrateAllClubsStripeFields();

    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully'
    });

  } catch (error: any) {
    console.error('Error running migration:', error);
    return NextResponse.json(
      { error: error.message || 'Migration failed' },
      { status: 500 }
    );
  }
}

/**
 * Get migration status
 * GET /api/admin/migrate-stripe-fields
 */
export async function GET(request: NextRequest) {
  try {
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
    
    // Check if user is Courtly admin
    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    if (userData?.userType !== 'courtly') {
      return NextResponse.json(
        { error: 'Unauthorized: Must be Courtly admin' },
        { status: 403 }
      );
    }

    // Get migration status
    const status = await getMigrationStatus();

    return NextResponse.json({
      success: true,
      status
    });

  } catch (error: any) {
    console.error('Error getting migration status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get migration status' },
      { status: 500 }
    );
  }
}
