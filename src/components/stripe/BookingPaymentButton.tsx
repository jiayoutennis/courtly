"use client";

import { useState } from 'react';
import { auth } from '../../../firebase';

interface BookingPaymentButtonProps {
  courtId: string;
  courtName: string;
  clubId: string;
  clubName: string;
  date: string;
  startTime: string;
  endTime: string;
  price: number;
  notes?: string;
  onSuccess?: () => void; // Note: Success handled via redirect URL params after Stripe checkout
  onError?: (error: string) => void;
  darkMode?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export default function BookingPaymentButton({
  courtId,
  courtName,
  clubId,
  clubName,
  date,
  startTime,
  endTime,
  price,
  notes = '',
  onSuccess: _onSuccess, // Prefixed with _ to indicate intentionally unused (handled by redirect)
  onError,
  darkMode = false,
  className = '',
  children,
}: BookingPaymentButtonProps) {
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    try {
      setLoading(true);

      const user = auth.currentUser;
      if (!user) {
        onError?.('Please sign in to make a payment');
        return;
      }

      // Get auth token
      const token = await user.getIdToken();

      // Call API to create checkout session
      const response = await fetch('/api/stripe/create-booking-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          courtId,
          courtName,
          clubId,
          clubName,
          date,
          startTime,
          endTime,
          price,
          notes,
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
      console.error('Payment error:', error);
      onError?.(error.message || 'Payment failed');
      setLoading(false);
    }
  };

  const defaultClasses = `px-4 py-2 rounded font-light transition-colors ${
    darkMode
      ? 'bg-white text-black hover:bg-gray-100'
      : 'bg-black text-white hover:bg-gray-800'
  } disabled:opacity-50 disabled:cursor-not-allowed ${className}`;

  return (
    <button
      onClick={handlePayment}
      disabled={loading}
      className={defaultClasses}
    >
      {loading ? 'Processing...' : children || `Pay $${price.toFixed(2)}`}
    </button>
  );
}
