// ...existing code up to first export default...
// Remove duplicate implementation below
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { db } from "../../../firebase";
import { collection, getDocs, addDoc, query, where, doc, getDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import PageTitle from "@/app/components/PageTitle";

interface Club {
  id: string;
  name: string;
  city: string;
  state: string;
  description?: string;
  courts?: number;
}

export default function BrowseClubsPage() {
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredClubs, setFilteredClubs] = useState<Club[]>([]);
  const [requestingClub, setRequestingClub] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [userClubs, setUserClubs] = useState<string[]>([]);

  useEffect(() => {
    const savedMode = localStorage.getItem("darkMode");
    if (savedMode === "true") {
      setDarkMode(true);
    }
  }, []);

  // Fetch user's current clubs
  useEffect(() => {
    const fetchUserClubs = async () => {
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const organization = userData.organization || [];
            
            // Handle both string and array formats
            if (Array.isArray(organization)) {
              setUserClubs(organization);
            } else if (typeof organization === 'string' && organization) {
              setUserClubs([organization]);
            }
          }
        } catch (error) {
          console.error("Error fetching user clubs:", error);
        }
      }
    };
    
    fetchUserClubs();
  }, []);

  const handleRequestMembership = async (clubId: string, clubName: string) => {
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user) {
      setErrorMessage("You must be signed in to request membership.");
      return;
    }

    setRequestingClub(clubId);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      // Check if request already exists
      const requestsRef = collection(db, "clubJoinRequests");
      const q = query(
        requestsRef,
        where("userId", "==", user.uid),
        where("clubId", "==", clubId)
      );
      const existingRequests = await getDocs(q);

      if (!existingRequests.empty) {
        setErrorMessage("You already have a pending request for this club.");
        setRequestingClub(null);
        return;
      }

      // Create new membership request
      await addDoc(collection(db, "clubJoinRequests"), {
        userId: user.uid,
        clubId: clubId,
        clubName: clubName,
        userEmail: user.email,
        status: "pending",
        createdAt: new Date().toISOString(),
        requestedAt: new Date()
      });

      setSuccessMessage(`Successfully requested membership to ${clubName}!`);
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (error) {
      console.error("Error requesting membership:", error);
      setErrorMessage("Failed to submit membership request. Please try again.");
    } finally {
      setRequestingClub(null);
    }
  };

  useEffect(() => {
    const fetchClubs = async () => {
      try {
        const clubsSnapshot = await getDocs(collection(db, "orgs"));
        const clubsData: Club[] = [];
        
        clubsSnapshot.forEach((doc) => {
          const data = doc.data();
          // Only show verified/active clubs
          if (data.isVerified && data.isActive) {
            clubsData.push({
              id: doc.id,
              name: data.name || "Unknown Club",
              city: data.city || "",
              state: data.state || "",
              description: data.description,
              courts: data.courtCount
            });
          }
        });
        
        setClubs(clubsData);
        setFilteredClubs(clubsData);
      } catch (error) {
        console.error("Error fetching clubs:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchClubs();
  }, []);

  useEffect(() => {
    const filtered = clubs.filter(club =>
      club.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      club.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      club.state.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredClubs(filtered);
  }, [searchTerm, clubs]);

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        darkMode ? "bg-[#0a0a0a] text-white" : "bg-white text-black"
      }`}>
        <div className="text-xs uppercase tracking-wider font-light">Loading clubs...</div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      darkMode ? "bg-[#0a0a0a] text-white" : "bg-white text-black"
    }`}>
      <PageTitle title="Browse Clubs - Courtly" />
      
      <header className={`py-6 px-4 ${
        darkMode ? "border-b border-[#1a1a1a]" : "border-b border-gray-100"
      }`}>
        <div className="container mx-auto">
          <div className="flex justify-between items-center">
            <h1 className="text-xs uppercase tracking-wider font-light">Browse Tennis Clubs</h1>
            <div className="flex items-center gap-3">
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
              <Link
                href="/"
                className={`px-4 py-3 text-xs uppercase tracking-wider font-light transition ${
                  darkMode
                    ? "border border-white text-white hover:bg-white hover:text-black"
                    : "border border-black text-black hover:bg-black hover:text-white"
                }`}
              >
                Back to Home
              </Link>
            </div>
          </div>
        </div>
      </header>
      
      <div className="container mx-auto px-4 py-8">
        {/* Success Message */}
        {successMessage && (
          <div className={`mb-6 px-4 py-3 text-xs uppercase tracking-wider font-light ${
            darkMode
              ? "border border-white/20 bg-white/5 text-white"
              : "border border-black/20 bg-black/5 text-black"
          }`}>
            {successMessage}
          </div>
        )}
        {errorMessage && (
          <div className={`mb-6 px-4 py-3 text-xs uppercase tracking-wider font-light ${
            darkMode
              ? "border border-white/20 bg-white/5 text-white"
              : "border border-black/20 bg-black/5 text-black"
          }`}>
            {errorMessage}
          </div>
        )}
        
        {/* Search Bar */}
        <div className="mb-8">
          <input
            type="text"
            placeholder="Search clubs by name, city, or state..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full px-4 py-3 font-light text-xs focus:outline-none ${
              darkMode
                ? "bg-[#0a0a0a] border border-[#1a1a1a] text-white placeholder-gray-600"
                : "bg-white border border-gray-100 text-black placeholder-gray-400"
            }`}
          />
        </div>
        
        {/* Clubs Grid */}
        {filteredClubs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClubs.map(club => (
              <div
                key={club.id}
                className={`p-6 border transition ${
                  darkMode ? "border-[#1a1a1a]" : "border-gray-100"
                }`}
              >
                <h2 className={`text-xs uppercase tracking-wider font-light mb-2 ${
                  darkMode ? "text-white" : "text-black"
                }`}>{club.name}</h2>
                <p className={`mb-3 text-xs font-light ${darkMode ? "text-gray-500" : "text-gray-500"}`}>
                  {[club.city, club.state].filter(Boolean).join(", ")}
                </p>
                {club.description && (
                  <p className={`text-xs font-light mb-3 line-clamp-2 ${
                    darkMode ? "text-gray-500" : "text-gray-500"
                  }`}>
                    {club.description}
                  </p>
                )}
                {club.courts && (
                  <p className={`text-xs font-light mb-4 ${darkMode ? "text-gray-600" : "text-gray-400"}`}>
                    {club.courts} {club.courts === 1 ? "Court" : "Courts"}
                  </p>
                )}
                
                <div className="flex gap-2 mt-4">
                  <Link
                    href={`/club/${club.id}`}
                    className={`flex-1 px-4 py-3 text-xs uppercase tracking-wider font-light text-center transition ${
                      darkMode
                        ? "border border-white text-white hover:bg-white hover:text-black"
                        : "border border-black text-black hover:bg-black hover:text-white"
                    }`}
                  >
                    View Details
                  </Link>
                  {userClubs.includes(club.id) ? (
                    <div
                      className={`flex-1 px-4 py-3 text-xs uppercase tracking-wider font-light text-center ${
                        darkMode
                          ? "border border-white/20 bg-white/5 text-white"
                          : "border border-black/20 bg-black/5 text-black"
                      }`}
                    >
                      Member
                    </div>
                  ) : (
                    <button
                      onClick={() => handleRequestMembership(club.id, club.name)}
                      disabled={requestingClub === club.id}
                      className={`flex-1 px-4 py-3 text-xs uppercase tracking-wider font-light transition ${
                        requestingClub === club.id
                          ? darkMode 
                            ? "border border-gray-600 text-gray-600 cursor-not-allowed"
                            : "border border-gray-400 text-gray-400 cursor-not-allowed"
                          : darkMode
                            ? "border border-white text-white hover:bg-white hover:text-black"
                            : "border border-black text-black hover:bg-black hover:text-white"
                      }`}
                    >
                      {requestingClub === club.id ? "Requesting..." : "Request"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className={`text-xs uppercase tracking-wider font-light ${darkMode ? "text-gray-500" : "text-gray-500"}`}>
              No clubs found matching your search.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
