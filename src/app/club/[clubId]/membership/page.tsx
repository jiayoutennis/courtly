"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { db, auth } from "../../../../../firebase";
import { 
  doc, 
  getDoc
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import PageTitle from "@/app/components/PageTitle";
import MembershipPlans from "@/components/stripe/MembershipPlans";

interface MembershipTierConfig {
  stripeProductId: string;
  stripePriceId: string;
  isActive: boolean;
}

interface MembershipPlan {
  id: string;
  name: string;
  tier: 'monthly' | 'annual' | 'day_pass';
  price: number;
  currency: string;
  stripePriceId: string;
  stripeProductId: string;
  features: string[];
  description: string;
  isActive: boolean;
}

interface ClubInfo {
  name: string;
  description?: string;
}

interface UserMembership {
  id: string;
  orgId: string;
  status: 'active' | 'expired' | 'canceled';
  tier: string;
  startDate: any;
  endDate: any;
  autoRenew: boolean;
}

export default function ClubMembershipPage() {
  const params = useParams();
  const clubId = params.clubId as string;
  
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [club, setClub] = useState<ClubInfo | null>(null);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userMembership, setUserMembership] = useState<UserMembership | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Initialize dark mode
  useEffect(() => {
    const savedMode = localStorage.getItem("darkMode");
    if (savedMode === "true") {
      setDarkMode(true);
    }
  }, []);

  // Check authentication
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user) {
        // Allow viewing plans without being signed in
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch club info and membership plans
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch club info
        const clubDoc = await getDoc(doc(db, "orgs", clubId));
        if (!clubDoc.exists()) {
          setError("Club not found");
          return;
        }

        const clubData = clubDoc.data();
        setClub({
          name: clubData.name || "Club",
          description: clubData.description || "",
        });

        // Check if memberships are enabled
        if (!clubData.membershipEnabled) {
          setPlans([]);
          setLoading(false);
          return;
        }

        // Get membership tiers from org document (new map structure)
        const membershipTiers = (clubData.membershipTiers || {}) as Record<string, MembershipTierConfig>;
        
        // Fetch full plan details from membershipPlans subcollection for active tiers
        const plansData: MembershipPlan[] = [];
        
        for (const [tierName, tierConfig] of Object.entries(membershipTiers)) {
          // Only fetch active tiers
          if (tierConfig.isActive) {
            try {
              const planDoc = await getDoc(
                doc(db, "orgs", clubId, "membershipPlans", tierName)
              );
              
              if (planDoc.exists()) {
                plansData.push({
                  id: planDoc.id,
                  ...planDoc.data()
                } as MembershipPlan);
              }
            } catch (err) {
              console.error(`Error fetching plan ${tierName}:`, err);
              // Continue with other plans
            }
          }
        }

        // Sort plans: day_pass, monthly, annual
        plansData.sort((a, b) => {
          const order = { 'day_pass': 1, 'monthly': 2, 'annual': 3 };
          return order[a.tier] - order[b.tier];
        });

        setPlans(plansData);

        // If user is logged in, check their current membership
        if (currentUser) {
          await fetchUserMembership(currentUser.uid);
        }

      } catch (error) {
        console.error("Error fetching data:", error);
        setError("Failed to load membership information");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [clubId, currentUser]);

  // Check for successful payment redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const membershipStatus = params.get('membership');
    
    if (membershipStatus === 'success') {
      setSuccess('✅ Membership purchased successfully! Processing your membership...');
      
      // Retry fetching membership status multiple times
      // (webhook might take a moment to complete)
      if (currentUser) {
        let retryCount = 0;
        const maxRetries = 5;
        
        const retryFetch = async () => {
          await fetchUserMembership(currentUser.uid);
          
          // Check if membership was loaded
          retryCount++;
          if (!userMembership && retryCount < maxRetries) {
            console.log(`Retrying membership fetch (${retryCount}/${maxRetries})...`);
            setTimeout(retryFetch, 2000); // Wait 2 seconds before retry
          } else if (userMembership) {
            setSuccess('✅ Membership activated! Welcome to the club!');
          } else {
            setSuccess('✅ Payment received! Your membership will be activated shortly.');
          }
        };
        
        retryFetch();
      }
      
      // Clear URL params after 10 seconds (longer to allow retries)
      setTimeout(() => {
        window.history.replaceState({}, '', window.location.pathname);
      }, 10000);
    } else if (membershipStatus === 'canceled') {
      setError('Membership purchase was canceled.');
      setTimeout(() => {
        window.history.replaceState({}, '', window.location.pathname);
      }, 3000);
    }
  }, [currentUser]);

  const fetchUserMembership = async (userId: string) => {
    try {
      // Memberships are stored in /orgs/{clubId}/memberships/{userId}
      const membershipRef = doc(db, "orgs", clubId, "memberships", userId);
      const membershipDoc = await getDoc(membershipRef);
      
      if (membershipDoc.exists()) {
        const membershipData = membershipDoc.data();
        // Only set if status is active
        if (membershipData.status === 'active') {
          setUserMembership({
            id: membershipDoc.id,
            ...membershipData
          } as UserMembership);
        }
      }
    } catch (error) {
      console.error("Error fetching membership:", error);
    }
  };

  const handlePurchaseError = (error: string) => {
    setError(error);
    setTimeout(() => setError(""), 5000);
  };

  const getMembershipStatusBadge = () => {
    if (!userMembership) return null;

    const endDate = userMembership.endDate?.toDate?.() || new Date(userMembership.endDate);
    const daysRemaining = Math.ceil((endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

    return (
      <div className={`mb-8 p-6 border rounded-lg ${
        darkMode ? 'border-[#1a1a1a] bg-[#0a0a0a]' : 'border-gray-200 bg-gray-50'
      }`}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className={`text-lg font-light mb-2 ${
              darkMode ? 'text-white' : 'text-gray-900'
            }`}>
              Current Membership
            </h3>
            <div className="space-y-1">
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                <span className="font-medium">Type:</span> {userMembership.tier.charAt(0).toUpperCase() + userMembership.tier.slice(1)}
              </p>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                <span className="font-medium">Status:</span>{' '}
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  userMembership.status === 'active'
                    ? (darkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-800')
                    : (darkMode ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-800')
                }`}>
                  {userMembership.status}
                </span>
              </p>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                <span className="font-medium">Expires:</span> {endDate.toLocaleDateString()}
                {daysRemaining > 0 && daysRemaining <= 30 && (
                  <span className={`ml-2 text-xs ${darkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                    ({daysRemaining} days remaining)
                  </span>
                )}
              </p>
              {userMembership.autoRenew && (
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  <span className="font-medium">Auto-renew:</span> Enabled
                </p>
              )}
            </div>
          </div>
          
          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            <Link
              href={`/club/${clubId}/my-bookings`}
              className={`px-4 py-2 text-xs uppercase tracking-wider font-light text-center transition ${
                darkMode
                  ? 'border border-white text-white hover:bg-white hover:text-black'
                  : 'border border-black text-black hover:bg-black hover:text-white'
              }`}
            >
              My Bookings
            </Link>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        darkMode ? "bg-[#0a0a0a] text-white" : "bg-white text-gray-900"
      }`}>
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-t-transparent border-teal-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg font-light">Loading membership plans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      darkMode ? "bg-[#0a0a0a] text-white" : "bg-white text-gray-900"
    }`}>
      <PageTitle title={`Membership - ${club?.name || 'Club'} - Courtly`} />
      
      {/* Header */}
      <header className={`border-b transition-colors duration-300 ${
        darkMode ? 'border-[#1a1a1a]' : 'border-gray-100'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <Link 
              href="/" 
              className={`text-xl font-light tracking-wider ${
                darkMode ? "text-white" : "text-black"
              }`}
            >
              COURTLY
            </Link>
          </div>
          <button
            onClick={() => {
              setDarkMode(!darkMode);
              localStorage.setItem("darkMode", (!darkMode).toString());
            }}
            className={`p-2 rounded transition-colors ${
              darkMode ? "hover:bg-[#1a1a1a]" : "hover:bg-gray-100"
            }`}
            aria-label="Toggle dark mode"
          >
            {darkMode ? (
              <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back button */}
        <Link
          href={`/club/${clubId}`}
          className={`inline-flex items-center mb-6 text-sm transition-colors ${
            darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-black'
          }`}
        >
          <svg className="w-4 h-4 mr-2" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
            <path d="M15 19l-7-7 7-7"></path>
          </svg>
          Back to Club
        </Link>

        {/* Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-light mb-2">Membership Plans</h1>
          <p className={`text-lg font-light ${
            darkMode ? 'text-gray-400' : 'text-gray-600'
          }`}>
            {club?.name}
          </p>
          {club?.description && (
            <p className={`mt-2 text-sm ${
              darkMode ? 'text-gray-500' : 'text-gray-500'
            }`}>
              {club.description}
            </p>
          )}
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className={`mb-6 p-4 border rounded-lg ${
            darkMode 
              ? 'border-green-900/50 bg-green-900/20 text-green-400' 
              : 'border-green-200 bg-green-50 text-green-800'
          }`}>
            <div className="flex items-start">
              <svg className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <p>{success}</p>
            </div>
          </div>
        )}

        {error && (
          <div className={`mb-6 p-4 border rounded-lg ${
            darkMode 
              ? 'border-red-900/50 bg-red-900/20 text-red-400' 
              : 'border-red-200 bg-red-50 text-red-800'
          }`}>
            <div className="flex items-start">
              <svg className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* Sign-in prompt if not logged in */}
        {!currentUser && (
          <div className={`mb-6 p-4 border rounded-lg ${
            darkMode 
              ? 'border-blue-900/50 bg-blue-900/20 text-blue-400' 
              : 'border-blue-200 bg-blue-50 text-blue-800'
          }`}>
            <div className="flex items-start">
              <svg className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="font-medium mb-1">Sign in to purchase a membership</p>
                <p className="text-sm mb-3">You need to be signed in to purchase a membership plan.</p>
                <Link
                  href={`/signin?redirect=/club/${clubId}/membership`}
                  className={`inline-block px-4 py-2 text-xs uppercase tracking-wider font-light transition ${
                    darkMode
                      ? 'border border-blue-400 text-blue-400 hover:bg-blue-400 hover:text-black'
                      : 'border border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white'
                  }`}
                >
                  Sign In
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Current Membership Status */}
        {currentUser && userMembership && getMembershipStatusBadge()}

        {/* Membership Plans */}
        {plans.length === 0 ? (
          <div className={`text-center py-12 border rounded-lg ${
            darkMode ? 'border-[#1a1a1a]' : 'border-gray-200'
          }`}>
            <svg className={`w-16 h-16 mx-auto mb-4 ${
              darkMode ? 'text-gray-700' : 'text-gray-300'
            }`} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
              <path d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
            </svg>
            <h3 className={`text-xl font-light mb-2 ${
              darkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>
              No Membership Plans Available
            </h3>
            <p className={`text-sm ${
              darkMode ? 'text-gray-500' : 'text-gray-500'
            }`}>
              This club hasn't set up any membership plans yet.
            </p>
          </div>
        ) : (
          <div>
            <h2 className={`text-xl font-light mb-6 ${
              darkMode ? 'text-white' : 'text-gray-900'
            }`}>
              Choose Your Plan
            </h2>
            <MembershipPlans
              clubId={clubId}
              clubName={club?.name || 'Club'}
              plans={plans}
              darkMode={darkMode}
              onError={handlePurchaseError}
            />
          </div>
        )}

        {/* Benefits Section */}
        <div className={`mt-12 p-8 border rounded-lg ${
          darkMode ? 'border-[#1a1a1a] bg-[#0a0a0a]' : 'border-gray-200 bg-gray-50'
        }`}>
          <h3 className={`text-lg font-light mb-4 ${
            darkMode ? 'text-white' : 'text-gray-900'
          }`}>
            Membership Benefits
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start">
              <svg className={`w-5 h-5 mr-3 mt-0.5 flex-shrink-0 ${
                darkMode ? 'text-white' : 'text-black'
              }`} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M5 13l4 4L19 7"></path>
              </svg>
              <div>
                <p className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  Priority Court Access
                </p>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Book courts before non-members
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <svg className={`w-5 h-5 mr-3 mt-0.5 flex-shrink-0 ${
                darkMode ? 'text-white' : 'text-black'
              }`} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M5 13l4 4L19 7"></path>
              </svg>
              <div>
                <p className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  Member-Only Events
                </p>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Exclusive tournaments and social events
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <svg className={`w-5 h-5 mr-3 mt-0.5 flex-shrink-0 ${
                darkMode ? 'text-white' : 'text-black'
              }`} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M5 13l4 4L19 7"></path>
              </svg>
              <div>
                <p className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  Special Rates
                </p>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Discounted rates on lessons and programs
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <svg className={`w-5 h-5 mr-3 mt-0.5 flex-shrink-0 ${
                darkMode ? 'text-white' : 'text-black'
              }`} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M5 13l4 4L19 7"></path>
              </svg>
              <div>
                <p className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  Flexible Cancellation
                </p>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Cancel anytime with no penalties
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-12">
          <h3 className={`text-lg font-light mb-6 ${
            darkMode ? 'text-white' : 'text-gray-900'
          }`}>
            Frequently Asked Questions
          </h3>
          <div className="space-y-4">
            <details className={`p-4 border rounded-lg ${
              darkMode ? 'border-[#1a1a1a]' : 'border-gray-200'
            }`}>
              <summary className={`font-medium cursor-pointer ${
                darkMode ? 'text-white' : 'text-gray-900'
              }`}>
                Can I upgrade or downgrade my membership?
              </summary>
              <p className={`mt-2 text-sm ${
                darkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Yes, you can upgrade or downgrade your membership at any time. Changes will be reflected in your next billing cycle.
              </p>
            </details>
            <details className={`p-4 border rounded-lg ${
              darkMode ? 'border-[#1a1a1a]' : 'border-gray-200'
            }`}>
              <summary className={`font-medium cursor-pointer ${
                darkMode ? 'text-white' : 'text-gray-900'
              }`}>
                What happens if I cancel my membership?
              </summary>
              <p className={`mt-2 text-sm ${
                darkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                You'll retain access until the end of your current billing period. After that, your membership will expire and you'll lose member benefits.
              </p>
            </details>
            <details className={`p-4 border rounded-lg ${
              darkMode ? 'border-[#1a1a1a]' : 'border-gray-200'
            }`}>
              <summary className={`font-medium cursor-pointer ${
                darkMode ? 'text-white' : 'text-gray-900'
              }`}>
                Do day passes expire?
              </summary>
              <p className={`mt-2 text-sm ${
                darkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Day passes are valid for 24 hours from the time of purchase and must be used within that period.
              </p>
            </details>
          </div>
        </div>
      </main>
    </div>
  );
}
