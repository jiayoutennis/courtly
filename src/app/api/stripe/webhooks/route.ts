import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { STRIPE_CONFIG } from '@/lib/stripe/config';
import { addUserToMembershipTierAdmin, MembershipTier } from '@/lib/membershipSyncAdmin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover' as any, // Matches Stripe account API version
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headersList = await headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      console.error('No Stripe signature found');
      return NextResponse.json(
        { error: 'No signature' },
        { status: 400 }
      );
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: `Webhook Error: ${err instanceof Error ? err.message : 'Unknown error'}` },
        { status: 400 }
      );
    }

    console.log('✅ Webhook verified:', event.type);

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('Checkout session completed:', session.id);
        
        // Check payment type from metadata
        const paymentType = session.metadata?.type;
        
        if (paymentType === 'booking') {
          // Handle booking payment
          await handleBookingPayment(session);
        } else if (paymentType === 'membership') {
          // Handle membership payment
          await handleMembershipPayment(session);
        } else if (paymentType === 'account_credit') {
          // Handle account credit payment
          await handleAccountCreditPayment(session);
        } else if (session.subscription && session.metadata?.clubId) {
          // Handle club subscription (existing logic)
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          );
          
          await updateOrgSubscription(
            session.metadata.clubId,
            subscription,
            'active'
          );
        }
        break;
      }

      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log('Subscription created:', subscription.id);
        
        // Find the org by Stripe customer ID
        const clubId = await findClubByCustomerId(subscription.customer as string);
        if (clubId) {
          await updateOrgSubscription(clubId, subscription, 'active');
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log('Subscription updated:', subscription.id);
        
        // Check if subscription is set to cancel at period end
        if (subscription.cancel_at_period_end) {
          console.log(`⏱️ Subscription will cancel at end of period: ${new Date(subscription.current_period_end * 1000).toISOString()}`);
        }
        
        // Check if this is a membership subscription or club subscription
        if (subscription.metadata?.type === 'membership') {
          // Handle membership subscription update
          await handleMembershipUpdate(subscription);
        } else {
          // Handle club subscription update (existing logic)
          const clubId = await findClubByCustomerId(subscription.customer as string);
          if (clubId) {
            await updateOrgSubscription(
              clubId,
              subscription,
              subscription.status
            );
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log('Subscription deleted:', subscription.id);
        
        // Check if this is a membership subscription or club subscription
        if (subscription.metadata?.type === 'membership') {
          // Handle membership subscription cancellation
          await handleMembershipCancellation(subscription);
        } else {
          // Handle club subscription cancellation (existing logic)
          const clubId = await findClubByCustomerId(subscription.customer as string);
          if (clubId) {
            // When subscription is fully deleted, revert to free plan
            const orgRef = adminDb.collection('orgs').doc(clubId);
            await orgRef.update({
              'subscription.plan': 'free',
              'subscription.status': 'canceled',
              'subscription.stripeSubscriptionId': '',
              'subscription.cancelAtPeriodEnd': false,
              updatedAt: FieldValue.serverTimestamp(),
            });
            console.log(`✅ Subscription fully canceled, reverted to free plan for club ${clubId}`);
          }
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('Payment succeeded for invoice:', invoice.id);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('Payment failed for invoice:', invoice.id);
        
        const clubId = await findClubByCustomerId(invoice.customer as string);
        if (clubId) {
          // Update subscription status to past_due
          const orgRef = adminDb.collection('orgs').doc(clubId);
          await orgRef.update({
            'subscription.status': 'past_due',
            'subscription.lastPaymentFailed': FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

// Helper function to update organization subscription in Firestore
async function updateOrgSubscription(
  clubId: string,
  subscription: Stripe.Subscription,
  status: string
) {
  try {
    const orgRef = adminDb.collection('orgs').doc(clubId);
    
    // Determine plan from price ID using config
    const priceId = subscription.items.data[0]?.price.id;
    let plan: 'free' | 'basic' | 'pro' | 'enterprise' = 'free';
    
    // Map price ID to plan using STRIPE_CONFIG
    for (const [planKey, planConfig] of Object.entries(STRIPE_CONFIG.plans)) {
      if (planConfig.stripePriceId && planConfig.stripePriceId === priceId) {
        plan = planKey as 'free' | 'basic' | 'pro' | 'enterprise';
        console.log(`✅ Matched price ID ${priceId} to plan: ${plan}`);
        break;
      }
    }
    
    if (plan === 'free' && priceId) {
      console.warn(`⚠️ Unknown price ID: ${priceId}, defaulting to free plan`);
    }

    console.log('Subscription data from Stripe:', {
      id: subscription.id,
      priceId,
      plan,
      status,
      current_period_start: subscription.current_period_start,
      current_period_end: subscription.current_period_end,
    });

    // Get current subscription to log the change
    let oldPlan: string | undefined;
    try {
      const orgDoc = await orgRef.get();
      if (orgDoc.exists) {
        const orgData = orgDoc.data();
        oldPlan = orgData?.subscription?.plan;
      }
    } catch (e) {
      console.warn('Could not fetch old subscription data for logging:', e);
    }

    const subscriptionData = {
      plan,
      status,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: subscription.customer as string,
      stripePriceId: priceId || '',
      currentPeriodStart: subscription.current_period_start || 0,
      currentPeriodEnd: subscription.current_period_end || 0,
      cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
    };

    console.log('Updating org subscription:', {
      clubId,
      oldPlan: oldPlan || 'unknown',
      newPlan: plan,
      status,
    });

    await orgRef.update({
      subscription: subscriptionData,
      stripeCustomerId: subscription.customer as string,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const changeMessage = oldPlan && oldPlan !== plan 
      ? `${oldPlan} → ${plan}` 
      : plan;
    
    console.log(`✅ Successfully updated org ${clubId} subscription: ${changeMessage}`, {
      status,
      subscriptionId: subscription.id,
      priceId,
    });
  } catch (error) {
    console.error('❌ Error updating org subscription:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

// Helper function to handle booking payment
async function handleBookingPayment(session: Stripe.Checkout.Session) {
  try {
    const metadata = session.metadata;
    if (!metadata) {
      console.error('No metadata found in session');
      return;
    }

    const { userId, clubId, courtId, courtName, date, startTime, endTime, notes } = metadata;
    
    if (!userId || !clubId || !courtId || !date || !startTime || !endTime) {
      console.error('Missing required metadata fields');
      return;
    }
    
    console.log('Processing booking payment:', {
      userId,
      clubId,
      courtId,
      date,
      startTime,
      endTime,
    });

    // Create booking document
    const bookingData = {
      courtId,
      courtName: courtName || '',
      date,
      startTime,
      endTime,
      userId,
      userName: '', // Will be populated from user doc if needed
      notes: notes || '',
      status: 'confirmed',
      paymentId: session.payment_intent as string,
      paymentStatus: 'completed',
      amount: session.amount_total ? session.amount_total / 100 : 0, // Convert from cents
      currency: session.currency,
      stripeCheckoutSessionId: session.id,
      createdAt: FieldValue.serverTimestamp(),
    };

    // Add booking to club's bookings subcollection
    const bookingRef = await adminDb
      .collection('orgs')
      .doc(clubId)
      .collection('bookings')
      .add(bookingData);

    console.log(`✅ Created booking ${bookingRef.id} for user ${userId}`);

    // Create payment record
    const paymentData = {
      paymentId: session.payment_intent as string,
      userId,
      orgId: clubId,
      type: 'booking',
      amount: session.amount_total ? session.amount_total / 100 : 0,
      currency: session.currency,
      status: 'completed',
      stripeCheckoutSessionId: session.id,
      metadata: {
        bookingId: bookingRef.id,
        courtId,
        date,
        startTime,
        endTime,
      },
      createdAt: FieldValue.serverTimestamp(),
      completedAt: FieldValue.serverTimestamp(),
    };

    await adminDb.collection('payments').add(paymentData);
    console.log(`✅ Created payment record for booking`);

  } catch (error) {
    console.error('❌ Error handling booking payment:', error);
    throw error;
  }
}

// Helper function to handle membership payment
async function handleMembershipCancellation(subscription: Stripe.Subscription) {
  try {
    const metadata = subscription.metadata;
    if (!metadata) {
      console.error('No metadata found in subscription');
      return;
    }

    const { userId, clubId, membershipTier } = metadata;
    
    if (!userId || !clubId || !membershipTier) {
      console.error('Missing required metadata fields for cancellation');
      return;
    }
    
    console.log('Processing membership cancellation:', {
      userId,
      clubId,
      membershipTier,
      subscriptionId: subscription.id,
    });

    // Update membership status in /orgs/{clubId}/memberships/{userId}
    const membershipRef = adminDb
      .collection('orgs')
      .doc(clubId)
      .collection('memberships')
      .doc(userId);

    const membershipDoc = await membershipRef.get();
    
    if (membershipDoc.exists) {
      await membershipRef.update({
        status: 'canceled',
        autoRenew: false,
        updatedAt: FieldValue.serverTimestamp(),
      });
      console.log(`✅ Updated membership status to canceled for user ${userId}`);
    }

    // Remove user from membership tracking (two-way sync)
    const { removeUserFromMembershipTierAdmin } = await import('@/lib/membershipSyncAdmin');
    await removeUserFromMembershipTierAdmin(userId, clubId, membershipTier as MembershipTier);
    console.log(`✅ Removed user from membership tracking for tier ${membershipTier}`);

  } catch (error) {
    console.error('❌ Error handling membership cancellation:', error);
    throw error;
  }
}

async function handleMembershipPayment(session: Stripe.Checkout.Session) {
  try {
    const metadata = session.metadata;
    if (!metadata) {
      console.error('No metadata found in session');
      return;
    }

    const { userId, clubId, membershipPlanId, membershipTier } = metadata;
    
    if (!userId || !clubId || !membershipTier) {
      console.error('Missing required metadata fields');
      return;
    }
    
    console.log('Processing membership payment:', {
      userId,
      clubId,
      membershipTier,
    });

    // Calculate membership period based on tier
    const now = new Date();
    let endDate: Date;
    
    if (membershipTier === 'monthly') {
      endDate = new Date(now);
      endDate.setMonth(endDate.getMonth() + 1);
    } else if (membershipTier === 'annual') {
      endDate = new Date(now);
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      // day_pass
      endDate = new Date(now);
      endDate.setDate(endDate.getDate() + 1);
    }

    // Create membership document
    const membershipData = {
      userId,
      orgId: clubId,
      status: 'active',
      tier: membershipTier,
      startDate: FieldValue.serverTimestamp(),
      endDate: endDate,
      stripeCustomerId: session.customer as string,
      paymentId: session.payment_intent as string || session.subscription as string,
      stripeCheckoutSessionId: session.id,
      autoRenew: !!session.subscription, // True if subscription, false for one-time
      amount: session.amount_total ? session.amount_total / 100 : 0,
      currency: session.currency,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    // If subscription, add subscription ID
    if (session.subscription) {
      (membershipData as any).stripeSubscriptionId = session.subscription as string;
    }

    // Create membership in org's memberships subcollection (primary location)
    // Use userId as document ID for easy lookup
    const orgMembershipRef = adminDb
      .collection('orgs')
      .doc(clubId)
      .collection('memberships')
      .doc(userId);
    
    await orgMembershipRef.set(membershipData);
    console.log(`✅ Created membership for user ${userId} in org ${clubId}`);

    // Update user document to add club to their organization array if not already there
    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (userDoc.exists) {
      const userData = userDoc.data();
      const currentOrg = userData?.organization || [];
      
      let updatedOrg: string[];
      if (Array.isArray(currentOrg)) {
        updatedOrg = currentOrg.includes(clubId) ? currentOrg : [...currentOrg, clubId];
      } else if (typeof currentOrg === 'string') {
        updatedOrg = currentOrg === clubId ? [currentOrg] : [currentOrg, clubId];
      } else {
        updatedOrg = [clubId];
      }
      
      await userRef.update({
        organization: updatedOrg,
        updatedAt: FieldValue.serverTimestamp(),
      });
      
      console.log(`✅ Added club ${clubId} to user ${userId} organizations`);
    }

    // Create payment record
    const paymentData = {
      paymentId: session.payment_intent as string || session.subscription as string,
      userId,
      orgId: clubId,
      type: 'membership',
      amount: session.amount_total ? session.amount_total / 100 : 0,
      currency: session.currency,
      status: 'completed',
      stripeCheckoutSessionId: session.id,
      metadata: {
        membershipId: userId, // Document ID is the userId
        membershipTier,
        membershipPlanId: membershipPlanId || '',
      },
      createdAt: FieldValue.serverTimestamp(),
      completedAt: FieldValue.serverTimestamp(),
    };

    await adminDb.collection('payments').add(paymentData);
    console.log(`✅ Created payment record for membership`);

    // Sync membership - add user to plan's members array and update user's clubMemberships map
    console.log(`[Webhook] About to sync membership tracking with tier: ${membershipTier}`);
    console.log(`[Webhook] Sync params:`, { userId, clubId, membershipTier, tierType: typeof membershipTier });
    
    try {
      await addUserToMembershipTierAdmin(userId, clubId, membershipTier as MembershipTier);
      console.log(`✅ Synced membership tracking for user ${userId} in club ${clubId}`);
      
      // Log success to database for debugging
      await adminDb.collection('webhookLogs').add({
        event: 'membership_sync_success',
        userId,
        clubId,
        tier: membershipTier,
        timestamp: FieldValue.serverTimestamp(),
      });
    } catch (syncError: any) {
      console.error(`❌ Failed to sync membership tracking:`, syncError);
      console.error(`❌ Sync error details:`, {
        message: syncError.message,
        stack: syncError.stack,
      });
      
      // Log error to database for debugging
      await adminDb.collection('webhookLogs').add({
        event: 'membership_sync_error',
        userId,
        clubId,
        tier: membershipTier,
        error: syncError.message,
        errorStack: syncError.stack,
        timestamp: FieldValue.serverTimestamp(),
      });
      // Don't throw - membership is already created, sync is secondary
    }

  } catch (error) {
    console.error('❌ Error handling membership payment:', error);
    throw error;
  }
}

// Handle membership subscription update (renewals, status changes)
async function handleMembershipUpdate(subscription: Stripe.Subscription) {
  try {
    const metadata = subscription.metadata;
    if (!metadata) {
      console.error('No metadata found in subscription');
      return;
    }

    const { userId, clubId, membershipTier } = metadata;
    
    if (!userId || !clubId || !membershipTier) {
      console.error('Missing required metadata fields for membership update');
      return;
    }
    
    console.log('Processing membership subscription update:', {
      userId,
      clubId,
      membershipTier,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end
    });

    // Update membership status in /orgs/{clubId}/memberships/{userId}
    const membershipRef = adminDb
      .collection('orgs')
      .doc(clubId)
      .collection('memberships')
      .doc(userId);

    const membershipDoc = await membershipRef.get();
    
    if (membershipDoc.exists) {
      const updateData: any = {
        status: subscription.status,
        updatedAt: FieldValue.serverTimestamp(),
      };
      
      // Update end date if subscription is renewed
      if (subscription.current_period_end) {
        updateData.endDate = new Date(subscription.current_period_end * 1000);
      }
      
      // Update auto-renew status
      if (subscription.cancel_at_period_end !== undefined) {
        updateData.autoRenew = !subscription.cancel_at_period_end;
      }
      
      await membershipRef.update(updateData);
      console.log(`✅ Updated membership for user ${userId}`);
    }

  } catch (error) {
    console.error('❌ Error handling membership update:', error);
    throw error;
  }
}

// Handle account credit payment
async function handleAccountCreditPayment(session: Stripe.Checkout.Session) {
  try {
    const metadata = session.metadata;
    if (!metadata) {
      console.error('No metadata found in session');
      return;
    }

    const { userId, clubId, amount: amountStr } = metadata;
    const amount = parseInt(amountStr || '0');
    
    if (!userId || !clubId || !amount) {
      console.error('Missing required metadata fields');
      return;
    }
    
    console.log('Processing account credit payment:', {
      userId,
      clubId,
      amount,
      sessionId: session.id,
    });

    // Add credit to user's account balance
    const balanceRef = adminDb
      .collection('users')
      .doc(userId)
      .collection('accountBalances')
      .doc(clubId);
    
    const balanceDoc = await balanceRef.get();
    const currentBalance = balanceDoc.exists ? (balanceDoc.data()?.balance || 0) : 0;
    const newBalance = currentBalance + amount;

    await balanceRef.set(
      {
        balance: newBalance,
        clubId: clubId,
        userId: userId,
        currency: 'usd',
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // Create transaction record
    const transactionRef = balanceRef.collection('transactions').doc();
    await transactionRef.set({
      type: 'credit',
      amount: amount,
      description: 'Added funds via Stripe',
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
      stripePaymentIntentId: session.payment_intent as string || '',
      stripeCheckoutSessionId: session.id,
      createdAt: FieldValue.serverTimestamp(),
    });

    console.log(`✅ Added ${amount} cents credit to user ${userId} account for club ${clubId}`);
    console.log(`Balance: ${currentBalance} → ${newBalance}`);

    // Create payment record
    const paymentData = {
      paymentId: session.payment_intent as string || session.id,
      userId,
      orgId: clubId,
      type: 'account_credit',
      amount: session.amount_total ? session.amount_total / 100 : 0,
      currency: session.currency,
      status: 'completed',
      stripeCheckoutSessionId: session.id,
      metadata: {
        creditAmount: amount,
      },
      createdAt: FieldValue.serverTimestamp(),
      completedAt: FieldValue.serverTimestamp(),
    };

    await adminDb.collection('payments').add(paymentData);
    console.log(`✅ Created payment record for account credit`);

  } catch (error) {
    console.error('Error handling account credit payment:', error);
    throw error;
  }
}

// Helper function to find club by Stripe customer ID
async function findClubByCustomerId(customerId: string): Promise<string | null> {
  try {
    // Query Firestore for the org with this stripeCustomerId
    const orgsRef = adminDb.collection('orgs');
    const querySnapshot = await orgsRef
      .where('stripeCustomerId', '==', customerId)
      .limit(1)
      .get();

    if (querySnapshot.empty) {
      console.warn('No club found for customer ID:', customerId);
      return null;
    }

    const firstDoc = querySnapshot.docs[0];
    if (!firstDoc) {
      console.warn('No club document found for customer ID:', customerId);
      return null;
    }

    const clubId = firstDoc.id;
    console.log('Found club for customer:', { customerId, clubId });
    return clubId;
  } catch (error) {
    console.error('Error finding club:', error);
    return null;
  }
}
