#!/usr/bin/env node

/**
 * Quick User Data Checker
 * This script helps check user data in Firestore
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

console.log('🔍 Checking User Data in Firestore...\n');

// Initialize Firebase Admin
let adminApp;
try {
  const serviceAccountPath = path.resolve(process.cwd(), './firebase-service-account.json');
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  
  adminApp = initializeApp({
    credential: cert(serviceAccount)
  });
  
  console.log('✅ Firebase Admin initialized');
} catch (error) {
  console.error('❌ Error initializing Firebase Admin:', error.message);
  process.exit(1);
}

const adminDb = getFirestore(adminApp);

async function checkUserData() {
  try {
    // Get all users and check their admin status
    const usersSnapshot = await adminDb.collection('users').get();
    
    console.log(`Found ${usersSnapshot.size} users in the database\n`);
    
    usersSnapshot.forEach((doc) => {
      const userData = doc.data();
      console.log(`👤 User: ${doc.id}`);
      console.log(`   Email: ${userData.email || 'N/A'}`);
      console.log(`   User Type: ${userData.userType || 'N/A'}`);
      console.log(`   Organization: ${JSON.stringify(userData.organization) || 'N/A'}`);
      console.log(`   Full Name: ${userData.fullName || 'N/A'}`);
      console.log('');
    });
    
    console.log('📋 To check a specific user, run:');
    console.log('   node check-user-data.js <userId>');
    
  } catch (error) {
    console.error('❌ Error checking user data:', error.message);
  }
}

async function checkSpecificUser(userId) {
  try {
    const userDoc = await adminDb.collection('users').doc(userId).get();
    
    if (userDoc.exists) {
      const userData = userDoc.data();
      console.log(`👤 User: ${userId}`);
      console.log(`   Email: ${userData.email || 'N/A'}`);
      console.log(`   User Type: ${userData.userType || 'N/A'}`);
      console.log(`   Organization: ${JSON.stringify(userData.organization) || 'N/A'}`);
      console.log(`   Full Name: ${userData.fullName || 'N/A'}`);
      console.log('');
      
      if (userData.userType === 'admin') {
        console.log('✅ User is an admin');
        if (userData.organization && Array.isArray(userData.organization)) {
          console.log(`✅ User has access to clubs: ${userData.organization.join(', ')}`);
        } else {
          console.log('❌ User organization field is not an array or is missing');
        }
      } else {
        console.log(`❌ User is not an admin (userType: ${userData.userType})`);
      }
    } else {
      console.log(`❌ User ${userId} not found in database`);
    }
    
  } catch (error) {
    console.error('❌ Error checking specific user:', error.message);
  }
}

// Get command line arguments
const args = process.argv.slice(2);
const userId = args[0];

if (userId) {
  checkSpecificUser(userId);
} else {
  checkUserData();
}
