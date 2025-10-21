import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../../firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

export async function POST(request: NextRequest) {
  try {
    const { clubId, plan } = await request.json();

    if (!clubId || !plan) {
      return NextResponse.json(
        { error: 'Missing clubId or plan' },
        { status: 400 }
      );
    }

    const orgRef = doc(db, 'orgs', clubId);
    
    await updateDoc(orgRef, {
      subscription: {
        plan,
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      },
      updatedAt: serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error syncing subscription:', error);
    return NextResponse.json(
      { error: 'Failed to sync subscription' },
      { status: 500 }
    );
  }
}
