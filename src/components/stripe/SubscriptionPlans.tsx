/**
 * Subscription Plans Component
 * Displays available Courtly subscription plans for clubs
 */

'use client';

import { useState } from 'react';
import { STRIPE_CONFIG } from '@/lib/stripe/config';

interface SubscriptionPlansProps {
  currentPlan?: string;
  darkMode?: boolean;
  onSelectPlan: (planId: string, priceId: string) => void;
}

export default function SubscriptionPlans({ 
  currentPlan = 'free', 
  darkMode = false,
  onSelectPlan 
}: SubscriptionPlansProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleSelectPlan = async (planId: string) => {
    const plan = STRIPE_CONFIG.plans[planId as keyof typeof STRIPE_CONFIG.plans];
    
    if (planId === 'free' || !plan.stripePriceId) {
      alert('Free plan is already active or plan not configured');
      return;
    }

    setLoading(planId);
    try {
      await onSelectPlan(planId, plan.stripePriceId);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {Object.values(STRIPE_CONFIG.plans).map((plan) => {
        const isCurrentPlan = plan.id === currentPlan;
        const isLoading = loading === plan.id;

        return (
          <div
            key={plan.id}
            className={`relative rounded-lg border p-6 ${
              darkMode 
                ? 'bg-[#1a1a1a] border-gray-800' 
                : 'bg-white border-gray-200'
            } ${isCurrentPlan ? 'ring-2 ring-blue-500' : ''}`}
          >
            {isCurrentPlan && (
              <div className={`absolute top-4 right-4 px-2 py-1 text-xs font-light rounded ${
                darkMode ? 'bg-blue-900 text-blue-300' : 'bg-blue-100 text-blue-700'
              }`}>
                Current Plan
              </div>
            )}

            <div className="mb-4">
              <h3 className={`text-xl font-light mb-2 ${
                darkMode ? 'text-white' : 'text-gray-900'
              }`}>
                {plan.name}
              </h3>
              <div className="flex items-baseline">
                <span className={`text-3xl font-light ${
                  darkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  ${plan.price}
                </span>
                <span className={`ml-2 text-sm font-light ${
                  darkMode ? 'text-gray-500' : 'text-gray-600'
                }`}>
                  /month
                </span>
              </div>
            </div>

            <ul className={`space-y-2 mb-6 text-sm font-light ${
              darkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>
              {plan.features.map((feature, index) => (
                <li key={index} className="flex items-start">
                  <svg className="w-5 h-5 mr-2 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleSelectPlan(plan.id)}
              disabled={isCurrentPlan || isLoading || plan.id === 'free'}
              className={`w-full py-2 px-4 rounded font-light text-sm transition-colors ${
                isCurrentPlan || plan.id === 'free'
                  ? darkMode
                    ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : darkMode
                    ? 'bg-white text-black hover:bg-gray-200'
                    : 'bg-black text-white hover:bg-gray-800'
              }`}
            >
              {isLoading ? 'Loading...' : isCurrentPlan ? 'Current Plan' : plan.id === 'free' ? 'Free' : 'Upgrade'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
