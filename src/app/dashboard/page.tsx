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
  organization?: string;
  createdAt: string;
}

interface ClubData {
  name: string;
  address: string;
  city: string;
  state: string;
}

export default function DashboardPage() {
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [clubData, setClubData] = useState<ClubData | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
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
            
            // Always fetch club data if organization exists (for both members and admins)
            if (data.organization) {
              // Use the fetchClubDetails function directly
              await fetchClubDetails(data.organization);
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

  const handleRefreshData = async () => {
    if (!auth.currentUser) {
      setError("You need to be signed in to refresh data");
      return;
    }
    
    setLoading(true);
    try {
      // Re-fetch user data
      const userDocRef = doc(db, "users", auth.currentUser.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const data = userDoc.data();
        
        setUserData({
          id: auth.currentUser.uid,
          fullName: data.fullName || auth.currentUser.displayName || auth.currentUser.email?.split('@')[0],
          email: auth.currentUser.email || data.email,
          userType: data.userType,
          club: data.club,
          organization: data.organization,
          createdAt: data.createdAt
        });
        
        // If user is a member, fetch their club's data
        if (data.userType === 'member' && data.organization) {
          try {
            // First try to get club from users collection
            let clubDocRef = doc(db, "users", data.organization);
            let clubDoc = await getDoc(clubDocRef);
            
            if (clubDoc.exists()) {
              console.log("Club found in users collection:", clubDoc.data());
              
              // Create club data with fallbacks for every field
              const clubDataResult = {
                name: clubDoc.data().club?.name || clubDoc.data().fullName || clubDoc.data().name || "Unknown Club",
                address: clubDoc.data().club?.address || clubDoc.data().address || "",
                city: clubDoc.data().club?.city || clubDoc.data().city || "",
                state: clubDoc.data().club?.state || clubDoc.data().state || ""
              };
              
              setClubData(clubDataResult);
              
            } else {
              // If not found in users, try publicClubs collection
              clubDocRef = doc(db, "publicClubs", data.organization);
              clubDoc = await getDoc(clubDocRef);
              
              if (clubDoc.exists()) {
                console.log("Club found in publicClubs collection:", clubDoc.data());
                
                setClubData({
                  name: clubDoc.data().name || "Unknown Club",
                  address: clubDoc.data().address || "",
                  city: clubDoc.data().city || "",
                  state: clubDoc.data().state || ""
                });
              } else {
                console.log("No club found with ID:", data.organization);
                setClubData(null);
              }
            }
          } catch (error) {
            console.error("Error fetching club data:", error);
            setError("Failed to load club data. Please try again later.");
          }
        }
        
        setSuccess("Data refreshed successfully");
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          setSuccess("");
        }, 3000);
      }
    } catch (error) {
      console.error("Error refreshing data:", error);
      setError("Failed to refresh data. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const debugClubData = async () => {
    if (!userData?.organization) return;
    
    setLoading(true);
    try {
      // Try to fetch club data from users collection first
      let clubDocRef = doc(db, "users", userData.organization);
      let clubDoc = await getDoc(clubDocRef);
      
      if (clubDoc.exists()) {
        console.log("Club found in users collection:", clubDoc.data());
        setClubData(clubDoc.data().club || {
          name: clubDoc.data().fullName || clubDoc.data().name || "Unknown Club",
          address: clubDoc.data().address || "",
          city: clubDoc.data().city || "",
          state: clubDoc.data().state || ""
        });
      } else {
        // If not found in users, try publicClubs collection
        console.log("Club not found in users, checking publicClubs collection");
        clubDocRef = doc(db, "publicClubs", userData.organization);
        clubDoc = await getDoc(clubDocRef);
        
        if (clubDoc.exists()) {
          console.log("Club found in publicClubs collection:", clubDoc.data());
          setClubData({
            name: clubDoc.data().name || "Unknown Club",
            address: clubDoc.data().address || "",
            city: clubDoc.data().city || "",
            state: clubDoc.data().state || ""
          });
        } else {
          console.warn("No club found with ID:", userData.organization);
          setClubData(null);
        }
      }
    } catch (error) {
      console.error("Error fetching club data:", error);
      setError("Failed to load club data. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const fetchClubDetails = async (organizationId: string) => {
    if (!organizationId) return null;
    
    try {
      console.log("Fetching club data for ID:", organizationId);
      
      // Get the club directly from publicClubs collection
      const clubDocRef = doc(db, "publicClubs", organizationId);
      const clubDoc = await getDoc(clubDocRef);
      
      if (clubDoc.exists()) {
        console.log("Club found in publicClubs:", clubDoc.data());
        
        const clubData = {
          name: clubDoc.data().name || "Unknown Club",
          address: clubDoc.data().address || "",
          city: clubDoc.data().city || "",
          state: clubDoc.data().state || ""
        };
        
        setClubData(clubData);
        return clubData;
      } 
    
      // If not in publicClubs, try users collection as fallback
      const userDocRef = doc(db, "users", organizationId);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        console.log("Club found in users collection:", userDoc.data());
        
        const clubData = {
          name: userDoc.data().club?.name || userDoc.data().fullName || "Unknown Club",
          address: userDoc.data().club?.address || userDoc.data().address || "",
          city: userDoc.data().club?.city || userDoc.data().city || "",
          state: userDoc.data().club?.state || userDoc.data().state || ""
        };
        
        setClubData(clubData);
        return clubData;
      }
      
      console.warn("No club found with ID:", organizationId);
      setClubData(null);
      return null;
      
    } catch (error) {
      console.error("Error fetching club data:", error);
      setError("Failed to load club information");
      return null;
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors duration-300 ${
        darkMode ? "bg-gray-900 text-white" : "bg-white text-gray-900"
      }`}>
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`min-h-screen transition-colors duration-300 ${
        darkMode ? "bg-gray-900 text-gray-50" : "bg-gray-50 text-gray-900"
      }`}
    >
      <PageTitle title="Dashboard - Courtly" />
      
      {/* Dark Mode Toggle Button */}
      <div className="absolute top-8 right-8">
        <DarkModeToggle darkMode={darkMode} setDarkMode={setDarkMode} />
      </div>
      
      {/* Top Navigation Bar */}
      <nav className={`py-4 px-6 flex items-center justify-between shadow-md ${
        darkMode ? "bg-gray-800" : "bg-white"
      }`}>
        <div className="flex items-center space-x-4">
          {/* Back to Home Button - NEW */}
          <Link href="/" className={`flex items-center px-3 py-1.5 rounded-lg ${
            darkMode 
              ? "bg-gray-700 hover:bg-gray-600 text-gray-200" 
              : "bg-gray-100 hover:bg-gray-200 text-gray-700"
            } transition-colors mr-2`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="hidden sm:inline">Home</span>
          </Link>
          
          {/* Logo */}
          <div className={`p-2 rounded-full ${darkMode ? "bg-teal-600" : "bg-green-400"}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
            </svg>
          </div>
          <h1 className="text-xl font-bold">Courtly</h1>
        </div>
        
        <div className="flex items-center space-x-4">
          <button
            onClick={handleRefreshData}
            disabled={loading}
            className={`px-4 py-2 rounded-lg ${
              darkMode 
                ? "bg-teal-600 hover:bg-teal-700 text-white" 
                : "bg-green-400 hover:bg-green-500 text-white"
            } transition-colors`}
          >
            {loading ? "Refreshing..." : "Refresh Data"}
          </button>
          <button
            onClick={handleSignOut}
            className={`px-4 py-2 rounded-lg ${
              darkMode 
                ? "bg-gray-700 hover:bg-gray-600 text-gray-200" 
                : "bg-gray-100 hover:bg-gray-200 text-gray-700"
            } transition-colors`}
          >
            Sign Out
          </button>
        </div>
      </nav>
      
      {/* Dashboard Content */}
      <div className="container mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-100 text-green-700 rounded-lg">
            {success}
          </div>
        )}
        
        {/* User Profile Section */}
        <div className={`p-6 rounded-lg shadow-md mb-8 ${
          darkMode ? "bg-gray-800" : "bg-white"
        }`}>
          <div className="flex items-center">
            <div className={`p-4 rounded-full mr-4 ${
              darkMode ? "bg-teal-600" : "bg-green-400"
            }`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold">{userData?.fullName}</h2>
              <p className={darkMode ? "text-gray-400" : "text-gray-500"}>
                {userData?.email} • {userData?.userType === 'admin' ? 'Club Admin' : 'Club Member'}
              </p>
            </div>
          </div>
          
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className={`p-4 rounded-lg ${darkMode ? "bg-gray-700" : "bg-gray-50"}`}>
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-medium">
                  {userData?.userType === 'admin' ? 'Your Club' : 'Club Membership'}
                </h3>
                
                {userData?.organization && (
                  <button
                    onClick={() => fetchClubDetails(userData.organization!)}
                    className={`px-2 py-1 text-xs rounded ${
                      darkMode 
                        ? "bg-teal-600 hover:bg-teal-700 text-white" 
                        : "bg-teal-500 hover:bg-teal-600 text-white"
                    }`}
                  >
                    Refresh
                  </button>
                )}
              </div>
              
              {clubData ? (
                <div>
                  <p className="font-semibold">{clubData.name}</p>
                  <p className={darkMode ? "text-gray-400" : "text-gray-500"}>
                    {[
                      clubData.address,
                      clubData.city,
                      clubData.state
                    ].filter(Boolean).join(", ")}
                  </p>
                </div>
              ) : userData?.organization ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-t-transparent border-teal-500 rounded-full animate-spin"></div>
                  <p className={darkMode ? "text-gray-400" : "text-gray-500"}>
                    Loading club information...
                  </p>
                </div>
              ) : (
                <p className={darkMode ? "text-gray-400" : "text-gray-500"}>
                  Not a member of any club
                </p>
              )}
            </div>
            
            <div className={`p-4 rounded-lg ${
              darkMode ? "bg-gray-700" : "bg-gray-50"
            }`}>
              <h3 className="text-lg font-medium mb-2">Account Details</h3>
              <p className={darkMode ? "text-gray-400" : "text-gray-500"}>
                <span className="font-medium">Account type:</span> {
                  userData?.userType 
                    ? userData.userType.charAt(0).toUpperCase() + userData.userType.slice(1)
                    : "Unknown"
                }
              </p>
              <p className={darkMode ? "text-gray-400" : "text-gray-500"}>
                <span className="font-medium">Joined:</span> {
                  userData?.createdAt 
                    ? new Date(userData.createdAt).toLocaleDateString()
                    : "N/A"
                }
              </p>
            </div>
          </div>
        </div>
        
        {/* Quick Actions */}
        <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
          {/* Court Reservations */}
          <Link href="/court-schedule" className={`p-6 rounded-lg shadow-md hover:shadow-lg transition ${
            darkMode ? "bg-gray-800 hover:bg-gray-700" : "bg-white hover:bg-gray-50"
          }`}>
            <div className="flex items-center mb-4">
              <div className={`p-3 rounded-full mr-3 ${
                darkMode ? "bg-teal-700" : "bg-green-100"
              }`}>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${
                  darkMode ? "text-teal-400" : "text-green-600"
                }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold">Court Reservations</h3>
            </div>
            <p className={darkMode ? "text-gray-400" : "text-gray-500"}>
              Book a court, view upcoming reservations, or manage bookings.
            </p>
          </Link>
          
          {/* Upcoming Events */}
          <Link href="#" className={`p-6 rounded-lg shadow-md hover:shadow-lg transition ${
            darkMode ? "bg-gray-800 hover:bg-gray-700" : "bg-white hover:bg-gray-50"
          }`}>
            <div className="flex items-center mb-4">
              <div className={`p-3 rounded-full mr-3 ${
                darkMode ? "bg-blue-700" : "bg-blue-100"
              }`}>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${
                  darkMode ? "text-blue-400" : "text-blue-600"
                }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold">Upcoming Events</h3>
            </div>
            <p className={darkMode ? "text-gray-400" : "text-gray-500"}>
              View and register for tournaments, clinics, and social events.
            </p>
          </Link>
          
          {/* My Profile */}
          <Link href="#" className={`p-6 rounded-lg shadow-md hover:shadow-lg transition ${
            darkMode ? "bg-gray-800 hover:bg-gray-700" : "bg-white hover:bg-gray-50"
          }`}>
            <div className="flex items-center mb-4">
              <div className={`p-3 rounded-full mr-3 ${
                darkMode ? "bg-purple-700" : "bg-purple-100"
              }`}>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${
                  darkMode ? "text-purple-400" : "text-purple-600"
                }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold">My Profile</h3>
          </div>
          <p className={darkMode ? "text-gray-400" : "text-gray-500"}>
            Update your profile information and account settings.
          </p>
        </Link>
          
          {/* Find and Join Clubs */}
          <Link href="/join-club" className={`p-6 rounded-lg shadow-md hover:shadow-lg transition ${
            darkMode ? "bg-gray-800 hover:bg-gray-700" : "bg-white hover:bg-gray-50"
          }`}>
            <div className="flex items-center mb-4">
              <div className={`p-3 rounded-full mr-3 ${
                darkMode ? "bg-indigo-700" : "bg-indigo-100"
              }`}>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${
                  darkMode ? "text-indigo-400" : "text-indigo-600"
                }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold">Join a Club</h3>
            </div>
            <p className={darkMode ? "text-gray-400" : "text-gray-500"}>
              Browse and request to join clubs in the Courtly directory.
            </p>
          </Link>
        </div>
        
        {/* Admin-only section */}
        <h2 className="text-xl font-bold mb-4">Club Administration</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
          {/* Manage Members */}
          <Link href="#" className={`p-6 rounded-lg shadow-md hover:shadow-lg transition ${
            darkMode ? "bg-gray-800 hover:bg-gray-700" : "bg-white hover:bg-gray-50"
          }`}>
            <div className="flex items-center mb-4">
              <div className={`p-3 rounded-full mr-3 ${
                darkMode ? "bg-amber-700" : "bg-amber-100"
              }`}>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${
                  darkMode ? "text-amber-400" : "text-amber-600"
                }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold">Manage Members</h3>
            </div>
            <p className={darkMode ? "text-gray-400" : "text-gray-500"}>
              View, add, and manage club members and their permissions.
            </p>
          </Link>
          
          {/* Club Settings */}
          <Link href="/admin/club-settings" className={`p-6 rounded-lg shadow-md hover:shadow-lg transition ${
            darkMode ? "bg-gray-800 hover:bg-gray-700" : "bg-white hover:bg-gray-50"
          }`}>
            <div className="flex items-center mb-4">
              <div className={`p-3 rounded-full mr-3 ${
                darkMode ? "bg-gray-700" : "bg-gray-100"
              }`}>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${
                  darkMode ? "text-gray-400" : "text-gray-600"
                }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold">Club Settings</h3>
            </div>
            <p className={darkMode ? "text-gray-400" : "text-gray-500"}>
              Manage club information, locations, and court details.
            </p>
          </Link>
          
          {/* Court Administration */}
          <Link href="/test-reservation" className={`p-6 rounded-lg shadow-md hover:shadow-lg transition ${
            darkMode ? "bg-gray-800 hover:bg-gray-700" : "bg-white hover:bg-gray-50"
          }`}>
            <div className="flex items-center mb-4">
              <div className={`p-3 rounded-full mr-3 ${
                darkMode ? "bg-green-700" : "bg-green-100"
              }`}>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${
                  darkMode ? "text-green-400" : "text-green-600"
                }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold">Test Court System</h3>
            </div>
            <p className={darkMode ? "text-gray-400" : "text-gray-500"}>
              Test your court reservation system with sample data.
            </p>
          </Link>
          
          {/* Member Requests */}
          <Link href="/admin/requests" className={`p-6 rounded-lg shadow-md hover:shadow-lg transition ${
            darkMode ? "bg-gray-800 hover:bg-gray-700" : "bg-white hover:bg-gray-50"
          }`}>
            <div className="flex items-center mb-4">
              <div className={`p-3 rounded-full mr-3 ${
                darkMode ? "bg-pink-700" : "bg-pink-100"
              }`}>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${
                  darkMode ? "text-pink-400" : "text-pink-600"
                }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold">Member Requests</h3>
            </div>
            <p className={darkMode ? "text-gray-400" : "text-gray-500"}>
              Manage requests from players who want to join your club.
            </p>
          </Link>
        </div>
        
        {/* Club Admin section - for any user whose userType ends with "Admin" */}
        {userData?.userType && userData.userType.endsWith("Admin") && (
          <>
            <h2 className="text-xl font-bold mb-4">{userData.userType.replace(" Admin", "")} Administration</h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
              {/* Member Requests */}
              <Link href="/admin/requests" className={`p-6 rounded-lg shadow-md hover:shadow-lg transition ${
                darkMode ? "bg-gray-800 hover:bg-gray-700" : "bg-white hover:bg-gray-50"
              }`}>
                <div className="flex items-center mb-4">
                  <div className={`p-3 rounded-full mr-3 ${
                    darkMode ? "bg-amber-700" : "bg-amber-100"
                  }`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${
                      darkMode ? "text-amber-400" : "text-amber-600"
                    }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold">Membership Requests</h3>
                </div>
                <p className={darkMode ? "text-gray-400" : "text-gray-500"}>
                  Review and approve requests from players who want to join your club.
                </p>
              </Link>
              
              {/* Manage Members */}
              <Link href="/admin/members" className={`p-6 rounded-lg shadow-md hover:shadow-lg transition ${
                darkMode ? "bg-gray-800 hover:bg-gray-700" : "bg-white hover:bg-gray-50"
              }`}>
                <div className="flex items-center mb-4">
                  <div className={`p-3 rounded-full mr-3 ${
                    darkMode ? "bg-blue-700" : "bg-blue-100"
                  }`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${
                      darkMode ? "text-blue-400" : "text-blue-600"
                    }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold">Manage Members</h3>
                </div>
                <p className={darkMode ? "text-gray-400" : "text-gray-500"}>
                  View and manage your club members and their profiles.
                </p>
              </Link>

              {/* Club Settings */}
              <Link href="/admin/club-settings" className={`p-6 rounded-lg shadow-md hover:shadow-lg transition ${
                darkMode ? "bg-gray-800 hover:bg-gray-700" : "bg-white hover:bg-gray-50"
              }`}>
                <div className="flex items-center mb-4">
                  <div className={`p-3 rounded-full mr-3 ${
                    darkMode ? "bg-green-700" : "bg-green-100"
                  }`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${
                      darkMode ? "text-green-400" : "text-green-600"
                    }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                  </div>
                  <h3 className="text-lg font-semibold">Club Settings</h3>
                </div>
                <p className={darkMode ? "text-gray-400" : "text-gray-500"}>
                  Manage club information, locations, and court details.
                </p>
              </Link>
            </div>
          </>
        )}
        
        {/* Courtly staff section */}
        {userData?.userType === 'courtly' && (
          <>
            <h2 className="text-xl font-semibold mb-4">Courtly Admin Tools</h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
              <Link href="/admin/manage-clubs" className={`p-6 rounded-lg shadow-md hover:shadow-lg transition ${
                darkMode ? "bg-gray-800 hover:bg-gray-700" : "bg-white hover:bg-gray-50"
              }`}>
                <div className="flex items-center mb-4">
                  <div className={`p-3 rounded-full mr-3 ${
                    darkMode ? "bg-purple-700" : "bg-purple-100"
                  }`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${
                      darkMode ? "text-purple-400" : "text-purple-600"
                    }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold">Manage Clubs</h3>
                </div>
                <p className={darkMode ? "text-gray-400" : "text-gray-500"}>
                  Add, edit, and manage clubs in the Courtly directory.
                </p>
              </Link>
              
              {/* Club Requests */}
              <Link href="/admin/club-requests" className={`p-6 rounded-lg shadow-md hover:shadow-lg transition ${
                darkMode ? "bg-gray-800 hover:bg-gray-700" : "bg-white hover:bg-gray-50"
              }`}>
                <div className="flex items-center mb-4">
                  <div className={`p-3 rounded-full mr-3 ${
                    darkMode ? "bg-teal-700" : "bg-teal-100"
                  }`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${
                      darkMode ? "text-teal-400" : "text-teal-600"
                    }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold">Club Requests</h3>
                </div>
                <p className={darkMode ? "text-gray-400" : "text-gray-500"}>
                  Review and approve pending club registration requests.
                </p>
              </Link>
            </div>
          </>
        )}
        
        {/* Recent Activity */}
        <h2 className="text-xl font-bold mb-4">Recent Activity</h2>
        <div className={`p-6 rounded-lg shadow-md ${
          darkMode ? "bg-gray-800" : "bg-white"
        }`}>
          <p className="text-center py-8 text-gray-500">
            Your recent activity will appear here.
          </p>
        </div>
      </div>
      
      {/* Footer */}
      <footer className={`mt-12 py-6 ${
        darkMode ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-600"
      }`}>
        <div className="container mx-auto px-4 text-center">
          <p>© {new Date().getFullYear()} Courtly by JiaYou Tennis. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}