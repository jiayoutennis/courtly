import { NextRequest, NextResponse } from 'next/server';
import { addUserToMembershipTierAdmin, MembershipTier } from '@/lib/membershipSyncAdmin';

/**
 * Manual Membership Sync API
 * 
 * Use this to manually trigger membership sync for testing
 * 
 * POST /api/test-membership-sync
 * Body: { userId: string, clubId: string, tier: 'monthly' | 'annual' | 'day_pass' }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, clubId, tier } = await request.json();

    if (!userId || !clubId || !tier) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, clubId, tier' },
        { status: 400 }
      );
    }

    if (!['monthly', 'annual', 'day_pass'].includes(tier)) {
      return NextResponse.json(
        { error: 'Invalid tier. Must be: monthly, annual, or day_pass' },
        { status: 400 }
      );
    }

    console.log(`\n🔧 Manual sync triggered:`);
    console.log(`   User: ${userId}`);
    console.log(`   Club: ${clubId}`);
    console.log(`   Tier: ${tier}\n`);

    await addUserToMembershipTierAdmin(userId, clubId, tier as MembershipTier);

    return NextResponse.json({
      success: true,
      message: 'Membership sync completed',
      data: { userId, clubId, tier }
    });

  } catch (error: any) {
    console.error('❌ Manual sync error:', error);
    return NextResponse.json(
      {
        error: 'Sync failed',
        message: error.message,
        details: error.toString()
      },
      { status: 500 }
    );
  }
}
