/**
 * Account Balance Utility Functions
 * Handles account balance operations, transactions, and balance calculations
 */

import { db } from '../../firebase';
import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  getDocs,
  serverTimestamp,
  runTransaction,
  orderBy,
  limit as limitQuery
} from 'firebase/firestore';
import type { 
  BalanceTransaction, 
  BalanceTransactionType,
  AccountBalanceSettings 
} from '../../shared/types';

/**
 * Get user's account balance for a specific club
 * @param userId - User ID
 * @param clubId - Club/Organization ID
 * @returns Balance in cents (positive = credit, negative = owed)
 */
export async function getAccountBalance(
  userId: string, 
  clubId: string
): Promise<number> {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    
    if (!userDoc.exists()) {
      return 0;
    }
    
    const userData = userDoc.data();
    const balances = userData.accountBalances || {};
    
    return balances[clubId] || 0;
  } catch (error) {
    console.error('Error getting account balance:', error);
    return 0;
  }
}

/**
 * Add a balance transaction and update user's balance
 * @param transaction - Transaction details
 * @returns Transaction ID
 */
export async function addBalanceTransaction(
  userId: string,
  clubId: string,
  type: BalanceTransactionType,
  amount: number, // in cents (positive = add credit, negative = charge)
  description: string,
  metadata?: {
    relatedBookingId?: string;
    relatedPaymentId?: string;
    stripePaymentIntentId?: string;
    createdBy?: string;
    [key: string]: any;
  }
): Promise<string> {
  try {
    // Run as a transaction to ensure atomicity
    const transactionResult = await runTransaction(db, async (transaction) => {
      // Get current user balance
      const userRef = doc(db, 'users', userId);
      const userDoc = await transaction.get(userRef);
      
      if (!userDoc.exists()) {
        throw new Error('User not found');
      }
      
      const userData = userDoc.data();
      const currentBalances = userData.accountBalances || {};
      const currentBalance = currentBalances[clubId] || 0;
      const newBalance = currentBalance + amount;
      
      // Update user's balance
      transaction.update(userRef, {
        [`accountBalances.${clubId}`]: newBalance,
        updatedAt: serverTimestamp()
      });
      
      // Create balance transaction record (only include defined fields)
      const transactionData: any = {
        userId,
        orgId: clubId,
        type,
        amount,
        balanceAfter: newBalance,
        currency: 'usd',
        description,
        createdBy: metadata?.createdBy || userId,
        createdAt: serverTimestamp()
      };
      
      // Only add optional fields if they have values
      if (metadata?.relatedBookingId) {
        transactionData.relatedBookingId = metadata.relatedBookingId;
      }
      if (metadata?.relatedPaymentId) {
        transactionData.relatedPaymentId = metadata.relatedPaymentId;
      }
      if (metadata?.stripePaymentIntentId) {
        transactionData.stripePaymentIntentId = metadata.stripePaymentIntentId;
      }
      if (metadata && Object.keys(metadata).length > 0) {
        transactionData.metadata = metadata;
      }
      
      // Save transaction to user's account balance subcollection
      const transactionRef = doc(collection(db, `users/${userId}/accountBalances/${clubId}/transactions`));
      transaction.set(transactionRef, transactionData);
      
      return transactionRef.id;
    });
    
    return transactionResult;
  } catch (error) {
    console.error('Error adding balance transaction:', error);
    throw error;
  }
}

/**
 * Get balance transaction history for a user at a club
 * @param userId - User ID
 * @param clubId - Club ID
 * @param limit - Max number of transactions to return
 * @returns Array of balance transactions
 */
export async function getBalanceTransactions(
  userId: string,
  clubId: string,
  limit: number = 50
): Promise<BalanceTransaction[]> {
  try {
    // Query transactions from user's account balance subcollection
    const transactionsRef = collection(db, `users/${userId}/accountBalances/${clubId}/transactions`);
    const transactionsQuery = query(
      transactionsRef,
      orderBy('createdAt', 'desc'),
      limitQuery(limit)
    );
    
    const snapshot = await getDocs(transactionsQuery);
    const transactions: BalanceTransaction[] = [];
    
    snapshot.forEach((doc) => {
      transactions.push({
        transactionId: doc.id,
        ...doc.data()
      } as BalanceTransaction);
    });
    
    return transactions;
  } catch (error) {
    console.error('Error getting balance transactions:', error);
    return [];
  }
}

/**
 * Check if user has sufficient balance for a booking
 * @param userId - User ID
 * @param clubId - Club ID
 * @param requiredAmount - Amount needed in cents
 * @returns True if sufficient balance or negative balance is allowed
 */
