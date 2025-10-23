#!/usr/bin/env node

/**
 * Firebase Service Account Setup Helper
 * This script helps you download and set up the Firebase service account
 */

const fs = require('fs');
const path = require('path');

console.log('🔥 Firebase Service Account Setup Helper\n');

console.log('📋 Steps to get your Firebase service account:');
console.log('');
console.log('1. Go to: https://console.firebase.google.com/project/courtly-by-jiayou-tennis/settings/serviceaccounts/adminsdk');
console.log('');
console.log('2. Click "Generate new private key"');
console.log('');
console.log('3. Download the JSON file');
console.log('');
console.log('4. Save it as "firebase-service-account.json" in your project root');
console.log('');
console.log('5. Run this script again to verify setup');
console.log('');

// Check if file exists
const serviceAccountPath = path.join(process.cwd(), 'firebase-service-account.json');

if (fs.existsSync(serviceAccountPath)) {
  console.log('✅ Firebase service account file found!');
  
  try {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    
    if (serviceAccount.project_id === 'courtly-by-jiayou-tennis') {
      console.log('✅ Project ID matches: courtly-by-jiayou-tennis');
      console.log('✅ Setup complete! You can now test Stripe Connect.');
      console.log('');
      console.log('🧪 Test your setup:');
      console.log('   npm run dev');
      console.log('   Go to: http://localhost:3000/club/[clubId]/stripe-setup');
    } else {
      console.log('❌ Project ID mismatch. Expected: courtly-by-jiayou-tennis');
      console.log(`   Found: ${serviceAccount.project_id}`);
    }
  } catch (error) {
    console.log('❌ Error reading service account file:', error.message);
  }
} else {
  console.log('❌ Firebase service account file not found.');
  console.log('   Please download it from the Firebase Console and save it as "firebase-service-account.json"');
}

console.log('');
console.log('📖 For more help, see: FIREBASE_SETUP_COMPLETE.md');
