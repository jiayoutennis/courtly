"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth, db } from "../../../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { 
  collection, query, getDocs, doc, getDoc, 
  addDoc, where, orderBy, serverTimestamp
} from "firebase/firestore";
import DarkModeToggle from "@/app/components/DarkModeToggle";
import PageTitle from "@/app/components/PageTitle";

interface Club {
  id: string;
  name: string;
  city: string;
  state: string;
  email: string;
  website?: string;
  description?: string;
  courts?: number;
  courtType?: string;
  approved: boolean;
}

export default function JoinClubPage() {
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [filteredClubs, setFilteredClubs] = useState<Club[]>([]);
  const [userData, setUserData] = useState<any>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [requestingClub, setRequestingClub] = useState<string | null>(null);
  const [joinMessage, setJoinMessage] = useState("");
  const [pendingRequests, setPendingRequests] = useState<string[]>([]);
  
  const router = useRouter();

  // Initialize dark mode from localStorage
  useEffect(() => {
    const savedMode = localStorage.getItem("darkMode");
    if (savedMode === "true") {
      setDarkMode(true);
    }
  }, []);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem("darkMode", newMode ? "true" : "false");
  };

  // Check if user is authenticated and fetch clubs
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // Fetch user data
          const userDocRef = doc(db, "users", user.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            setUserData({
              id: user.uid,
              ...userDoc.data()
            });
            
            // Fetch clubs
            await fetchClubs();
            
            // Fetch user's pending join requests
            const requestsQuery = query(
              collection(db, "clubJoinRequests"),
              where("userId", "==", user.uid),
              where("status", "==", "pending")
            );
            
            const requestsSnapshot = await getDocs(requestsQuery);
            const pendingClubIds: string[] = [];
            
            requestsSnapshot.forEach(doc => {
              const data = doc.data();
              pendingClubIds.push(data.clubId);
            });
            
            setPendingRequests(pendingClubIds);
          }
        } catch (error) {
          console.error("Error fetching data:", error);
          setError("Failed to load data. Please try again later.");
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

  // Fetch clubs from Firestore
  const fetchClubs = async () => {
    try {
      // Get approved clubs
      const clubsQuery = query(
        collection(db, "publicClubs"),
        where("approved", "==", true),
        orderBy("name")
      );
      
      const querySnapshot = await getDocs(clubsQuery);
      const clubList: Club[] = [];
      
      querySnapshot.forEach((doc) => {
        clubList.push({
          id: doc.id,
          ...doc.data()
        } as Club);
      });
      
      setClubs(clubList);
      setFilteredClubs(clubList);
    } catch (error) {
      console.error("Error fetching clubs:", error);
      setError("Failed to load clubs. Please try again later.");
    }
  };

  // Handle search and filter
  useEffect(() => {
    if (clubs.length > 0) {
      let filtered = [...clubs];
      
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(club => 
          club.name.toLowerCase().includes(query) ||
          club.city.toLowerCase().includes(query)
        );
      }
      
      if (stateFilter) {
        filtered = filtered.filter(club => club.state === stateFilter);
      }
      
      setFilteredClubs(filtered);
    }
  }, [searchQuery, stateFilter, clubs]);

  // Get unique states for filter
  const uniqueStates = [...new Set(clubs.map(club => club.state))].sort();

  // Handle join request
  const requestToJoin = async (clubId: string) => {
    if (!userData) {
      setError("You must be logged in to request joining a club");
      return;
    }
    
    setRequestingClub(clubId);
    setJoinMessage("");
  };

  // Submit join request
  const submitJoinRequest = async (clubId: string) => {
    try {
      setLoading(true);
      
      // Create a join request document
      await addDoc(collection(db, "clubJoinRequests"), {
        userId: userData.id,
        clubId: clubId,
        userName: userData.fullName || userData.email,
        userEmail: userData.email,
        message: joinMessage,
        status: "pending",
        createdAt: serverTimestamp()
      });
      
      // Update UI state
      setPendingRequests([...pendingRequests, clubId]);
      setRequestingClub(null);
      setSuccess("Your join request has been sent! The club admin will review it soon.");
      
      // Clear success after 3 seconds
      setTimeout(() => {
        setSuccess("");
      }, 3000);
    } catch (error) {
      console.error("Error submitting join request:", error);
      setError("Failed to submit your join request. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Cancel join request modal
  const cancelRequest = () => {
    setRequestingClub(null);
    setJoinMessage("");
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors duration-300 ${
        darkMode ? "bg-gray-900 text-white" : "bg-white text-gray-900"
      }`}>
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-t-transparent border-blue-500 rounded-full animate-spin mx-auto"></div>
          <p className="mt-4">Loading clubs directory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      darkMode ? "bg-gray-900 text-gray-50" : "bg-gray-50 text-gray-900"
    }`}>
      <PageTitle title="Join a Club - Courtly" />
      
      {/* Dark Mode Toggle Button */}
      <div className="absolute top-8 right-8">
        <DarkModeToggle darkMode={darkMode} setDarkMode={setDarkMode} />
      </div>
      
      {/* Top Navigation Bar */}
      <nav className={`py-4 px-6 flex items-center justify-between shadow-md ${
        darkMode ? "bg-gray-800" : "bg-white"
      }`}>
        <div className="flex items-center space-x-4">
          <Link href="/dashboard" className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </Link>
        </div>
      </nav>
      
      {/* Main content */}
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
        
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold mb-2">Find and Join a Club</h1>
            <p className={darkMode ? "text-gray-400" : "text-gray-600"}>
              Browse clubs in the Courtly directory and request to join
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 mt-4 md:mt-0">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search clubs..."
                className={`px-4 py-2 w-full sm:w-64 rounded-lg ${
                  darkMode 
                    ? "bg-gray-800 border-gray-700 text-white" 
                    : "bg-white border-gray-300 text-gray-900"
                } border focus:outline-none focus:ring-2 ${
                  darkMode ? "focus:ring-indigo-500" : "focus:ring-indigo-500"
                }`}
              />
              <svg 
                className={`absolute right-3 top-2.5 h-5 w-5 ${
                  darkMode ? "text-gray-400" : "text-gray-500"
                }`}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className={`px-4 py-2 rounded-lg ${
                darkMode 
                  ? "bg-gray-800 border-gray-700 text-white" 
                  : "bg-white border-gray-300 text-gray-900"
              } border focus:outline-none focus:ring-2 ${
                darkMode ? "focus:ring-indigo-500" : "focus:ring-indigo-500"
              }`}
            >
              <option value="">All States</option>
              {uniqueStates.map((state) => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
          </div>
        </div>
        
        {/* Clubs Grid */}
        {filteredClubs.length === 0 ? (
          <div className={`p-8 rounded-lg text-center ${
            darkMode ? "bg-gray-800" : "bg-white"
          } shadow-md`}>
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-16 w-16 mx-auto mb-4 ${
              darkMode ? "text-gray-600" : "text-gray-400"
            }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-xl font-semibold mb-2">No Clubs Found</h2>
            <p className={darkMode ? "text-gray-400" : "text-gray-600"}>
              No clubs match your search criteria. Try adjusting your filters.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredClubs.map((club) => (
              <div key={club.id} className={`rounded-lg shadow-md overflow-hidden ${
                darkMode ? "bg-gray-800" : "bg-white"
              }`}>
                <div className={`p-6 ${
                  darkMode ? "border-b border-gray-700" : "border-b border-gray-200"
                }`}>
                  <h3 className="text-xl font-semibold mb-2">{club.name}</h3>
                  <div className={`flex items-center mb-2 ${
                    darkMode ? "text-gray-400" : "text-gray-600"
                  }`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {club.city}, {club.state}
                  </div>
                  {club.courts && (
                    <div className={`flex items-center mb-2 ${
                      darkMode ? "text-gray-400" : "text-gray-600"
                    }`}>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                      </svg>
                      {club.courts} {club.courts > 1 ? 'Courts' : 'Court'} ({club.courtType})
                    </div>
                  )}
                  {club.description && (
                    <p className={`mt-3 text-sm ${
                      darkMode ? "text-gray-400" : "text-gray-600"
                    }`}>
                      {club.description.length > 100 
                        ? `${club.description.substring(0, 100)}...` 
                        : club.description
                      }
                    </p>
                  )}
                </div>
                <div className="p-4 flex justify-between items-center">
                  {club.website && (
                    <a 
                      href={club.website.startsWith('http') ? club.website : `https://${club.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`text-sm ${
                        darkMode ? "text-indigo-400" : "text-indigo-600"
                      } hover:underline`}
                    >
                      Visit Website
                    </a>
                  )}
                  
                  {pendingRequests.includes(club.id) ? (
                    <div className={`text-sm px-3 py-1 rounded ${
                      darkMode ? "bg-gray-700 text-yellow-400" : "bg-yellow-100 text-yellow-800"
                    }`}>
                      Request Pending
                    </div>
                  ) : userData?.organization === club.id ? (
                    <div className={`text-sm px-3 py-1 rounded ${
                      darkMode ? "bg-gray-700 text-green-400" : "bg-green-100 text-green-800"
                    }`}>
                      Current Member
                    </div>
                  ) : (
                    <button
                      onClick={() => requestToJoin(club.id)}
                      className={`text-sm px-4 py-2 rounded ${
                        darkMode 
                          ? "bg-indigo-600 text-white hover:bg-indigo-700" 
                          : "bg-indigo-500 text-white hover:bg-indigo-600"
                      }`}
                    >
                      Request to Join
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Join Request Modal */}
      {requestingClub && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className={`w-full max-w-md rounded-lg shadow-lg ${
            darkMode ? "bg-gray-800" : "bg-white"
          } p-6`}>
            <h3 className="text-xl font-semibold mb-4">Request to Join Club</h3>
            <p className={`mb-4 ${
              darkMode ? "text-gray-300" : "text-gray-700"
            }`}>
              Your request will be sent to the club administrator for approval. You can include a message with your request.
            </p>
            
            <div className="mb-4">
              <label 
                htmlFor="joinMessage" 
                className={`block mb-2 ${
                  darkMode ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Message (Optional)
              </label>
              <textarea
                id="joinMessage"
                value={joinMessage}
                onChange={(e) => setJoinMessage(e.target.value)}
                placeholder="Introduce yourself and explain why you'd like to join this club..."
                rows={4}
                className={`w-full px-3 py-2 rounded-lg ${
                  darkMode 
                    ? "bg-gray-700 border-gray-600 text-white" 
                    : "bg-white border-gray-300 text-gray-900"
                } border focus:outline-none focus:ring-2 ${
                  darkMode ? "focus:ring-indigo-500" : "focus:ring-indigo-500"
                }`}
              ></textarea>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={cancelRequest}
                className={`px-4 py-2 rounded ${
                  darkMode 
                    ? "bg-gray-700 text-gray-200 hover:bg-gray-600" 
                    : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                }`}
              >
                Cancel
              </button>
              <button
                onClick={() => submitJoinRequest(requestingClub)}
                disabled={loading}
                className={`px-4 py-2 rounded ${
                  darkMode 
                    ? "bg-indigo-600 text-white hover:bg-indigo-700" 
                    : "bg-indigo-500 text-white hover:bg-indigo-600"
                } ${loading ? "opacity-70 cursor-not-allowed" : ""}`}
              >
                {loading ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </div>
        </div>
      )}
      
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