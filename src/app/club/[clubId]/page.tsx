"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { db, auth } from "../../../../firebase";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
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
  const [coaches, setCoaches] = useState<Array<{id: string; name: string; email: string}>>([]);
  const [userMembership, setUserMembership] = useState<{
    tier: string;
    status: 'active' | 'past_due' | 'canceled' | 'incomplete';
    endDate: any;
    autoRenew: boolean;
  } | null>(null);

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

  // Fetch user's membership for this club
  useEffect(() => {
    const fetchUserMembership = async () => {
      if (!currentUser) {
        setUserMembership(null);
        return;
      }

      try {
        // Check for membership in org's memberships subcollection
        const membershipRef = doc(db, "orgs", clubId, "memberships", currentUser.uid);
        const membershipDoc = await getDoc(membershipRef);

        if (membershipDoc.exists()) {
          const membershipData = membershipDoc.data();
          setUserMembership({
            tier: membershipData.plan?.tier || membershipData.tier || 'unknown',
            status: membershipData.status || 'active',
            endDate: membershipData.endDate || membershipData.currentPeriodEnd,
            autoRenew: membershipData.autoRenew !== false
          });
        } else {
          setUserMembership(null);
        }
      } catch (error) {
        console.error("Error fetching user membership:", error);
        setUserMembership(null);
      }
    };

    if (clubId && currentUser) {
      fetchUserMembership();
    }
  }, [clubId, currentUser]);

  // Fetch coaches for this club
  useEffect(() => {
    const fetchCoaches = async () => {
      try {
        const q = query(
          collection(db, "users"),
          where("userType", "==", "coach"),
          where("organization", "array-contains", clubId)
        );
        
        const snapshot = await getDocs(q);
        const coachesData = snapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || doc.data().fullName || doc.data().email,
          email: doc.data().email
        }));
        
        setCoaches(coachesData);
      } catch (error) {
        console.error("Error fetching coaches:", error);
      }
    };

    if (clubId) {
      fetchCoaches();
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
        
        {/* Membership Status */}
        {currentUser && userMembership && (
          <div className={`p-6 mb-8 border ${
            darkMode ? "border-[#1a1a1a] bg-[#0a0a0a]" : "border-gray-100 bg-gray-50"
          }`}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xs uppercase tracking-wider font-light mb-2">Your Membership</h2>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-light ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                      Tier:
                    </span>
                    <span className={`text-xs font-medium uppercase tracking-wide ${
                      darkMode ? "text-white" : "text-black"
                    }`}>
                      {userMembership.tier === 'day_pass' ? 'Day Pass' : 
                       userMembership.tier === 'monthly' ? 'Monthly' : 
                       userMembership.tier === 'annual' ? 'Annual' : 
                       userMembership.tier}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-light ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                      Status:
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      userMembership.status === 'active'
                        ? (darkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-800')
                        : userMembership.status === 'past_due'
                          ? (darkMode ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-800')
                          : (darkMode ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-800')
                    }`}>
                      {userMembership.status.toUpperCase()}
                    </span>
                  </div>
                  
                  {userMembership.endDate && (
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-light ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                        {userMembership.status === 'active' ? 'Renews' : 'Expires'}:
                      </span>
                      <span className={`text-xs ${darkMode ? "text-white" : "text-black"}`}>
                        {userMembership.endDate?.toDate ? 
                          userMembership.endDate.toDate().toLocaleDateString() : 
                          new Date(userMembership.endDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  
                  {userMembership.autoRenew && userMembership.status === 'active' && (
                    <div className="flex items-center gap-2">
                      <svg className={`w-4 h-4 ${darkMode ? "text-green-400" : "text-green-600"}`} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                      <span className={`text-xs font-light ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                        Auto-renew enabled
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              <Link
                href={`/club/${clubId}/membership`}
                className={`px-4 py-2 text-xs uppercase tracking-wider font-light transition ${
                  darkMode
                    ? "border border-white text-white hover:bg-white hover:text-black"
                    : "border border-black text-black hover:bg-black hover:text-white"
                }`}
              >
                View Plans
              </Link>
            </div>
            
            {userMembership.status === 'past_due' && (
              <div className={`mt-4 p-3 rounded border ${
                darkMode ? 'border-yellow-900/50 bg-yellow-900/20 text-yellow-400' : 'border-yellow-200 bg-yellow-50 text-yellow-800'
              }`}>
                <p className="text-xs">
                  Your membership payment is past due. Please update your payment method to continue enjoying member benefits.
                </p>
              </div>
            )}
          </div>
        )}
        
        {/* No Membership Prompt */}
        {currentUser && !userMembership && isMember && (
          <div className={`p-6 mb-8 border ${
            darkMode ? "border-[#1a1a1a]" : "border-gray-100"
          }`}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xs uppercase tracking-wider font-light mb-2">Become a Member</h2>
                <p className={`text-xs font-light ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                  Get exclusive access to court bookings, events, and special rates.
                </p>
              </div>
              
              <Link
                href={`/club/${clubId}/membership`}
                className={`px-4 py-2 text-xs uppercase tracking-wider font-light transition ${
                  darkMode
                    ? "bg-white text-black hover:bg-gray-200"
                    : "bg-black text-white hover:bg-gray-800"
                }`}
              >
                View Plans
              </Link>
            </div>
          </div>
        )}
        
        {/* Coaches */}
        {coaches.length > 0 && (
          <div className={`p-6 mb-8 border ${
            darkMode ? "border-[#1a1a1a]" : "border-gray-100"
          }`}>
            <h2 className="text-xs uppercase tracking-wider font-light mb-4">Coaches</h2>
            <div className="space-y-3">
              {coaches.map(coach => (
                <div key={coach.id} className="flex items-center gap-3">
                  <span className={`px-2 py-1 border text-xs font-light ${
                    darkMode 
                      ? "border-green-900/50 text-green-400" 
                      : "border-green-200 text-green-600"
                  }`}>
                    COACH
                  </span>
                  <div>
                    <p className="text-xs font-light">{coach.name}</p>
                    <p className={`text-xs font-light ${darkMode ? "text-gray-500" : "text-gray-500"}`}>
                      {coach.email}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
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
                href="/my-bookings"
                className={`block px-4 py-3 text-xs uppercase tracking-wider font-light text-center transition ${
                  darkMode
                    ? "border border-white text-white hover:bg-white hover:text-black"
                    : "border border-black text-black hover:bg-black hover:text-white"
                }`}
              >
                My Bookings
              </Link>
              
              <Link
                href={`/club/${clubId}/lessons`}
                className={`block px-4 py-3 text-xs uppercase tracking-wider font-light text-center transition ${
                  darkMode
                    ? "border border-white text-white hover:bg-white hover:text-black"
                    : "border border-black text-black hover:bg-black hover:text-white"
                }`}
              >
                Lessons & Classes
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
