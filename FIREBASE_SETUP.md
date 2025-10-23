# Firebase Admin SDK Setup

## Issue
The error "Could not load the default credentials" occurs because the Firebase Admin SDK needs service account credentials to work with server-side operations.

## Solution

### Option 1: Environment Variable (Recommended for Production)
Set the `FIREBASE_SERVICE_ACCOUNT` environment variable with the minified JSON:

```bash
export FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"your-project-id",...}'
```

### Option 2: Service Account File (For Development)
1. Download the service account JSON file from Firebase Console
2. Place it in your project root (not committed to git)
3. Set the `FIREBASE_SERVICE_ACCOUNT_PATH` environment variable:

```bash
export FIREBASE_SERVICE_ACCOUNT_PATH="./your-service-account.json"
```

### Option 3: Google Cloud Default Credentials
If running on Google Cloud, the SDK can use default credentials:

```bash
gcloud auth application-default login
```

## For Vercel Deployment
Add the `FIREBASE_SERVICE_ACCOUNT` environment variable in your Vercel dashboard with the minified JSON string.

## Current Status
The membership purchase API has been temporarily modified to work without Firebase Admin SDK authentication, but some features may be limited until proper credentials are set up.