export async function hasSufficientBalance(
  userId: string,
  clubId: string,
  requiredAmount: number
): Promise<boolean> {
  try {
    const balance = await getAccountBalance(userId, clubId);
    
    // Get club's account balance settings
    const clubDoc = await getDoc(doc(db, 'orgs', clubId));
    if (!clubDoc.exists()) {
      return false;
    }
    
    const clubData = clubDoc.data();
    const settings = clubData.accountBalanceSettings as AccountBalanceSettings | undefined;
    
    if (!settings?.enabled) {
      // If balance system not enabled, default to no balance check
      return true;
    }
    
    // Check if user has enough balance
    if (balance >= requiredAmount) {
      return true;
    }
    
    // Check if negative balance is allowed
    if (settings.allowNegativeBalance) {
      const balanceAfterCharge = balance - requiredAmount;
      const maxNegative = -Math.abs(settings.maxNegativeBalance || 0);
      return balanceAfterCharge >= maxNegative;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking sufficient balance:', error);
    return false;
  }
}

/**
 * Charge a booking to user's account balance
 * @param userId - User ID
 * @param clubId - Club ID
 * @param amount - Amount to charge in cents
 * @param bookingId - Related booking ID
 * @param description - Transaction description
 * @returns Transaction ID
 */
export async function chargeBookingToBalance(
  userId: string,
  clubId: string,
  amount: number,
  bookingId: string,
  description: string
): Promise<string> {
  // Check if user has sufficient balance first
  const hasBalance = await hasSufficientBalance(userId, clubId, amount);
  
  if (!hasBalance) {
    throw new Error('Insufficient account balance');
  }
  
  // Charge the booking (negative amount)
  return addBalanceTransaction(
    userId,
    clubId,
    'booking_charge',
    -Math.abs(amount), // Negative amount for charges
    description,
    { relatedBookingId: bookingId, createdBy: userId }
  );
}

/**
 * Refund a booking to user's account balance
 * @param userId - User ID
 * @param clubId - Club ID
 * @param amount - Amount to refund in cents
 * @param bookingId - Related booking ID
 * @param description - Transaction description
 * @returns Transaction ID
 */
export async function refundBookingToBalance(
  userId: string,
  clubId: string,
  amount: number,
  bookingId: string,
  description: string
): Promise<string> {
  // Add positive amount for refunds
  return addBalanceTransaction(
    userId,
    clubId,
    'booking_refund',
    Math.abs(amount), // Positive amount for refunds
    description,
    { relatedBookingId: bookingId, createdBy: 'system' }
  );
}

/**
 * Add credit to user's account (top-up)
 * @param userId - User ID
 * @param clubId - Club ID
 * @param amount - Amount to add in cents
 * @param paymentId - Related Stripe payment ID
 * @param stripePaymentIntentId - Stripe payment intent ID
 * @returns Transaction ID
 */
export async function addAccountCredit(
  userId: string,
  clubId: string,
  amount: number,
  paymentId?: string,
  stripePaymentIntentId?: string
): Promise<string> {
  return addBalanceTransaction(
    userId,
    clubId,
    'credit_added',
    Math.abs(amount), // Positive amount
    `Account credit added: $${(amount / 100).toFixed(2)}`,
    { 
      relatedPaymentId: paymentId,
      stripePaymentIntentId,
      createdBy: 'system'
    }
  );
}

/**
 * Format balance amount for display
 * @param amountInCents - Amount in cents
 * @returns Formatted string (e.g., "$25.00" or "-$10.50")
 */
export function formatBalance(amountInCents: number): string {
  const dollars = amountInCents / 100;
  const formatted = Math.abs(dollars).toFixed(2);
  
  if (amountInCents < 0) {
    return `-$${formatted}`;
  }
  return `$${formatted}`;
}

/**
 * Get default account balance settings
 * @returns Default settings object
 */
export function getDefaultAccountBalanceSettings(): AccountBalanceSettings {
  return {
    enabled: false,
    allowNegativeBalance: true,
    maxNegativeBalance: 10000, // $100.00 max negative
    lowBalanceThreshold: 2000, // $20.00
    autoTopUpEnabled: false,
    autoTopUpAmount: 5000, // $50.00
    autoTopUpThreshold: 1000, // $10.00
    creditExpirationDays: 0, // Never expire
    allowCreditPurchase: true,
    creditPackages: [
      {
        id: 'small',
        name: 'Small',
        amount: 2500, // $25
        price: 2500,
        bonusPercentage: 0,
        isActive: true
      },
      {
        id: 'medium',
        name: 'Medium',
        amount: 5000, // $50
        price: 5000,
        bonusPercentage: 5, // 5% bonus
        isActive: true
      },
      {
        id: 'large',
        name: 'Large',
        amount: 10000, // $100
        price: 10000,
        bonusPercentage: 10, // 10% bonus
        isActive: true
      }
    ]
  };
}

/**
 * Check if user has a payment method on file
 * @param userId - User ID
 * @returns True if user has a payment method saved
 */
export async function hasPaymentMethod(userId: string): Promise<boolean> {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      return false;
    }
    
    const userData = userDoc.data();
    return !!userData.stripeCustomerId;
  } catch (error) {
    console.error('Error checking payment method:', error);
    return false;
  }
}

/**
 * Attempt to automatically charge user's saved payment method
 * Falls back to adding debt if payment fails or no payment method
 * @param userId - User ID
 * @param clubId - Club ID
 * @param amount - Amount in cents
 * @param description - Transaction description
 * @returns Object with success status and message
 */
export async function chargeOrDebitBalance(
  userId: string,
  clubId: string,
  amount: number,
  description: string
): Promise<{ success: boolean; charged: boolean; message: string }> {
  try {
    // Check if user has payment method on file
    const hasPM = await hasPaymentMethod(userId);
    
    if (hasPM) {
      // Attempt to charge payment method
      try {
        const response = await fetch('/api/stripe/charge-payment-method', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            clubId,
            amount,
            description,
            metadata: {
              type: 'booking',
              autoCharge: true
            }
          }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          return {
            success: true,
            charged: true,
            message: 'Payment charged successfully'
          };
        } else {
          console.warn('Payment charge failed:', data.error);
          // Fall through to add debt
        }
      } catch (error) {
        console.error('Error charging payment method:', error);
        // Fall through to add debt
      }
    }
    
    // If no payment method or charge failed, add as debt
    await addBalanceTransaction(
      userId,
      clubId,
      'booking_charge',
      -amount, // Negative amount for charge/debit
      description
    );
    
    return {
      success: true,
      charged: false,
      message: 'Added to account balance'
    };
  } catch (error) {
    console.error('Error in chargeOrDebitBalance:', error);
    return {
      success: false,
      charged: false,
      message: 'Failed to process payment'
    };
  }
}
