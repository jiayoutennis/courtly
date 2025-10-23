'use client';

import { useState } from 'react';

interface ReservationPaymentButtonProps {
  reservationId: string;
  clubId: string;
  amount: number;
  currency: string;
  darkMode?: boolean;
}

export default function ReservationPaymentButton({
  reservationId,
  clubId,
  amount,
  currency,
  darkMode = false
}: ReservationPaymentButtonProps) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const handlePayment = async () => {
    setProcessing(true);
    setError('');

    try {
      const response = await fetch('/api/payments/stripe/checkout/reservation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clubId,
          reservationId,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else {
        setError(data.error || 'Failed to create payment session');
      }
    } catch (error) {
      console.error('Error creating payment session:', error);
      setError('Failed to process payment. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
        <div className="flex items-center justify-between mb-2">
          <span className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Payment Required
          </span>
          <span className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            ${(amount / 100).toFixed(2)} {currency.toUpperCase()}
          </span>
        </div>
        
        <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          Complete your payment to confirm this reservation.
        </p>
      </div>

      <button
        onClick={handlePayment}
        disabled={processing}
        className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {processing ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            <span>Processing...</span>
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <span>Pay Now</span>
          </>
        )}
      </button>

      <p className={`text-xs text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
        Secure payment powered by Stripe
      </p>
    </div>
  );
}
