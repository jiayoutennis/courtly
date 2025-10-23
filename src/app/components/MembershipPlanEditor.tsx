'use client';

import { useState } from 'react';

interface MembershipPlan {
  id: string;
  name: string;
  priceCents: number;
  interval: 'month' | 'year' | 'one_time';
  active: boolean;
  stripePriceId?: string;
}

interface MembershipPlanEditorProps {
  clubId: string;
  plans: MembershipPlan[];
  onPlanUpdate: (plans: MembershipPlan[]) => void;
  darkMode?: boolean;
}

export default function MembershipPlanEditor({
  clubId,
  plans,
  onPlanUpdate,
  darkMode = false
}: MembershipPlanEditorProps) {
  const [newPlan, setNewPlan] = useState<Partial<MembershipPlan>>({
    name: '',
    priceCents: 0,
    interval: 'month',
    active: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleCreatePlan = async () => {
    if (!newPlan.name || newPlan.priceCents === undefined || newPlan.priceCents <= 0) {
      setError('Please fill in all required fields');
      return;
    }

    setSaving(true);
    setError('');

    try {
      // Create Stripe product and price
      const productResponse = await fetch('/api/stripe/create-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clubId,
          name: newPlan.name,
          description: `Membership plan: ${newPlan.name}`,
        }),
      });

      const productData = await productResponse.json();
      if (!productResponse.ok) {
        throw new Error(productData.error || 'Failed to create product');
      }

      // Create Stripe price
      const priceResponse = await fetch('/api/stripe/create-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clubId,
          productId: productData.product.id,
          unitAmount: newPlan.priceCents,
          currency: 'usd',
          recurring: newPlan.interval !== 'one_time' ? { interval: newPlan.interval } : null,
        }),
      });

      const priceData = await priceResponse.json();
      if (!priceResponse.ok) {
        throw new Error(priceData.error || 'Failed to create price');
      }

      // Create new plan
      const plan: MembershipPlan = {
        id: Date.now().toString(),
        name: newPlan.name!,
        priceCents: newPlan.priceCents!,
        interval: newPlan.interval!,
        active: true,
        stripePriceId: priceData.price.id,
      };

      const updatedPlans = [...plans, plan];
      onPlanUpdate(updatedPlans);

      // Reset form
      setNewPlan({
        name: '',
        priceCents: 0,
        interval: 'month',
        active: true,
      });

    } catch (error: any) {
      console.error('Error creating plan:', error);
      setError(error.message || 'Failed to create membership plan');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePlan = async (planId: string) => {
    const updatedPlans = plans.map(plan => 
      plan.id === planId ? { ...plan, active: !plan.active } : plan
    );
    onPlanUpdate(updatedPlans);
  };

  const handleDeletePlan = async (planId: string) => {
    if (!confirm('Are you sure you want to delete this membership plan?')) {
      return;
    }

    const updatedPlans = plans.filter(plan => plan.id !== planId);
    onPlanUpdate(updatedPlans);
  };

  return (
    <div className={`rounded-lg shadow-md p-6 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
      <h3 className={`text-lg font-semibold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
        Membership Plans
      </h3>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Create New Plan Form */}
      <div className={`mb-6 p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
        <h4 className={`font-medium mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          Create New Plan
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Plan Name
            </label>
            <input
              type="text"
              value={newPlan.name || ''}
              onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg ${
                darkMode 
                  ? 'bg-gray-600 border-gray-500 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
              placeholder="e.g., Monthly Membership"
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Price ($)
            </label>
            <input
              type="number"
              value={newPlan.priceCents ? newPlan.priceCents / 100 : ''}
              onChange={(e) => setNewPlan({ 
                ...newPlan, 
                priceCents: Math.round(parseFloat(e.target.value) * 100) 
              })}
              className={`w-full px-3 py-2 border rounded-lg ${
                darkMode 
                  ? 'bg-gray-600 border-gray-500 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
              placeholder="49.00"
              step="0.01"
              min="0"
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Billing Interval
            </label>
            <select
              value={newPlan.interval || 'month'}
              onChange={(e) => setNewPlan({ 
                ...newPlan, 
                interval: e.target.value as 'month' | 'year' | 'one_time' 
              })}
              className={`w-full px-3 py-2 border rounded-lg ${
                darkMode 
                  ? 'bg-gray-600 border-gray-500 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            >
              <option value="month">Monthly</option>
              <option value="year">Yearly</option>
              <option value="one_time">One-time</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleCreatePlan}
          disabled={saving}
          className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Creating...</span>
            </>
          ) : (
            <>
              <span>Create Plan</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </>
          )}
        </button>
      </div>

      {/* Existing Plans */}
      <div className="space-y-3">
        <h4 className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          Existing Plans ({plans.length})
        </h4>

        {plans.length === 0 ? (
          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            No membership plans created yet.
          </p>
        ) : (
          <div className="space-y-2">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  darkMode 
                    ? 'bg-gray-700 border-gray-600' 
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h5 className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {plan.name}
                    </h5>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      plan.active 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                    }`}>
                      {plan.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1">
                    <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      ${(plan.priceCents / 100).toFixed(2)}
                    </span>
                    <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      {plan.interval === 'one_time' ? 'One-time' : `Per ${plan.interval}`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTogglePlan(plan.id)}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                      plan.active
                        ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900 dark:text-yellow-200 dark:hover:bg-yellow-800'
                        : 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-200 dark:hover:bg-green-800'
                    }`}
                  >
                    {plan.active ? 'Deactivate' : 'Activate'}
                  </button>
                  
                  <button
                    onClick={() => handleDeletePlan(plan.id)}
                    className="px-3 py-1 rounded text-sm font-medium bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900 dark:text-red-200 dark:hover:bg-red-800 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
