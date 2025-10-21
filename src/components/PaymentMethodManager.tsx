'use client';

import { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

interface PaymentMethodManagerProps {
  userId: string;
  clubId?: string;
  darkMode?: boolean;
  onSuccess?: () => void;
}

function SetupForm({ userId: _userId, clubId: _clubId, onSuccess }: { userId: string; clubId?: string; onSuccess?: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);
    setError(null);

    const { error: submitError } = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/dashboard?payment_method=added`,
      },
      redirect: 'if_required',
    });

    if (submitError) {
      setError(submitError.message || 'Failed to save payment method');
      setProcessing(false);
    } else {
      // Success!
      if (onSuccess) {
        onSuccess();
      }
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && (
        <div className="text-red-600 text-sm">{error}</div>
      )}
      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
      >
        {processing ? 'Saving...' : 'Save Card'}
      </button>
    </form>
  );
}

export default function PaymentMethodManager({ 
  userId, 
  clubId, 
  darkMode = false,
  onSuccess 
}: PaymentMethodManagerProps) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddCard, setShowAddCard] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPaymentMethods();
  }, [userId]);

  const fetchPaymentMethods = async () => {
    try {
      const response = await fetch(`/api/stripe/payment-methods?userId=${userId}`);
      const data = await response.json();

      if (response.ok) {
        setPaymentMethods(data.paymentMethods || []);
      } else {
        console.error('Error fetching payment methods:', data.error);
      }
    } catch (error) {
      console.error('Error fetching payment methods:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCard = async () => {
    try {
      const response = await fetch('/api/stripe/create-setup-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, clubId }),
      });

      const data = await response.json();

      if (response.ok) {
        setClientSecret(data.clientSecret);
        setShowAddCard(true);
      } else {
        setError(data.error || 'Failed to initialize payment method setup');
      }
    } catch (error) {
      console.error('Error creating setup intent:', error);
      setError('Failed to initialize payment method setup');
    }
  };

  const handleRemoveCard = async (paymentMethodId: string) => {
    if (!confirm('Are you sure you want to remove this payment method?')) {
      return;
    }

    try {
      const response = await fetch('/api/stripe/payment-methods', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, paymentMethodId }),
      });

      if (response.ok) {
        await fetchPaymentMethods();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to remove payment method');
      }
    } catch (error) {
      console.error('Error removing payment method:', error);
      alert('Failed to remove payment method');
    }
  };

  const handleSetDefault = async (paymentMethodId: string) => {
    try {
      const response = await fetch('/api/stripe/payment-methods', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, paymentMethodId }),
      });

      if (response.ok) {
        await fetchPaymentMethods();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to set default payment method');
      }
    } catch (error) {
      console.error('Error setting default payment method:', error);
      alert('Failed to set default payment method');
    }
  };

  const handleSuccess = () => {
    setShowAddCard(false);
    setClientSecret(null);
    fetchPaymentMethods();
    if (onSuccess) {
      onSuccess();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          Payment Methods
        </h3>
        {!showAddCard && (
          <button
            onClick={handleAddCard}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            + Add Card
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Add Card Form */}
      {showAddCard && clientSecret && (
        <div className={`p-6 rounded-lg border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="mb-4 flex items-center justify-between">
            <h4 className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Add New Card
            </h4>
            <button
              onClick={() => {
                setShowAddCard(false);
                setClientSecret(null);
              }}
              className={`text-sm ${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-700'}`}
            >
              Cancel
            </button>
          </div>
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <SetupForm userId={userId} clubId={clubId} onSuccess={handleSuccess} />
          </Elements>
        </div>
      )}

      {/* Payment Methods List */}
      {paymentMethods.length === 0 && !showAddCard ? (
        <div className={`text-center py-8 px-4 rounded-lg border-2 border-dashed ${darkMode ? 'border-gray-700 text-gray-400' : 'border-gray-300 text-gray-600'}`}>
          <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          <p className="mb-4">No payment methods saved</p>
          <button
            onClick={handleAddCard}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Add Your First Card
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {paymentMethods.map((pm) => (
            <div
              key={pm.id}
              className={`p-4 rounded-lg border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <div>
                    <div className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {pm.brand.charAt(0).toUpperCase() + pm.brand.slice(1)} •••• {pm.last4}
                    </div>
                    <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Expires {pm.expMonth}/{pm.expYear}
                      {pm.isDefault && (
                        <span className="ml-2 text-blue-600 font-medium">Default</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!pm.isDefault && (
                    <button
                      onClick={() => handleSetDefault(pm.id)}
                      className={`text-sm px-3 py-1 rounded ${darkMode ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
                    >
                      Set Default
                    </button>
                  )}
                  <button
                    onClick={() => handleRemoveCard(pm.id)}
                    className="text-red-600 hover:text-red-700 p-2 rounded hover:bg-red-50"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info Box */}
      <div className={`p-4 rounded-lg ${darkMode ? 'bg-blue-900/20 border border-blue-800' : 'bg-blue-50 border border-blue-200'}`}>
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className={`text-sm ${darkMode ? 'text-blue-300' : 'text-blue-800'}`}>
            <p className="font-medium mb-1">Automatic Charging</p>
            <p>When you book a court, your default payment method will be automatically charged. No need to manually add funds!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
