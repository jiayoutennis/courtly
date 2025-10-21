/**
 * Cleanup Script: Fix Old Membership Plan Document IDs
 * 
 * This script finds membership plans with old timestamp-based IDs (e.g., "monthly-1234567890")
 * and recreates them with proper tier-based IDs (e.g., "monthly")
 * 
 * Run this if you have old plans created before the document ID standardization.
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
if (admin.apps.length === 0) {
  const serviceAccountPath = path.join(__dirname, '../courtly-by-jiayou-tennis-firebase-adminsdk-fbsvc-220bf9c91d.json');
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function fixPlanDocumentIds() {
  console.log('🔍 Starting membership plan document ID cleanup...\n');

  try {
    const orgsSnapshot = await db.collection('orgs').get();
    let fixedCount = 0;
    let skippedCount = 0;

    for (const orgDoc of orgsSnapshot.docs) {
      const clubId = orgDoc.id;
      const plansSnapshot = await db
        .collection('orgs')
        .doc(clubId)
        .collection('membershipPlans')
        .get();

      if (plansSnapshot.empty) {
        continue;
      }

      console.log(`\n📋 Checking club: ${clubId}`);
      console.log(`   Found ${plansSnapshot.size} plans\n`);

      for (const planDoc of plansSnapshot.docs) {
        const planId = planDoc.id;
        const planData = planDoc.data();
        const tier = planData.tier;

        // Check if document ID matches the tier
        if (planId === tier) {
          console.log(`   ✅ Plan '${planId}' - Already correct`);
          skippedCount++;
          continue;
        }

        // Check if this looks like an old timestamp-based ID
        if (planId.includes('-') || planId !== tier) {
          console.log(`   🔧 Fixing plan '${planId}' (tier: ${tier})`);

          // Check if a plan with the correct tier name already exists
          const correctPlanRef = db
            .collection('orgs')
            .doc(clubId)
            .collection('membershipPlans')
            .doc(tier);

          const correctPlanDoc = await correctPlanRef.get();

          if (correctPlanDoc.exists) {
            console.log(`   ⚠️  Plan '${tier}' already exists, deleting old plan '${planId}'`);
            await planDoc.ref.delete();
          } else {
            // Create new plan with correct ID
            console.log(`   ✨ Creating plan with correct ID: '${tier}'`);
            await correctPlanRef.set({
              ...planData,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Delete old plan
            console.log(`   🗑️  Deleting old plan '${planId}'`);
            await planDoc.ref.delete();
          }

          fixedCount++;
        }
      }
    }

    console.log('\n\n🎉 Cleanup completed!');
    console.log(`   - Fixed: ${fixedCount} plans`);
    console.log(`   - Skipped (already correct): ${skippedCount} plans`);

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    throw error;
  }
}

// Run cleanup
fixPlanDocumentIds()
  .then(() => {
    console.log('\n✅ Cleanup script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Cleanup script failed:', error);
    process.exit(1);
  });
