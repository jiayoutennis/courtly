"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth, db } from "../../../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import DarkModeToggle from "@/app/components/DarkModeToggle";
import PageTitle from "@/app/components/PageTitle";
import AccountBalanceWidget from "@/components/AccountBalanceWidget";
import PaymentMethodManager from "@/components/PaymentMethodManager";

interface UserData {
  id: string;
  fullName?: string;
  email: string;
  userType: 'admin' | 'member' | 'courtly';
  club?: {
    name: string;
    address: string;
    city: string;
    state: string;
  };
  organization?: string | string[]; // Can be either string or string array
  createdAt: string;
}

interface ClubData {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
}

export default function DashboardPage() {
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [clubs, setClubs] = useState<ClubData[]>([]);
  const [error, setError] = useState("");
  const [success] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const router = useRouter();

  // Initialize dark mode from localStorage
  useEffect(() => {
    const savedMode = localStorage.getItem("darkMode");
    if (savedMode === "true") {
      setDarkMode(true);
    }
  }, []);

  // Check if user is authenticated
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Check if email is verified
        if (!user.emailVerified) {
          setError("Please verify your email before accessing the dashboard.");
          await signOut(auth);
          router.push('/signin?verification=pending');
          return;
        }
        
        // User is signed in and verified, fetch their data
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const data = userDoc.data();
            
            setUserData({
              id: user.uid,
              fullName: data.fullName || user.displayName || user.email?.split('@')[0],
              email: user.email || data.email,
              userType: data.userType,
              club: data.club,
              organization: data.organization,
              createdAt: data.createdAt
            });
            
            // Fetch all clubs that the user belongs to
            if (data.organization) {
              const orgIds = Array.isArray(data.organization) ? data.organization : [data.organization];
              await fetchAllClubs(orgIds);
            }
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          setError("Failed to load user data. Please try again later.");
        } finally {
          setLoading(false);
        }
      } else {
        // User is not signed in, redirect to login
        router.push('/signin');
      }
    });
    
    return () => unsubscribe();
  }, [router]);
  
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push('/signin');
    } catch (error) {
      console.error("Error signing out:", error);
      setError("Failed to sign out. Please try again.");
    }
  };

  // Fetch all clubs that the user belongs to
  const fetchAllClubs = async (organizationIds: string[]) => {
    if (!organizationIds || organizationIds.length === 0) {
      setClubs([]);
      return;
    }
    
    try {
      console.log("Fetching clubs for IDs:", organizationIds);
      const clubsList: ClubData[] = [];
      
      for (const orgId of organizationIds) {
        const clubDocRef = doc(db, "orgs", orgId);
        const clubDoc = await getDoc(clubDocRef);
        
        if (clubDoc.exists()) {
          const orgData = clubDoc.data();
          clubsList.push({
            id: orgId,
            name: orgData.name || "Unknown Club",
            address: orgData.address || "",
            city: orgData.city || "",
            state: orgData.state || ""
          });
        }
      }
      
      console.log("Fetched clubs:", clubsList);
      setClubs(clubsList);
    } catch (error) {
      console.error("Error fetching clubs:", error);
      setError("Failed to load club data. Please try again later.");
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
          }`}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`min-h-screen flex flex-col lg:flex-row transition-colors duration-300 ${
        darkMode ? "bg-[#0a0a0a] text-white" : "bg-white text-gray-900"
      }`}
    >
      <PageTitle title="Dashboard - Courtly" />
      
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 flex-shrink-0 
        transform transition-transform duration-300 ease-in-out
        lg:transform-none
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        ${darkMode ? "bg-[#0a0a0a] lg:border-r border-[#1a1a1a]" : "bg-white lg:border-r border-gray-100"}
      `}>
        <div className="p-6 h-full overflow-y-auto">
          {/* Header with Logo and Close Button */}
          <div className="flex items-center justify-between mb-12">
            <Link href="/" className="flex items-center gap-3">
              <div className={`text-2xl font-light tracking-tight ${
                darkMode ? "text-white" : "text-black"
              }`}>
                Courtly
              </div>
            </Link>
            
            {/* Close button for mobile */}
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className={`lg:hidden p-2 ${
                darkMode 
                  ? "hover:bg-[#1a1a1a] text-gray-400 hover:text-white" 
                  : "hover:bg-gray-100 text-gray-600 hover:text-black"
              }`}
              aria-label="Close menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Navigation */}
          <nav className="space-y-8">
            {/* Quick Actions */}
            <div>
              <h3 className={`text-xs font-light uppercase tracking-wider mb-4 ${
                darkMode ? "text-gray-600" : "text-gray-400"
              }`}>
                Quick Actions
              </h3>
              <div className="space-y-1">
                <Link 
                  href="/your-clubs"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded text-sm font-light transition-colors ${
                    darkMode 
                      ? "hover:bg-[#1a1a1a] text-gray-400 hover:text-white" 
                      : "hover:bg-gray-100 text-gray-600 hover:text-black"
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Your Clubs
                </Link>
                <Link 
                  href="/court-schedule"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded text-sm font-light transition-colors ${
                    darkMode 
                      ? "hover:bg-[#1a1a1a] text-gray-400 hover:text-white" 
                      : "hover:bg-gray-100 text-gray-600 hover:text-black"
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Court Schedule
                </Link>
                <Link 
                  href="/my-bookings"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded text-sm font-light transition-colors ${
                    darkMode 
                      ? "hover:bg-[#1a1a1a] text-gray-400 hover:text-white" 
                      : "hover:bg-gray-100 text-gray-600 hover:text-black"
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                  My Bookings
                </Link>
                <Link 
                  href="/browse-clubs"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded text-sm font-light transition-colors ${
                    darkMode 
                      ? "hover:bg-[#1a1a1a] text-gray-400 hover:text-white" 
                      : "hover:bg-gray-100 text-gray-600 hover:text-black"
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  Browse Clubs
                </Link>
                <Link 
                  href="/register-club"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded text-sm font-light transition-colors ${
                    darkMode 
                      ? "hover:bg-[#1a1a1a] text-gray-400 hover:text-white" 
                      : "hover:bg-gray-100 text-gray-600 hover:text-black"
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                  </svg>
                  Register Club
                </Link>
              </div>
            </div>

            {/* Admin Actions */}
            {userData?.userType === 'admin' && (
              <div>
                <h3 className={`text-xs font-light uppercase tracking-wider mb-4 ${
                  darkMode ? "text-gray-600" : "text-gray-400"
                }`}>
                  Club Admin
                </h3>
                <div className="space-y-1">
                  <Link 
                    href={`/club/${Array.isArray(userData.organization) ? userData.organization[0] : userData.organization}/manage-members`}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded text-sm font-light transition-colors ${
                      darkMode 
                        ? "hover:bg-[#1a1a1a] text-gray-400 hover:text-white" 
                        : "hover:bg-gray-100 text-gray-600 hover:text-black"
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    Manage Members
                  </Link>
                  <Link 
                    href={`/club/${Array.isArray(userData.organization) ? userData.organization[0] : userData.organization}/club-settings`}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded text-sm font-light transition-colors ${
                      darkMode 
                        ? "hover:bg-[#1a1a1a] text-gray-400 hover:text-white" 
                        : "hover:bg-gray-100 text-gray-600 hover:text-black"
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Club Settings
                  </Link>
                  <Link 
                    href={`/club/${Array.isArray(userData.organization) ? userData.organization[0] : userData.organization}/subscription`}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded text-sm font-light transition-colors ${
                      darkMode 
                        ? "hover:bg-[#1a1a1a] text-gray-400 hover:text-white" 
                        : "hover:bg-gray-100 text-gray-600 hover:text-black"
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    Subscription
                  </Link>
                </div>
              </div>
            )}

            {/* Coach Actions */}
            {userData?.userType === 'coach' && (
              <div>
                <h3 className={`text-xs font-light uppercase tracking-wider mb-4 ${
                  darkMode ? "text-gray-600" : "text-gray-400"
                }`}>
                  Coach Tools
                </h3>
                <div className="space-y-1">
                  <Link 
                    href="/coach/profile"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded text-sm font-light transition-colors ${
                      darkMode 
                        ? "hover:bg-[#1a1a1a] text-gray-400 hover:text-white" 
                        : "hover:bg-gray-100 text-gray-600 hover:text-black"
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Coach Profile
                  </Link>
                </div>
              </div>
            )}

            {/* Courtly Admin Actions */}
            {userData?.userType === 'courtly' && (
              <div>
                <h3 className={`text-xs font-light uppercase tracking-wider mb-4 ${
                  darkMode ? "text-gray-600" : "text-gray-400"
                }`}>
                  Courtly Admin
                </h3>
                <div className="space-y-1">
                  <Link 
                    href="/admin/manage-clubs"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded text-sm font-light transition-colors ${
                      darkMode 
                        ? "hover:bg-[#1a1a1a] text-gray-400 hover:text-white" 
                        : "hover:bg-gray-100 text-gray-600 hover:text-black"
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    Manage Clubs
                  </Link>
                  <Link 
                    href="/admin/club-requests"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded text-sm font-light transition-colors ${
                      darkMode 
                        ? "hover:bg-[#1a1a1a] text-gray-400 hover:text-white" 
                        : "hover:bg-gray-100 text-gray-600 hover:text-black"
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Club Requests
                  </Link>
                  <Link 
                    href="/admin/manage-all-users"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded text-sm font-light transition-colors ${
                      darkMode 
                        ? "hover:bg-[#1a1a1a] text-gray-400 hover:text-white" 
                        : "hover:bg-gray-100 text-gray-600 hover:text-black"
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Manage All Users
                  </Link>
                </div>
              </div>
            )}
          </nav>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Minimalist Header */}
        <header className={`px-4 sm:px-6 md:px-12 py-4 sm:py-6 flex justify-between items-center ${
          darkMode ? "border-b border-[#1a1a1a]" : "border-b border-gray-100"
        }`}>
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={`lg:hidden p-2 ${
                darkMode 
                  ? "hover:bg-[#1a1a1a] text-gray-400 hover:text-white" 
                  : "hover:bg-gray-100 text-gray-600 hover:text-black"
              }`}
              aria-label="Toggle menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            
            <h1 className={`text-xl sm:text-2xl font-light ${
              darkMode ? "text-white" : "text-black"
            }`}>
              Dashboard
            </h1>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            <DarkModeToggle darkMode={darkMode} setDarkMode={setDarkMode} />
            <button
              onClick={handleSignOut}
              className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-light transition-colors ${
                darkMode 
                  ? "hover:bg-[#1a1a1a] text-gray-400 hover:text-white" 
                  : "hover:bg-gray-100 text-gray-600 hover:text-black"
              }`}
            >
              Sign Out
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-12 py-8 sm:py-12">
          {error && (
            <div className={`mb-6 px-4 py-3 text-sm sm:text-base font-light ${
              darkMode ? "bg-red-900/20 text-red-400 border border-red-900/30" : "bg-red-50 text-red-600 border border-red-100"
            }`}>
              {error}
            </div>
          )}
          {success && (
            <div className={`mb-6 px-4 py-3 text-sm sm:text-base font-light ${
              darkMode ? "bg-green-900/20 text-green-400 border border-green-900/30" : "bg-green-50 text-green-600 border border-green-100"
            }`}>
              {success}
            </div>
          )}
          
          {/* Welcome Section */}
          <div className="max-w-4xl mb-8 sm:mb-12 md:mb-16">
            <h2 className={`text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-light mb-2 sm:mb-3 ${
              darkMode ? "text-white" : "text-black"
            }`}>
              Welcome back, {userData?.fullName?.split(' ')[0] || 'Player'}
            </h2>
            <p className={`text-base sm:text-lg font-light ${
              darkMode ? "text-gray-400" : "text-gray-600"
            }`}>
              {userData?.userType === 'admin' ? 'Manage your club' : 'Your tennis dashboard'}
            </p>
          </div>

          {/* Profile Information */}
          <div className="max-w-4xl">
            <h3 className={`text-xs sm:text-sm font-light uppercase tracking-wider mb-4 sm:mb-6 ${
              darkMode ? "text-gray-500" : "text-gray-400"
            }`}>
              Profile
            </h3>
            
            <div className={`p-4 sm:p-6 md:p-8 ${
              darkMode 
                ? "bg-[#0a0a0a] border border-[#1a1a1a]" 
                : "bg-white border border-gray-100"
            }`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                {/* Personal Info */}
                <div>
                  <h4 className={`text-lg font-light mb-4 ${
                    darkMode ? "text-white" : "text-black"
                  }`}>
                    Personal Information
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <p className={`text-xs font-light uppercase tracking-wider mb-1 ${
                        darkMode ? "text-gray-600" : "text-gray-400"
                      }`}>
                        Name
                      </p>
                      <p className={`font-light ${
                        darkMode ? "text-gray-300" : "text-gray-700"
                      }`}>
                        {userData?.fullName}
                      </p>
                    </div>
                    <div>
                      <p className={`text-xs font-light uppercase tracking-wider mb-1 ${
                        darkMode ? "text-gray-600" : "text-gray-400"
                      }`}>
                        Email
                      </p>
                      <p className={`font-light ${
                        darkMode ? "text-gray-300" : "text-gray-700"
                      }`}>
                        {userData?.email}
                      </p>
                    </div>
                    <div>
                      <p className={`text-xs font-light uppercase tracking-wider mb-1 ${
                        darkMode ? "text-gray-600" : "text-gray-400"
                      }`}>
                        Account Type
                      </p>
                      <p className={`font-light ${
                        darkMode ? "text-gray-300" : "text-gray-700"
                      }`}>
                        {userData?.userType === 'admin' ? 'Club Admin' : userData?.userType === 'courtly' ? 'Courtly Admin' : 'Member'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Club Info */}
                <div>
                  <h4 className={`text-lg font-light mb-4 ${
                    darkMode ? "text-white" : "text-black"
                  }`}>
                    {clubs.length > 1 ? 'Club Memberships' : 'Club Information'}
                  </h4>
                  {clubs.length > 0 ? (
                    <div className="space-y-4">
                      {clubs.map((club) => (
                        <div key={club.id} className={`pb-4 ${
                          clubs.length > 1 ? `border-b ${darkMode ? 'border-[#1a1a1a]' : 'border-gray-100'} last:border-b-0 last:pb-0` : ''
                        }`}>
                          <div>
                            <p className={`text-xs font-light uppercase tracking-wider mb-1 ${
                              darkMode ? "text-gray-600" : "text-gray-400"
                            }`}>
                              Club Name
                            </p>
                            <p className={`font-light ${
                              darkMode ? "text-gray-300" : "text-gray-700"
                            }`}>
                              {club.name}
                            </p>
                          </div>
                          <div className="mt-3">
                            <p className={`text-xs font-light uppercase tracking-wider mb-1 ${
                              darkMode ? "text-gray-600" : "text-gray-400"
                            }`}>
                              Location
                            </p>
                            <p className={`font-light ${
                              darkMode ? "text-gray-300" : "text-gray-700"
                            }`}>
                              {[club.address, club.city, club.state].filter(Boolean).join(", ")}
                            </p>
                          </div>
                          {clubs.length > 1 && (
                            <div className="mt-3">
                              <Link
                                href={`/club/${club.id}`}
                                className={`text-sm font-light underline hover:no-underline transition-colors ${
                                  darkMode ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-black"
                                }`}
                              >
                                View Club →
                              </Link>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className={`font-light ${
                      darkMode ? "text-gray-500" : "text-gray-600"
                    }`}>
                      Not in any club
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Account Balance - only show for club members */}
          {clubs.length > 0 && (
            <div className="max-w-4xl mt-8 sm:mt-12">
              <h3 className={`text-xs sm:text-sm font-light uppercase tracking-wider mb-4 sm:mb-6 ${
                darkMode ? "text-gray-500" : "text-gray-400"
              }`}>
                Account Balance
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {clubs.map((club) => (
                  <AccountBalanceWidget 
                    key={club.id} 
                    clubId={club.id} 
                    darkMode={darkMode}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Payment Methods Section */}
          {userData && (
            <div className="max-w-4xl mb-8 sm:mb-12">
              <h3 className={`text-xs sm:text-sm font-light uppercase tracking-wider mb-4 sm:mb-6 ${
                darkMode ? "text-gray-500" : "text-gray-400"
              }`}>
                Payment Methods
              </h3>
              <PaymentMethodManager 
                userId={userData.id}
                darkMode={darkMode}
              />
            </div>
          )}

          {/* Footer */}
          <div className={`max-w-4xl mt-12 sm:mt-16 pt-6 sm:pt-8 border-t ${
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
    </div>
  );
}