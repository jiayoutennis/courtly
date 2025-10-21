/**
 * Membership Sync Utilities
 * 
 * Two-way sync system for membership tracking:
 * 1. MembershipPlan.members[] - tracks which users have this tier
 * 2. User.clubMemberships{} - tracks which tier user has in each club
 */

import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../../firebase';
import { MembershipTier } from '../../shared/types';

/**
 * Add a user to a membership tier
 * Updates both the membership plan's members array and user's clubMemberships map
 */
export async function addUserToMembershipTier(
  userId: string,
  clubId: string,
  tier: MembershipTier
): Promise<void> {
  try {
    console.log(`[MembershipSync] Adding user ${userId} to ${tier} tier in club ${clubId}`);
    
    // 1. Update membership plan document - add user to members array
    const planRef = doc(db, 'orgs', clubId, 'membershipPlans', tier);
    const planDoc = await getDoc(planRef);
    
    if (planDoc.exists()) {
      await updateDoc(planRef, {
        members: arrayUnion(userId),
        updatedAt: new Date()
      });
      console.log(`[MembershipSync] Added user to plan's members array`);
    } else {
      console.warn(`[MembershipSync] Membership plan ${tier} not found in club ${clubId}`);
    }
    
    // 2. Update user document - add club membership to map
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const clubMemberships = userData.clubMemberships || {};
      
      // Add or update this club's membership tier
      clubMemberships[clubId] = tier;
      
      await updateDoc(userRef, {
        clubMemberships: clubMemberships,
        lastActivityAt: new Date()
      });
      console.log(`[MembershipSync] Updated user's clubMemberships map`);
    } else {
      console.warn(`[MembershipSync] User ${userId} not found`);
    }
    
    console.log(`[MembershipSync] Successfully synced membership for user ${userId}`);
  } catch (error) {
    console.error('[MembershipSync] Error adding user to membership tier:', error);
    throw error;
  }
}

/**
 * Remove a user from a membership tier
 * Updates both the membership plan's members array and user's clubMemberships map
 */
export async function removeUserFromMembershipTier(
  userId: string,
  clubId: string,
  tier: MembershipTier
): Promise<void> {
  try {
    console.log(`[MembershipSync] Removing user ${userId} from ${tier} tier in club ${clubId}`);
    
    // 1. Update membership plan document - remove user from members array
    const planRef = doc(db, 'orgs', clubId, 'membershipPlans', tier);
    const planDoc = await getDoc(planRef);
    
    if (planDoc.exists()) {
      await updateDoc(planRef, {
        members: arrayRemove(userId),
        updatedAt: new Date()
      });
      console.log(`[MembershipSync] Removed user from plan's members array`);
    }
    
    // 2. Update user document - remove club from membership map
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const clubMemberships = userData.clubMemberships || {};
      
      // Remove this club's membership
      delete clubMemberships[clubId];
      
      await updateDoc(userRef, {
        clubMemberships: clubMemberships,
        lastActivityAt: new Date()
      });
      console.log(`[MembershipSync] Removed club from user's clubMemberships map`);
    }
    
    console.log(`[MembershipSync] Successfully removed membership for user ${userId}`);
  } catch (error) {
    console.error('[MembershipSync] Error removing user from membership tier:', error);
    throw error;
  }
}

/**
 * Update a user's membership tier in a club
 * Removes from old tier and adds to new tier
 */
export async function updateUserMembershipTier(
  userId: string,
  clubId: string,
  oldTier: MembershipTier,
  newTier: MembershipTier
): Promise<void> {
  try {
    console.log(`[MembershipSync] Updating user ${userId} from ${oldTier} to ${newTier} in club ${clubId}`);
    
    // Remove from old tier
    await removeUserFromMembershipTier(userId, clubId, oldTier);
    
    // Add to new tier
    await addUserToMembershipTier(userId, clubId, newTier);
    
    console.log(`[MembershipSync] Successfully updated membership tier for user ${userId}`);
  } catch (error) {
    console.error('[MembershipSync] Error updating membership tier:', error);
    throw error;
  }
}

/**
 * Get all members for a specific membership tier
 */
export async function getMembersForTier(
  clubId: string,
  tier: MembershipTier
): Promise<string[]> {
  try {
    const planRef = doc(db, 'orgs', clubId, 'membershipPlans', tier);
    const planDoc = await getDoc(planRef);
    
    if (planDoc.exists()) {
      const planData = planDoc.data();
      return planData.members || [];
    }
    
    return [];
  } catch (error) {
    console.error('[MembershipSync] Error getting members for tier:', error);
    return [];
  }
}

/**
 * Get a user's membership tier in a specific club
 */
export async function getUserMembershipTier(
  userId: string,
  clubId: string
): Promise<MembershipTier | null> {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const clubMemberships = userData.clubMemberships || {};
      return clubMemberships[clubId] || null;
    }
    
    return null;
  } catch (error) {
    console.error('[MembershipSync] Error getting user membership tier:', error);
    return null;
  }
}

/**
 * Get all clubs where a user has a membership
 */
export async function getUserClubMemberships(
  userId: string
): Promise<Record<string, MembershipTier>> {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return userData.clubMemberships || {};
    }
    
    return {};
  } catch (error) {
    console.error('[MembershipSync] Error getting user club memberships:', error);
    return {};
  }
}
