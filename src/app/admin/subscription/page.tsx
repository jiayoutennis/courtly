/**
 * Club Subscription Management Page
 * Allows club admins to view and manage their Courtly subscription
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { auth, db } from '../../../../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import DarkModeToggle from '@/app/components/DarkModeToggle';
import PageTitle from '@/app/components/PageTitle';
import SubscriptionPlans from '@/components/stripe/SubscriptionPlans';
import { getStripe } from '@/lib/stripe/client';

interface ClubData {
  id: string;
  name: string;
  subscription?: {
    plan: string;
    status: string;
    stripeSubscriptionId?: string;
    stripeCustomerId?: string;
    currentPeriodEnd?: any;
  };
}

function SubscriptionPageContent() {
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [clubData, setClubData] = useState<ClubData | null>(null);
  const [userEmail, setUserEmail] = useState('');

  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode === 'true') {
      setDarkMode(true);
    }
  }, []);

  useEffect(() => {
    // Check for success/cancel parameters
    if (searchParams?.get('success')) {
      setSuccess('Subscription activated successfully!');
      // Clean up URL
      window.history.replaceState({}, '', '/admin/subscription');
    }
    if (searchParams?.get('canceled')) {
      setError('Subscription setup was canceled');
      window.history.replaceState({}, '', '/admin/subscription');
    }
  }, [searchParams]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/signin');
        return;
      }

      try {
        setUserEmail(user.email || '');

        // Get user's club
        console.log('Fetching user document for UID:', user.uid);
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        
        console.log('User document exists?', userDoc.exists());
        console.log('User document ID:', userDoc.id);
        console.log('User document ref path:', userDoc.ref.path);
        
        if (!userDoc.exists()) {
          console.error('User document not found for UID:', user.uid);
          setError('User not found');
          setLoading(false);
          return;
        }

        const userData = userDoc.data();
        console.log('Raw user data:', userData);
        console.log('User data keys:', Object.keys(userData || {}));
        console.log('User data:', {
          uid: user.uid,
          email: user.email,
          userType: userData?.userType,
          organization: userData?.organization,
          organizations: userData?.organizations,
          allFields: userData,
        });

        if (userData.userType !== 'admin') {
          setError('Only club administrators can access this page');
          setLoading(false);
          return;
        }

        // Get the organization (club) for this user
        // Support multiple formats: string, array, or object
        let orgId: string | null = null;
        
        if (typeof userData.organization === 'string') {
          // Format: organization: "orgId"
          orgId = userData.organization;
        } else if (Array.isArray(userData.organization) && userData.organization.length > 0) {
          // Format: organization: ["orgId"]
          orgId = userData.organization[0];
        } else if (typeof userData.organization === 'object' && userData.organization?.id) {
          // Format: organization: { id: "orgId" }
          orgId = userData.organization.id;
        } else if (Array.isArray(userData.organizations) && userData.organizations.length > 0) {
          // Format: organizations: ["orgId"]
          orgId = userData.organizations[0];
        }
        
        console.log('Organization ID from user:', orgId, 'Type:', typeof userData.organization);
        
        if (!orgId || typeof orgId !== 'string') {
          console.error('No valid organization ID found. User data:', userData);
          setError('No club associated with your account. Please contact support to link your account to a club.');
          setLoading(false);
          return;
        }

        // Get club data
        const clubDoc = await getDoc(doc(db, 'orgs', orgId));
        if (!clubDoc.exists()) {
          setError('Club not found');
          setLoading(false);
          return;
        }

        const club = clubDoc.data();
        const clubDataObj = {
          id: clubDoc.id,
          name: club.name,
          subscription: club.subscription || {
            plan: 'free',
            status: 'active',
          },
        };
        
        console.log('Club data loaded:', clubDataObj);
        setClubData(clubDataObj);
      } catch (err) {
        console.error('Error loading subscription:', err);
        setError('Failed to load subscription data');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleSelectPlan = async (_planId: string, priceId: string) => {
    try {
      setError('');
      setLoading(true);

      // Validate required data
      if (!clubData?.id) {
        throw new Error('Club ID not found. Please refresh the page.');
      }
      if (!userEmail) {
        throw new Error('User email not found. Please sign in again.');
      }
      if (!priceId) {
        throw new Error('Invalid plan selected.');
      }

      console.log('Creating checkout session with:', {
        priceId,
        clubId: clubData.id,
        customerEmail: userEmail,
      });

      // Create checkout session
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId,
          customerId: clubData?.subscription?.stripeCustomerId,
          customerEmail: userEmail,
          clubId: clubData.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe Checkout
      const stripe = await getStripe();
      if (!stripe) {
        throw new Error('Stripe failed to load');
      }

      // Type assertion for redirectToCheckout which exists on Stripe instance
      const result = await (stripe as any).redirectToCheckout({
        sessionId: data.sessionId,
      });

      if (result?.error) {
        throw new Error(result.error.message);
      }
    } catch (err) {
      console.error('Error selecting plan:', err);
      setError(err instanceof Error ? err.message : 'Failed to upgrade plan');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        darkMode ? 'bg-[#0a0a0a]' : 'bg-white'
      }`}>
        <div className={`w-8 h-8 border-2 border-t-transparent rounded-full animate-spin ${
          darkMode ? 'border-white' : 'border-black'
        }`}></div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors ${
      darkMode ? 'bg-[#0a0a0a]' : 'bg-white'
    }`}>
      <PageTitle title="Subscription - Courtly" />
      
      {/* Header */}
      <header className={`py-4 sm:py-6 px-4 sm:px-6 ${
        darkMode ? '' : 'border-b border-gray-100'
      }`}>
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
            <div>
              <h1 className={`text-xl sm:text-2xl md:text-3xl font-light tracking-tight ${
                darkMode ? 'text-white' : 'text-gray-900'
              }`}>
                Subscription
              </h1>
              {clubData && (
                <p className={`mt-1 text-xs sm:text-sm font-light ${
                  darkMode ? 'text-gray-500' : 'text-gray-400'
                }`}>
                  Manage your Courtly subscription for {clubData.name}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3 sm:gap-4">
              <DarkModeToggle darkMode={darkMode} setDarkMode={setDarkMode} />
              <Link
                href="/dashboard"
                className={`text-xs sm:text-sm font-light ${
                  darkMode
                    ? 'text-gray-400 hover:text-white'
                    : 'text-gray-500 hover:text-gray-900'
                } transition-colors`}
              >
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Messages */}
        {error && (
          <div className={`mb-6 p-4 text-sm font-light ${
            darkMode ? 'text-red-400 bg-red-900/20' : 'text-red-600 bg-red-50'
          } rounded`}>
            {error}
          </div>
        )}

        {success && (
          <div className={`mb-6 p-4 text-sm font-light ${
            darkMode ? 'text-green-400 bg-green-900/20' : 'text-green-600 bg-green-50'
          } rounded`}>
            {success}
          </div>
        )}

        {/* Current Subscription Info */}
        {clubData?.subscription && (
          <div className={`mb-8 p-6 rounded-lg ${
            darkMode ? 'bg-[#1a1a1a]' : 'bg-gray-50'
          }`}>
            <h2 className={`text-lg font-light mb-4 ${
              darkMode ? 'text-white' : 'text-gray-900'
            }`}>
              Current Subscription
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className={`text-xs font-light mb-1 ${
                  darkMode ? 'text-gray-500' : 'text-gray-600'
                }`}>
                  Plan
                </div>
                <div className={`text-sm font-light capitalize ${
                  darkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  {clubData.subscription.plan}
                </div>
              </div>
              <div>
                <div className={`text-xs font-light mb-1 ${
                  darkMode ? 'text-gray-500' : 'text-gray-600'
                }`}>
                  Status
                </div>
                <div className={`text-sm font-light capitalize ${
                  clubData.subscription.status === 'active'
                    ? 'text-green-500'
                    : 'text-yellow-500'
                }`}>
                  {clubData.subscription.status}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Debug Info - Remove in production */}
        <div className={`mb-6 p-4 rounded text-xs font-mono ${
          darkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'
        }`}>
          <div>Club ID: {clubData?.id || 'NOT LOADED'}</div>
          <div>Club Name: {clubData?.name || 'NOT LOADED'}</div>
          <div>User Email: {userEmail || 'NOT LOADED'}</div>
        </div>

        {/* Subscription Plans */}
        <div>
          <h2 className={`text-lg font-light mb-6 ${
            darkMode ? 'text-white' : 'text-gray-900'
          }`}>
            Available Plans
          </h2>
          {clubData?.id ? (
            <SubscriptionPlans
              currentPlan={clubData?.subscription?.plan || 'free'}
              darkMode={darkMode}
              onSelectPlan={handleSelectPlan}
            />
          ) : (
            <div className={`text-center py-12 ${
              darkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>
              <div className={`w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4 ${
                darkMode ? 'border-white' : 'border-black'
              }`}></div>
              Loading subscription plans...
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className={`mt-8 p-4 rounded text-xs font-light ${
          darkMode ? 'bg-blue-900/20 text-blue-400' : 'bg-blue-50 text-blue-700'
        }`}>
          <p>
            <strong>Note:</strong> You can upgrade or downgrade your plan at any time. 
            Changes will be reflected in your next billing cycle. All plans include a 14-day free trial.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SubscriptionPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="text-center">Loading...</div></div>}>
      <SubscriptionPageContent />
    </Suspense>
  );
}
