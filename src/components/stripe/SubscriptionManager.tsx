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
  darkMode?: boolean;
}

export default function SubscriptionManager({ 
  clubId, 
  subscription, 
  onUpdate,
  isOwner,
  darkMode = false
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
    <div className={`border p-6 sm:p-8 ${
      darkMode ? "bg-[#0a0a0a] border-[#1a1a1a]" : "bg-white border-gray-100"
    }`}>
      <h3 className={`text-xs uppercase tracking-wider font-light mb-6 ${
        darkMode ? "text-gray-500" : "text-gray-400"
      }`}>
        Current Subscription
      </h3>

      {/* Current Plan Info */}
      <div className="mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
          <div>
            <p className={`text-xs font-light uppercase tracking-wider mb-2 ${
              darkMode ? "text-gray-600" : "text-gray-400"
            }`}>
              Plan
            </p>
            <p className={`text-lg font-light capitalize ${
              darkMode ? "text-white" : "text-black"
            }`}>
              {subscription.plan}
            </p>
          </div>
          <div>
            <p className={`text-xs font-light uppercase tracking-wider mb-2 ${
              darkMode ? "text-gray-600" : "text-gray-400"
            }`}>
              Status
            </p>
            <p className={`text-lg font-light ${
              darkMode ? "text-white" : "text-black"
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
          <div>
            <p className={`text-xs font-light uppercase tracking-wider mb-2 ${
              darkMode ? "text-gray-600" : "text-gray-400"
            }`}>
              {willCancelAtPeriodEnd ? 'Access Until' : 'Next Billing Date'}
            </p>
            <p className={`text-base font-light ${
              darkMode ? "text-white" : "text-black"
            }`}>
              {formatDate(subscription.currentPeriodEnd)}
            </p>
            <p className={`text-sm font-light mt-1 ${
              darkMode ? "text-gray-400" : "text-gray-600"
            }`}>
              {getDaysRemaining()} days remaining
            </p>
          </div>
        )}
      </div>

      {/* Status Messages */}
      {error && (
        <div className={`mb-6 p-4 border text-sm font-light ${
          darkMode 
            ? 'bg-red-900/20 text-red-400 border-red-900/30' 
            : 'bg-red-50 text-red-600 border-red-100'
        }`}>
          {error}
        </div>
      )}
      {success && (
        <div className={`mb-6 p-4 border text-sm font-light ${
          darkMode 
            ? 'bg-green-900/20 text-green-400 border-green-900/30' 
            : 'bg-green-50 text-green-600 border-green-100'
        }`}>
          {success}
        </div>
      )}

      {/* Warning if subscription is canceling */}
      {willCancelAtPeriodEnd && (
        <div className={`mb-6 p-4 border text-sm font-light ${
          darkMode 
            ? 'bg-yellow-900/20 text-yellow-400 border-yellow-900/30' 
            : 'bg-yellow-50 text-yellow-700 border-yellow-100'
        }`}>
          <p className="font-medium mb-2">
            Subscription Scheduled for Cancellation
          </p>
          <p>
            Your subscription will be canceled on {formatDate(subscription.currentPeriodEnd)}.
            You will continue to have access to all {subscription.plan} features until then.
            After that, you will be downgraded to the Free plan.
          </p>
        </div>
      )}

      {/* Not Owner Warning */}
      {!isOwner && (
        <div className={`mb-6 p-4 border text-sm font-light ${
          darkMode 
            ? 'bg-blue-900/20 text-blue-400 border-blue-900/30' 
            : 'bg-blue-50 text-blue-700 border-blue-100'
        }`}>
          <p className="font-medium mb-2">
            Owner Access Required
          </p>
          <p>
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
              className={`w-full px-4 py-2 text-sm font-light transition-colors ${
                darkMode
                  ? "border border-[#1a1a1a] text-gray-400 hover:border-gray-600 hover:text-white disabled:opacity-50"
                  : "border border-gray-200 text-gray-600 hover:border-gray-400 hover:text-black disabled:opacity-50"
              }`}
            >
              {loading ? 'Processing...' : 'Cancel Subscription'}
            </button>
          )}

          {isPaidPlan && willCancelAtPeriodEnd && (
            <button
              onClick={handleReactivateSubscription}
              disabled={loading}
              className={`w-full px-4 py-2 text-sm font-light transition-colors ${
                darkMode
                  ? "border border-white text-white hover:bg-white hover:text-black disabled:opacity-50"
                  : "border border-black text-black hover:bg-black hover:text-white disabled:opacity-50"
              }`}
            >
              {loading ? 'Processing...' : 'Reactivate Subscription'}
            </button>
          )}

          {subscription.plan === 'free' && (
            <div className="text-center">
              <p className={`text-sm font-light mb-4 ${
                darkMode ? "text-gray-400" : "text-gray-600"
              }`}>
                Upgrade to unlock more features
              </p>
              <a
                href={`/club/${clubId}`}
                className={`inline-block px-6 py-2 text-sm font-light transition-colors ${
                  darkMode
                    ? "border border-white text-white hover:bg-white hover:text-black"
                    : "border border-black text-black hover:bg-black hover:text-white"
                }`}
              >
                View Plans
              </a>
            </div>
          )}
        </div>
      )}

      {/* Plan Features Summary */}
      <div className={`mt-6 pt-6 border-t ${
        darkMode ? "border-[#1a1a1a]" : "border-gray-100"
      }`}>
        <p className={`text-xs font-light uppercase tracking-wider mb-3 ${
          darkMode ? "text-gray-600" : "text-gray-400"
        }`}>
          Current Features
        </p>
        <ul className={`text-sm font-light space-y-2 ${
          darkMode ? "text-gray-400" : "text-gray-600"
        }`}>
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
