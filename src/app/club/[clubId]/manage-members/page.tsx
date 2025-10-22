"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { db, auth } from "../../../../../firebase";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  updateDoc,
  setDoc,
  deleteDoc,
  serverTimestamp
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import PageTitle from "@/app/components/PageTitle";

interface MemberRequest {
  id: string;
  userId: string;
  clubId: string;
  clubName: string;
  userEmail: string;
  status: string;
  createdAt: string;
  requestedAt: any;
}

interface Member {
  id: string;
  email: string;
  name?: string;
  userType: string;
  joinedAt?: string;
  organization: string | string[];
  membershipStatus?: "active" | "expired" | "none";
  membershipTier?: "monthly" | "annual" | "day_pass" | string;
  membershipEndDate?: Date;
}

type TabType = "members" | "requests";

export default function ManageMembersPage() {
  const params = useParams();
  const router = useRouter();
  const clubId = params.clubId as string;
  
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("members");
  
  // Members state
  const [members, setMembers] = useState<Member[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
  
  // Requests state
  const [requests, setRequests] = useState<MemberRequest[]>([]);
  
  // Shared state
  const [clubName, setClubName] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    const savedMode = localStorage.getItem("darkMode");
    if (savedMode === "true") {
      setDarkMode(true);
    }
  }, []);

  // Check if user is admin of this club
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push(`/club/${clubId}`);
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const organization = userData.organization;
          const userType = userData.userType;
          
          // Check if user is admin or courtly admin
          const isCourtlyAdmin = userType === 'courtly';
          const isClubAdmin = userType === 'admin' && (
            (Array.isArray(organization) && organization.includes(clubId)) ||
            organization === clubId
          );
          
          if (isCourtlyAdmin || isClubAdmin) {
            setIsAdmin(true);
          } else {
            setError("You don't have permission to view this page.");
            setTimeout(() => router.push(`/club/${clubId}`), 2000);
          }
        } else {
          setError("User data not found.");
          setTimeout(() => router.push(`/club/${clubId}`), 2000);
        }
      } catch (error) {
        console.error("Error checking permissions:", error);
        setError("Failed to verify permissions.");
      }
    });

    return () => unsubscribe();
  }, [clubId, router]);

  // Fetch club data, members, and requests
  useEffect(() => {
    if (!isAdmin) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch club name from orgs
        const clubDoc = await getDoc(doc(db, "orgs", clubId));
        if (clubDoc.exists()) {
          setClubName(clubDoc.data().name || "Unknown Club");
        }

        // Fetch all members of this club
        const usersSnapshot = await getDocs(collection(db, "users"));
        const membersData: Member[] = [];
        
        for (const userDoc of usersSnapshot.docs) {
          const data = userDoc.data();
          const organization = data.organization;
          
          // Check if user belongs to this club
          const isMember = Array.isArray(organization) 
            ? organization.includes(clubId)
            : organization === clubId;
            
          if (isMember) {
            // Fetch membership data from /orgs/{clubId}/memberships/{userId}
            let membershipStatus: "active" | "expired" | "none" = "none";
            let membershipTier: string | undefined;
            let membershipEndDate: Date | undefined;
            
            try {
              const membershipDoc = await getDoc(doc(db, "orgs", clubId, "memberships", userDoc.id));
              if (membershipDoc.exists()) {
                const membershipData = membershipDoc.data();
                membershipStatus = membershipData.status || "none";
                membershipTier = membershipData.tier;
                membershipEndDate = membershipData.endDate?.toDate();
              }
            } catch (error) {
              console.error(`Error fetching membership for ${userDoc.id}:`, error);
            }
            
            membersData.push({
              id: userDoc.id,
              email: data.email || "No email",
              name: data.name || data.displayName,
              userType: data.userType || "member",
              joinedAt: data.createdAt,
              organization: data.organization,
              membershipStatus,
              membershipTier,
              membershipEndDate
            });
          }
        }
        
        // Sort members by email
        membersData.sort((a, b) => a.email.localeCompare(b.email));
        setMembers(membersData);
        setFilteredMembers(membersData);

        // Fetch all pending requests for this club
        const requestsQuery = query(
          collection(db, "clubJoinRequests"),
          where("clubId", "==", clubId),
          where("status", "==", "pending")
        );
        
        const requestsSnapshot = await getDocs(requestsQuery);
        const requestsData: MemberRequest[] = [];
        
        requestsSnapshot.forEach((doc) => {
          const data = doc.data();
          requestsData.push({
            id: doc.id,
            userId: data.userId,
            clubId: data.clubId,
            clubName: data.clubName,
            userEmail: data.userEmail,
            status: data.status,
            createdAt: data.createdAt,
            requestedAt: data.requestedAt
          });
        });
        
        // Sort by date (newest first)
        requestsData.sort((a, b) => {
          const dateA = a.requestedAt?.toDate?.() || new Date(a.createdAt);
          const dateB = b.requestedAt?.toDate?.() || new Date(b.createdAt);
          return dateB.getTime() - dateA.getTime();
        });
        
        setRequests(requestsData);
      } catch (error) {
        console.error("Error fetching data:", error);
        setError("Failed to load members and requests.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [clubId, isAdmin]);

  // Filter members by search term
  useEffect(() => {
    const filtered = members.filter(member =>
      member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (member.name && member.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setFilteredMembers(filtered);
  }, [searchTerm, members]);

  const handleApproveRequest = async (requestId: string, userId: string, userEmail: string) => {
    setProcessingId(requestId);
    setError("");
    setSuccessMessage("");

    try {
      // Step 1: Add user to club members (update user's organization field)
      const userDocRef = doc(db, "users", userId);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const currentOrg = userData.organization || [];
        
        // Ensure organization is an array and add clubId if not already present
        let updatedOrg: string[];
        if (Array.isArray(currentOrg)) {
          updatedOrg = currentOrg.includes(clubId) ? currentOrg : [...currentOrg, clubId];
        } else if (typeof currentOrg === 'string') {
          // Convert string to array
          updatedOrg = currentOrg === clubId ? [currentOrg] : [currentOrg, clubId];
        } else {
          updatedOrg = [clubId];
        }
        
        await updateDoc(userDocRef, {
          organization: updatedOrg,
          userType: userData.userType || 'member',
          updatedAt: serverTimestamp()
        });

        // Add to members list immediately
        setMembers(prev => [...prev, {
          id: userId,
          email: userEmail,
          name: userData.name || userData.displayName,
          userType: userData.userType || 'member',
          joinedAt: new Date().toISOString(),
          organization: updatedOrg
        }]);
      }

      // Step 2: Delete the request
      await deleteDoc(doc(db, "clubJoinRequests", requestId));

      setSuccessMessage(`Approved membership for ${userEmail}`);
      
      // Remove from requests list
      setRequests(prev => prev.filter(req => req.id !== requestId));
      
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (error) {
      console.error("Error approving request:", error);
      setError("Failed to approve request. Please try again.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeclineRequest = async (requestId: string, userEmail: string) => {
    setProcessingId(requestId);
    setError("");
    setSuccessMessage("");

    try {
      // Delete the request
      await deleteDoc(doc(db, "clubJoinRequests", requestId));

      setSuccessMessage(`Declined membership request from ${userEmail}`);
      
      // Remove from list
      setRequests(prev => prev.filter(req => req.id !== requestId));
      
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (error) {
      console.error("Error declining request:", error);
      setError("Failed to decline request. Please try again.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleRemoveMember = async (memberId: string, memberEmail: string) => {
    if (!confirm(`Are you sure you want to remove ${memberEmail} from this club?`)) {
      return;
    }

    setProcessingId(memberId);
    setError("");
    setSuccessMessage("");

    try {
      const userDocRef = doc(db, "users", memberId);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const currentOrg = userData.organization || [];
        
        // Remove clubId from organization array
        let updatedOrg: string[];
        if (Array.isArray(currentOrg)) {
          updatedOrg = currentOrg.filter(id => id !== clubId);
        } else if (currentOrg === clubId) {
          updatedOrg = [];
        } else {
          updatedOrg = [currentOrg];
        }
        
        await updateDoc(userDocRef, {
          organization: updatedOrg,
          updatedAt: serverTimestamp()
        });
      }

      setSuccessMessage(`Removed ${memberEmail} from the club`);
      
      // Remove from members list
      setMembers(prev => prev.filter(member => member.id !== memberId));
      
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (error) {
      console.error("Error removing member:", error);
      setError("Failed to remove member. Please try again.");
    } finally {
      setProcessingId(null);
    }
  };

  const handlePromoteToAdmin = async (memberId: string, memberEmail: string) => {
    if (!confirm(`Are you sure you want to make ${memberEmail} an admin of this club?`)) {
      return;
    }

    setProcessingId(memberId);
    setError("");
    setSuccessMessage("");

    try {
      await updateDoc(doc(db, "users", memberId), {
        userType: "admin",
        updatedAt: serverTimestamp()
      });

      setSuccessMessage(`${memberEmail} is now an admin`);
      
      // Update in members list
      setMembers(prev => prev.map(member => 
        member.id === memberId ? { ...member, userType: "admin" } : member
      ));
      
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (error) {
      console.error("Error promoting member:", error);
      setError("Failed to promote member. Please try again.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDemoteToMember = async (memberId: string, memberEmail: string) => {
    if (!confirm(`Are you sure you want to remove admin privileges from ${memberEmail}?`)) {
      return;
    }

    setProcessingId(memberId);
    setError("");
    setSuccessMessage("");

    try {
      await updateDoc(doc(db, "users", memberId), {
        userType: "member",
        updatedAt: serverTimestamp()
      });

      setSuccessMessage(`${memberEmail} is now a regular member`);
      
      // Update in members list
      setMembers(prev => prev.map(member => 
        member.id === memberId ? { ...member, userType: "member" } : member
      ));
      
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (error) {
      console.error("Error demoting member:", error);
      setError("Failed to demote member. Please try again.");
    } finally {
      setProcessingId(null);
    }
  };

  const handlePromoteToCoach = async (memberId: string, memberEmail: string) => {
    if (!confirm(`Are you sure you want to make ${memberEmail} a coach? Coaches can reserve courts without restrictions.`)) {
      return;
    }

    setProcessingId(memberId);
    setError("");
    setSuccessMessage("");

    try {
      // Update user type to coach
      await updateDoc(doc(db, "users", memberId), {
        userType: "coach",
        updatedAt: serverTimestamp()
      });

      // Add to coaches collection with default pricing
      await setDoc(doc(db, `orgs/${clubId}/coaches`, memberId), {
        userId: memberId,
        email: memberEmail,
        name: memberEmail, // Will be updated when coach sets their profile
        hourlyRate: 50, // Default hourly rate - can be changed by admin
        isActive: true,
        specialties: [],
        bio: "",
        phone: "",
        profileImage: "",
        age: null,
        gender: null,
        birthday: null,
        availability: {
          monday: { start: "09:00", end: "17:00", available: true },
          tuesday: { start: "09:00", end: "17:00", available: true },
          wednesday: { start: "09:00", end: "17:00", available: true },
          thursday: { start: "09:00", end: "17:00", available: true },
          friday: { start: "09:00", end: "17:00", available: true },
          saturday: { start: "09:00", end: "17:00", available: true },
          sunday: { start: "09:00", end: "17:00", available: true }
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      setSuccessMessage(`${memberEmail} is now a coach with unrestricted booking privileges. Default hourly rate set to $50.`);
      
      // Update in members list
      setMembers(prev => prev.map(member => 
        member.id === memberId ? { ...member, userType: "coach" } : member
      ));
      
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (error) {
      console.error("Error promoting to coach:", error);
      setError("Failed to promote to coach. Please try again.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDemoteFromCoach = async (memberId: string, memberEmail: string) => {
    if (!confirm(`Are you sure you want to remove coach status from ${memberEmail}?`)) {
      return;
    }

    setProcessingId(memberId);
    setError("");
    setSuccessMessage("");

    try {
      await updateDoc(doc(db, "users", memberId), {
        userType: "member",
        updatedAt: serverTimestamp()
      });

      setSuccessMessage(`${memberEmail} is now a regular member`);
      
      // Update in members list
      setMembers(prev => prev.map(member => 
        member.id === memberId ? { ...member, userType: "member" } : member
      ));
      
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (error) {
      console.error("Error demoting from coach:", error);
      setError("Failed to demote from coach. Please try again.");
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors duration-300 ${
        darkMode ? "bg-[#0a0a0a] text-white" : "bg-white text-gray-900"
      }`}>
        <div className="text-center">
          <div className={`w-12 h-12 border-2 ${
            darkMode ? "border-white" : "border-black"
          } border-t-transparent rounded-full animate-spin mx-auto mb-4`}></div>
          <p className="font-light">Loading members...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors duration-300 ${
        darkMode ? "bg-[#0a0a0a] text-white" : "bg-white text-gray-900"
      }`}>
        <div className="text-center">
          <h1 className="text-2xl font-light mb-4">Access Denied</h1>
          <p className="font-light mb-4">{error || "You don't have permission to view this page."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      darkMode ? "bg-[#0a0a0a] text-white" : "bg-white text-gray-900"
    }`}>
      <PageTitle title={`Manage Members - ${clubName} - Courtly`} />
      
      {/* Minimalist Header */}
      <header className={`border-b transition-colors duration-300 ${
        darkMode ? 'border-[#1a1a1a]' : 'border-gray-100'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <Link href="/dashboard" className="text-lg font-light">Courtly</Link>
            <span className={`text-sm font-light ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>/</span>
            <Link href={`/club/${clubId}`} className={`text-sm font-light transition-colors duration-200 ${
              darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-black'
            }`}>
              {clubName}
            </Link>
            <span className={`text-sm font-light ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>/</span>
            <h1 className="text-sm font-light">Manage Members</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={() => {
                const newMode = !darkMode;
                setDarkMode(newMode);
                localStorage.setItem('darkMode', newMode ? 'true' : 'false');
              }}
              className={`p-2 transition-colors duration-200 ${
                darkMode ? "hover:bg-[#1a1a1a]" : "hover:bg-gray-100"
              }`}
              aria-label="Toggle dark mode"
            >
              {darkMode ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Success/Error Messages */}
        {successMessage && (
          <div className={`mb-8 px-4 py-3 border font-light text-sm ${
            darkMode ? 'border-green-900/50 bg-green-950/20 text-green-400' : 'border-green-200 bg-green-50 text-green-600'
          }`}>
            {successMessage}
          </div>
        )}
        {error && (
          <div className={`mb-8 px-4 py-3 border font-light text-sm ${
            darkMode ? 'border-red-900/50 bg-red-950/20 text-red-400' : 'border-red-200 bg-red-50 text-red-600'
          }`}>
            {error}
          </div>
        )}
        
        {/* Tabs */}
        <div className="mb-8 flex gap-4 border-b transition-colors duration-300"
          style={{
            borderColor: darkMode ? '#1a1a1a' : 'rgb(243 244 246)'
          }}>
          <button
            onClick={() => setActiveTab("members")}
            className={`px-6 py-3 font-light text-sm transition-colors duration-200 ${
              activeTab === "members"
                ? `border-b-2 ${darkMode ? 'border-white text-white' : 'border-black text-black'}`
                : `${darkMode ? 'text-gray-600 hover:text-gray-400' : 'text-gray-400 hover:text-gray-600'}`
            }`}
          >
            Members ({members.length})
          </button>
          <button
            onClick={() => setActiveTab("requests")}
            className={`px-6 py-3 font-light text-sm transition-colors duration-200 ${
              activeTab === "requests"
                ? `border-b-2 ${darkMode ? 'border-white text-white' : 'border-black text-black'}`
                : `${darkMode ? 'text-gray-600 hover:text-gray-400' : 'text-gray-400 hover:text-gray-600'}`
            }`}
          >
            Pending Requests ({requests.length})
          </button>
        </div>

        {/* Members Tab */}
        {activeTab === "members" && (
          <div>
            {/* Search Bar */}
            <div className="mb-8">
              <label htmlFor="search" className={`block text-xs font-light uppercase tracking-wider mb-2 ${
                darkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Search Members
              </label>
              <input
                id="search"
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full px-4 py-3 border font-light transition-colors duration-200 ${
                  darkMode
                    ? "bg-[#0a0a0a] border-[#1a1a1a] text-white placeholder-gray-600 focus:border-gray-600"
                    : "bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-gray-400"
                } focus:outline-none`}
              />
            </div>

            {/* Members List */}
            {filteredMembers.length > 0 ? (
              <div className={`border ${
                darkMode ? "border-[#1a1a1a]" : "border-gray-100"
              }`}>
                <div className={`px-6 py-4 border-b ${
                  darkMode ? 'border-[#1a1a1a]' : 'border-gray-100'
                }`}>
                  <h2 className="text-sm font-light uppercase tracking-wider">
                    All Members ({filteredMembers.length})
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className={darkMode ? "bg-[#0a0a0a]" : "bg-white"}>
                      <tr>
                        <th scope="col" className={`px-6 py-4 text-left text-xs font-light uppercase tracking-wider ${
                          darkMode ? 'text-gray-600' : 'text-gray-400'
                        }`}>
                          Email
                        </th>
                        <th scope="col" className={`px-6 py-4 text-left text-xs font-light uppercase tracking-wider ${
                          darkMode ? 'text-gray-600' : 'text-gray-400'
                        }`}>
                          Name
                        </th>
                        <th scope="col" className={`px-6 py-4 text-left text-xs font-light uppercase tracking-wider ${
                          darkMode ? 'text-gray-600' : 'text-gray-400'
                        }`}>
                          Role
                        </th>
                        <th scope="col" className={`px-6 py-4 text-left text-xs font-light uppercase tracking-wider ${
                          darkMode ? 'text-gray-600' : 'text-gray-400'
                        }`}>
                          Membership
                        </th>
                        <th scope="col" className={`px-6 py-4 text-right text-xs font-light uppercase tracking-wider ${
                          darkMode ? 'text-gray-600' : 'text-gray-400'
                        }`}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className={`${
                      darkMode ? "divide-y divide-[#1a1a1a]" : "divide-y divide-gray-100"
                    }`}>
                      {filteredMembers.map((member) => (
                        <tr key={member.id} className={`transition-colors duration-200 ${
                          darkMode ? "hover:bg-[#0f0f0f]" : "hover:bg-gray-50"
                        }`}>
                          <td className="px-6 py-4">
                            <div className="font-light">{member.email}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-light">{member.name || "-"}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 border text-xs font-light uppercase tracking-wider ${
                              member.userType === "admin"
                                ? (darkMode ? "border-purple-900/50 text-purple-400" : "border-purple-200 text-purple-600")
                                : member.userType === "coach"
                                ? (darkMode ? "border-green-900/50 text-green-400" : "border-green-200 text-green-600")
                                : member.userType === "courtly"
                                ? (darkMode ? "border-yellow-900/50 text-yellow-400" : "border-yellow-200 text-yellow-600")
                                : (darkMode ? "border-blue-900/50 text-blue-400" : "border-blue-200 text-blue-600")
                            }`}>
                              {member.userType === "courtly" ? "Courtly Admin" : member.userType}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {member.membershipStatus === "active" ? (
                              <div className="flex flex-col gap-1">
                                <span className={`inline-flex items-center px-3 py-1 border text-xs font-light uppercase tracking-wider ${
                                  darkMode ? "border-green-900/50 text-green-400" : "border-green-200 text-green-600"
                                }`}>
                                  Active • {member.membershipTier}
                                </span>
                                {member.membershipEndDate && (
                                  <span className={`text-xs font-light ${
                                    darkMode ? "text-gray-600" : "text-gray-400"
                                  }`}>
                                    Until {member.membershipEndDate.toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            ) : member.membershipStatus === "expired" ? (
                              <span className={`inline-flex items-center px-3 py-1 border text-xs font-light uppercase tracking-wider ${
                                darkMode ? "border-gray-800 text-gray-600" : "border-gray-200 text-gray-500"
                              }`}>
                                Expired
                              </span>
                            ) : (
                              <span className={`inline-flex items-center px-3 py-1 border text-xs font-light uppercase tracking-wider ${
                                darkMode ? "border-gray-800 text-gray-600" : "border-gray-200 text-gray-500"
                              }`}>
                                No Membership
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right text-sm font-light whitespace-nowrap">
                            <div className="flex justify-end gap-4">
                              {member.userType === "member" && (
                                <>
                                  <button
                                    onClick={() => handlePromoteToAdmin(member.id, member.email)}
                                    disabled={processingId === member.id}
                                    className={`underline hover:no-underline transition-colors duration-200 ${
                                      processingId === member.id
                                        ? (darkMode ? "text-gray-600" : "text-gray-400")
                                        : (darkMode ? "text-purple-400" : "text-purple-600")
                                    }`}
                                  >
                                    Make Admin
                                  </button>
                                  <button
                                    onClick={() => handlePromoteToCoach(member.id, member.email)}
                                    disabled={processingId === member.id}
                                    className={`underline hover:no-underline transition-colors duration-200 ${
                                      processingId === member.id
                                        ? (darkMode ? "text-gray-600" : "text-gray-400")
                                        : (darkMode ? "text-green-400" : "text-green-600")
                                    }`}
                                  >
                                    Make Coach
                                  </button>
                                </>
                              )}
                              {member.userType === "admin" && (
                                <button
                                  onClick={() => handleDemoteToMember(member.id, member.email)}
                                  disabled={processingId === member.id}
                                  className={`underline hover:no-underline transition-colors duration-200 ${
                                    processingId === member.id
                                      ? (darkMode ? "text-gray-600" : "text-gray-400")
                                      : (darkMode ? "text-yellow-400" : "text-yellow-600")
                                  }`}
                                >
                                  Remove Admin
                                </button>
                              )}
                              {member.userType === "coach" && (
                                <button
                                  onClick={() => handleDemoteFromCoach(member.id, member.email)}
                                  disabled={processingId === member.id}
                                  className={`underline hover:no-underline transition-colors duration-200 ${
                                    processingId === member.id
                                      ? (darkMode ? "text-gray-600" : "text-gray-400")
                                      : (darkMode ? "text-yellow-400" : "text-yellow-600")
                                  }`}
                                >
                                  Remove Coach
                                </button>
                              )}
                              {member.userType !== "courtly" && (
                                <button
                                  onClick={() => handleRemoveMember(member.id, member.email)}
                                  disabled={processingId === member.id}
                                  className={`underline hover:no-underline transition-colors duration-200 ${
                                    processingId === member.id
                                      ? (darkMode ? "text-gray-600" : "text-gray-400")
                                      : (darkMode ? "text-red-400" : "text-red-600")
                                  }`}
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className={`p-12 border text-center ${
                darkMode ? "border-[#1a1a1a]" : "border-gray-100"
              }`}>
                <p className={`font-light ${darkMode ? "text-gray-600" : "text-gray-400"}`}>
                  {searchTerm ? "No members found matching your search." : "No members yet."}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Requests Tab */}
        {activeTab === "requests" && (
          <div>
            {requests.length > 0 ? (
              <div className={`border ${
                darkMode ? "border-[#1a1a1a]" : "border-gray-100"
              }`}>
                <div className={`px-6 py-4 border-b ${
                  darkMode ? 'border-[#1a1a1a]' : 'border-gray-100'
                }`}>
                  <h2 className="text-sm font-light uppercase tracking-wider">
                    Pending Requests ({requests.length})
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className={darkMode ? "bg-[#0a0a0a]" : "bg-white"}>
                      <tr>
                        <th scope="col" className={`px-6 py-4 text-left text-xs font-light uppercase tracking-wider ${
                          darkMode ? 'text-gray-600' : 'text-gray-400'
                        }`}>
                          Email
                        </th>
                        <th scope="col" className={`px-6 py-4 text-left text-xs font-light uppercase tracking-wider ${
                          darkMode ? 'text-gray-600' : 'text-gray-400'
                        }`}>
                          Requested On
                        </th>
                        <th scope="col" className={`px-6 py-4 text-right text-xs font-light uppercase tracking-wider ${
                          darkMode ? 'text-gray-600' : 'text-gray-400'
                        }`}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className={`${
                      darkMode ? "divide-y divide-[#1a1a1a]" : "divide-y divide-gray-100"
                    }`}>
                      {requests.map((request) => (
                        <tr key={request.id} className={`transition-colors duration-200 ${
                          darkMode ? "hover:bg-[#0f0f0f]" : "hover:bg-gray-50"
                        }`}>
                          <td className="px-6 py-4">
                            <div className="font-light">{request.userEmail}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-light">{new Date(request.createdAt).toLocaleDateString()}</div>
                          </td>
                          <td className="px-6 py-4 text-right text-sm font-light whitespace-nowrap">
                            <div className="flex justify-end gap-4">
                              <button
                                onClick={() => handleApproveRequest(request.id, request.userId, request.userEmail)}
                                disabled={processingId === request.id}
                                className={`underline hover:no-underline transition-colors duration-200 ${
                                  processingId === request.id
                                    ? (darkMode ? "text-gray-600" : "text-gray-400")
                                    : (darkMode ? "text-green-400" : "text-green-600")
                                }`}
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleDeclineRequest(request.id, request.userEmail)}
                                disabled={processingId === request.id}
                                className={`underline hover:no-underline transition-colors duration-200 ${
                                  processingId === request.id
                                    ? (darkMode ? "text-gray-600" : "text-gray-400")
                                    : (darkMode ? "text-red-400" : "text-red-600")
                                }`}
                              >
                                Decline
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className={`p-12 border text-center ${
                darkMode ? "border-[#1a1a1a]" : "border-gray-100"
              }`}>
                <p className={`font-light ${darkMode ? "text-gray-600" : "text-gray-400"}`}>
                  No pending membership requests.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
