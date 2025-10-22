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
        className="w-full border border-black text-black px-4 py-3 hover:bg-black hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-light text-sm"
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
      <div className={`border p-6 ${darkMode ? 'bg-[#0a0a0a] border-[#1a1a1a]' : 'bg-white border-gray-100'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-4 h-4 border-2 ${darkMode ? 'border-white' : 'border-black'} border-t-transparent rounded-full animate-spin`}></div>
          <p className={`text-sm font-light ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Loading payment methods...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`border p-6 ${darkMode ? 'bg-[#0a0a0a] border-[#1a1a1a]' : 'bg-white border-gray-100'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className={`text-xs uppercase tracking-wider font-light ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
          Payment Methods
        </h3>
        {!showAddCard && (
          <button
            onClick={handleAddCard}
            className={`px-4 py-2 text-sm font-light transition-colors ${
              darkMode
                ? 'border border-white text-white hover:bg-white hover:text-black'
                : 'border border-black text-black hover:bg-black hover:text-white'
            }`}
          >
            Add Card
          </button>
        )}
      </div>

      {error && (
        <div className={`mb-6 p-4 border text-sm font-light ${
          darkMode 
            ? 'bg-red-900/20 text-red-400 border-red-900/30' 
            : 'bg-red-50 text-red-600 border-red-100'
        }`}>
          {error}
        </div>
      )}

      {/* Add Card Form */}
      {showAddCard && clientSecret && (
        <div className={`p-6 mb-6 border-t ${darkMode ? 'border-[#1a1a1a]' : 'border-gray-100'}`}>
          <div className="mb-4 flex items-center justify-between">
            <h4 className={`text-sm font-light ${darkMode ? 'text-white' : 'text-black'}`}>
              Add New Card
            </h4>
            <button
              onClick={() => {
                setShowAddCard(false);
                setClientSecret(null);
              }}
              className={`text-sm font-light ${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-black'}`}
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
        <div className={`text-center py-8 px-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          <p className="text-sm font-light mb-4">No payment methods saved</p>
          <button
            onClick={handleAddCard}
            className={`px-6 py-2 text-sm font-light transition-colors ${
              darkMode
                ? 'border border-white text-white hover:bg-white hover:text-black'
                : 'border border-black text-black hover:bg-black hover:text-white'
            }`}
          >
            Add Your First Card
          </button>
        </div>
      ) : (
        <div className={`space-y-3 border-t pt-6 ${darkMode ? 'border-[#1a1a1a]' : 'border-gray-100'}`}>
          {paymentMethods.map((pm) => (
            <div
              key={pm.id}
              className={`p-4 border ${darkMode ? 'border-[#1a1a1a]' : 'border-gray-100'}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className={`font-light ${darkMode ? 'text-white' : 'text-black'}`}>
                    {pm.brand.charAt(0).toUpperCase() + pm.brand.slice(1)} •••• {pm.last4}
                  </div>
                  <div className={`text-sm font-light mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Expires {pm.expMonth}/{pm.expYear}
                    {pm.isDefault && (
                      <span className="ml-2">• Default</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!pm.isDefault && (
                    <button
                      onClick={() => handleSetDefault(pm.id)}
                      className={`text-sm font-light px-3 py-1 transition-colors ${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-black'}`}
                    >
                      Set Default
                    </button>
                  )}
                  <button
                    onClick={() => handleRemoveCard(pm.id)}
                    className={`p-2 transition-colors ${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-black'}`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info Box */}
      <div className={`mt-6 p-4 border text-sm font-light ${
        darkMode 
          ? 'bg-blue-900/20 border-blue-900/30 text-blue-400' 
          : 'bg-blue-50 border-blue-100 text-blue-700'
      }`}>
        <p className="font-medium mb-1">Automatic Charging</p>
        <p>When you book a court, your default payment method will be automatically charged. No need to manually add funds!</p>
      </div>
    </div>
  );
}
