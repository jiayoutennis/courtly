/**
 * Firebase Admin SDK Configuration
 * For server-side operations that need to bypass security rules
 * Used in API routes and webhooks
 */

import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import * as fs from 'fs';
import * as path from 'path';

let adminApp: App;

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  // Try to use service account credentials if available
  // Option 1: From environment variable (minified JSON string)
  // Option 2: From file path (easier for development)
  
  let serviceAccount: any = null;
  
  // Try to load from file first (if FIREBASE_SERVICE_ACCOUNT_PATH is set)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    try {
      const serviceAccountPath = path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
      const fileContents = fs.readFileSync(serviceAccountPath, 'utf8');
      serviceAccount = JSON.parse(fileContents);
      console.log('✅ Loaded service account from file');
    } catch (error) {
      console.error('Failed to load service account from file:', error);
    }
  }
  
  // If not loaded from file, try environment variable
  if (!serviceAccount && process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      console.log('✅ Loaded service account from environment variable');
    } catch (error) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT:', error);
      console.error('Make sure it is valid minified JSON on a single line');
    }
  }
  
  // Initialize with service account if available
  if (serviceAccount) {
    adminApp = initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
    console.log('✅ Firebase Admin initialized with service account');
  } else {
    // Fallback: Basic initialization (won't work for webhooks in production)
    console.warn('⚠️  No service account credentials found. Webhook updates will fail.');
    console.warn('Set FIREBASE_SERVICE_ACCOUNT_PATH to the path of your service account JSON file');
    console.warn('Or set FIREBASE_SERVICE_ACCOUNT with minified JSON string');
    adminApp = initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'courtly-by-jiayou-tennis',
    });
  }
} else {
  adminApp = getApps()[0] as App;
}

export const adminDb = getFirestore(adminApp);
export const adminAuth = getAuth(adminApp);
export { adminApp };
