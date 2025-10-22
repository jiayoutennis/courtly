'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, collection, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../../../../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import BackButton from '@/app/components/BackButton';
import DarkModeToggle from '@/app/components/DarkModeToggle';

interface MembershipPlan {
  id: string;
  name: string;
  tier: 'day_pass' | 'monthly' | 'annual';
  price: number;
  currency: string;
  stripePriceId: string;
  stripeProductId: string;
  features: string[];
  description: string;
  isActive: boolean;
}

interface ClubStripeConfig {
  stripeConnected: boolean;
  stripeAccountId?: string;
  stripePublishableKey?: string;
  platformFeePercent?: number;
}

interface StripeConnectStatus {
  connected: boolean;
  status: string;
  stripeAccountId?: string;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
  requiresAction?: boolean;
  email?: string;
  country?: string;
}

export default function StripeSetupPage() {
  const params = useParams();
  const router = useRouter();
  const clubId = params.clubId as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [clubName, setClubName] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  
  // Stripe configuration
  const [stripeConfig, setStripeConfig] = useState<ClubStripeConfig>({
    stripeConnected: false,
  });
  
  // Stripe Connect status
  const [connectStatus, setConnectStatus] = useState<StripeConnectStatus | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [connectingStripe, setConnectingStripe] = useState(false);

  // Membership plans
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [newPlan, setNewPlan] = useState<Partial<MembershipPlan>>({
    name: '',
    tier: 'monthly',
    price: 0,
    currency: 'usd',
    stripePriceId: '',
    stripeProductId: '',
    features: [''],
    description: '',
    isActive: true,
  });

  // UI state
  const [activeTab, setActiveTab] = useState<'overview' | 'plans' | 'settings' | 'connect'>('connect');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        await checkAdminStatus(currentUser.uid);
        await fetchClubData();
        await fetchMembershipPlans();
        await checkStripeConnectStatus();
        
        // Check for success/refresh URL params
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('success') === 'true') {
          setSuccessMessage('Stripe Connect setup completed successfully!');
          await checkStripeConnectStatus();
          // Clean up URL
          window.history.replaceState({}, '', `/club/${clubId}/stripe-setup`);
        } else if (urlParams.get('refresh') === 'true') {
          setErrorMessage('Stripe Connect setup was not completed. Please try again.');
          // Clean up URL
          window.history.replaceState({}, '', `/club/${clubId}/stripe-setup`);
        }
      } else {
        setUser(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [clubId]);

  const checkAdminStatus = async (userId: string) => {
    try {
      console.log('[Stripe Setup] Checking admin status for user:', userId, 'club:', clubId);
      
      // Fetch user data to check if they're Courtly admin
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        console.log('[Stripe Setup] User doc exists:', userDoc.exists());
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          console.log('[Stripe Setup] User type:', userData.userType);
          const userType = userData.userType;
          
          // Courtly admins have full access
          if (userType === 'courtly') {
            console.log('[Stripe Setup] User is Courtly admin - granting access');
            setIsAdmin(true);
            return true;
          }
        }
      } catch (userError: any) {
        console.error('[Stripe Setup] Error fetching user document:', userError);
        console.error('[Stripe Setup] Error code:', userError.code);
        console.error('[Stripe Setup] Error message:', userError.message);
      }
      
      // Check if user is club owner by checking staff array in org document
      try {
        console.log('[Stripe Setup] Checking org document for club:', clubId);
        const clubDoc = await getDoc(doc(db, 'orgs', clubId));
        console.log('[Stripe Setup] Club doc exists:', clubDoc.exists());
        
        if (clubDoc.exists()) {
          const clubData = clubDoc.data();
          console.log('[Stripe Setup] Club data staff:', clubData.staff);
          const staff = clubData.staff || [];
          const userStaffRecord = staff.find((s: any) => s.userId === userId);
          
          console.log('[Stripe Setup] User staff record:', userStaffRecord);
          
          // Only club owners can access Stripe setup
          if (userStaffRecord && userStaffRecord.role === 'owner') {
            console.log('[Stripe Setup] User is club owner - granting access');
            setIsAdmin(true);
            return true;
          }
        } else {
          console.log('[Stripe Setup] Club document does not exist');
        }
      } catch (clubError: any) {
        console.error('[Stripe Setup] Error fetching club document:', clubError);
        console.error('[Stripe Setup] Error code:', clubError.code);
        console.error('[Stripe Setup] Error message:', clubError.message);
        setErrorMessage(`Permission error: ${clubError.message}. Please check browser console for details.`);
      }
      
      console.log('[Stripe Setup] Access denied - user is not owner or Courtly admin');
      setIsAdmin(false);
      return false;
    } catch (error: any) {
      console.error('[Stripe Setup] Error checking admin status:', error);
      console.error('[Stripe Setup] Error code:', error?.code);
      console.error('[Stripe Setup] Error message:', error?.message);
      setErrorMessage(`Failed to verify permissions: ${error?.message || 'Unknown error'}`);
      setIsAdmin(false);
      return false;
    }
  };

  const fetchClubData = async () => {
    try {
      const clubDoc = await getDoc(doc(db, 'orgs', clubId));
      if (clubDoc.exists()) {
        const data = clubDoc.data();
        setClubName(data.name || 'Club');
        
        // Fetch Stripe configuration
        if (data.stripeConfig) {
          setStripeConfig(data.stripeConfig);
        }
      }
    } catch (error) {
      console.error('Error fetching club data:', error);
    }
  };

  const fetchMembershipPlans = async () => {
    try {
      const plansRef = collection(db, 'orgs', clubId, 'membershipPlans');
      const snapshot = await getDocs(plansRef);
      const plansData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as MembershipPlan[];
      setPlans(plansData);
    } catch (error) {
      console.error('Error fetching membership plans:', error);
    }
  };

  const handleSaveStripeConfig = async () => {
    setSaving(true);
    try {
      const clubRef = doc(db, 'orgs', clubId);
      await updateDoc(clubRef, {
        stripeConfig: stripeConfig,
        updatedAt: new Date(),
      });
      setSuccessMessage('Stripe configuration saved successfully!');
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (error) {
      console.error('Error saving Stripe config:', error);
      setErrorMessage('Failed to save configuration. Please try again.');
      setTimeout(() => setErrorMessage(''), 5000);
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePlan = async () => {
    if (!newPlan.name || !newPlan.stripePriceId || !newPlan.stripeProductId) {
      setErrorMessage('Please fill in all required fields');
      setTimeout(() => setErrorMessage(''), 5000);
      return;
    }

    setSaving(true);
    try {
      // Use the tier name as the document ID for consistency
      const tierName = newPlan.tier as string;
      const planRef = doc(db, 'orgs', clubId, 'membershipPlans', tierName);
      
      // Create the plan document
      await setDoc(planRef, {
        ...newPlan,
        features: newPlan.features?.filter(f => f.trim() !== ''),
        members: [], // Initialize empty array to track members with this tier
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      // Update the org document's membershipTiers map
      const orgRef = doc(db, 'orgs', clubId);
      const orgDoc = await getDoc(orgRef);
      
      if (orgDoc.exists()) {
        const orgData = orgDoc.data();
        const membershipTiers = orgData.membershipTiers || {};
        
        // Add this tier to the map
        membershipTiers[tierName] = {
          stripeProductId: newPlan.stripeProductId || '',
          stripePriceId: newPlan.stripePriceId || '',
          isActive: newPlan.isActive !== false
        };
        
        await updateDoc(orgRef, {
          membershipTiers: membershipTiers,
          membershipEnabled: true, // Auto-enable memberships when first plan is added
          updatedAt: new Date()
        });
      }
      
      await fetchMembershipPlans();
      await fetchClubData(); // Refresh club data to show updated config
      
      setNewPlan({
        name: '',
        tier: 'monthly',
        price: 0,
        currency: 'usd',
        stripePriceId: '',
        stripeProductId: '',
        features: [''],
        description: '',
        isActive: true,
      });
      setSuccessMessage('Membership plan created successfully!');
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (error) {
      console.error('Error creating plan:', error);
      setErrorMessage('Failed to create plan. Please try again.');
      setTimeout(() => setErrorMessage(''), 5000);
    } finally {
      setSaving(false);
    }
  };

  // Stripe Connect Functions
  const checkStripeConnectStatus = async () => {
    setCheckingStatus(true);
    try {
      const response = await fetch(`/api/stripe/connect/account-status?clubId=${clubId}`);
      const data = await response.json();
      
      if (response.ok) {
        setConnectStatus(data);
      } else {
        console.error('Error checking Stripe Connect status:', data.error);
      }
    } catch (error) {
      console.error('Error checking Stripe Connect status:', error);
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleConnectStripe = async () => {
    if (!user) return;
    
    setConnectingStripe(true);
    try {
      const response = await fetch('/api/stripe/connect/create-account-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clubId: clubId,
          userId: user.uid,
        }),
      });

      const data = await response.json();

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
      setConnectingStripe(false);
    }
  };

  const handleUpdatePlan = async (planId: string, updates: Partial<MembershipPlan>) => {
    setSaving(true);
    try {
      const planRef = doc(db, 'orgs', clubId, 'membershipPlans', planId);
      await updateDoc(planRef, {
        ...updates,
        updatedAt: new Date(),
      });
      
      // If isActive status changed, update the org document's membershipTiers map
      if (updates.isActive !== undefined) {
        const orgRef = doc(db, 'orgs', clubId);
        const orgDoc = await getDoc(orgRef);
        
        if (orgDoc.exists()) {
          const orgData = orgDoc.data();
          const membershipTiers = orgData.membershipTiers || {};
          
          if (membershipTiers[planId]) {
            membershipTiers[planId].isActive = updates.isActive;
            
            await updateDoc(orgRef, {
              membershipTiers: membershipTiers,
              updatedAt: new Date()
            });
          }
        }
      }
      
      await fetchMembershipPlans();
      await fetchClubData(); // Refresh club data
      
      setSuccessMessage('Plan updated successfully!');
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (error) {
      console.error('Error updating plan:', error);
      setErrorMessage('Failed to update plan. Please try again.');
      setTimeout(() => setErrorMessage(''), 5000);
    } finally {
      setSaving(false);
    }
  };

  const addFeatureField = () => {
    setNewPlan({
      ...newPlan,
      features: [...(newPlan.features || []), ''],
    });
  };

  const updateFeature = (index: number, value: string) => {
    const updatedFeatures = [...(newPlan.features || [])];
    updatedFeatures[index] = value;
    setNewPlan({ ...newPlan, features: updatedFeatures });
  };

  const removeFeature = (index: number) => {
    const updatedFeatures = (newPlan.features || []).filter((_, i) => i !== index);
    setNewPlan({ ...newPlan, features: updatedFeatures });
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className={`text-3xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Authentication Required
          </h1>
          <p className={`mb-8 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            Please sign in to access Stripe setup.
          </p>
          <button
            onClick={() => router.push('/signin')}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className={`text-3xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Owner Access Required
          </h1>
          <p className={`mb-8 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            Only club owners can access Stripe payment setup. Please contact your club owner if you need assistance with payment configuration.
          </p>
          <BackButton darkMode={darkMode} />
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <BackButton darkMode={darkMode} />
              <div>
                <h1 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  Stripe Payment Setup
                </h1>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  {clubName}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className={`text-sm font-light ${
                  darkMode ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-black"
                } transition-colors`}
              >
                Dashboard
              </Link>
              <DarkModeToggle darkMode={darkMode} setDarkMode={setDarkMode} />
            </div>
          </div>
        </div>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="container mx-auto px-4 mt-4">
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative">
            {successMessage}
          </div>
        </div>
      )}
      {errorMessage && (
        <div className="container mx-auto px-4 mt-4">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
            {errorMessage}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="container mx-auto px-4">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('connect')}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'connect'
                  ? `border-blue-600 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`
                  : `border-transparent ${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`
              }`}
            >
              🔗 Connect Stripe
            </button>
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'overview'
                  ? `border-blue-600 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`
                  : `border-transparent ${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`
              }`}
            >
              Overview & Instructions
            </button>
            <button
              onClick={() => setActiveTab('plans')}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'plans'
                  ? `border-blue-600 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`
                  : `border-transparent ${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`
              }`}
            >
              Membership Plans
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'settings'
                  ? `border-blue-600 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`
                  : `border-transparent ${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`
              }`}
            >
              Stripe Settings
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Connect Stripe Tab */}
        {activeTab === 'connect' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md p-8`}>
              <h2 className={`text-3xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                Connect Your Stripe Account
              </h2>
              <p className={`mb-6 text-lg ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Receive automatic payments directly to your bank account when members book courts or purchase memberships.
              </p>

              {checkingStatus ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
              ) : connectStatus?.connected ? (
                // Connected Status
                <div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-green-900 mb-2">
                          ✅ Stripe Connected Successfully!
                        </h3>
                        <p className="text-green-800 mb-4">
                          Your club is ready to receive payments automatically.
                        </p>
                        <div className="space-y-2 text-sm text-green-700">
                          <div className="flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span>Charges enabled: {connectStatus.chargesEnabled ? 'Yes' : 'No'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span>Payouts enabled: {connectStatus.payoutsEnabled ? 'Yes' : 'No'}</span>
                          </div>
                          {connectStatus.email && (
                            <div className="flex items-center gap-2">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                              <span>Account email: {connectStatus.email}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={`p-6 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <h4 className={`font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      What happens now?
                    </h4>
                    <ul className={`space-y-2 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-600 font-bold">1.</span>
                        <span>When members book courts, fees are automatically charged to their account balance</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-600 font-bold">2.</span>
                        <span>When members add funds to their balance, payments go directly to your Stripe account</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-600 font-bold">3.</span>
                        <span>Stripe automatically transfers funds to your bank account (typically within 2-7 days)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-600 font-bold">4.</span>
                        <span>You can view all transactions and manage payouts in your Stripe Dashboard</span>
                      </li>
                    </ul>
                    
                    <a
                      href="https://dashboard.stripe.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-4 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Open Stripe Dashboard →
                    </a>
                  </div>
                </div>
              ) : (
                // Not Connected - Show Setup Button
                <div>
                  <div className={`p-6 rounded-lg mb-6 ${darkMode ? 'bg-gray-700' : 'bg-blue-50'}`}>
                    <h3 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      Why Connect Stripe?
                    </h3>
                    <ul className={`space-y-3 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      <li className="flex items-start gap-3">
                        <span className="text-2xl">💰</span>
                        <div>
                          <strong>Automatic Payments:</strong> Court booking fees are automatically charged when members book
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="text-2xl">🏦</span>
                        <div>
                          <strong>Direct Bank Transfers:</strong> Receive funds directly in your bank account
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="text-2xl">📊</span>
                        <div>
                          <strong>Full Control:</strong> Manage your account, view transactions, and generate reports
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="text-2xl">🔒</span>
                        <div>
                          <strong>Secure & Compliant:</strong> Stripe handles PCI compliance and security
                        </div>
                      </li>
                    </ul>
                  </div>

                  <div className={`p-6 rounded-lg mb-6 ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <h3 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      What you'll need:
                    </h3>
                    <ul className={`space-y-2 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      <li className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Business information (name, address, tax ID)</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Bank account details for payouts</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Personal information for verification</span>
                      </li>
                    </ul>
                    <p className={`text-sm mt-3 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Setup takes about 5-10 minutes. You'll be redirected to Stripe to complete the process.
                    </p>
                  </div>

                  <button
                    onClick={handleConnectStripe}
                    disabled={connectingStripe}
                    className="w-full bg-blue-600 text-white px-8 py-4 rounded-lg hover:bg-blue-700 transition-colors font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {connectingStripe ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        <span>Connecting...</span>
                      </>
                    ) : (
                      <>
                        <span>Connect with Stripe</span>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="max-w-4xl mx-auto space-y-8">
            {/* Welcome Section */}
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md p-6`}>
              <h2 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                Welcome to Stripe Payment Setup! 💳
              </h2>
              <p className={`mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                This guide will help you set up payments for your club's memberships and court bookings.
                Follow these steps to get started:
              </p>
            </div>

            {/* Step-by-Step Instructions */}
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md p-6`}>
              <h3 className={`text-xl font-bold mb-6 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                Step-by-Step Setup Guide
              </h3>

              {/* Step 1 */}
              <div className="mb-8">
                <div className="flex items-start gap-4 mb-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                    1
                  </div>
                  <div className="flex-1">
                    <h4 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      Create a Stripe Account
                    </h4>
                    <p className={`mb-3 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      If you don't have a Stripe account yet, create one at{' '}
                      <a
                        href="https://dashboard.stripe.com/register"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        stripe.com/register
                      </a>
                    </p>
                    <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                      <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                        <strong>What you'll need:</strong>
                      </p>
                      <ul className={`list-disc list-inside text-sm mt-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        <li>Business information (name, address, tax ID)</li>
                        <li>Bank account for payouts</li>
                        <li>Identity verification documents</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="mb-8">
                <div className="flex items-start gap-4 mb-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                    2
                  </div>
                  <div className="flex-1">
                    <h4 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      Create Products in Stripe Dashboard
                    </h4>
                    <p className={`mb-3 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      Go to{' '}
                      <a
                        href="https://dashboard.stripe.com/products"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        Products → Create Product
                      </a>
                    </p>
                    
                    <div className="space-y-4">
                      {/* Day Pass Example */}
                      <div className={`p-4 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                        <h5 className={`font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                          Example 1: Day Pass
                        </h5>
                        <ul className={`text-sm space-y-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          <li><strong>Name:</strong> Day Pass</li>
                          <li><strong>Description:</strong> 24-hour access to club facilities</li>
                          <li><strong>Pricing:</strong> One-time payment, $15.00 USD</li>
                          <li><strong>Type:</strong> One-time purchase</li>
                        </ul>
                      </div>

                      {/* Monthly Membership Example */}
                      <div className={`p-4 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                        <h5 className={`font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                          Example 2: Monthly Membership
                        </h5>
                        <ul className={`text-sm space-y-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          <li><strong>Name:</strong> Monthly Membership</li>
                          <li><strong>Description:</strong> Full club access with monthly billing</li>
                          <li><strong>Pricing:</strong> Recurring, $49.00 USD / month</li>
                          <li><strong>Type:</strong> Subscription</li>
                        </ul>
                      </div>

                      {/* Annual Membership Example */}
                      <div className={`p-4 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                        <h5 className={`font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                          Example 3: Annual Membership
                        </h5>
                        <ul className={`text-sm space-y-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          <li><strong>Name:</strong> Annual Membership</li>
                          <li><strong>Description:</strong> Full club access - save 2 months!</li>
                          <li><strong>Pricing:</strong> Recurring, $499.00 USD / year</li>
                          <li><strong>Type:</strong> Subscription</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="mb-8">
                <div className="flex items-start gap-4 mb-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                    3
                  </div>
                  <div className="flex-1">
                    <h4 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      Copy Your Stripe IDs
                    </h4>
                    <p className={`mb-3 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      For each product you create, you'll need to copy two IDs:
                    </p>
                    
                    <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                      <div className="space-y-3">
                        <div>
                          <p className={`text-sm font-semibold mb-1 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                            📦 Product ID (starts with <code className="text-blue-600">prod_</code>)
                          </p>
                          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            Found at the top of the product page
                          </p>
                          <code className={`text-xs block mt-1 p-2 rounded ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
                            Example: prod_ABC123xyz
                          </code>
                        </div>
                        
                        <div>
                          <p className={`text-sm font-semibold mb-1 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                            💰 Price ID (starts with <code className="text-blue-600">price_</code>)
                          </p>
                          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            Found in the "Pricing" section - click on the price to see it
                          </p>
                          <code className={`text-xs block mt-1 p-2 rounded ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
                            Example: price_1ABC123xyz
                          </code>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 4 */}
              <div className="mb-8">
                <div className="flex items-start gap-4 mb-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                    4
                  </div>
                  <div className="flex-1">
                    <h4 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      Add Membership Plans
                    </h4>
                    <p className={`mb-3 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      Go to the "Membership Plans" tab above and create plans for your club.
                      Paste the Product ID and Price ID from Stripe for each plan.
                    </p>
                    <button
                      onClick={() => setActiveTab('plans')}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Go to Membership Plans →
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 5 */}
              <div>
                <div className="flex items-start gap-4 mb-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                    5
                  </div>
                  <div className="flex-1">
                    <h4 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      Test Your Setup
                    </h4>
                    <p className={`mb-3 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      Use Stripe's test mode to verify everything works:
                    </p>
                    
                    <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                      <p className={`text-sm mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                        <strong>Test Card Number:</strong> <code>4242 4242 4242 4242</code>
                      </p>
                      <p className={`text-sm mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Use any future expiration date, any 3-digit CVC, and any ZIP code
                      </p>
                      <a
                        href={`/club/${clubId}/membership`}
                        className="inline-block mt-3 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                      >
                        View Membership Page →
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Resources Section */}
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md p-6`}>
              <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                📚 Helpful Resources
              </h3>
              <div className="space-y-3">
                <a
                  href="https://stripe.com/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`block p-3 rounded-lg border ${darkMode ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-50'} transition-colors`}
                >
                  <div className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    Stripe Documentation
                  </div>
                  <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Complete guide to Stripe features and APIs
                  </div>
                </a>
                
                <a
                  href="https://stripe.com/docs/testing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`block p-3 rounded-lg border ${darkMode ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-50'} transition-colors`}
                >
                  <div className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    Testing with Stripe
                  </div>
                  <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Test cards and testing best practices
                  </div>
                </a>

                <a
                  href="https://support.stripe.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`block p-3 rounded-lg border ${darkMode ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-50'} transition-colors`}
                >
                  <div className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    Stripe Support
                  </div>
                  <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Get help from the Stripe team
                  </div>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Membership Plans Tab */}
        {activeTab === 'plans' && (
          <div className="max-w-6xl mx-auto space-y-8">
            {/* Existing Plans */}
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md p-6`}>
              <h3 className={`text-xl font-bold mb-6 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                Current Membership Plans
              </h3>
              
              {plans.length === 0 ? (
                <div className="text-center py-8">
                  <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    No membership plans yet. Create your first plan below.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {plans.map((plan) => (
                    <div
                      key={plan.id}
                      className={`border rounded-lg p-6 ${
                        darkMode ? 'border-gray-700 bg-gray-700' : 'border-gray-200 bg-gray-50'
                      } ${!plan.isActive ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h4 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                            {plan.name}
                          </h4>
                          <p className={`text-2xl font-bold mt-2 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                            ${plan.price}
                            <span className={`text-sm font-normal ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                              {plan.tier === 'day_pass' ? '' : plan.tier === 'monthly' ? '/mo' : '/yr'}
                            </span>
                          </p>
                        </div>
                        <span
                          className={`px-2 py-1 text-xs rounded ${
                            plan.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {plan.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>

                      <p className={`text-sm mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        {plan.description}
                      </p>

                      <div className="mb-4">
                        <p className={`text-xs font-semibold mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Features:
                        </p>
                        <ul className={`text-xs space-y-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          {plan.features.map((feature, idx) => (
                            <li key={idx}>• {feature}</li>
                          ))}
                        </ul>
                      </div>

                      <div className={`text-xs space-y-1 mb-4 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                        <div className="truncate">
                          <strong>Product:</strong> {plan.stripeProductId}
                        </div>
                        <div className="truncate">
                          <strong>Price:</strong> {plan.stripePriceId}
                        </div>
                      </div>

                      <button
                        onClick={() => handleUpdatePlan(plan.id, { isActive: !plan.isActive })}
                        disabled={saving}
                        className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                          plan.isActive
                            ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                            : 'bg-green-100 text-green-800 hover:bg-green-200'
                        } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {plan.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Create New Plan */}
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md p-6`}>
              <h3 className={`text-xl font-bold mb-6 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                Create New Membership Plan
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Plan Name */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Plan Name *
                  </label>
                  <input
                    type="text"
                    value={newPlan.name}
                    onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
                    placeholder="e.g., Monthly Membership"
                    className={`w-full px-4 py-2 rounded-lg border ${
                      darkMode
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  />
                </div>

                {/* Tier */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Tier *
                  </label>
                  <select
                    value={newPlan.tier}
                    onChange={(e) => setNewPlan({ ...newPlan, tier: e.target.value as any })}
                    className={`w-full px-4 py-2 rounded-lg border ${
                      darkMode
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  >
                    <option value="day_pass">Day Pass</option>
                    <option value="monthly">Monthly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>

                {/* Price */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Price (USD) *
                  </label>
                  <input
                    type="number"
                    value={newPlan.price}
                    onChange={(e) => setNewPlan({ ...newPlan, price: parseFloat(e.target.value) })}
                    placeholder="49.00"
                    step="0.01"
                    className={`w-full px-4 py-2 rounded-lg border ${
                      darkMode
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  />
                </div>

                {/* Stripe Product ID */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Stripe Product ID *
                  </label>
                  <input
                    type="text"
                    value={newPlan.stripeProductId}
                    onChange={(e) => setNewPlan({ ...newPlan, stripeProductId: e.target.value })}
                    placeholder="prod_ABC123xyz"
                    className={`w-full px-4 py-2 rounded-lg border ${
                      darkMode
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  />
                </div>

                {/* Stripe Price ID */}
                <div className="md:col-span-2">
                  <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Stripe Price ID *
                  </label>
                  <input
                    type="text"
                    value={newPlan.stripePriceId}
                    onChange={(e) => setNewPlan({ ...newPlan, stripePriceId: e.target.value })}
                    placeholder="price_1ABC123xyz"
                    className={`w-full px-4 py-2 rounded-lg border ${
                      darkMode
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  />
                </div>

                {/* Description */}
                <div className="md:col-span-2">
                  <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Description
                  </label>
                  <textarea
                    value={newPlan.description}
                    onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })}
                    placeholder="Brief description of this plan"
                    rows={2}
                    className={`w-full px-4 py-2 rounded-lg border ${
                      darkMode
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  />
                </div>

                {/* Features */}
                <div className="md:col-span-2">
                  <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Features
                  </label>
                  <div className="space-y-2">
                    {(newPlan.features || []).map((feature, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={feature}
                          onChange={(e) => updateFeature(index, e.target.value)}
                          placeholder="e.g., Unlimited court bookings"
                          className={`flex-1 px-4 py-2 rounded-lg border ${
                            darkMode
                              ? 'bg-gray-700 border-gray-600 text-white'
                              : 'bg-white border-gray-300 text-gray-900'
                          }`}
                        />
                        <button
                          onClick={() => removeFeature(index)}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={addFeatureField}
                      className={`w-full py-2 rounded-lg border-2 border-dashed ${
                        darkMode
                          ? 'border-gray-600 text-gray-400 hover:border-gray-500'
                          : 'border-gray-300 text-gray-600 hover:border-gray-400'
                      }`}
                    >
                      + Add Feature
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleCreatePlan}
                  disabled={saving}
                  className={`px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors ${
                    saving ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {saving ? 'Creating...' : 'Create Plan'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="max-w-2xl mx-auto">
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md p-6`}>
              <h3 className={`text-xl font-bold mb-6 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                Stripe Connection Settings
              </h3>

              <div className="space-y-6">
                {/* Account ID */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Stripe Account ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={stripeConfig.stripeAccountId || ''}
                    onChange={(e) => setStripeConfig({ ...stripeConfig, stripeAccountId: e.target.value })}
                    placeholder="acct_ABC123xyz"
                    className={`w-full px-4 py-2 rounded-lg border ${
                      darkMode
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  />
                  <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Leave empty if using platform's Stripe account
                  </p>
                </div>

                {/* Platform Fee */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Platform Fee Percentage (Optional)
                  </label>
                  <input
                    type="number"
                    value={stripeConfig.platformFeePercent || 0}
                    onChange={(e) => setStripeConfig({ ...stripeConfig, platformFeePercent: parseFloat(e.target.value) })}
                    placeholder="5.0"
                    step="0.1"
                    min="0"
                    max="100"
                    className={`w-full px-4 py-2 rounded-lg border ${
                      darkMode
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  />
                  <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Platform fee to charge on top of membership prices
                  </p>
                </div>

                {/* Connected Status */}
                <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                        Connection Status
                      </p>
                      <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        {stripeConfig.stripeConnected
                          ? 'Stripe is configured for this club'
                          : 'Not yet configured'}
                      </p>
                    </div>
                    <div
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        stripeConfig.stripeConnected
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {stripeConfig.stripeConnected ? 'Connected' : 'Pending'}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-4">
                  <button
                    onClick={handleSaveStripeConfig}
                    disabled={saving}
                    className={`px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors ${
                      saving ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {saving ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </div>
            </div>

            {/* Info Box */}
            <div className={`mt-6 p-4 rounded-lg ${darkMode ? 'bg-blue-900 bg-opacity-20' : 'bg-blue-50'} border ${darkMode ? 'border-blue-800' : 'border-blue-200'}`}>
              <h4 className={`font-semibold mb-2 ${darkMode ? 'text-blue-300' : 'text-blue-900'}`}>
                ℹ️ About These Settings
              </h4>
              <p className={`text-sm ${darkMode ? 'text-blue-200' : 'text-blue-800'}`}>
                These settings are optional and primarily for advanced use cases. Most clubs can use the
                platform's Stripe account without entering additional configuration here.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
