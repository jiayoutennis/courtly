"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth, db } from "../../../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import DarkModeToggle from "@/app/components/DarkModeToggle";
import PageTitle from "@/app/components/PageTitle";

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
        // User is signed in, fetch their data
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
      className={`min-h-screen flex transition-colors duration-300 ${
        darkMode ? "bg-[#0a0a0a] text-white" : "bg-white text-gray-900"
      }`}
    >
      <PageTitle title="Dashboard - Courtly" />
      
      {/* Sidebar */}
      <aside className={`w-64 flex-shrink-0 ${
        darkMode ? "border-r border-[#1a1a1a]" : "border-r border-gray-100"
      }`}>
        <div className="p-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 mb-12">
            <div className={`text-2xl font-light tracking-tight ${
              darkMode ? "text-white" : "text-black"
            }`}>
              Courtly
            </div>
          </Link>

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
                {userData?.organization && (
                  <Link 
                    href={`/club/${Array.isArray(userData.organization) ? userData.organization[0] : userData.organization}/court-schedule`}
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
                )}
                <Link 
                  href="/browse-clubs"
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
                    href={`/club/${Array.isArray(userData.organization) ? userData.organization[0] : userData.organization}/manage-club`}
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
      <div className="flex-1 flex flex-col">
        {/* Minimalist Header */}
        <header className={`px-6 md:px-12 py-6 flex justify-between items-center ${
          darkMode ? "border-b border-[#1a1a1a]" : "border-b border-gray-100"
        }`}>
          <h1 className={`text-2xl font-light ${
            darkMode ? "text-white" : "text-black"
          }`}>
            Dashboard
          </h1>
          
          <div className="flex items-center gap-4">
            <DarkModeToggle darkMode={darkMode} setDarkMode={setDarkMode} />
            <button
              onClick={handleSignOut}
              className={`px-4 py-2 text-sm font-light rounded transition-colors ${
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
        <main className="flex-1 overflow-y-auto px-6 md:px-12 py-12">
          {error && (
            <div className={`mb-6 px-4 py-3 rounded font-light ${
              darkMode ? "bg-red-900/20 text-red-400" : "bg-red-50 text-red-600"
            }`}>
              {error}
            </div>
          )}
          {success && (
            <div className={`mb-6 px-4 py-3 rounded font-light ${
              darkMode ? "bg-green-900/20 text-green-400" : "bg-green-50 text-green-600"
            }`}>
              {success}
            </div>
          )}
          
          {/* Welcome Section */}
          <div className="max-w-4xl mb-16">
            <h2 className={`text-4xl md:text-5xl font-light mb-3 ${
              darkMode ? "text-white" : "text-black"
            }`}>
              Welcome back, {userData?.fullName?.split(' ')[0] || 'Player'}
            </h2>
            <p className={`text-lg font-light ${
              darkMode ? "text-gray-400" : "text-gray-600"
            }`}>
              {userData?.userType === 'admin' ? 'Manage your club' : 'Your tennis dashboard'}
            </p>
          </div>

          {/* Profile Information */}
          <div className="max-w-4xl">
            <h3 className={`text-sm font-light uppercase tracking-wider mb-6 ${
              darkMode ? "text-gray-500" : "text-gray-400"
            }`}>
              Profile
            </h3>
            
            <div className={`p-8 rounded ${
              darkMode 
                ? "bg-[#0a0a0a] border border-[#1a1a1a]" 
                : "bg-white border border-gray-100"
            }`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
                  ) : userData?.organization ? (
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 border-2 ${
                        darkMode ? "border-white" : "border-black"
                      } border-t-transparent rounded-full animate-spin`}></div>
                      <p className={`font-light ${
                        darkMode ? "text-gray-500" : "text-gray-600"
                      }`}>
                        Loading club information...
                      </p>
                    </div>
                  ) : (
                    <p className={`font-light ${
                      darkMode ? "text-gray-500" : "text-gray-600"
                    }`}>
                      Not a member of any club yet.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className={`max-w-4xl mt-16 pt-8 border-t ${
            darkMode ? "border-[#1a1a1a]" : "border-gray-100"
          }`}>
            <p className={`text-center text-sm font-light ${
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