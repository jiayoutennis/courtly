"use client";

import { useState } from 'react';
import { auth } from '../../../firebase';

interface SubscriptionInfo {
  plan: 'free' | 'basic' | 'pro' | 'enterprise';
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete' | 'incomplete_expired' | 'unpaid';
  stripeSubscriptionId?: string;
  currentPeriodStart?: number;
  currentPeriodEnd?: number;
  cancelAtPeriodEnd?: boolean;
}

interface SubscriptionManagerProps {
  clubId: string;
  subscription: SubscriptionInfo;
  onUpdate: () => void; // Callback to refresh club data after updates
  isOwner: boolean; // New prop to indicate if current user is the owner
}

export default function SubscriptionManager({ 
  clubId, 
  subscription, 
  onUpdate,
  isOwner 
}: SubscriptionManagerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isPaidPlan = subscription.plan !== 'free';
  const isActive = subscription.status === 'active';
  const willCancelAtPeriodEnd = subscription.cancelAtPeriodEnd || false;

  // Format date from Unix timestamp
  const formatDate = (timestamp?: number) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Calculate days remaining
  const getDaysRemaining = () => {
    if (!subscription.currentPeriodEnd) return 0;
    const now = Date.now();
    const endDate = subscription.currentPeriodEnd * 1000;
    const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
    return Math.max(0, daysLeft);
  };

  const handleCancelSubscription = async () => {
    if (!confirm(
      'Are you sure you want to cancel your subscription?\n\n' +
      'Your current plan will remain active until the end of your billing period, ' +
      'then you will be downgraded to the Free plan.'
    )) {
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Get auth token
      const user = auth.currentUser;
      if (!user) {
        throw new Error('You must be logged in to manage subscriptions');
      }
      const token = await user.getIdToken();

      const response = await fetch('/api/stripe/cancel-subscription', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          clubId,
          cancelImmediately: false // Keep access until period ends
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel subscription');
      }

      setSuccess(
        `Subscription will be canceled on ${formatDate(data.currentPeriodEnd)}. ` +
        'You will retain access to your current plan until then.'
      );
      
      // Refresh club data to show updated cancelAtPeriodEnd status
      setTimeout(() => {
        onUpdate();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel subscription');
    } finally {
      setLoading(false);
    }
  };

  const handleReactivateSubscription = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Get auth token
      const user = auth.currentUser;
      if (!user) {
        throw new Error('You must be logged in to manage subscriptions');
      }
      const token = await user.getIdToken();

      const response = await fetch('/api/stripe/reactivate-subscription', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ clubId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reactivate subscription');
      }

      setSuccess('Subscription reactivated! Your plan will continue automatically.');
      
      // Refresh club data
      setTimeout(() => {
        onUpdate();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reactivate subscription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
      <h3 className="text-xl font-semibold mb-4 dark:text-white">
        Subscription Management
      </h3>

      {/* Current Plan Info */}
      <div className="mb-6">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Current Plan</p>
            <p className="text-lg font-semibold dark:text-white capitalize">
              {subscription.plan}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Status</p>
            <p className={`text-lg font-semibold ${
              isActive ? 'text-green-600' : 'text-red-600'
            }`}>
              {subscription.status === 'active' && willCancelAtPeriodEnd
                ? 'Canceling'
                : subscription.status.replace('_', ' ').charAt(0).toUpperCase() + 
                  subscription.status.slice(1).replace('_', ' ')
              }
            </p>
          </div>
        </div>

        {isPaidPlan && subscription.currentPeriodEnd && (
          <div className="mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {willCancelAtPeriodEnd ? 'Access Until' : 'Next Billing Date'}
            </p>
            <p className="text-lg dark:text-white">
              {formatDate(subscription.currentPeriodEnd)}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              ({getDaysRemaining()} days remaining)
            </p>
          </div>
        )}
      </div>

      {/* Status Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
          {success}
        </div>
      )}

      {/* Warning if subscription is canceling */}
      {willCancelAtPeriodEnd && (
        <div className="mb-4 p-4 bg-yellow-100 dark:bg-yellow-900/30 border-l-4 border-yellow-500 rounded">
          <p className="text-yellow-800 dark:text-yellow-400 font-semibold mb-2">
            ⚠️ Subscription Scheduled for Cancellation
          </p>
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            Your subscription will be canceled on {formatDate(subscription.currentPeriodEnd)}.
            You will continue to have access to all {subscription.plan} features until then.
            After that, you will be downgraded to the Free plan.
          </p>
        </div>
      )}

      {/* Not Owner Warning */}
      {!isOwner && (
        <div className="mb-4 p-4 bg-blue-100 dark:bg-blue-900/30 border-l-4 border-blue-500 rounded">
          <p className="text-blue-800 dark:text-blue-400 font-semibold mb-2">
            ℹ️ Owner Access Required
          </p>
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Only the club owner can manage subscriptions. Please contact your club owner to make changes.
          </p>
        </div>
      )}

      {/* Action Buttons - Only show to owners */}
      {isOwner && (
        <div className="space-y-3">
          {isPaidPlan && isActive && !willCancelAtPeriodEnd && (
            <button
              onClick={handleCancelSubscription}
              disabled={loading}
              className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : 'Cancel Subscription'}
            </button>
          )}

          {isPaidPlan && willCancelAtPeriodEnd && (
            <button
              onClick={handleReactivateSubscription}
              disabled={loading}
              className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : 'Reactivate Subscription'}
            </button>
          )}

          {subscription.plan === 'free' && (
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Upgrade to unlock more features
              </p>
              <a
                href={`/club/${clubId}`}
                className="inline-block px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                View Plans
              </a>
            </div>
          )}
        </div>
      )}

      {/* Plan Features Summary */}
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          Current Features:
        </p>
        <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
          {subscription.plan === 'free' && (
            <>
              <li>• 1 court</li>
              <li>• Up to 10 members</li>
              <li>• Basic scheduling</li>
            </>
          )}
          {subscription.plan === 'basic' && (
            <>
              <li>• 3 courts</li>
              <li>• Up to 50 members</li>
              <li>• Advanced scheduling</li>
              <li>• Email notifications</li>
            </>
          )}
          {subscription.plan === 'pro' && (
            <>
              <li>• 10 courts</li>
              <li>• Up to 200 members</li>
              <li>• Advanced scheduling</li>
              <li>• Priority support</li>
              <li>• Custom branding</li>
            </>
          )}
          {subscription.plan === 'enterprise' && (
            <>
              <li>• Unlimited courts</li>
              <li>• Unlimited members</li>
              <li>• White-label solution</li>
              <li>• Dedicated support</li>
              <li>• Custom integrations</li>
            </>
          )}
        </ul>
      </div>
    </div>
  );
}
