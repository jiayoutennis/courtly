/**
 * Migration Script: Add Stripe Connect Fields to Existing Clubs
 * 
 * This script adds the new Stripe Connect fields to existing club documents
 * according to the Stripe Connect Integration Spec.
 */

import { adminDb } from './firebase-admin';

interface StripeFields {
  stripeAccountId: string | null;
  stripeStatus: 'unlinked' | 'onboarding' | 'active' | 'restricted' | 'pending_verification';
  stripeOnboardingComplete: boolean;
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
  supportEmail: string;
  supportPhone: string;
  statementDescriptor?: string;
  country: 'US' | string;
  currency: 'usd' | string;
  reservationSettings: {
    requirePaymentAtBooking: boolean;
    hourlyRateCents: number;
  };
  membershipPlans: Array<{
    id: string;
    name: string;
    priceCents: number;
    interval: 'month' | 'year' | 'one_time';
    active: boolean;
    stripePriceId?: string;
  }>;
}

/**
 * Migrate a single club to add Stripe Connect fields
 */
export async function migrateClubStripeFields(clubId: string): Promise<void> {
  try {
    console.log(`Migrating club ${clubId} to add Stripe Connect fields...`);
    
    const clubRef = adminDb.collection('orgs').doc(clubId);
    const clubDoc = await clubRef.get();
    
    if (!clubDoc.exists) {
      console.log(`Club ${clubId} not found, skipping...`);
      return;
    }
    
    const clubData = clubDoc.data();
    if (!clubData) {
      console.log(`Club ${clubId} has no data, skipping...`);
      return;
    }
    
    // Check if already migrated
    if (clubData.stripeStatus !== undefined) {
      console.log(`Club ${clubId} already has Stripe fields, skipping...`);
      return;
    }
    
    // Prepare Stripe fields with defaults
    const stripeFields: Partial<StripeFields> = {
      stripeAccountId: clubData.stripeAccountId || null,
      stripeStatus: 'unlinked',
      stripeOnboardingComplete: false,
      payoutsEnabled: false,
      chargesEnabled: false,
      supportEmail: clubData.email || clubData.supportEmail || '',
      supportPhone: clubData.phone || clubData.supportPhone || '',
      statementDescriptor: clubData.name ? clubData.name.substring(0, 22) : undefined,
      country: 'US',
      currency: 'usd',
      reservationSettings: {
        requirePaymentAtBooking: true,
        hourlyRateCents: 1500, // $15.00 default
      },
      membershipPlans: [],
    };
    
    // Update the club document
    await clubRef.update(stripeFields);
    
    console.log(`✅ Successfully migrated club ${clubId} with Stripe Connect fields`);
    
  } catch (error) {
    console.error(`Error migrating club ${clubId}:`, error);
    throw error;
  }
}

/**
 * Migrate all clubs to add Stripe Connect fields
 */
export async function migrateAllClubsStripeFields(): Promise<void> {
  try {
    console.log('Starting migration of all clubs to add Stripe Connect fields...');
    
    const clubsSnapshot = await adminDb.collection('orgs').get();
    const clubs = clubsSnapshot.docs;
    
    console.log(`Found ${clubs.length} clubs to migrate`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const clubDoc of clubs) {
      try {
        await migrateClubStripeFields(clubDoc.id);
        successCount++;
      } catch (error) {
        console.error(`Failed to migrate club ${clubDoc.id}:`, error);
        errorCount++;
      }
    }
    
    console.log(`Migration complete:`);
    console.log(`  ✅ Successfully migrated: ${successCount} clubs`);
    console.log(`  ❌ Failed to migrate: ${errorCount} clubs`);
    
  } catch (error) {
    console.error('Error during migration:', error);
    throw error;
  }
}

/**
 * Check if a club has Stripe Connect fields
 */
export async function checkClubStripeFields(clubId: string): Promise<boolean> {
  try {
    const clubRef = adminDb.collection('orgs').doc(clubId);
    const clubDoc = await clubRef.get();
    
    if (!clubDoc.exists) {
      return false;
    }
    
    const clubData = clubDoc.data();
    return clubData?.stripeStatus !== undefined;
    
  } catch (error) {
    console.error(`Error checking club ${clubId}:`, error);
    return false;
  }
}

/**
 * Get migration status for all clubs
 */
export async function getMigrationStatus(): Promise<{
  total: number;
  migrated: number;
  notMigrated: number;
  clubs: Array<{
    id: string;
    name: string;
    migrated: boolean;
  }>;
}> {
  try {
    const clubsSnapshot = await adminDb.collection('orgs').get();
    const clubs = clubsSnapshot.docs;
    
    const result = {
      total: clubs.length,
      migrated: 0,
      notMigrated: 0,
      clubs: [] as Array<{
        id: string;
        name: string;
        migrated: boolean;
      }>
    };
    
    for (const clubDoc of clubs) {
      const clubData = clubDoc.data();
      const migrated = clubData?.stripeStatus !== undefined;
      
      result.clubs.push({
        id: clubDoc.id,
        name: clubData?.name || 'Unknown',
        migrated
      });
      
      if (migrated) {
        result.migrated++;
      } else {
        result.notMigrated++;
      }
    }
    
    return result;
    
  } catch (error) {
    console.error('Error getting migration status:', error);
    throw error;
  }
}
