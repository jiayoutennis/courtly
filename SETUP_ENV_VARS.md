# 🔧 Environment Variables Setup

## Create .env.local file

Create a file called `.env.local` in your project root with these variables:

```bash
# Firebase Admin SDK
# Get this from: https://console.firebase.google.com/project/courtly-by-jiayou-tennis/settings/serviceaccounts/adminsdk
# Download the JSON file, minify it, and paste it here (wrapped in single quotes)
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"courtly-by-jiayou-tennis",...}'

# Stripe Keys (Test Mode)
# Get these from: https://dashboard.stripe.com/test/apikeys
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key_here

# Stripe Connect (Test Mode)
# Get this from: https://dashboard.stripe.com/test/connect/accounts/overview
STRIPE_CONNECT_CLIENT_ID=ca_test_your_connect_client_id_here
```

## Step-by-Step Setup

### 1. Get Firebase Service Account
1. Go to: https://console.firebase.google.com/project/courtly-by-jiayou-tennis/settings/serviceaccounts/adminsdk
2. Click "Generate new private key"
3. Download the JSON file
4. **Minify the JSON** (remove all whitespace and line breaks)
5. Wrap it in single quotes and paste as `FIREBASE_SERVICE_ACCOUNT`

### 2. Get Stripe Keys
1. Go to: https://dashboard.stripe.com/test/apikeys
2. Copy the "Secret key" (starts with `sk_test_`)
3. Copy the "Publishable key" (starts with `pk_test_`)

### 3. Get Stripe Connect Client ID
1. Go to: https://dashboard.stripe.com/test/connect/accounts/overview
2. Copy the "Client ID" (starts with `ca_test_`)

### 4. Test Your Setup
```bash
node test-stripe-setup.js
```

You should see:
```
✅ All required environment variables are set
✅ Stripe keys appear to be in test mode
✅ Firebase service account configured correctly
🎉 Environment setup looks good!
```

## Next Steps

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Test Stripe Connect:**
   - Go to: `http://localhost:3000/club/[clubId]/stripe-setup`
   - Click "Connect Stripe Account"
   - Complete the Stripe onboarding

3. **Test Payment Flow:**
   - Book a court and test payment
   - Create membership plans
   - Test membership purchases

## Troubleshooting

### "Could not load default credentials"
- Check that `FIREBASE_SERVICE_ACCOUNT` is properly minified JSON
- Make sure it's wrapped in single quotes
- Restart the development server

### "Invalid API key"
- Check that your Stripe keys start with `sk_test_` and `pk_test_`
- Make sure you're using test keys, not live keys

### "Stripe Connect not working"
- Check that `STRIPE_CONNECT_CLIENT_ID` is set
- Make sure you're using the test client ID (starts with `ca_test_`)
