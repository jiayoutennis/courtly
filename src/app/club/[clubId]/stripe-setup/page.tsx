'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../../../../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import BackButton from '@/app/components/BackButton';
import DarkModeToggle from '@/app/components/DarkModeToggle';

// Types according to the spec
interface ClubStripeData {
  stripeAccountId: string | null;
  stripeStatus: 'unlinked' | 'onboarding' | 'active' | 'restricted' | 'pending_verification';
  stripeOnboardingComplete: boolean;
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
  supportEmail: string;
  supportPhone: string;
  statementDescriptor?: string;
  country: 'US' | string;
  currency: 'usd' | string;
  reservationSettings: {
    requirePaymentAtBooking: boolean;
    hourlyRateCents: number;
  };
  membershipPlans: Array<{
  id: string;
  name: string;
    priceCents: number;
    interval: 'month' | 'year' | 'one_time';
    active: boolean;
    stripePriceId?: string;
  }>;
}

interface ConnectResponse {
  url: string;
  stripeAccountId?: string;
  error?: string;
}

export default function StripeSetupPage() {
  const params = useParams();
  const router = useRouter();
  const clubId = params.clubId as string;

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [clubData, setClubData] = useState<ClubStripeData | null>(null);
  const [darkMode, setDarkMode] = useState(false);

  // UI state
  const [connecting, setConnecting] = useState(false);
  const [openingDashboard, setOpeningDashboard] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        await checkAdminStatus(currentUser.uid);
        await fetchClubData();
        
        // Check for success/refresh URL params
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('connected') === '1') {
          setSuccessMessage('Stripe account connected successfully!');
          setTimeout(() => setSuccessMessage(''), 5000);
          // Clean up URL
          window.history.replaceState({}, '', `/club/${clubId}/stripe-setup`);
        } else if (urlParams.get('refresh') === '1') {
          setErrorMessage('Stripe onboarding was not completed. Please try again.');
          setTimeout(() => setErrorMessage(''), 5000);
          // Clean up URL
          window.history.replaceState({}, '', `/club/${clubId}/stripe-setup`);
        }
      } else {
        setUser(null);
        router.push('/signin');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [clubId, router]);

  const checkAdminStatus = async (userId: string) => {
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          // Debug logging
          console.log('=== ADMIN STATUS DEBUG ===');
          console.log('User ID:', userId);
          console.log('Club ID:', clubId);
          console.log('User Data:', userData);
          console.log('User Type:', userData.userType);
          console.log('Organization:', userData.organization);
          console.log('Is Array:', Array.isArray(userData.organization));
          console.log('Includes Club ID:', userData.organization?.includes(clubId));
          
          // Check if user is Courtly admin or club admin
          const isCourtlyAdmin = userData.userType === 'courtly';
          const isClubAdmin = userData.userType === 'admin' && 
            userData.organization && 
            Array.isArray(userData.organization) && 
            userData.organization.includes(clubId);
            
          console.log('Is Courtly Admin:', isCourtlyAdmin);
          console.log('Is Club Admin:', isClubAdmin);
          console.log('Final Admin Status:', isCourtlyAdmin || isClubAdmin);
          console.log('========================');
            
          setIsAdmin(isCourtlyAdmin || isClubAdmin);
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
    }
  };

  const fetchClubData = async () => {
    try {
      const clubDoc = await getDoc(doc(db, 'orgs', clubId));
      if (clubDoc.exists()) {
        const data = clubDoc.data();
        setClubData({
          stripeAccountId: data.stripeAccountId || null,
          stripeStatus: data.stripeStatus || 'unlinked',
          stripeOnboardingComplete: data.stripeOnboardingComplete || false,
          payoutsEnabled: data.payoutsEnabled || false,
          chargesEnabled: data.chargesEnabled || false,
          supportEmail: data.supportEmail || '',
          supportPhone: data.supportPhone || '',
          statementDescriptor: data.statementDescriptor,
          country: data.country || 'US',
          currency: data.currency || 'usd',
          reservationSettings: data.reservationSettings || {
            requirePaymentAtBooking: true,
            hourlyRateCents: 1500, // $15.00
          },
          membershipPlans: data.membershipPlans || [],
        });
      }
    } catch (error) {
      console.error('Error fetching club data:', error);
    }
  };

  const handleConnectStripe = async () => {
    if (!user || !isAdmin) return;
    
    setConnecting(true);
    try {
      // Get the Firebase ID token
      const idToken = await user.getIdToken();
      
      const response = await fetch('/api/payments/stripe/connect/start', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ clubId }),
      });

      const data: ConnectResponse = await response.json();
      
      if (response.ok) {
        // Redirect to Stripe Connect onboarding
        window.location.href = data.url;
      } else {
        setErrorMessage(data.error || 'Failed to initiate Stripe Connect');
        setTimeout(() => setErrorMessage(''), 5000);
      }
    } catch (error) {
      console.error('Error connecting Stripe:', error);
      setErrorMessage('Failed to connect Stripe. Please try again.');
      setTimeout(() => setErrorMessage(''), 5000);
    } finally {
      setConnecting(false);
    }
  };

  const handleResumeOnboarding = async () => {
    if (!user || !isAdmin) return;
    
    setConnecting(true);
    try {
      // Get the Firebase ID token
      const idToken = await user.getIdToken();
      
      const response = await fetch('/api/payments/stripe/connect/start', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ clubId }),
      });

      const data: ConnectResponse = await response.json();

      if (response.ok) {
        // Redirect to Stripe Connect onboarding
        window.location.href = data.url;
      } else {
        setErrorMessage(data.error || 'Failed to resume Stripe onboarding');
        setTimeout(() => setErrorMessage(''), 5000);
      }
    } catch (error) {
      console.error('Error resuming onboarding:', error);
      setErrorMessage('Failed to resume onboarding. Please try again.');
      setTimeout(() => setErrorMessage(''), 5000);
    } finally {
      setConnecting(false);
    }
  };

  const handleOpenDashboard = async () => {
    if (!user || !isAdmin || !clubData?.stripeAccountId) return;
    
    setOpeningDashboard(true);
    try {
      // Get the Firebase ID token
      const idToken = await user.getIdToken();
      
      const response = await fetch('/api/payments/stripe/connect/dashboard', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ clubId }),
      });

      const data: ConnectResponse = await response.json();

      if (response.ok) {
        // Open Stripe Express Dashboard in new tab
        window.open(data.url, '_blank');
      } else {
        setErrorMessage(data.error || 'Failed to open Stripe dashboard');
        setTimeout(() => setErrorMessage(''), 5000);
      }
    } catch (error) {
      console.error('Error opening dashboard:', error);
      setErrorMessage('Failed to open dashboard. Please try again.');
      setTimeout(() => setErrorMessage(''), 5000);
    } finally {
      setOpeningDashboard(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Access Denied
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            You need to be a club admin to access this page.
          </p>
          <Link
            href="/dashboard"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

    return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <BackButton darkMode={darkMode} />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Stripe Payment Setup
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Configure payments for your club
                </p>
              </div>
            </div>
            <DarkModeToggle darkMode={darkMode} setDarkMode={setDarkMode} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Success/Error Messages */}
      {successMessage && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
          </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">{successMessage}</p>
        </div>
          </div>
        </div>
      )}

        {errorMessage && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
          </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">{errorMessage}</p>
        </div>
      </div>
          </div>
        )}

        {/* Connect Stripe Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            Stripe Connect Status
              </h2>

          {clubData?.stripeStatus === 'unlinked' && (
            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start">
                      <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                      </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">
                      Stripe Not Connected
                        </h3>
                    <p className="text-sm text-yellow-700 mt-1">
                      Connect your Stripe account to start accepting payments for court reservations and memberships.
                    </p>
                          </div>
                          </div>
                  </div>

                  <button
                    onClick={handleConnectStripe}
                disabled={connecting}
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                {connecting ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        <span>Connecting...</span>
                      </>
                    ) : (
                      <>
                    <span>Connect Stripe Account</span>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </>
                    )}
                  </button>
          </div>
        )}
        
          {clubData?.stripeStatus === 'onboarding' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
            </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-blue-800">
                      Onboarding In Progress
              </h3>
                    <p className="text-sm text-blue-700 mt-1">
                      Complete your Stripe account setup to start accepting payments.
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleResumeOnboarding}
                disabled={connecting}
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {connecting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Resuming...</span>
                  </>
                ) : (
                  <>
                    <span>Resume Stripe Onboarding</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          )}

          {clubData?.stripeStatus === 'active' && (
                    <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                      </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-green-800">
                      Stripe Connected ✅
                    </h3>
                    <p className="text-sm text-green-700 mt-1">
                      Your club is ready to accept payments.
                    </p>
                  </div>
                </div>
              </div>

              {/* Status Indicators */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Charges Enabled
                    </span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      clubData?.chargesEnabled 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    }`}>
                      {clubData?.chargesEnabled ? 'Yes' : 'No'}
                    </span>
                  </div>
                        </div>
                        
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Payouts Enabled
                    </span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      clubData?.payoutsEnabled 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    }`}>
                      {clubData?.payoutsEnabled ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                    <button
                  onClick={handleOpenDashboard}
                  disabled={openingDashboard}
                  className="flex-1 bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {openingDashboard ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Opening...</span>
                    </>
                  ) : (
                    <>
                      <span>Open Stripe Dashboard</span>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </>
                  )}
                    </button>
                  </div>
                </div>
          )}

          {clubData?.stripeStatus === 'restricted' && (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      Account Restricted
              </h3>
                    <p className="text-sm text-red-700 mt-1">
                      Your Stripe account needs additional verification. Please complete the required steps in your Stripe dashboard.
                  </p>
                </div>
                        </div>
                      </div>

                      <button
                onClick={handleOpenDashboard}
                disabled={openingDashboard}
                className="w-full bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {openingDashboard ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Opening...</span>
                  </>
                ) : (
                  <>
                    <span>Open Stripe Dashboard</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </>
                )}
                      </button>
                </div>
              )}
            </div>

        {/* Payment Settings */}
        {clubData?.stripeStatus === 'active' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Payment Settings
            </h2>
            
            <div className="space-y-4">
                <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Hourly Rate
                  </label>
                <div className="flex items-center space-x-2">
                  <span className="text-gray-500">$</span>
                  <input
                    type="number"
                    value={clubData?.reservationSettings?.hourlyRateCents ? clubData.reservationSettings.hourlyRateCents / 100 : 0}
                    onChange={(e) => {
                      const cents = Math.round(parseFloat(e.target.value) * 100);
                      // Update in Firestore
                      updateDoc(doc(db, 'orgs', clubId), {
                        'reservationSettings.hourlyRateCents': cents
                      });
                    }}
                    className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    step="0.01"
                    min="0"
                  />
                  <span className="text-sm text-gray-500">per hour</span>
                </div>
                </div>

              <div className="flex items-center">
                  <input
                  type="checkbox"
                  id="requirePayment"
                  checked={clubData?.reservationSettings?.requirePaymentAtBooking || false}
                  onChange={(e) => {
                    updateDoc(doc(db, 'orgs', clubId), {
                      'reservationSettings.requirePaymentAtBooking': e.target.checked
                    });
                  }}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="requirePayment" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  Require payment at time of booking
                  </label>
                </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}