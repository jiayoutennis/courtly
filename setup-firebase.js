#!/usr/bin/env node

/**
 * Firebase Setup Helper Script
 * This script helps you set up Firebase Admin SDK credentials
 */

const fs = require('fs');
const path = require('path');

console.log('🔥 Firebase Admin SDK Setup Helper\n');

// Check if .env.local exists
const envPath = path.join(process.cwd(), '.env.local');
const envExists = fs.existsSync(envPath);

if (envExists) {
  console.log('✅ .env.local file found');
} else {
  console.log('❌ .env.local file not found');
  console.log('\n📝 Creating .env.local template...');
  
  const envTemplate = `# Firebase Configuration
# Replace with your actual Firebase service account JSON (minified)
# Get this from Firebase Console → Project Settings → Service Accounts
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"your-project-id","private_key_id":"your-key-id","private_key":"-----BEGIN PRIVATE KEY-----\\nYOUR_PRIVATE_KEY\\n-----END PRIVATE KEY-----\\n","client_email":"your-service-account@your-project.iam.gserviceaccount.com","client_id":"your-client-id","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/your-service-account%40your-project.iam.gserviceaccount.com"}'

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key_here

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
`;

  fs.writeFileSync(envPath, envTemplate);
  console.log('✅ Created .env.local template');
}

console.log('\n📋 Next Steps:');
console.log('1. Go to Firebase Console: https://console.firebase.google.com/');
console.log('2. Select your project: courtly-by-jiayou-tennis');
console.log('3. Go to Project Settings → Service Accounts');
console.log('4. Click "Generate new private key"');
console.log('5. Download the JSON file');
console.log('6. Minify the JSON (remove all whitespace)');
console.log('7. Replace the FIREBASE_SERVICE_ACCOUNT value in .env.local');
console.log('8. Add your Stripe keys to .env.local');
console.log('9. Run: npm run dev');

console.log('\n🔗 Helpful Links:');
console.log('- Firebase Console: https://console.firebase.google.com/');
console.log('- JSON Minifier: https://jsonformatter.org/');
console.log('- Stripe Dashboard: https://dashboard.stripe.com/');
