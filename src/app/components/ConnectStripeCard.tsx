'use client';

import { useState } from 'react';

interface ConnectStripeCardProps {
  clubId: string;
  stripeStatus: 'unlinked' | 'onboarding' | 'active' | 'restricted' | 'pending_verification';
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  darkMode?: boolean;
}

export default function ConnectStripeCard({
  clubId,
  stripeStatus,
  chargesEnabled,
  payoutsEnabled,
  darkMode = false
}: ConnectStripeCardProps) {
  const [connecting, setConnecting] = useState(false);
  const [openingDashboard, setOpeningDashboard] = useState(false);
  const [error, setError] = useState('');

  const handleConnectStripe = async () => {
    setConnecting(true);
    setError('');
    
    try {
      const response = await fetch('/api/payments/stripe/connect/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clubId }),
      });

      const data = await response.json();

      if (response.ok) {
        // Redirect to Stripe Connect onboarding
        window.location.href = data.url;
      } else {
        setError(data.error || 'Failed to initiate Stripe Connect');
      }
    } catch (error) {
      console.error('Error connecting Stripe:', error);
      setError('Failed to connect Stripe. Please try again.');
    } finally {
      setConnecting(false);
    }
  };

  const handleResumeOnboarding = async () => {
    setConnecting(true);
    setError('');
    
    try {
      const response = await fetch('/api/payments/stripe/connect/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clubId }),
      });

      const data = await response.json();

      if (response.ok) {
        // Redirect to Stripe Connect onboarding
        window.location.href = data.url;
      } else {
        setError(data.error || 'Failed to resume Stripe onboarding');
      }
    } catch (error) {
      console.error('Error resuming onboarding:', error);
      setError('Failed to resume onboarding. Please try again.');
    } finally {
      setConnecting(false);
    }
  };

  const handleOpenDashboard = async () => {
    setOpeningDashboard(true);
    setError('');
    
    try {
      const response = await fetch('/api/payments/stripe/connect/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clubId }),
      });

      const data = await response.json();

      if (response.ok) {
        // Open Stripe Express Dashboard in new tab
        window.open(data.url, '_blank');
      } else {
        setError(data.error || 'Failed to open Stripe dashboard');
      }
    } catch (error) {
      console.error('Error opening dashboard:', error);
      setError('Failed to open dashboard. Please try again.');
    } finally {
      setOpeningDashboard(false);
    }
  };

  return (
    <div className={`rounded-lg shadow-md p-6 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
      <h3 className={`text-lg font-semibold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
        Stripe Connect Status
      </h3>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {stripeStatus === 'unlinked' && (
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-yellow-800">
                  Stripe Not Connected
                </h4>
                <p className="text-sm text-yellow-700 mt-1">
                  Connect your Stripe account to start accepting payments for court reservations and memberships.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handleConnectStripe}
            disabled={connecting}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {connecting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <span>Connect Stripe Account</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </>
            )}
          </button>
        </div>
      )}

      {stripeStatus === 'onboarding' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-blue-800">
                  Onboarding In Progress
                </h4>
                <p className="text-sm text-blue-700 mt-1">
                  Complete your Stripe account setup to start accepting payments.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handleResumeOnboarding}
            disabled={connecting}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {connecting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Resuming...</span>
              </>
            ) : (
              <>
                <span>Resume Stripe Onboarding</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </>
            )}
          </button>
        </div>
      )}

      {stripeStatus === 'active' && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-green-800">
                  Stripe Connected ✅
                </h4>
                <p className="text-sm text-green-700 mt-1">
                  Your club is ready to accept payments.
                </p>
              </div>
            </div>
          </div>

          {/* Status Indicators */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className={`rounded-lg p-3 ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Charges Enabled
                </span>
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  chargesEnabled 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                }`}>
                  {chargesEnabled ? 'Yes' : 'No'}
                </span>
              </div>
            </div>

            <div className={`rounded-lg p-3 ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Payouts Enabled
                </span>
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  payoutsEnabled 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                }`}>
                  {payoutsEnabled ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleOpenDashboard}
            disabled={openingDashboard}
            className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {openingDashboard ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Opening...</span>
              </>
            ) : (
              <>
                <span>Open Stripe Dashboard</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </>
            )}
          </button>
        </div>
      )}

      {stripeStatus === 'restricted' && (
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-red-800">
                  Account Restricted
                </h4>
                <p className="text-sm text-red-700 mt-1">
                  Your Stripe account needs additional verification. Please complete the required steps in your Stripe dashboard.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handleOpenDashboard}
            disabled={openingDashboard}
            className="w-full bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {openingDashboard ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Opening...</span>
              </>
            ) : (
              <>
                <span>Open Stripe Dashboard</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
