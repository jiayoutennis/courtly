"use client";

import { useState } from 'react';
import { auth } from '../../../firebase';

interface MembershipPlan {
  id: string;
  name: string;
  tier: 'monthly' | 'annual' | 'day_pass';
  price: number;
  currency: string;
  stripePriceId: string;
  stripeProductId: string;
  features: string[];
  description: string;
  isActive: boolean;
}

interface MembershipPlansProps {
  clubId: string;
  clubName: string;
  plans: MembershipPlan[];
  darkMode?: boolean;
  onSuccess?: () => void; // Note: Success handled via redirect URL params after Stripe checkout
  onError?: (error: string) => void;
}

export default function MembershipPlans({
  clubId,
  clubName,
  plans,
  darkMode = false,
  onSuccess: _onSuccess, // Prefixed with _ to indicate intentionally unused (handled by redirect)
  onError,
}: MembershipPlansProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handlePurchase = async (plan: MembershipPlan) => {
    try {
      setLoading(plan.id);

      const user = auth.currentUser;
      if (!user) {
        onError?.('Please sign in to purchase a membership');
        setLoading(null);
        return;
      }

      // Get auth token
      const token = await user.getIdToken();

      // Call API to create checkout session
      const response = await fetch('/api/stripe/create-membership-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          clubId,
          clubName,
          membershipPlan: plan,
          userId: user.uid,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }

    } catch (error: any) {
      console.error('Purchase error:', error);
      onError?.(error.message || 'Purchase failed');
      setLoading(null);
    }
  };

  const getTierLabel = (tier: string) => {
    switch (tier) {
      case 'monthly':
        return 'Monthly';
      case 'annual':
        return 'Annual';
      case 'day_pass':
        return 'Day Pass';
      default:
        return tier;
    }
  };

  const activePlans = plans.filter(p => p.isActive);

  if (activePlans.length === 0) {
    return (
      <div className={`p-6 text-center ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
        <p>No membership plans available at this time.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {activePlans.map((plan) => (
        <div
          key={plan.id}
          className={`border p-6 rounded-lg ${
            darkMode ? 'border-[#1a1a1a] bg-[#0a0a0a]' : 'border-gray-200 bg-white'
          }`}
        >
          {/* Plan Header */}
          <div className="mb-4">
            <h3 className={`text-xl font-light mb-1 ${
              darkMode ? 'text-white' : 'text-gray-900'
            }`}>
              {plan.name}
            </h3>
            <p className={`text-xs uppercase tracking-wider ${
              darkMode ? 'text-gray-500' : 'text-gray-400'
            }`}>
              {getTierLabel(plan.tier)}
            </p>
          </div>

          {/* Price */}
          <div className="mb-4">
            <span className={`text-3xl font-light ${
              darkMode ? 'text-white' : 'text-gray-900'
            }`}>
              ${plan.price}
            </span>
            <span className={`text-sm ml-2 ${
              darkMode ? 'text-gray-500' : 'text-gray-400'
            }`}>
              {plan.tier === 'monthly' ? '/ month' : plan.tier === 'annual' ? '/ year' : ''}
            </span>
          </div>

          {/* Description */}
          {plan.description && (
            <p className={`text-sm mb-4 ${
              darkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>
              {plan.description}
            </p>
          )}

          {/* Features */}
          {plan.features.length > 0 && (
            <ul className="mb-6 space-y-2">
              {plan.features.map((feature, idx) => (
                <li
                  key={idx}
                  className={`text-sm flex items-start ${
                    darkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}
                >
                  <svg
                    className={`w-4 h-4 mr-2 mt-0.5 flex-shrink-0 ${
                      darkMode ? 'text-white' : 'text-black'
                    }`}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M5 13l4 4L19 7"></path>
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
          )}

          {/* Purchase Button */}
          <button
            onClick={() => handlePurchase(plan)}
            disabled={loading === plan.id}
            className={`w-full px-4 py-3 text-sm uppercase tracking-wider font-light transition-colors ${
              darkMode
                ? 'border border-white text-white hover:bg-white hover:text-black'
                : 'border border-black text-black hover:bg-black hover:text-white'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {loading === plan.id ? 'Processing...' : 'Purchase'}
          </button>
        </div>
      ))}
    </div>
  );
}
