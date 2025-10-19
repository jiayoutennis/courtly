"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { db, auth } from "../../../../firebase";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import PageTitle from "@/app/components/PageTitle";

// Define types
interface ClubInfo {
  id: string;
  name: string;
  email: string;
  phone?: string;
  website?: string;
  address?: string;
  city: string;
  state: string;
  zip?: string;
  description?: string;
  courts?: number;
  courtType?: string;
}

export default function PublicClubPage() {
  const params = useParams();
  const clubId = params.clubId as string;  
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [clubInfo, setClubInfo] = useState<ClubInfo | null>(null);
  const [error, setError] = useState("");
  const [isMember, setIsMember] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Initialize dark mode
  useEffect(() => {
    const savedMode = localStorage.getItem("darkMode");
    if (savedMode === "true") {
      setDarkMode(true);
    }
  }, []);

  // Check authentication and membership status
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        
        // Check if user is a member of this club by checking their organization field
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const organization = userData.organization;
            const userType = userData.userType;
            
            // Check if user is admin of this club or Courtly admin
            const isCourtlyAdmin = userType === 'courtly';
            const isClubAdmin = userType === 'admin' && (
              (Array.isArray(organization) && organization.includes(clubId)) ||
              organization === clubId
            );
            
            if (isCourtlyAdmin || isClubAdmin) {
              setIsAdmin(true);
            }
            
            // Check if the clubId is in the organization field (could be string or array)
            if (organization) {
              const isMemberOfClub = Array.isArray(organization)
                ? organization.includes(clubId)
                : organization === clubId;
              
              if (isMemberOfClub) {
                console.log("User is a member of this club");
                setIsMember(true);
              } else {
                console.log("User is NOT a member of this club");
                setIsMember(false);
              }
            } else {
              console.log("User has no organization field");
              setIsMember(false);
            }
          } else {
            console.log("User document not found");
            setIsMember(false);
          }
        } catch (error) {
          console.error("Error checking membership:", error);
          setIsMember(false);
        }
      } else {
        console.log("No user logged in");
        setCurrentUser(null);
        setIsMember(false);
      }
    });
    
    return () => unsubscribe();
  }, [clubId]);

  // Fetch all club data
  useEffect(() => {
    const fetchClubData = async () => {
      try {
        setLoading(true);
        
        // Fetch club information from orgs collection
        const clubDoc = await getDoc(doc(db, "orgs", clubId));
        
        if (!clubDoc.exists()) {
          setError("Club not found");
          setLoading(false);
          return;
        }
        
        const clubData = clubDoc.data();
        setClubInfo({
          id: clubDoc.id,
          name: clubData.name || "Unknown Club",
          email: clubData.email || "",
          phone: clubData.phone,
          website: clubData.website,
          address: clubData.address,
          city: clubData.city || "",
          state: clubData.state || "",
          zip: clubData.zip,
          description: clubData.description,
          courts: clubData.courts,
          courtType: clubData.courtType
        });
        
      } catch (error) {
        console.error("Error fetching club data:", error);
        setError("Failed to load club information");
      } finally {
        setLoading(false);
      }
    };
    
    if (clubId) {
      fetchClubData();
    }
  }, [clubId]);

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        darkMode ? "bg-[#0a0a0a] text-white" : "bg-white text-black"
      }`}>
        <div className="text-xs uppercase tracking-wider font-light">Loading...</div>
      </div>
    );
  }

  if (error || !clubInfo) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        darkMode ? "bg-[#0a0a0a] text-white" : "bg-white text-black"
      }`}>
        <div className="text-center">
          <h1 className="text-xs uppercase tracking-wider font-light mb-4">Club Not Found</h1>
          <p className="text-xs font-light mb-4">{error || "The club you're looking for doesn't exist."}</p>
          <Link
            href="/browse-clubs"
            className={`px-4 py-3 text-xs uppercase tracking-wider font-light transition ${
              darkMode
                ? "border border-white text-white hover:bg-white hover:text-black"
                : "border border-black text-black hover:bg-black hover:text-white"
            }`}
          >
            Browse Clubs
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      darkMode ? "bg-[#0a0a0a] text-white" : "bg-white text-black"
    }`}>
      <PageTitle title={`${clubInfo.name} - Courtly`} />
      
      {/* Header */}
      <header className={`py-6 px-4 ${
        darkMode ? "border-b border-[#1a1a1a]" : "border-b border-gray-100"
      }`}>
        <div className="container mx-auto">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xs uppercase tracking-wider font-light">{clubInfo.name}</h1>
              <p className={`mt-1 text-xs font-light ${darkMode ? "text-gray-500" : "text-gray-500"}`}>
                {[clubInfo.city, clubInfo.state].filter(Boolean).join(", ")}
              </p>
            </div>
            
            <Link
              href="/browse-clubs"
              className={`px-4 py-3 text-xs uppercase tracking-wider font-light transition ${
                darkMode
                  ? "border border-white text-white hover:bg-white hover:text-black"
                  : "border border-black text-black hover:bg-black hover:text-white"
              }`}
            >
              Back to Browse
            </Link>
          </div>
        </div>
      </header>
      
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Club Information */}
        <div className={`p-6 mb-8 border ${
          darkMode ? "border-[#1a1a1a]" : "border-gray-100"
        }`}>
          <h2 className="text-xs uppercase tracking-wider font-light mb-4">Club Information</h2>
          
          {clubInfo.description && (
            <p className={`mb-6 text-xs font-light ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
              {clubInfo.description}
            </p>
          )}
          
          <div className="space-y-4">
            {clubInfo.address && (
              <div>
                <h3 className="text-xs uppercase tracking-wider font-light mb-1">Address</h3>
                <p className={`text-xs font-light ${darkMode ? "text-gray-500" : "text-gray-500"}`}>
                  {clubInfo.address}<br />
                  {clubInfo.city}, {clubInfo.state} {clubInfo.zip}
                </p>
              </div>
            )}
            
            {clubInfo.phone && (
              <div>
                <h3 className="text-xs uppercase tracking-wider font-light mb-1">Phone</h3>
                <p className={`text-xs font-light ${darkMode ? "text-gray-500" : "text-gray-500"}`}>
                  {clubInfo.phone}
                </p>
              </div>
            )}
            
            {clubInfo.email && (
              <div>
                <h3 className="text-xs uppercase tracking-wider font-light mb-1">Email</h3>
                <p className={`text-xs font-light ${darkMode ? "text-gray-500" : "text-gray-500"}`}>
                  {clubInfo.email}
                </p>
              </div>
            )}
            
            {clubInfo.courts && (
              <div>
                <h3 className="text-xs uppercase tracking-wider font-light mb-1">Number of Courts</h3>
                <p className={`text-xs font-light ${darkMode ? "text-gray-500" : "text-gray-500"}`}>
                  {clubInfo.courts} {clubInfo.courts === 1 ? "Court" : "Courts"}
                </p>
              </div>
            )}
          </div>
        </div>
        
        {/* Website Link */}
        {clubInfo.website && (
          <div className={`p-6 mb-8 border ${
            darkMode ? "border-[#1a1a1a]" : "border-gray-100"
          }`}>
            <h3 className="text-xs uppercase tracking-wider font-light mb-4">For More Information</h3>
            <a
              href={clubInfo.website}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-block px-4 py-3 text-xs uppercase tracking-wider font-light transition ${
                darkMode
                  ? "border border-white text-white hover:bg-white hover:text-black"
                  : "border border-black text-black hover:bg-black hover:text-white"
              }`}
            >
              Visit {clubInfo.name} Website →
            </a>
          </div>
        )}
        
        {/* Admin Actions - Only shown to club admins */}
        {isAdmin && currentUser && (
          <div className={`p-6 mb-8 border ${
            darkMode ? "border-[#1a1a1a]" : "border-gray-100"
          }`}>
            <h2 className="text-xs uppercase tracking-wider font-light mb-4">Admin Actions</h2>
            <div className="space-y-3">
              <Link
                href={`/club/${clubId}/club-settings`}
                className={`block px-4 py-3 text-xs uppercase tracking-wider font-light text-center transition ${
                  darkMode
                    ? "border border-white text-white hover:bg-white hover:text-black"
                    : "border border-black text-black hover:bg-black hover:text-white"
                }`}
              >
                Club Settings
              </Link>
            </div>
          </div>
        )}
        
        {/* Member Actions - Only shown to members */}
        {isMember && currentUser && (
          <div className={`p-6 mb-8 border ${
            darkMode ? "border-[#1a1a1a]" : "border-gray-100"
          }`}>
            <h2 className="text-xs uppercase tracking-wider font-light mb-4">Member Actions</h2>
            <div className="space-y-3">
              <Link
                href={`/club/${clubId}/court-schedule`}
                className={`block px-4 py-3 text-xs uppercase tracking-wider font-light text-center transition ${
                  darkMode
                    ? "border border-white text-white hover:bg-white hover:text-black"
                    : "border border-black text-black hover:bg-black hover:text-white"
                }`}
              >
                View Court Schedule
              </Link>
              
              <Link
                href={`/club/${clubId}/my-bookings`}
                className={`block px-4 py-3 text-xs uppercase tracking-wider font-light text-center transition ${
                  darkMode
                    ? "border border-white text-white hover:bg-white hover:text-black"
                    : "border border-black text-black hover:bg-black hover:text-white"
                }`}
              >
                My Bookings
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
