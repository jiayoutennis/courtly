"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth, db } from "../../../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import DarkModeToggle from "@/app/components/DarkModeToggle";
import PageTitle from "@/app/components/PageTitle";

interface Club {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
}

export default function CourtSchedulePage() {
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [clubs, setClubs] = useState<Club[]>([]);
  
  const router = useRouter();

  useEffect(() => {
    const savedMode = localStorage.getItem("darkMode");
    if (savedMode === "true") {
      setDarkMode(true);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/signin");
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          if (userData.organization) {
            const orgIds = Array.isArray(userData.organization) 
              ? userData.organization 
              : [userData.organization];
            
            if (orgIds.length === 0) {
              router.push("/browse-clubs");
              return;
            }
            
            await fetchAllClubs(orgIds);
          } else {
            router.push("/browse-clubs");
          }
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        setError("Failed to load clubs");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const fetchAllClubs = async (organizationIds: string[]) => {
    if (!organizationIds || organizationIds.length === 0) {
      router.push("/browse-clubs");
      return;
    }
    
    try {
      const clubsList: Club[] = [];
      
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
      
      setClubs(clubsList);
      
      if (clubsList.length === 0) {
        router.push("/browse-clubs");
      }
    } catch (error) {
      console.error("Error fetching clubs:", error);
      setError("Failed to load club data.");
    }
  };

  const handleClubSelection = (club: Club) => {
    router.push(`/club/${club.id}/court-schedule`);
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        darkMode ? "bg-[#0a0a0a]" : "bg-white"
      }`}>
        <div className={`w-8 h-8 border-2 border-t-transparent rounded-full animate-spin ${
          darkMode ? "border-white" : "border-black"
        }`}></div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors ${
      darkMode ? "bg-[#0a0a0a]" : "bg-white"
    }`}>
      <PageTitle title="Select Club - Court Schedule - Courtly" />
      
      <header className={`py-6 px-6 ${
        darkMode ? "" : "border-b border-gray-100"
      }`}>
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center">
            <div>
              <h1 className={`text-3xl font-light tracking-tight ${
                darkMode ? "text-white" : "text-gray-900"
              }`}>
                Court Schedule
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <DarkModeToggle darkMode={darkMode} setDarkMode={setDarkMode} />
              <Link
                href="/dashboard"
                className={`text-sm font-light ${
                  darkMode
                    ? "text-gray-400 hover:text-white"
                    : "text-gray-500 hover:text-gray-900"
                } transition-colors`}
              >
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="mb-8">
          <h2 className={`text-xl sm:text-2xl font-light mb-2 ${
            darkMode ? "text-white" : "text-gray-900"
          }`}>
            Select a Club
          </h2>
          <p className={`text-sm font-light ${
            darkMode ? "text-gray-500" : "text-gray-500"
          }`}>
            Choose which club's schedule you'd like to view
          </p>
        </div>

        {error && (
          <div className={`mb-6 p-4 rounded font-light text-sm ${
            darkMode ? "bg-red-900/20 text-red-400" : "bg-red-50 text-red-600"
          }`}>
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {clubs.map((club) => (
            <button
              key={club.id}
              onClick={() => handleClubSelection(club)}
              className={`p-6 text-left border transition-all ${
                darkMode
                  ? "border-[#1a1a1a] hover:border-white"
                  : "border-gray-200 hover:border-black"
              }`}
            >
              <h3 className={`text-lg font-light mb-2 ${
                darkMode ? "text-white" : "text-gray-900"
              }`}>
                {club.name}
              </h3>
              {club.city && club.state && (
                <p className={`text-xs font-light ${
                  darkMode ? "text-gray-500" : "text-gray-500"
                }`}>
                  {club.city}, {club.state}
                </p>
              )}
            </button>
          ))}
        </div>

        <div className="mt-8">
          <Link
            href="/browse-clubs"
            className={`inline-block px-6 py-3 text-sm font-light border transition-colors ${
              darkMode
                ? "border-white text-white hover:bg-white hover:text-black"
                : "border-black text-black hover:bg-black hover:text-white"
            }`}
          >
            Browse More Clubs
          </Link>
        </div>
      </div>
    </div>
  );
}
