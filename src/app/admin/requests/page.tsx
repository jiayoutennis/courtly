"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { auth, db } from '../../../../firebase';
import { 
  collection, doc, getDoc, getDocs, query, where, 
  updateDoc, deleteDoc, serverTimestamp, addDoc
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth'; // Import from firebase/auth instead
import Image from 'next/image';
import PageTitle from '../../components/PageTitle';

// Define types
type MemberRequest = {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  userPhone: string;
  message: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
  updatedAt?: any;
  clubId: string;
};

type UserProfile = {
  id: string;
  fullName?: string;
  email?: string;
  phone?: string;
  photoURL?: string;
  [key: string]: any;
};

// Format date for display
const formatDate = (timestamp: any) => {
  if (!timestamp) return "N/A";
  
  const date = timestamp instanceof Date 
    ? timestamp 
    : timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export default function MemberRequestsPage() {
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [clubName, setClubName] = useState('');
  
  const [memberRequests, setMemberRequests] = useState<MemberRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<MemberRequest[]>([]);
  const [userProfiles, setUserProfiles] = useState<{[key: string]: UserProfile}>({});
  const [filterStatus, setFilterStatus] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [selectedRequests, setSelectedRequests] = useState<string[]>([]); // For tracking selected request IDs
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [currentRequest, setCurrentRequest] = useState<MemberRequest | null>(null);
  
  const router = useRouter();

  // Initialize dark mode from localStorage
  useEffect(() => {
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode === 'true') {
      setDarkMode(true);
    }
  }, []);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('darkMode', newMode ? 'true' : 'false');
  };

  // Check if user is authorized
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      
      if (!currentUser) {
        // No user is signed in
        setIsAuthorized(false);
        router.push('/signin');
        return;
      }
      
      try {
        // Check if user has admin permissions
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          // Check if user is an admin or a courtly admin
          const isAdmin = userData.userType === 'admin' || userData.userType === 'courtly';
          
          if (isAdmin) {
            // User is authorized as a club admin
            setIsAuthorized(true);
            setUser({
              ...currentUser,
              ...userData
            });
            
            // Get club details if user is a club admin
            if (userData.userType === 'admin' && userData.organization) {
              try {
                // Support both string and array organization format
                const orgId = Array.isArray(userData.organization) 
                  ? userData.organization[0] 
                  : userData.organization;
                
                // Try to get club name from orgs collection first
                let clubDoc = await getDoc(doc(db, "orgs", orgId));
                if (clubDoc.exists()) {
                  setClubName(clubDoc.data().name || "Your Club");
                } else {
                  // Fallback to publicClubs if not found in orgs
                  clubDoc = await getDoc(doc(db, "publicClubs", orgId));
                  if (clubDoc.exists()) {
                    setClubName(clubDoc.data().name || "Your Club");
                  } else {
                    setClubName("Your Club");
                  }
                }
              } catch (err) {
                console.error("Error fetching club details:", err);
                setClubName("Your Club");
              }
            } else if (userData.userType === 'courtly') {
              // Courtly admins can see all requests
              setClubName("All Clubs");
            }
            
            // Fetch member requests - pass organization ID for club admins
            const orgId = Array.isArray(userData.organization) 
              ? userData.organization[0] 
              : userData.organization;
            console.log("Admin user data:", {
              userType: userData.userType,
              organization: userData.organization,
              orgId: orgId,
              uid: currentUser.uid
            });
            fetchMemberRequests(currentUser.uid, orgId, userData.userType);
          } else {
            // User is not a club admin
            setIsAuthorized(false);
            setError("You don't have club administrator permissions");
            router.push('/dashboard');
          }
        } else {
          // User document doesn't exist
          setIsAuthorized(false);
          setError("User profile not found");
          router.push('/signin');
        }
      } catch (err) {
        console.error("Error checking authorization:", err);
        setError("Failed to verify permissions. Please try again.");
        setIsAuthorized(false);
      } finally {
        setLoading(false);
      }
    });
    
    return () => unsubscribe();
  }, [router]);

  // Fetch member requests for this admin's club
  const fetchMemberRequests = async (adminId: string, organizationId?: string, userType?: string) => {
    try {
      setLoading(true);
      console.log("Fetching requests for admin:", adminId);
      console.log("Organization ID:", organizationId);
      console.log("User Type:", userType);
      
      // If user is a courtly admin, they can see all requests
      if (userType === 'courtly') {
        const requestsQuery = query(
          collection(db, "clubJoinRequests")
        );
        
        const querySnapshot = await getDocs(requestsQuery);
        const requests: MemberRequest[] = [];
        const userIds: string[] = [];
        
        console.log("Courtly admin - Query snapshot size:", querySnapshot.size);
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          requests.push({
            id: doc.id,
            userId: data.userId,
            userEmail: data.userEmail || "",
            userName: data.userName || "",
            userPhone: data.userPhone || "",
            message: data.message || "",
            status: data.status || "pending",
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            clubId: data.clubId
          });
          
          // Collect user IDs to fetch profiles
          if (data.userId) {
            userIds.push(data.userId);
          }
        });
        
        // Sort by createdAt in JavaScript (newest first)
        requests.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
          const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
          return dateB.getTime() - dateA.getTime();
        });
        
        setMemberRequests(requests);
        
        // Filter by default to show pending requests
        const pendingRequests = requests.filter(req => req.status === 'pending');
        setFilteredRequests(pendingRequests);
        
        // Fetch user profiles for additional details
        await fetchUserProfiles(userIds);
      } else if (organizationId) {
        // Regular club admin - only sees requests for their club
        const requestsQuery = query(
          collection(db, "clubJoinRequests"),
          where("clubId", "==", organizationId)
        );
        
        console.log("Club admin - Querying for clubId:", organizationId);
        
        const querySnapshot = await getDocs(requestsQuery);
        const requests: MemberRequest[] = [];
        const userIds: string[] = [];
        
        console.log("Club admin - Query snapshot size:", querySnapshot.size);
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          requests.push({
            id: doc.id,
            userId: data.userId,
            userEmail: data.userEmail || "",
            userName: data.userName || "",
            userPhone: data.userPhone || "",
            message: data.message || "",
            status: data.status || "pending",
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            clubId: data.clubId
          });
          
          // Collect user IDs to fetch profiles
          if (data.userId) {
            userIds.push(data.userId);
          }
        });
        
        // Sort by createdAt in JavaScript (newest first)
        requests.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
          const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
          return dateB.getTime() - dateA.getTime();
        });
        
        setMemberRequests(requests);
        
        // Filter by default to show pending requests
        const pendingRequests = requests.filter(req => req.status === 'pending');
        setFilteredRequests(pendingRequests);
        
        // Fetch user profiles for additional details
        await fetchUserProfiles(userIds);
      } else {
        setError("No club associated with this admin account");
        setMemberRequests([]);
        setFilteredRequests([]);
      }
      
    } catch (error) {
      console.error("Error fetching member requests:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      setError("Failed to load membership requests. Please check console for details.");
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch user profiles for additional information
  const fetchUserProfiles = async (userIds: string[]) => {
    if (!userIds.length) return;
    
    try {
      const uniqueUserIds = [...new Set(userIds)];
      const profiles: {[key: string]: UserProfile} = {};
      
      for (const userId of uniqueUserIds) {
        const userDoc = await getDoc(doc(db, "users", userId));
        if (userDoc.exists()) {
          profiles[userId] = {
            id: userId,
            ...userDoc.data()
          };
        }
      }
      
      setUserProfiles(profiles);
    } catch (error) {
      console.error("Error fetching user profiles:", error);
    }
  };
  
  // Handle request approval
  const handleApprove = async (request: MemberRequest) => {
    if (!confirm("Are you sure you want to approve this membership request?")) {
      return;
    }
    
    setLoading(true);
    
    try {
      // Step 1: Check if the user document exists first
      const userDocRef = doc(db, "users", request.userId);
      const userDocSnap = await getDoc(userDocRef);
      
      if (!userDocSnap.exists()) {
        setError(`Cannot approve: User document for ${request.userName} (ID: ${request.userId}) doesn't exist`);
        console.error(`User document doesn't exist: ${request.userId}`);
        setLoading(false);
        return;
      }
      
      console.log("Updating request status...");
      // Step 2: Delete the request instead of updating status
      try {
        await deleteDoc(doc(db, "clubJoinRequests", request.id));
        console.log("Request deleted successfully");
      } catch (error) {
        console.error("Error deleting request:", error);
        setError("Failed to delete request. You may not have permission.");
        setLoading(false);
        return;
      }
      
      console.log("Updating user organization...");
      // Step 3: Update user's organization field
      try {
        const userData = userDocSnap.data();
        const currentOrg = userData.organization || [];
        
        // Ensure organization is an array and add clubId if not already present
        let updatedOrg: string[];
        if (Array.isArray(currentOrg)) {
          updatedOrg = currentOrg.includes(request.clubId) ? currentOrg : [...currentOrg, request.clubId];
        } else if (typeof currentOrg === 'string') {
          // Convert string to array
          updatedOrg = currentOrg === request.clubId ? [currentOrg] : [currentOrg, request.clubId];
        } else {
          updatedOrg = [request.clubId];
        }
        
        console.log("Updating organization to:", updatedOrg);
        
        await updateDoc(userDocRef, {
          organization: updatedOrg,
          updatedAt: serverTimestamp()
        });
        console.log("User organization updated successfully");
      } catch (error) {
        console.error("Error updating user organization:", error);
        // Continue even if this fails - just note the issue
        console.warn("The request was approved, but user organization couldn't be updated");
      }
      
      // Update local state with proper type assertion
      const updatedRequests = memberRequests.map(req => {
        if (req.id === request.id) {
          return { 
            ...req, 
            status: "approved" as const,
            updatedAt: new Date() 
          };
        }
        return req;
      });
      
      setMemberRequests(updatedRequests);
      applyFilters(updatedRequests);
      setSuccess(`Successfully approved ${request.userName}'s membership request`);
      
    } catch (error) {
      console.error("Error in approval process:", error);
      setError("Failed to approve request: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setLoading(false);
    }
  };
  
  // Handle request rejection
  const handleReject = async (request: MemberRequest) => {
    if (!confirm("Are you sure you want to reject this membership request?")) {
      return;
    }
    
    setLoading(true);
    
    try {
      // Delete request instead of updating status
      await deleteDoc(doc(db, "clubJoinRequests", request.id));
      
      // Remove from local state
      const updatedRequests = memberRequests.filter(req => req.id !== request.id);
      
      setMemberRequests(updatedRequests);
      applyFilters(updatedRequests);
      setSuccess(`Successfully rejected ${request.userName}'s membership request`);
      
    } catch (error) {
      console.error("Error rejecting request:", error);
      setError("Failed to reject request. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  
  // Add these functions to handle request selection
  const toggleRequestSelection = (requestId: string) => {
    setSelectedRequests(prev => 
      prev.includes(requestId) 
        ? prev.filter(id => id !== requestId) 
        : [...prev, requestId]
    );
  };

  const selectAllVisibleRequests = () => {
    const allVisibleIds = filteredRequests.map(req => req.id);
    setSelectedRequests(allVisibleIds);
  };

  const clearSelection = () => {
    setSelectedRequests([]);
  };

  // For showing details of a specific request
  const showRequestDetails = (request: MemberRequest) => {
    setCurrentRequest(request);
    setIsDetailModalOpen(true);
  };

  // Batch approve/reject functions
  const batchApproveRequests = async () => {
    if (selectedRequests.length === 0) return;
    
    if (!confirm(`Are you sure you want to approve ${selectedRequests.length} selected requests?`)) {
      return;
    }
    
    setLoading(true);
    
    try {
      // Get the selected requests
      const requestsToApprove = memberRequests.filter(req => 
        selectedRequests.includes(req.id) && req.status === 'pending'
      );
      
      // Process each request
      for (const request of requestsToApprove) {
        await updateDoc(doc(db, "clubJoinRequests", request.id), {
          status: "approved",
          updatedAt: serverTimestamp()
        });
        
        // Update user's organization
        await updateDoc(doc(db, "users", request.userId), {
          organization: request.clubId,
          updatedAt: serverTimestamp()
        });
      }
      
      // Update local state
      const updatedRequests = memberRequests.map(req => {
        if (selectedRequests.includes(req.id) && req.status === 'pending') {
          return { 
            ...req, 
            status: "approved" as const,
            updatedAt: new Date() 
          };
        }
        return req;
      });
      
      setMemberRequests(updatedRequests);
      applyFilters(updatedRequests);
      setSuccess(`Successfully approved ${requestsToApprove.length} membership requests`);
      clearSelection();
    } catch (error) {
      console.error("Error batch approving requests:", error);
      setError("Failed to approve selected requests. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const batchRejectRequests = async () => {
    if (selectedRequests.length === 0) return;
    
    if (!confirm(`Are you sure you want to reject ${selectedRequests.length} selected requests?`)) {
      return;
    }
    
    setLoading(true);
    
    try {
      // Get the selected requests
      const requestsToReject = memberRequests.filter(req => 
        selectedRequests.includes(req.id) && req.status === 'pending'
      );
      
      // Delete each request
      for (const request of requestsToReject) {
        await deleteDoc(doc(db, "clubJoinRequests", request.id));
      }
      
      // Remove from local state
      const updatedRequests = memberRequests.filter(req => 
        !selectedRequests.includes(req.id)
      );
      
      setMemberRequests(updatedRequests);
      applyFilters(updatedRequests);
      setSuccess(`Successfully rejected ${requestsToReject.length} membership requests`);
      clearSelection();
    } catch (error) {
      console.error("Error batch rejecting requests:", error);
      setError("Failed to reject selected requests. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  
  // Apply filters (status & search)
  const applyFilters = (requests = memberRequests) => {
    let filtered = [...requests];
    
    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(req => req.status === filterStatus);
    }
    
    // Apply search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(req => 
        req.userName.toLowerCase().includes(term) ||
        req.userEmail.toLowerCase().includes(term)
      );
    }
    
    setFilteredRequests(filtered);
  };

  // Update filters when status changes
  useEffect(() => {
    applyFilters();
  }, [filterStatus]);
  
  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters();
  };
  
  // Debug function to help diagnose permission issues
  const debugAndFixPermissions = async () => {
    try {
      setError('');
      
      if (!auth.currentUser) {
        setError('No user is signed in. Please sign in first.');
        return;
      }
      
      const currentUserId = auth.currentUser.uid;
      console.log("Current user ID:", currentUserId);
      
      // Check current user's permissions
      const userDoc = await getDoc(doc(db, "users", currentUserId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        console.log("User data:", userData);
        console.log("User type:", userData.userType);
        console.log("Is admin?", userData.userType?.endsWith("Admin") || userData.isAdmin === true);
        console.log("Admin club ID:", userData.adminClubId);
        
        // Determine which club ID to use
        const clubIdToUse = userData.adminClubId || currentUserId;
        
        // Try to get ALL club join requests
        try {
          console.log("Attempting to get ALL club join requests");
          const allRequestsSnap = await getDocs(collection(db, "clubJoinRequests"));
          console.log(`Found ${allRequestsSnap.size} total join requests`);
          
          // Check if any exist with this club ID
          let matchingRequests = 0;
          allRequestsSnap.forEach(doc => {
            const data = doc.data();
            if (data.clubId === clubIdToUse) {
              matchingRequests++;
              console.log("Matching request found:", data);
            } else {
              console.log("Non-matching request:", {
                id: doc.id,
                clubId: data.clubId,
                expectedClubId: clubIdToUse,
                userId: data.userId
              });
            }
          });
          
          console.log(`Found ${matchingRequests} requests matching club ID: ${clubIdToUse}`);
          
          // If no requests exist, create a test request
          if (allRequestsSnap.size === 0 || matchingRequests === 0) {
            console.log(`Creating test request with clubId: ${clubIdToUse}`);
            
            const testRequest = {
              userId: "test-user-" + Date.now().toString(),
              userEmail: "test@example.com",
              userName: "Test User",
              message: "This is a test request created for debugging",
              status: "pending",
              createdAt: new Date(),
              clubId: clubIdToUse // Using the correct club ID
            };
            
            const docRef = await addDoc(collection(db, "clubJoinRequests"), testRequest);
            console.log("Test request created successfully with ID:", docRef.id);
            setSuccess(`Test request created with clubId: ${clubIdToUse}. Please click Refresh to see it.`);
            
            // Refresh the requests
            fetchMemberRequests(currentUserId, userData.adminClubId);
          }
        } catch (err) {
          console.error("Error in debug function:", err);
        }
      } else {
        console.log("User document not found!");
      }
    } catch (error) {
      console.error("Debug error:", error);
      setError("Debug function error: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  // Add this function
  const updateUserOrganization = async (userId: string, clubId: string) => {
    try {
      setLoading(true);
      setError("");
      
      // Just update the UI for now
      setSuccess(`User organization will be updated separately by a Courtly administrator.`);
      
      // Copy the user ID and club ID to clipboard for admin use
      const copyText = `User ID: ${userId}\nClub ID: ${clubId}`;
      navigator.clipboard.writeText(copyText)
        .then(() => {
          console.log("User and club IDs copied to clipboard");
          setSuccess(prev => prev + " IDs copied to clipboard!");
        })
        .catch(err => {
          console.error("Failed to copy: ", err);
        });
        
    } catch (error) {
      console.error("Error updating user organization:", error);
      setError("Failed to update user organization: " + 
        (error instanceof Error ? error.message : String(error)));
    } finally {
      setLoading(false);
    }
  };

  // Show loading screen
  if (loading && !isAuthorized) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors duration-300 ${
        darkMode ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"
      }`}>
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4">Verifying your club administrator access...</p>
        </div>
      </div>
    );
  }

  // If not authorized, show access denied
  if (!isAuthorized && !loading) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-4 transition-colors duration-300 ${
        darkMode ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"
      }`}>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-red-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
        <p className="mb-6 text-center">You don't have club administrator permissions to view membership requests.</p>
        <Link href="/dashboard" className={`py-2 px-4 rounded ${
          darkMode ? "bg-teal-600 hover:bg-teal-700" : "bg-green-500 hover:bg-green-600"
        } text-white transition-colors`}>
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-300 ${
      darkMode ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"
    }`}>
      <PageTitle title={`${clubName} Membership Requests - Courtly`} />
      
      {/* Header with back button */}
      <header className={`py-4 px-6 flex items-center border-b transition-colors ${
        darkMode ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"
      }`}>
        <Link href="/dashboard" className={`flex items-center text-sm font-medium mr-4 ${
          darkMode ? "text-gray-300 hover:text-white" : "text-gray-600 hover:text-gray-900"
        }`}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </Link>
        
        <h1 className="text-xl font-bold flex-1">{clubName} Membership Requests</h1>
        
        <button
          onClick={toggleDarkMode}
          className={`p-2 rounded-full ${darkMode 
            ? "bg-gray-700 text-teal-400 hover:bg-gray-600" 
            : "bg-gray-200 text-amber-500 hover:bg-gray-300"} transition-colors`}
          aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
        >
          {darkMode ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
            </svg>
          )}
        </button>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-100 text-red-700 flex items-start">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mt-0.5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>{error}</p>
          </div>
        )}
        
        {/* Success message */}
        {success && (
          <div className="mb-6 p-4 rounded-lg bg-green-100 text-green-700 flex items-start">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mt-0.5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p>{success}</p>
          </div>
        )}

        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-2">Membership Requests</h2>
          <p className={darkMode ? "text-gray-400" : "text-gray-600"}>
            Review and manage requests from players who want to join {clubName}.
          </p>
        </div>
        
        {/* Search and filter bar */}
        <div className="flex flex-col md:flex-row mb-6 space-y-4 md:space-y-0 md:space-x-4">
          <form onSubmit={handleSearch} className="flex flex-1">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or email..."
              className={`flex-1 px-4 py-2 rounded-l-lg border ${
                darkMode 
                  ? "bg-gray-800 border-gray-700 text-white placeholder-gray-400" 
                  : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
              } focus:outline-none focus:ring-2 ${
                darkMode ? "focus:ring-teal-500" : "focus:ring-green-500"
              }`}
            />
            <button
              type="submit"
              className={`px-4 py-2 rounded-r-lg ${
                darkMode 
                  ? "bg-gray-700 text-gray-300 hover:bg-gray-600" 
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </form>
          
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className={`px-4 py-2 rounded-lg border ${
              darkMode 
                ? "bg-gray-800 border-gray-700 text-white" 
                : "bg-white border-gray-300 text-gray-900"
            } focus:outline-none focus:ring-2 ${
              darkMode ? "focus:ring-teal-500" : "focus:ring-green-500"
            }`}
          >
            <option value="pending">Pending Requests</option>
            <option value="approved">Approved Requests</option>
            <option value="rejected">Rejected Requests</option>
            <option value="all">All Requests</option>
          </select>
          
          <div className="flex space-x-2">
            <button
              onClick={() => user && fetchMemberRequests(user.uid, user.adminClubId)}
              disabled={loading}
              className={`px-4 py-2 rounded-lg flex items-center ${
                darkMode 
                  ? "bg-blue-600 text-white hover:bg-blue-700" 
                  : "bg-blue-500 text-white hover:bg-blue-600"
              } transition-colors ${loading ? "opacity-70 cursor-not-allowed" : ""}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {loading ? "Refreshing..." : "Refresh"}
            </button>
            
            <button
              onClick={debugAndFixPermissions}
              className={`px-4 py-2 rounded-lg flex items-center ${
                darkMode 
                  ? "bg-yellow-600 text-white hover:bg-yellow-700" 
                  : "bg-yellow-500 text-white hover:bg-yellow-600"
              } transition-colors`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Debug
            </button>
          </div>
        </div>
        
        {/* Add batch action buttons below the search and filter bar */}
        <div className="flex justify-between items-center mb-4">
          {selectedRequests.length > 0 && (
            <div className="flex items-center space-x-4">
              <span className={`text-sm ${darkMode ? "text-gray-300" : "text-gray-600"}`}>
                {selectedRequests.length} {selectedRequests.length === 1 ? 'request' : 'requests'} selected
              </span>
              <button
                onClick={clearSelection}
                className={`px-3 py-1 text-sm rounded ${
                  darkMode 
                    ? "bg-gray-700 text-gray-300 hover:bg-gray-600" 
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                } transition-colors`}
              >
                Clear Selection
              </button>
              <button
                onClick={batchRejectRequests}
                disabled={loading}
                className={`px-3 py-1 text-sm rounded ${
                  darkMode 
                    ? "bg-red-600 text-white hover:bg-red-700" 
                    : "bg-red-500 text-white hover:bg-red-600"
                } transition-colors ${loading ? "opacity-70 cursor-not-allowed" : ""}`}
              >
                Reject Selected
              </button>
              <button
                onClick={batchApproveRequests}
                disabled={loading}
                className={`px-3 py-1 text-sm rounded ${
                  darkMode 
                    ? "bg-teal-600 text-white hover:bg-teal-700" 
                    : "bg-green-500 text-white hover:bg-green-600"
                } transition-colors ${loading ? "opacity-70 cursor-not-allowed" : ""}`}
              >
                Approve Selected
              </button>
            </div>
          )}
        </div>
        
        {/* Member requests table */}
        {loading && filteredRequests.length === 0 ? (
          <div className="bg-gray-100 rounded-lg p-8 text-center">
            <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading membership requests...</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className={`rounded-lg p-8 text-center ${
            darkMode ? "bg-gray-800" : "bg-gray-100"
          }`}>
            <div className="mx-auto w-24 h-24 flex items-center justify-center rounded-full bg-opacity-10 bg-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-12 w-12 ${
                darkMode ? "text-gray-500" : "text-gray-400"
              }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mt-4 mb-1">No membership requests found</h3>
            <p className={darkMode ? "text-gray-400" : "text-gray-600"}>
              There are no pending membership requests at this time.
            </p>
          </div>
        ) : (
          <div className={`overflow-x-auto rounded-lg border ${
            darkMode ? "border-gray-700" : "border-gray-200"
          }`}>
            <table className="min-w-full divide-y">
              <thead className={darkMode ? "bg-gray-800" : "bg-gray-50"}>
                <tr>
                  <th scope="col" className={`px-3 py-3 text-left ${
                    darkMode ? "text-gray-300" : "text-gray-500"
                  }`}>
                    <input
                      type="checkbox"
                      checked={filteredRequests.length > 0 && 
                        filteredRequests.every(req => selectedRequests.includes(req.id))}
                      onChange={() => {
                        if (filteredRequests.every(req => selectedRequests.includes(req.id))) {
                          clearSelection();
                        } else {
                          selectAllVisibleRequests();
                        }
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    darkMode ? "text-gray-300" : "text-gray-500"
                  }`}>
                    Member
                  </th>
                  <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    darkMode ? "text-gray-300" : "text-gray-500"
                  }`}>
                    Request Date
                  </th>
                  <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    darkMode ? "text-gray-300" : "text-gray-500"
                  }`}>
                    Status
                  </th>
                  <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    darkMode ? "text-gray-300" : "text-gray-500"
                  }`}>
                    Message
                  </th>
                  <th scope="col" className={`px-6 py-3 text-right text-xs font-medium uppercase tracking-wider ${
                    darkMode ? "text-gray-300" : "text-gray-500"
                  }`}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className={`divide-y ${
                darkMode ? "divide-gray-700" : "divide-gray-200"
              }`}>
                {filteredRequests.map((request) => (
                  <tr 
                    key={request.id} 
                    className={`${darkMode ? "bg-gray-800" : "bg-white"} ${
                      selectedRequests.includes(request.id) 
                        ? darkMode ? "bg-gray-700" : "bg-blue-50" 
                        : ""
                    } hover:${darkMode ? "bg-gray-700" : "bg-gray-50"} cursor-pointer`}
                    onClick={() => showRequestDetails(request)}
                  >
                    <td className="px-3 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedRequests.includes(request.id)}
                        onChange={() => toggleRequestSelection(request.id)}
                        onClick={(e) => e.stopPropagation()} // Prevent row click when clicking checkbox
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td 
                      className="px-6 py-4 whitespace-nowrap"
                      onClick={() => showRequestDetails(request)}
                    >
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          {userProfiles[request.userId]?.photoURL ? (
                            <Image
                              src={userProfiles[request.userId]?.photoURL || ''}
                              alt={request.userName}
                              width={40}
                              height={40}
                              className="rounded-full"
                            />
                          ) : (
                            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                              darkMode ? "bg-gray-700" : "bg-gray-200"
                            }`}>
                              <span className={`text-lg font-medium ${
                                darkMode ? "text-gray-300" : "text-gray-600"
                              }`}>
                                {request.userName.substring(0, 1).toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="ml-4">
                          <div className={`font-medium ${darkMode ? "text-white" : "text-gray-900"}`}>
                            {request.userName}
                          </div>
                          <div className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                            {request.userEmail}
                          </div>
                          {request.userPhone && (
                            <div className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                              {request.userPhone}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${
                      darkMode ? "text-gray-300" : "text-gray-500"
                    }`}>
                      {formatDate(request.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        request.status === 'pending' 
                          ? darkMode 
                            ? "bg-yellow-900 text-yellow-200" 
                            : "bg-yellow-100 text-yellow-800"
                          : request.status === 'approved'
                            ? darkMode 
                              ? "bg-green-900 text-green-200" 
                              : "bg-green-100 text-green-800"
                            : darkMode 
                              ? "bg-red-900 text-red-200" 
                              : "bg-red-100 text-red-800"
                      }`}>
                        {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                      </span>
                    </td>
                    <td className={`px-6 py-4 max-w-xs truncate text-sm ${
                      darkMode ? "text-gray-300" : "text-gray-500"
                    }`}>
                      {request.message || "No message provided"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {request.status === 'pending' ? (
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent row click event
                              handleApprove(request);
                            }}
                            disabled={loading}
                            className={`px-3 py-1 rounded ${
                              darkMode 
                                ? "bg-teal-600 text-white hover:bg-teal-700" 
                                : "bg-green-500 text-white hover:bg-green-600"
                            } transition-colors`}
                          >
                            Approve
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent row click event
                              handleReject(request);
                            }}
                            disabled={loading}
                            className={`px-3 py-1 rounded ${
                              darkMode 
                                ? "bg-red-600 text-white hover:bg-red-700" 
                                : "bg-red-500 text-white hover:bg-red-600"
                            } transition-colors`}
                          >
                            Reject
                          </button>
                        </div>
                      ) : request.status === 'approved' ? (
                        <span className={darkMode ? "text-gray-300" : "text-gray-600"}>
                          Approved {request.updatedAt ? `on ${formatDate(request.updatedAt)}` : ''}
                        </span>
                      ) : (
                        <span className={darkMode ? "text-gray-300" : "text-gray-600"}>
                          Rejected {request.updatedAt ? `on ${formatDate(request.updatedAt)}` : ''}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {/* Footer */}
      <footer className={`mt-auto py-4 text-center ${
        darkMode ? "text-gray-400" : "text-gray-600"
      }`}>
        <p className="text-sm">
          © {new Date().getFullYear()} Courtly by JiaYou Tennis. All rights reserved.
        </p>
      </footer>
      
      {/* Request Detail Modal */}
      <RequestDetailModal
        request={currentRequest}
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        onApprove={handleApprove}
        onReject={handleReject}
        userProfile={currentRequest ? userProfiles[currentRequest.userId] : undefined}
        darkMode={darkMode}
        loading={loading}
        onUpdateUserOrganization={updateUserOrganization} // Add this prop
      />
    </div>
  );
}

// Add this component at the bottom of your file
const RequestDetailModal = ({ 
  request, 
  isOpen, 
  onClose, 
  onApprove, 
  onReject, 
  userProfile, 
  darkMode,
  loading,
  onUpdateUserOrganization // Add this prop
}: { 
  request: MemberRequest | null; 
  isOpen: boolean; 
  onClose: () => void; 
  onApprove: (req: MemberRequest) => void; 
  onReject: (req: MemberRequest) => void; 
  userProfile: UserProfile | undefined;
  darkMode: boolean;
  loading: boolean;
  onUpdateUserOrganization: (userId: string, clubId: string) => void; // Add this type
}) => {
  if (!isOpen || !request) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-opacity-30">
      <div className={`relative w-full max-w-md p-6 rounded-lg shadow-xl ${
        darkMode ? "bg-gray-800/90" : "bg-white/90"
      }`}>
        <button 
          onClick={onClose}
          className={`absolute top-3 right-3 text-gray-400 hover:${darkMode ? "text-gray-200" : "text-gray-600"}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        <h3 className={`text-xl font-bold mb-4 ${darkMode ? "text-white" : "text-gray-900"}`}>
          Membership Request Details
        </h3>
        
        <div className="flex items-center mb-6">
          <div className="flex-shrink-0 h-16 w-16">
            {userProfile?.photoURL ? (
              <Image
                src={userProfile.photoURL || ''}
                alt={request.userName}
                width={64}
                height={64}
                className="rounded-full"
              />
            ) : (
              <div className={`h-16 w-16 rounded-full flex items-center justify-center ${
                darkMode ? "bg-gray-700" : "bg-gray-200"
              }`}>
                <span className={`text-2xl font-medium ${
                  darkMode ? "text-gray-300" : "text-gray-600"
                }`}>
                  {request.userName.substring(0, 1).toUpperCase()}
                </span>
              </div>
            )}
          </div>
          <div className="ml-4">
            <div className={`text-xl font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>
              {request.userName}
            </div>
            <div className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
              {request.userEmail}
            </div>
          </div>
        </div>
        
        <div className="space-y-4 mb-6">
          <div>
            <h4 className={`text-sm font-medium ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
              Request Date
            </h4>
            <p className={darkMode ? "text-white" : "text-gray-900"}>
              {formatDate(request.createdAt)}
            </p>
          </div>
          
          {request.userPhone && (
            <div>
              <h4 className={`text-sm font-medium ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                Phone Number
              </h4>
              <p className={darkMode ? "text-white" : "text-gray-900"}>
                {request.userPhone}
              </p>
            </div>
          )}
          
          <div>
            <h4 className={`text-sm font-medium ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
              Status
            </h4>
            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
              request.status === 'pending' 
                ? darkMode 
                  ? "bg-yellow-900 text-yellow-200" 
                  : "bg-yellow-100 text-yellow-800"
                : request.status === 'approved'
                  ? darkMode 
                    ? "bg-green-900 text-green-200" 
                    : "bg-green-100 text-green-800"
                  : darkMode 
                    ? "bg-red-900 text-red-200" 
                    : "bg-red-100 text-red-800"
            }`}>
              {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
            </span>
          </div>
          
          <div>
            <h4 className={`text-sm font-medium ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
              Message
            </h4>
            <p className={`whitespace-pre-wrap ${darkMode ? "text-white" : "text-gray-900"}`}>
              {request.message || "No message provided"}
            </p>
          </div>
          
          {userProfile && (
            <div>
              <h4 className={`text-sm font-medium ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                Additional Info
              </h4>
              <div className={`text-sm ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                {Object.entries(userProfile)
                  .filter(([key]) => !['id', 'photoURL', 'email', 'fullName'].includes(key))
                  .map(([key, value]) => (
                    <div key={key} className="flex gap-2 py-1">
                      <span className="font-medium">{key}:</span>
                      <span>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                    </div>
                  ))
                }
              </div>
            </div>
          )}
        </div>
        
        {request.status === 'pending' && (
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => onReject(request)}
              disabled={loading}
              className={`px-4 py-2 rounded ${
                darkMode 
                  ? "bg-red-600 text-white hover:bg-red-700" 
                  : "bg-red-500 text-white hover:bg-red-600"
              } transition-colors ${loading ? "opacity-70 cursor-not-allowed" : ""}`}
            >
              Reject
            </button>
            <button
              onClick={() => onApprove(request)}
              disabled={loading}
              className={`px-4 py-2 rounded ${
                darkMode 
                  ? "bg-teal-600 text-white hover:bg-teal-700" 
                  : "bg-green-500 text-white hover:bg-green-600"
              } transition-colors ${loading ? "opacity-70 cursor-not-allowed" : ""}`}
            >
              Approve
            </button>
          </div>
        )}
        
        {/* Add this button to copy user/club IDs */}
        <button
          onClick={() => onUpdateUserOrganization(request.userId, request.clubId)}
          className={`mt-2 px-3 py-1 text-xs rounded ${
            darkMode 
              ? "bg-blue-600 hover:bg-blue-700 text-white" 
              : "bg-blue-500 hover:bg-blue-600 text-white"
          }`}
        >
          Copy User/Club IDs
        </button>
      </div>
    </div>
  );
};