/**
 * Migration Script: Add Two-Way Membership Tracking
 * 
 * This script migrates existing data to support two-way membership tracking:
 * 1. Adds `members` array to existing membership plans
 * 2. Adds `clubMemberships` map to existing users
 * 3. Syncs existing memberships to populate both fields
 * 
 * Run this script once after deploying the new code.
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Initialize Firebase Admin
if (getApps().length === 0) {
  const serviceAccountPath = path.join(__dirname, '../../../courtly-by-jiayou-tennis-firebase-adminsdk-fbsvc-220bf9c91d.json');
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

  initializeApp({
    credential: cert(serviceAccount)
  });
}

const db = getFirestore();

async function migrateMembers() {
  console.log('🚀 Starting membership tracking migration...\n');

  try {
    // Step 1: Add empty members array to all membership plans
    console.log('📋 Step 1: Adding members array to membership plans...');
    const orgsSnapshot = await db.collection('orgs').get();
    let planCount = 0;

    for (const orgDoc of orgsSnapshot.docs) {
      const clubId = orgDoc.id;
      const plansSnapshot = await db
        .collection('orgs')
        .doc(clubId)
        .collection('membershipPlans')
        .get();

      for (const planDoc of plansSnapshot.docs) {
        const planData = planDoc.data();
        
        // Only add if members field doesn't exist
        if (!planData.members) {
          await planDoc.ref.update({
            members: [],
            updatedAt: FieldValue.serverTimestamp()
          });
          planCount++;
          console.log(`  ✅ Added members array to ${clubId}/${planDoc.id}`);
        }
      }
    }
    console.log(`✅ Updated ${planCount} membership plans\n`);

    // Step 2: Add empty clubMemberships map to all users
    console.log('📋 Step 2: Adding clubMemberships map to users...');
    const usersSnapshot = await db.collection('users').get();
    let userCount = 0;

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      
      // Only add if clubMemberships field doesn't exist
      if (!userData.clubMemberships) {
        await userDoc.ref.update({
          clubMemberships: {},
          lastActivityAt: FieldValue.serverTimestamp()
        });
        userCount++;
        console.log(`  ✅ Added clubMemberships map to user ${userDoc.id}`);
      }
    }
    console.log(`✅ Updated ${userCount} users\n`);

    // Step 3: Sync existing active memberships
    console.log('📋 Step 3: Syncing existing active memberships...');
    let syncCount = 0;

    for (const orgDoc of orgsSnapshot.docs) {
      const clubId = orgDoc.id;
      
      // Get all active memberships for this club
      const membershipsSnapshot = await db
        .collection('orgs')
        .doc(clubId)
        .collection('memberships')
        .where('status', '==', 'active')
        .get();

      for (const membershipDoc of membershipsSnapshot.docs) {
        const membershipData = membershipDoc.data();
        const userId = membershipDoc.id; // Document ID is the user ID
        const tier = membershipData.plan?.tier || membershipData.tier;

        if (!tier) {
          console.warn(`  ⚠️  Skipping membership ${membershipDoc.id} - no tier found`);
          continue;
        }

        try {
          // Update membership plan's members array
          const planRef = db
            .collection('orgs')
            .doc(clubId)
            .collection('membershipPlans')
            .doc(tier);

          const planDoc = await planRef.get();
          if (planDoc.exists) {
            await planRef.update({
              members: FieldValue.arrayUnion(userId),
              updatedAt: FieldValue.serverTimestamp()
            });
          }

          // Update user's clubMemberships map
          const userRef = db.collection('users').doc(userId);
          const userDoc = await userRef.get();
          
          if (userDoc.exists) {
            const userData = userDoc.data();
            const clubMemberships = userData?.clubMemberships || {};
            clubMemberships[clubId] = tier;

            await userRef.update({
              clubMemberships: clubMemberships,
              lastActivityAt: FieldValue.serverTimestamp()
            });
          }

          syncCount++;
          console.log(`  ✅ Synced ${tier} membership for user ${userId} in club ${clubId}`);
        } catch (error) {
          console.error(`  ❌ Error syncing membership for user ${userId}:`, error);
        }
      }
    }
    console.log(`✅ Synced ${syncCount} active memberships\n`);

    console.log('🎉 Migration completed successfully!');
    console.log('\nSummary:');
    console.log(`  - Updated ${planCount} membership plans`);
    console.log(`  - Updated ${userCount} users`);
    console.log(`  - Synced ${syncCount} active memberships`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration
migrateMembers()
  .then(() => {
    console.log('\n✅ Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration script failed:', error);
    process.exit(1);
  });
