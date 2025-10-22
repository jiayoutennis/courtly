"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { auth, db } from "../../../../../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import DarkModeToggle from "@/app/components/DarkModeToggle";
import PageTitle from "@/app/components/PageTitle";
import SubscriptionManager from "@/components/stripe/SubscriptionManager";
import SubscriptionPlans from "@/components/stripe/SubscriptionPlans";
import { getStripe } from "@/lib/stripe/client";

interface SubscriptionInfo {
  plan: 'free' | 'basic' | 'pro' | 'enterprise';
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete' | 'incomplete_expired' | 'unpaid';
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  stripePriceId?: string;
  currentPeriodStart?: number;
  currentPeriodEnd?: number;
  cancelAtPeriodEnd?: boolean;
}

interface StaffMember {
  userId: string;
  role: string;
}

interface OrgData {
  orgId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  staff: StaffMember[];
  subscription?: SubscriptionInfo;
}

export default function SubscriptionPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const clubIdFromUrl = params.clubId as string;
  
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [orgData, setOrgData] = useState<OrgData | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [showPlans, setShowPlans] = useState(false);

  // Initialize dark mode from localStorage
  useEffect(() => {
    const savedMode = localStorage.getItem("darkMode");
    if (savedMode === "true") {
      setDarkMode(true);
    }
  }, []);

  // Check for success/cancel parameters from Stripe redirect
  useEffect(() => {
    if (searchParams?.get('success')) {
      setSuccess('Subscription activated successfully!');
      // Clean up URL
      window.history.replaceState({}, '', `/club/${clubIdFromUrl}/subscription`);
    }
    if (searchParams?.get('canceled')) {
      setError('Subscription setup was canceled');
      window.history.replaceState({}, '', `/club/${clubIdFromUrl}/subscription`);
    }
  }, [searchParams, clubIdFromUrl]);

  // Authentication and authorization check
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push('/signin');
        return;
      }
      
      try {
        setLoading(true);
        setUserEmail(currentUser.email || '');
        
        // Fetch org data
        const orgRef = doc(db, 'orgs', clubIdFromUrl);
        const orgDoc = await getDoc(orgRef);
        
        if (!orgDoc.exists()) {
          setError('Club not found');
          setIsAuthorized(false);
          return;
        }
        
        const data = orgDoc.data() as OrgData;
        setOrgData({
          ...data,
          orgId: clubIdFromUrl
        });
        
        // Check if user is in staff
        const staff = data.staff || [];
        const userStaffRecord = staff.find(s => s.userId === currentUser.uid);
        
        if (!userStaffRecord) {
          setError('You do not have access to this club');
          setIsAuthorized(false);
          return;
        }
        
        // Check if user is owner
        setIsOwner(userStaffRecord.role === 'owner');
        setIsAuthorized(true);
        
      } catch (error) {
        console.error('Error fetching club data:', error);
        setError('Failed to load club data');
        setIsAuthorized(false);
      } finally {
        setLoading(false);
      }
    });
    
    return () => unsubscribe();
  }, [clubIdFromUrl, router]);

  const fetchClubData = async () => {
    try {
      const orgRef = doc(db, 'orgs', clubIdFromUrl);
      const orgDoc = await getDoc(orgRef);
      
      if (orgDoc.exists()) {
        const data = orgDoc.data() as OrgData;
        setOrgData({
          ...data,
          orgId: clubIdFromUrl
        });
      }
    } catch (error) {
      console.error('Error refreshing club data:', error);
    }
  };

  const handleSelectPlan = async (_planId: string, priceId: string) => {
    try {
      setError('');
      setSuccess('');
      setLoading(true);

      // Validate required data
      if (!clubIdFromUrl) {
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
        clubId: clubIdFromUrl,
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
          customerId: orgData?.subscription?.stripeCustomerId,
          customerEmail: userEmail,
          clubId: clubIdFromUrl,
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

  // Show loading state
  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors duration-300 ${
        darkMode ? "bg-[#0a0a0a] text-white" : "bg-white text-gray-900"
      }`}>
        <div className="text-center">
          <div className={`w-12 h-12 border-2 ${
            darkMode ? "border-white" : "border-black"
          } border-t-transparent rounded-full animate-spin mx-auto`}></div>
          <p className={`mt-4 font-light ${
            darkMode ? "text-gray-400" : "text-gray-600"
          }`}>Loading subscription...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (!isAuthorized || error) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors duration-300 ${
        darkMode ? "bg-[#0a0a0a] text-white" : "bg-white text-gray-900"
      }`}>
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-light mb-2">Access Denied</h1>
          <p className={`font-light mb-6 ${
            darkMode ? "text-gray-400" : "text-gray-600"
          }`}>
            {error || 'You do not have access to this page'}
          </p>
          <Link
            href="/dashboard"
            className={`inline-block px-6 py-3 font-light transition-colors ${
              darkMode
                ? "bg-white text-black hover:bg-gray-200"
                : "bg-black text-white hover:bg-gray-800"
            }`}
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      darkMode ? "bg-[#0a0a0a] text-white" : "bg-white text-gray-900"
    }`}>
      <PageTitle title={`Subscription - ${orgData?.name || 'Club'} - Courtly`} />
      
      {/* Header */}
      <header className={`border-b ${
        darkMode ? "border-[#1a1a1a]" : "border-gray-100"
      }`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              <Link
                href={`/club/${clubIdFromUrl}`}
                className={`p-2 transition-colors ${
                  darkMode
                    ? "hover:bg-[#1a1a1a] text-gray-400 hover:text-white"
                    : "hover:bg-gray-100 text-gray-600 hover:text-black"
                }`}
                aria-label="Back to club"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <h1 className={`text-xl sm:text-2xl font-light ${
                  darkMode ? "text-white" : "text-black"
                }`}>
                  Subscription Management
                </h1>
                <p className={`text-sm font-light ${
                  darkMode ? "text-gray-400" : "text-gray-600"
                }`}>
                  {orgData?.name}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 sm:gap-4">
              <Link
                href="/dashboard"
                className={`text-xs sm:text-sm font-light ${
                  darkMode
                    ? "text-gray-400 hover:text-white"
                    : "text-gray-600 hover:text-black"
                } transition-colors`}
              >
                Dashboard
              </Link>
              <DarkModeToggle darkMode={darkMode} setDarkMode={setDarkMode} />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Success/Error Messages */}
        {error && !loading && (
          <div className={`mb-6 p-4 border text-sm font-light ${
            darkMode 
              ? 'bg-red-900/20 text-red-400 border-red-900/30' 
              : 'bg-red-50 text-red-600 border-red-100'
          }`}>
            {error}
          </div>
        )}

        {success && (
          <div className={`mb-6 p-4 border text-sm font-light ${
            darkMode 
              ? 'bg-green-900/20 text-green-400 border-green-900/30' 
              : 'bg-green-50 text-green-600 border-green-100'
          }`}>
            {success}
          </div>
        )}

        {/* Current Subscription Management */}
        {orgData?.subscription ? (
          <div className="mb-8">
            <SubscriptionManager
              clubId={clubIdFromUrl}
              subscription={orgData.subscription}
              onUpdate={fetchClubData}
              isOwner={isOwner}
              darkMode={darkMode}
            />
          </div>
        ) : (
          <div className={`mb-8 p-6 sm:p-8 border text-center ${
            darkMode ? "bg-[#0a0a0a] border-[#1a1a1a]" : "bg-white border-gray-100"
          }`}>
            <div className="text-4xl mb-4">📊</div>
            <h2 className={`text-lg sm:text-xl font-light mb-2 ${
              darkMode ? "text-white" : "text-gray-900"
            }`}>
              No Subscription Information
            </h2>
            <p className={`text-sm font-light ${
              darkMode ? "text-gray-400" : "text-gray-600"
            }`}>
              This club doesn't have subscription data yet. Choose a plan below to get started.
            </p>
          </div>
        )}

        {/* Available Plans Section */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <h2 className={`text-lg sm:text-xl font-light ${
              darkMode ? 'text-white' : 'text-gray-900'
            }`}>
              {orgData?.subscription?.plan === 'free' ? 'Upgrade Your Plan' : 'Change Plan'}
            </h2>
            {!showPlans && orgData?.subscription && orgData.subscription.plan !== 'free' && (
              <button
                onClick={() => setShowPlans(!showPlans)}
                className={`text-xs sm:text-sm font-light px-3 sm:px-4 py-2 transition-colors ${
                  darkMode
                    ? 'text-gray-400 hover:text-white hover:bg-[#1a1a1a]'
                    : 'text-gray-600 hover:text-black hover:bg-gray-100'
                }`}
              >
                View All Plans
              </button>
            )}
          </div>

          {/* Show plans if: free plan, or user clicked "View All Plans" */}
          {(orgData?.subscription?.plan === 'free' || showPlans || !orgData?.subscription) && (
            <>
              <SubscriptionPlans
                currentPlan={orgData?.subscription?.plan || 'free'}
                darkMode={darkMode}
                onSelectPlan={handleSelectPlan}
              />
              
              {/* Info Box */}
              <div className={`mt-8 p-4 border text-sm font-light ${
                darkMode 
                  ? 'bg-blue-900/20 text-blue-400 border-blue-900/30' 
                  : 'bg-blue-50 text-blue-700 border-blue-100'
              }`}>
                <p>
                  <strong>Note:</strong> You can upgrade or downgrade your plan at any time. 
                  Changes will be reflected in your next billing cycle.
                  {isOwner ? ' Only club owners can change subscription plans.' : ''}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className={`mt-12 sm:mt-16 pt-6 sm:pt-8 border-t ${
          darkMode ? "border-[#1a1a1a]" : "border-gray-100"
        }`}>
          <p className={`text-center text-xs sm:text-sm font-light ${
            darkMode ? "text-gray-600" : "text-gray-400"
          }`}>
            © 2025 Courtly by JiaYou Tennis
          </p>
        </div>
      </main>
    </div>
  );
}
