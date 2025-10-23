#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing .env.local file...\n');

// Read the current .env.local file
const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

// Remove duplicate FIREBASE_SERVICE_ACCOUNT_PATH entries
const lines = envContent.split('\n');
const filteredLines = [];
const seenPaths = new Set();

for (const line of lines) {
  if (line.startsWith('FIREBASE_SERVICE_ACCOUNT_PATH=')) {
    if (!seenPaths.has('FIREBASE_SERVICE_ACCOUNT_PATH')) {
      filteredLines.push('FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json');
      seenPaths.add('FIREBASE_SERVICE_ACCOUNT_PATH');
    }
  } else {
    filteredLines.push(line);
  }
}

// Write the cleaned file
const cleanedContent = filteredLines.join('\n');
fs.writeFileSync(envPath, cleanedContent);

console.log('✅ Removed duplicate FIREBASE_SERVICE_ACCOUNT_PATH entries');
console.log('✅ Set correct path: ./firebase-service-account.json');
console.log('');
console.log('🧪 Now test your setup:');
console.log('   npm run dev');
console.log('   Go to: http://localhost:3002/club/[clubId]/stripe-setup');
