/**
 * Membership Sync Utilities - Server (Firebase Admin)
 * 
 * Two-way sync system for membership tracking:
 * 1. MembershipPlan.members[] - tracks which users have this tier
 * 2. User.clubMemberships{} - tracks which tier user has in each club
 * 
 * This version uses firebase-admin for server-side operations (API routes, webhooks)
 */

import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export type MembershipTier = 'monthly' | 'annual' | 'day_pass';

/**
 * Add a user to a membership tier (Server-side with firebase-admin)
 * Updates both the membership plan's members array and user's clubMemberships map
 */
export async function addUserToMembershipTierAdmin(
  userId: string,
  clubId: string,
  tier: MembershipTier
): Promise<void> {
  try {
    console.log(`[MembershipSync-Admin] Adding user ${userId} to ${tier} tier in club ${clubId}`);
    console.log(`[MembershipSync-Admin] Looking for plan at: orgs/${clubId}/membershipPlans/${tier}`);
    
    // 1. Update membership plan document - add user to members array
    const planRef = adminDb
      .collection('orgs')
      .doc(clubId)
      .collection('membershipPlans')
      .doc(tier);
    
    const planDoc = await planRef.get();
    
    if (planDoc.exists) {
      const planData = planDoc.data();
      console.log(`[MembershipSync-Admin] Found plan:`, { id: planDoc.id, tier: planData?.tier, members: planData?.members });
      await planRef.update({
        members: FieldValue.arrayUnion(userId),
        updatedAt: FieldValue.serverTimestamp()
      });
      console.log(`[MembershipSync-Admin] Added user to plan's members array`);
    } else {
      console.error(`[MembershipSync-Admin] ❌ Membership plan '${tier}' NOT FOUND in club ${clubId}`);
      console.log(`[MembershipSync-Admin] Checking what plans exist...`);
      const allPlansSnapshot = await adminDb
        .collection('orgs')
        .doc(clubId)
        .collection('membershipPlans')
        .get();
      console.log(`[MembershipSync-Admin] Found ${allPlansSnapshot.size} plans:`);
      allPlansSnapshot.forEach(doc => {
        console.log(`  - Plan ID: ${doc.id}, Tier: ${doc.data()?.tier}`);
      });
    }
    
    // 2. Update user document - add club membership to map
    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (userDoc.exists) {
      const userData = userDoc.data();
      const clubMemberships = userData?.clubMemberships || {};
      
      // Add or update this club's membership tier
      clubMemberships[clubId] = tier;
      
      await userRef.update({
        clubMemberships: clubMemberships,
        lastActivityAt: FieldValue.serverTimestamp()
      });
      console.log(`[MembershipSync-Admin] Updated user's clubMemberships map`);
    } else {
      console.warn(`[MembershipSync-Admin] User ${userId} not found`);
    }
    
    console.log(`[MembershipSync-Admin] Successfully synced membership for user ${userId}`);
  } catch (error) {
    console.error('[MembershipSync-Admin] Error adding user to membership tier:', error);
    throw error;
  }
}

/**
 * Remove a user from a membership tier (Server-side with firebase-admin)
 * Updates both the membership plan's members array and user's clubMemberships map
 */
export async function removeUserFromMembershipTierAdmin(
  userId: string,
  clubId: string,
  tier: MembershipTier
): Promise<void> {
  try {
    console.log(`[MembershipSync-Admin] Removing user ${userId} from ${tier} tier in club ${clubId}`);
    
    // 1. Update membership plan document - remove user from members array
    const planRef = adminDb
      .collection('orgs')
      .doc(clubId)
      .collection('membershipPlans')
      .doc(tier);
    
    const planDoc = await planRef.get();
    
    if (planDoc.exists) {
      await planRef.update({
        members: FieldValue.arrayRemove(userId),
        updatedAt: FieldValue.serverTimestamp()
      });
      console.log(`[MembershipSync-Admin] Removed user from plan's members array`);
    }
    
    // 2. Update user document - remove club from membership map
    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (userDoc.exists) {
      const userData = userDoc.data();
      const clubMemberships = userData?.clubMemberships || {};
      
      // Remove this club's membership
      delete clubMemberships[clubId];
      
      await userRef.update({
        clubMemberships: clubMemberships,
        lastActivityAt: FieldValue.serverTimestamp()
      });
      console.log(`[MembershipSync-Admin] Removed club from user's clubMemberships map`);
    }
    
    console.log(`[MembershipSync-Admin] Successfully removed membership for user ${userId}`);
  } catch (error) {
    console.error('[MembershipSync-Admin] Error removing user from membership tier:', error);
    throw error;
  }
}

/**
 * Update a user's membership tier in a club (Server-side with firebase-admin)
 * Removes from old tier and adds to new tier
 */
export async function updateUserMembershipTierAdmin(
  userId: string,
  clubId: string,
  oldTier: MembershipTier,
  newTier: MembershipTier
): Promise<void> {
  try {
    console.log(`[MembershipSync-Admin] Updating user ${userId} from ${oldTier} to ${newTier} in club ${clubId}`);
    
    // Remove from old tier
    await removeUserFromMembershipTierAdmin(userId, clubId, oldTier);
    
    // Add to new tier
    await addUserToMembershipTierAdmin(userId, clubId, newTier);
    
    console.log(`[MembershipSync-Admin] Successfully updated membership tier for user ${userId}`);
  } catch (error) {
    console.error('[MembershipSync-Admin] Error updating membership tier:', error);
    throw error;
  }
}

/**
 * Get all members for a specific membership tier
 */
export async function getMembersForTierAdmin(
  clubId: string,
  tier: MembershipTier
): Promise<string[]> {
  try {
    const planRef = adminDb
      .collection('orgs')
      .doc(clubId)
      .collection('membershipPlans')
      .doc(tier);
    
    const planDoc = await planRef.get();
    
    if (planDoc.exists) {
      const planData = planDoc.data();
      return planData?.members || [];
    }
    
    return [];
  } catch (error) {
    console.error('[MembershipSync-Admin] Error getting members for tier:', error);
    return [];
  }
}

/**
 * Get a user's membership tier in a specific club
 */
export async function getUserMembershipTierAdmin(
  userId: string,
  clubId: string
): Promise<MembershipTier | null> {
  try {
    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (userDoc.exists) {
      const userData = userDoc.data();
      const clubMemberships = userData?.clubMemberships || {};
      return clubMemberships[clubId] || null;
    }
    
    return null;
  } catch (error) {
    console.error('[MembershipSync-Admin] Error getting user membership tier:', error);
    return null;
  }
}

/**
 * Get all clubs where a user has a membership
 */
export async function getUserClubMembershipsAdmin(
  userId: string
): Promise<Record<string, MembershipTier>> {
  try {
    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (userDoc.exists) {
      const userData = userDoc.data();
      return userData?.clubMemberships || {};
    }
    
    return {};
  } catch (error) {
    console.error('[MembershipSync-Admin] Error getting user club memberships:', error);
    return {};
  }
}
