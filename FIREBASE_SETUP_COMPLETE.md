# 🔥 Complete Firebase Admin SDK Setup Guide

## Quick Setup (5 minutes)

### Step 1: Get Firebase Service Account Key

1. **Go to Firebase Console:**
   - Visit: https://console.firebase.google.com/
   - Select project: `courtly-by-jiayou-tennis`

2. **Generate Service Account:**
   - Click gear icon → Project Settings
   - Go to "Service Accounts" tab
   - Click "Generate new private key"
   - Download the JSON file

3. **Minify the JSON:**
   - Copy the entire JSON content
   - Go to: https://jsonformatter.org/
   - Paste JSON and click "Minify"
   - Copy the minified result

### Step 2: Update Environment Variables

Edit your `.env.local` file and replace the `FIREBASE_SERVICE_ACCOUNT` value:

```bash
# Replace this line in .env.local:
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"courtly-by-jiayou-tennis",...}'
```

### Step 3: Add Stripe Keys

Get your Stripe keys from: https://dashboard.stripe.com/test/apikeys

```bash
# Add to .env.local:
STRIPE_SECRET_KEY=sk_test_your_actual_stripe_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_actual_stripe_publishable_key
```

### Step 4: Test the Setup

```bash
npm run dev
```

You should see:
- ✅ "Loaded service account from environment variable"
- ✅ "Firebase Admin initialized with service account"
- No more "Could not load default credentials" errors

## Alternative: File-Based Setup (For Development)

If you prefer using a file instead of environment variables:

1. **Download the service account JSON file**
2. **Place it in your project root:**
   ```
   /Users/lcp/Desktop/JiaYou Tennis/Courtly/courtly/firebase-service-account.json
   ```

3. **Add to .env.local:**
   ```bash
   FIREBASE_SERVICE_ACCOUNT_PATH="./firebase-service-account.json"
   ```

4. **Add to .gitignore:**
   ```gitignore
   firebase-service-account.json
   *.json
   ```

## For Vercel Deployment

1. **Go to Vercel Dashboard:**
   - Select your project
   - Go to Settings → Environment Variables

2. **Add these variables:**
   - `FIREBASE_SERVICE_ACCOUNT` = (your minified JSON)
   - `STRIPE_SECRET_KEY` = (your Stripe secret key)
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` = (your Stripe publishable key)

## Troubleshooting

### Error: "Could not load default credentials"
- ✅ Make sure `FIREBASE_SERVICE_ACCOUNT` is set in `.env.local`
- ✅ Make sure the JSON is properly minified (no line breaks)
- ✅ Make sure the JSON is wrapped in single quotes

### Error: "Invalid JSON"
- ✅ Use a JSON minifier to remove all whitespace
- ✅ Make sure there are no line breaks in the JSON
- ✅ Check that all quotes are properly escaped

### Error: "Project not found"
- ✅ Make sure you're using the correct project ID: `courtly-by-jiayou-tennis`
- ✅ Make sure the service account has the right permissions

## What This Fixes

Once set up, these features will work:
- ✅ Stripe products creation and listing
- ✅ Payment methods management
- ✅ Stripe Connect account status
- ✅ Setup intents for saving cards
- ✅ All API routes that use Firebase Admin SDK

## Security Notes

- ✅ Never commit service account keys to git
- ✅ Use environment variables in production
- ✅ Rotate keys regularly
- ✅ Use least-privilege access

## Need Help?

If you're still having issues:
1. Check the console logs for specific error messages
2. Verify your Firebase project ID matches
3. Make sure the service account has the right permissions
4. Try the file-based approach as an alternative
