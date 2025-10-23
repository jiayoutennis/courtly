# 🧪 Stripe Connect Integration Testing Guide

## Prerequisites

### 1. Environment Setup
Make sure you have these environment variables in `.env.local`:

```bash
# Firebase Admin SDK
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'

# Stripe Keys (Test Mode)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key

# Stripe Connect (Test Mode)
STRIPE_CONNECT_CLIENT_ID=ca_test_your_connect_client_id
```

### 2. Start Development Server
```bash
npm run dev
```

## Testing Scenarios

### 🏢 **Scenario 1: Club Admin - Stripe Connect Setup**

**Goal:** Test the complete Stripe Connect onboarding flow

**Steps:**
1. **Login as a club admin**
   - Go to `/club/[clubId]/stripe-setup`
   - You should see "Stripe Not Connected" status

2. **Connect Stripe Account**
   - Click "Connect Stripe Account"
   - Should redirect to Stripe Connect onboarding
   - Complete the Stripe Express account setup
   - Return to your app

3. **Verify Connection**
   - Should see "Stripe Connected ✅" status
   - Check that `chargesEnabled` and `payoutsEnabled` are displayed
   - Click "Open Stripe Dashboard" to verify access

**Expected Results:**
- ✅ Redirects to Stripe Connect onboarding
- ✅ Returns to app after completion
- ✅ Status updates to "active"
- ✅ Dashboard link works

### 💳 **Scenario 2: Create Membership Plans**

**Goal:** Test membership plan creation and management

**Steps:**
1. **Navigate to Stripe Setup Page**
   - Go to `/club/[clubId]/stripe-setup`
   - Should see membership plan editor

2. **Create a Membership Plan**
   - Plan Name: "Monthly Membership"
   - Price: $49.00
   - Billing Interval: Monthly
   - Click "Create Plan"

3. **Verify Plan Creation**
   - Plan should appear in "Existing Plans" section
   - Should show as "Active"
   - Should have Stripe price ID

**Expected Results:**
- ✅ Plan created successfully
- ✅ Stripe product and price created
- ✅ Plan appears in list
- ✅ Can toggle active/inactive

### 🏟️ **Scenario 3: Court Reservation Payment**

**Goal:** Test payment processing for court bookings

**Steps:**
1. **Book a Court**
   - Go to `/club/[clubId]/court-schedule`
   - Select a time slot
   - Click "Confirm Booking"

2. **Payment Flow**
   - Should redirect to Stripe Checkout
   - Complete payment with test card: `4242 4242 4242 4242`
   - Return to app

3. **Verify Booking**
   - Check `/my-bookings` page
   - Booking should appear as "confirmed"
   - Check Stripe dashboard for payment

**Expected Results:**
- ✅ Redirects to Stripe Checkout
- ✅ Payment processes successfully
- ✅ Booking confirmed
- ✅ Payment appears in Stripe dashboard

### 👥 **Scenario 4: Membership Purchase**

**Goal:** Test membership subscription flow

**Steps:**
1. **Navigate to Membership Page**
   - Go to `/club/[clubId]/membership`
   - Should see available membership plans

2. **Purchase Membership**
   - Click on a membership plan
   - Should redirect to Stripe Checkout
   - Complete payment with test card

3. **Verify Membership**
   - Check user's membership status
   - Verify subscription in Stripe dashboard

**Expected Results:**
- ✅ Membership plan displayed
- ✅ Stripe Checkout redirects
- ✅ Payment processes
- ✅ Membership activated

### 🔄 **Scenario 5: Webhook Processing**

**Goal:** Test real-time webhook updates

**Steps:**
1. **Set up Webhook Endpoint**
   - In Stripe Dashboard, go to Webhooks
   - Add endpoint: `https://your-domain.com/api/payments/stripe/webhook`
   - Select events: `checkout.session.completed`, `payment_intent.succeeded`

2. **Trigger Events**
   - Complete a court booking payment
   - Purchase a membership

3. **Verify Webhook Processing**
   - Check app logs for webhook events
   - Verify database updates
   - Check booking/membership status

**Expected Results:**
- ✅ Webhooks received
- ✅ Database updated
- ✅ Status changes reflected

## Test Cards (Stripe Test Mode)

Use these test card numbers:

```bash
# Successful payments
4242 4242 4242 4242  # Visa
4000 0566 5566 5556  # Visa (debit)
5555 5555 5555 4444  # Mastercard

# Declined payments
4000 0000 0000 0002  # Card declined
4000 0000 0000 9995  # Insufficient funds
4000 0000 0000 0069  # Expired card
```

## Debugging Tips

### 1. Check Console Logs
```bash
# In browser console, look for:
- "Stripe Connect status: active"
- "Payment session created"
- "Webhook received"
```

### 2. Check Network Tab
- Look for API calls to `/api/payments/stripe/*`
- Verify request/response data
- Check for error responses

### 3. Check Stripe Dashboard
- Go to https://dashboard.stripe.com/test
- Check "Connect" section for accounts
- Check "Payments" for transactions
- Check "Products" for created plans

### 4. Check Firebase Console
- Go to https://console.firebase.google.com/
- Check Firestore for updated documents
- Verify club documents have Stripe fields

## Common Issues & Solutions

### Issue: "Could not load default credentials"
**Solution:** 
- Check `FIREBASE_SERVICE_ACCOUNT` in `.env.local`
- Make sure JSON is properly minified
- Restart development server

### Issue: "Stripe Connect not redirecting"
**Solution:**
- Check `STRIPE_CONNECT_CLIENT_ID` is set
- Verify Stripe Connect is enabled in your Stripe account
- Check browser console for errors

### Issue: "Payment not processing"
**Solution:**
- Check `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- Verify you're using test keys (not live keys)
- Check Stripe dashboard for error logs

### Issue: "Webhook not receiving events"
**Solution:**
- Check webhook endpoint URL is correct
- Verify webhook is enabled in Stripe dashboard
- Check server logs for webhook processing

## Testing Checklist

- [ ] Environment variables set correctly
- [ ] Development server running without errors
- [ ] Stripe Connect onboarding works
- [ ] Membership plans can be created
- [ ] Court booking payments work
- [ ] Membership purchases work
- [ ] Webhooks process correctly
- [ ] Dashboard access works
- [ ] Status updates in real-time
- [ ] Error handling works properly

## Production Testing

Before going live:

1. **Switch to Live Keys**
   - Update environment variables with live Stripe keys
   - Test with real (small) payments
   - Verify webhook endpoints

2. **Security Review**
   - Ensure all API routes are protected
   - Verify webhook signature validation
   - Check for any exposed sensitive data

3. **Performance Testing**
   - Test with multiple concurrent payments
   - Verify webhook processing speed
   - Check database performance

## Need Help?

If you encounter issues:
1. Check the console logs first
2. Verify all environment variables
3. Test with Stripe's test cards
4. Check the Stripe dashboard for errors
5. Review the webhook logs
