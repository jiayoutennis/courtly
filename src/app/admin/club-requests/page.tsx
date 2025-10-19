"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { auth, db } from '../../../../firebase';
import { 
  collection, getDocs, doc, getDoc, updateDoc, deleteDoc,
  query, orderBy, where, Timestamp
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import PageTitle from '@/app/components/PageTitle';
import { initializeClubCollections } from '@/lib/initializeClub';

interface ClubRequest {
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
  courts: number;
  courtType: string;
  approved: boolean;
  createdAt: Timestamp;
  submittedBy: string;
}

export default function ClubRequestsPage() {
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [canViewAll, setCanViewAll] = useState(false);
  const [currentUid, setCurrentUid] = useState<string | null>(null);
  const [clubRequests, setClubRequests] = useState<ClubRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<ClubRequest[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<ClubRequest | null>(null);
  const [isDetailView, setIsDetailView] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [processing, setProcessing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'recent' | 'oldest'>('all');
  const [confirmAction, setConfirmAction] = useState<{
    type: 'approve' | 'decline';
    requestId: string;
    clubName: string;
  } | null>(null);

  // Initialize dark mode from localStorage
  useEffect(() => {
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode === 'true') {
      setDarkMode(true);
    }
  }, []);

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
        // Check if user has courtly role either via Firestore user doc or custom auth claims
        const [userDoc, tokenResult] = await Promise.all([
          getDoc(doc(db, "users", currentUser.uid)),
          currentUser.getIdTokenResult().catch(() => ({ claims: {} as any }))
        ]);

        if (!userDoc.exists()) {
          // User document doesn't exist
          setIsAuthorized(false);
          setError("User profile not found");
          router.push('/signin');
          return;
        }

        const userData = userDoc.data();
        let isCourtlyByDoc = userData.userType === 'courtly';
        let isCourtlyByClaim = Boolean((tokenResult as any)?.claims?.courtlyAdmin === true);

        // If not authorized yet, force refresh token once in case claims were just updated
        if (!(isCourtlyByDoc || isCourtlyByClaim)) {
          try {
            await currentUser.getIdToken(true);
            const refreshed = await currentUser.getIdTokenResult();
            isCourtlyByClaim = Boolean(refreshed?.claims?.courtlyAdmin === true);
          } catch {
            // ignore
          }
        }

        if (isCourtlyByDoc || isCourtlyByClaim) {
          // User is authorized
          setIsAuthorized(true);
          setCanViewAll(true);
          setCurrentUid(currentUser.uid);

          // Fetch club requests
          fetchClubRequests(true, currentUser.uid);
        } else {
          // Not Courtly staff: allow viewing their own submissions only (no actions)
          setIsAuthorized(true);
          setCanViewAll(false);
          setCurrentUid(currentUser.uid);
          setError("Limited access: showing only your own club submissions.");
          await fetchClubRequests(false, currentUser.uid);
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

  // Fetch pending club requests
  const fetchClubRequests = async (viewAll: boolean = false, uid?: string | null) => {
    try {
      setLoading(true);
      
      // Get club submissions: either all (Courtly staff) or only current user's
      const baseCol = collection(db, "clubSubmissions");
      const clubsQuery = viewAll
        ? query(baseCol, orderBy("createdAt", "desc"))
        : query(baseCol, where("submittedBy", "==", uid || "__none__"));
      
      const querySnapshot = await getDocs(clubsQuery);
      const requests: ClubRequest[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        requests.push({
          id: doc.id,
          name: data.name,
          email: data.email,
          phone: data.phone || '',
          website: data.website || '',
          address: data.address || '',
          city: data.city,
          state: data.state,
          zip: data.zip || '',
          description: data.description || '',
          courts: data.courts || 1,
          courtType: data.courtType || 'hard',
          approved: data.status === 'approved',
          createdAt: data.createdAt,
          submittedBy: data.submittedBy
        });
      });
      
      setClubRequests(requests);
      setFilteredRequests(requests);
      
      // Clear any previously selected request when refreshing data
      setSelectedRequest(null);
      setIsDetailView(false);
    } catch (error: any) {
      console.error("Error fetching club requests:", error);
      if (error?.code === 'permission-denied') {
        setError("Insufficient permissions to view club submissions. If you were just granted staff access, please sign out and sign back in.");
      } else {
        setError("Failed to load club requests. Please try again later.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Apply search and filters
  useEffect(() => {
    if (clubRequests.length > 0) {
      let filtered = [...clubRequests];
      
      // Apply search term
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(
          club => club.name.toLowerCase().includes(term) || 
                 club.city.toLowerCase().includes(term) ||
                 club.state.toLowerCase().includes(term)
        );
      }
      
      // Apply date filter
      if (filter === 'recent') {
        filtered.sort((a, b) => b.createdAt.seconds - a.createdAt.seconds);
      } else if (filter === 'oldest') {
        filtered.sort((a, b) => a.createdAt.seconds - b.createdAt.seconds);
      }
      
      setFilteredRequests(filtered);
    }
  }, [searchTerm, filter, clubRequests]);

  // View club request details
  const viewRequestDetails = (request: ClubRequest) => {
    setSelectedRequest(request);
    setIsDetailView(true);
  };

  // Back to list view
  const backToList = () => {
    setSelectedRequest(null);
    setIsDetailView(false);
  };

  // Handle approve club
  const approveClub = async (requestId: string, clubName: string) => {
    setConfirmAction({ type: 'approve', requestId, clubName });
  };

  // Handle decline club
  const declineClub = async (requestId: string, clubName: string) => {
    setConfirmAction({ type: 'decline', requestId, clubName });
  };

  // Confirm action handler
  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    
    const { type, requestId } = confirmAction;
    setProcessing(true);
    
    try {
      // Get the submission data from clubSubmissions
      const submissionRef = doc(db, "clubSubmissions", requestId);
      const submissionDoc = await getDoc(submissionRef);
      
      if (!submissionDoc.exists()) {
        throw new Error("Club submission not found");
      }
      
      const submissionData = submissionDoc.data();
      
      if (type === 'approve') {
        // 1. Generate a new club ID
        const newClubRef = doc(collection(db, "orgs"));
        const newClubId = newClubRef.id;
        
        // 2. Prepare club data for /orgs structure
        const clubData = {
          name: submissionData.name,
          email: submissionData.email,
          phone: submissionData.phone || null,
          website: submissionData.website || null,
          address: submissionData.address || null,
          city: submissionData.city,
          state: submissionData.state,
          zip: submissionData.zip || null,
          description: submissionData.description || null,
          courts: submissionData.courts || 1,
          courtType: submissionData.courtType,
          submittedBy: submissionData.submittedBy,
          submitterEmail: submissionData.submitterEmail || submissionData.email,
          submitterName: submissionData.submitterName || "Unknown",
          originalRequestId: requestId
        };
        
        // 3. Initialize club with complete /orgs structure (org document + subcollections)
        await initializeClubCollections(newClubId, clubData);
        console.log("New club created in /orgs with ID:", newClubId);
        console.log("Club collections initialized successfully");
        
        // 4. Update the submitter's organizations array to include the new club
        if (submissionData.submittedBy) {
          const submitterRef = doc(db, "users", submissionData.submittedBy);
          const submitterDoc = await getDoc(submitterRef);
          
          if (submitterDoc.exists()) {
            const userData = submitterDoc.data();
            
            // Get existing organizations array (using new schema format)
            let organizations = userData.organizations || [];
            
            // Check if user is already a member of this org
            const alreadyMember = organizations.some((org: any) => org.orgId === newClubId);
            
            if (!alreadyMember) {
              // Add the new club with 'owner' role (they created/requested it)
              organizations.push({
                orgId: newClubId,
                role: 'owner'
              });
            }
            
            // Set as default org if they don't have one
            const defaultOrgId = userData.defaultOrgId || newClubId;
            
            // Update user with new organizations array and admin status
            await updateDoc(submitterRef, {
              organizations: organizations,
              defaultOrgId: defaultOrgId,
              userType: userData.userType === 'member' ? 'admin' : userData.userType,
              // Keep legacy organization field for backward compatibility
              organization: organizations.map((org: any) => org.orgId)
            });
            
            console.log(`Updated user ${submissionData.submittedBy} with club ${newClubId} as owner`);
          }
        }
        
        // 5. Delete the submission instead of updating it
        await deleteDoc(submissionRef);
        console.log("Club submission deleted:", requestId);
        
        setSuccess("Club has been approved with all collections initialized! The submitter now has owner access to this club.");
      } else {
        // For decline, just delete the submission
        await deleteDoc(submissionRef);
        
        setSuccess("Club request has been declined and deleted.");
      }
      
  // Refresh club requests with correct scope
  await fetchClubRequests(canViewAll, currentUid);
      
      // Close confirmation dialog
      setConfirmAction(null);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess("");
      }, 3000);
    } catch (error) {
      console.error(`Error ${type === 'approve' ? 'approving' : 'declining'} club:`, error);
      setError(`Failed to ${type} club. Please try again.`);
    } finally {
      setProcessing(false);
    }
  };

  // Cancel confirmation
  const cancelConfirmation = () => {
    setConfirmAction(null);
  };

  // Format date from Timestamp
  const formatDate = (timestamp: Timestamp) => {
    if (!timestamp) return 'Unknown date';
    
    const date = timestamp.toDate();
    return date.toLocaleDateString('en-US', {
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Loading state
  if (loading && !isAuthorized) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        darkMode ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"
      }`}>
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-t-transparent border-teal-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg">Verifying your access...</p>
        </div>
      </div>
    );
  }

  // Access denied
  if (!isAuthorized && !loading) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-4 ${
        darkMode ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"
      }`}>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-red-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
        <p className="mb-6 text-center">You don't have permission to access club requests.</p>
        <Link href="/dashboard" className={`py-2 px-4 rounded ${
          darkMode ? "bg-teal-600 text-white hover:bg-teal-700" : "bg-green-500 text-white hover:bg-green-600"
        } transition-colors`}>
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      darkMode ? "bg-[#0a0a0a] text-white" : "bg-white text-black"
    }`}>
      <PageTitle title="Club Requests - Courtly Admin" />
      
      {/* Header */}
      <header className={`py-6 px-6 border-b flex items-center justify-between ${
        darkMode ? "border-[#1a1a1a]" : "border-gray-100"
      }`}>
        <div className="flex items-center space-x-6">
          <Link href="/dashboard" className="text-xs uppercase tracking-wider font-light hover:opacity-70 transition">
            ← Back
          </Link>
          <h1 className="text-xs uppercase tracking-wider font-light">Club Requests</h1>
        </div>
        
        <div className={`px-3 py-2 border text-xs uppercase tracking-wider font-light ${
          darkMode ? "border-white/20" : "border-black/20"
        }`}>
          Courtly Staff
        </div>
      </header>
      
      <div className="container mx-auto px-4 py-8">
        {/* Alert messages */}
        {error && (
          <div className={`mb-6 px-4 py-3 text-xs uppercase tracking-wider font-light border ${
            darkMode ? "border-white/20 bg-white/5" : "border-black/20 bg-black/5"
          }`}>
            {error}
          </div>
        )}
        
        {success && (
          <div className={`mb-6 px-4 py-3 text-xs uppercase tracking-wider font-light border ${
            darkMode ? "border-white/20 bg-white/5" : "border-black/20 bg-black/5"
          }`}>
            {success}
          </div>
        )}
        
        {/* Main content */}
        {isDetailView && selectedRequest ? (
          // Detail view of a club request
          <div className={`border ${
            darkMode ? "border-[#1a1a1a]" : "border-gray-100"
          }`}>
            <div className={`p-6 border-b ${darkMode ? "border-[#1a1a1a]" : "border-gray-100"}`}>
              <div className="flex justify-between items-center mb-4">
                <button
                  onClick={backToList}
                  className={`text-xs uppercase tracking-wider font-light hover:opacity-70 transition ${
                    darkMode ? "text-white" : "text-black"
                  }`}
                >
                  ← Back to all requests
                </button>
                
                {canViewAll && (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => declineClub(selectedRequest.id, selectedRequest.name)}
                      className={`px-4 py-3 text-xs uppercase tracking-wider font-light transition ${
                        darkMode
                          ? "border border-white/30 text-white hover:bg-white hover:text-black"
                          : "border border-black/30 text-black hover:bg-black hover:text-white"
                      }`}
                    >
                      Decline
                    </button>
                    <button
                      onClick={() => approveClub(selectedRequest.id, selectedRequest.name)}
                      className={`px-4 py-3 text-xs uppercase tracking-wider font-light transition ${
                        darkMode
                          ? "border border-white text-white hover:bg-white hover:text-black"
                          : "border border-black text-black hover:bg-black hover:text-white"
                      }`}
                    >
                      Approve
                    </button>
                  </div>
                )}
              </div>
              
              <h2 className="text-xs uppercase tracking-wider font-light mb-4">{selectedRequest.name}</h2>
              <div className={`text-xs font-light mb-4 ${darkMode ? "text-gray-500" : "text-gray-500"}`}>
                Submitted on {formatDate(selectedRequest.createdAt)}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-xs uppercase tracking-wider font-light mb-3">Contact Information</h3>
                  <div className={`p-4 border ${
                    darkMode ? "border-[#1a1a1a]/50" : "border-gray-100"
                  }`}>
                    <div className="mb-3">
                      <label className={`block text-xs uppercase tracking-wider font-light mb-1 ${darkMode ? "text-gray-600" : "text-gray-400"}`}>Email</label>
                      <p className="text-xs font-light">{selectedRequest.email}</p>
                    </div>
                    {selectedRequest.phone && (
                      <div className="mb-3">
                        <label className={`block text-xs uppercase tracking-wider font-light mb-1 ${darkMode ? "text-gray-600" : "text-gray-400"}`}>Phone</label>
                        <p className="text-xs font-light">{selectedRequest.phone}</p>
                      </div>
                    )}
                    {selectedRequest.website && (
                      <div>
                        <label className={`block text-xs uppercase tracking-wider font-light mb-1 ${darkMode ? "text-gray-600" : "text-gray-400"}`}>Website</label>
                        <a
                          href={selectedRequest.website.startsWith('http') ? selectedRequest.website : `https://${selectedRequest.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-light hover:opacity-70 transition"
                        >
                          {selectedRequest.website}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
                
                <div>
                  <h3 className="text-xs uppercase tracking-wider font-light mb-3">Location</h3>
                  <div className={`p-4 border ${
                    darkMode ? "border-[#1a1a1a]/50" : "border-gray-100"
                  }`}>
                    {selectedRequest.address && (
                      <div className="mb-3">
                        <label className={`block text-xs uppercase tracking-wider font-light mb-1 ${darkMode ? "text-gray-600" : "text-gray-400"}`}>Address</label>
                        <p className="text-xs font-light">{selectedRequest.address}</p>
                      </div>
                    )}
                    <div className="mb-3">
                      <label className={`block text-xs uppercase tracking-wider font-light mb-1 ${darkMode ? "text-gray-600" : "text-gray-400"}`}>City, State</label>
                      <p className="text-xs font-light">{selectedRequest.city}, {selectedRequest.state}</p>
                    </div>
                    {selectedRequest.zip && (
                      <div>
                        <label className={`block text-xs uppercase tracking-wider font-light mb-1 ${darkMode ? "text-gray-600" : "text-gray-400"}`}>ZIP Code</label>
                        <p className="text-xs font-light">{selectedRequest.zip}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-3">Club Details</h3>
                <div className={`p-4 rounded-lg ${
                  darkMode ? "bg-gray-700" : "bg-gray-50"
                }`}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Number of Courts</label>
                      <p>{selectedRequest.courts}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Court Surface Type</label>
                      <p className="capitalize">{selectedRequest.courtType}</p>
                    </div>
                  </div>
                  
                  {selectedRequest.description && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Description</label>
                      <p className={`whitespace-pre-line ${
                        darkMode ? "text-gray-300" : "text-gray-700"
                      }`}>
                        {selectedRequest.description}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className={`p-4 flex justify-between items-center ${
              darkMode ? "bg-gray-750" : "bg-gray-50"
            }`}>
              <div className="text-sm text-gray-500">
                Club ID: {selectedRequest.id}
              </div>
              
              {canViewAll && (
                <div className="flex space-x-2">
                  <button
                    onClick={() => declineClub(selectedRequest.id, selectedRequest.name)}
                    className="px-4 py-2 rounded text-white bg-red-500 hover:bg-red-600 transition-colors"
                  >
                    Decline
                  </button>
                  <button
                    onClick={() => approveClub(selectedRequest.id, selectedRequest.name)}
                    className="px-4 py-2 rounded text-white bg-green-500 hover:bg-green-600 transition-colors"
                  >
                    Approve
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          // List view of club requests
          <>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
              <div>
                <h2 className="text-xs uppercase tracking-wider font-light mb-2">Pending Requests</h2>
                <p className={`text-xs font-light ${darkMode ? "text-gray-500" : "text-gray-500"}`}>
                  Review and approve club submissions
                </p>
              </div>
              
              <div className="mt-4 md:mt-0 flex items-center space-x-2">
                <button
                  onClick={() => fetchClubRequests(canViewAll, currentUid)}
                  className={`px-4 py-3 text-xs uppercase tracking-wider font-light transition ${
                    darkMode 
                      ? "border border-white text-white hover:bg-white hover:text-black" 
                      : "border border-black text-black hover:bg-black hover:text-white"
                  }`}
                >
                  Refresh
                </button>
              </div>
            </div>
            
            {/* Search and filter bar */}
            <div className={`p-4 border mb-6 ${
              darkMode ? "border-[#1a1a1a]" : "border-gray-100"
            }`}>
              <div className="flex flex-col md:flex-row space-y-3 md:space-y-0 md:space-x-4">
                <div className="flex-grow">
                  <input
                    type="text"
                    placeholder="Search club requests..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`w-full px-4 py-3 text-xs font-light focus:outline-none ${
                      darkMode 
                        ? "bg-[#0a0a0a] border border-[#1a1a1a] text-white placeholder-gray-600" 
                        : "bg-white border border-gray-100 text-black placeholder-gray-400"
                    }`}
                  />
                </div>
                
                <div className="flex-shrink-0">
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value as 'all' | 'recent' | 'oldest')}
                    className={`px-4 py-3 text-xs font-light focus:outline-none ${
                      darkMode 
                        ? "bg-[#0a0a0a] border border-[#1a1a1a] text-white" 
                        : "bg-white border border-gray-100 text-black"
                    }`}
                  >
                    <option value="all">All Requests</option>
                    <option value="recent">Most Recent</option>
                    <option value="oldest">Oldest First</option>
                  </select>
                </div>
              </div>
            </div>
            
            {/* Club requests list */}
            {loading ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 border-4 border-t-transparent border-teal-500 rounded-full animate-spin mx-auto mb-4"></div>
                <p>Loading club requests...</p>
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className={`p-8 rounded-lg shadow-md text-center ${
                darkMode ? "bg-gray-800" : "bg-white"
              }`}>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-16 w-16 mx-auto mb-4 ${
                  darkMode ? "text-gray-600" : "text-gray-400"
                }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <h3 className="text-lg font-semibold mb-2">No pending requests</h3>
                <p className={darkMode ? "text-gray-400" : "text-gray-600"}>
                  {searchTerm 
                    ? "No club requests match your search. Try a different search term." 
                    : "There are no pending club requests to review at this time."}
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredRequests.map((request) => (
                  <div 
                    key={request.id} 
                    className={`rounded-lg shadow-md overflow-hidden ${
                      darkMode ? "bg-gray-800" : "bg-white"
                    }`}
                  >
                    <div className="p-6">
                      <h3 className="text-xl font-semibold mb-2">{request.name}</h3>
                      <div className="flex items-center text-sm mb-3">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className={darkMode ? "text-gray-300" : "text-gray-600"}>
                          {request.city}, {request.state}
                        </span>
                      </div>
                      <div className="flex items-center text-sm mb-3">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span className={darkMode ? "text-gray-300" : "text-gray-600"}>
                          {request.email}
                        </span>
                      </div>
                      <div className="flex items-center text-sm mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className={darkMode ? "text-gray-300" : "text-gray-600"}>
                          {formatDate(request.createdAt)}
                        </span>
                      </div>
                      
                      <div className={`p-3 rounded-lg mb-4 ${
                        darkMode ? "bg-gray-700" : "bg-gray-50"
                      }`}>
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="text-sm font-medium">Courts:</span> {request.courts}
                          </div>
                          <div>
                            <span className="text-sm capitalize">{request.courtType} surface</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <button 
                          onClick={() => viewRequestDetails(request)}
                          className={`text-sm ${
                            darkMode 
                              ? "text-teal-400 hover:text-teal-300" 
                              : "text-teal-600 hover:text-teal-700"
                          }`}
                        >
                          View Details
                        </button>
                        
                        {canViewAll && (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => declineClub(request.id, request.name)}
                              className="p-2 rounded-full text-red-500 hover:bg-red-100 dark:hover:bg-red-900"
                              title="Decline Request"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                            <button
                              onClick={() => approveClub(request.id, request.name)}
                              className="p-2 rounded-full text-green-500 hover:bg-green-100 dark:hover:bg-green-900"
                              title="Approve Request"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        
        {/* Confirmation Modal */}
        {confirmAction && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className={`w-full max-w-md border p-6 ${
              darkMode ? "bg-[#0a0a0a] border-[#1a1a1a]" : "bg-white border-gray-100"
            }`}>
              <h3 className="text-xs uppercase tracking-wider font-light mb-4">
                {confirmAction.type === 'approve' ? 'Approve' : 'Decline'} Club
              </h3>
              <p className={`mb-6 text-xs font-light ${
                darkMode ? "text-gray-500" : "text-gray-500"
              }`}>
                Are you sure you want to {confirmAction.type === 'approve' ? 'approve' : 'decline'} <span className="font-normal">{confirmAction.clubName}</span>?
                {confirmAction.type === 'approve' 
                  ? " This will make the club visible in the directory." 
                  : " This will permanently remove the request."}
              </p>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={cancelConfirmation}
                  disabled={processing}
                  className={`px-4 py-3 text-xs uppercase tracking-wider font-light transition ${
                    darkMode 
                      ? "border border-white/30 text-white hover:bg-white hover:text-black" 
                      : "border border-black/30 text-black hover:bg-black hover:text-white"
                  } ${processing ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmAction}
                  disabled={processing}
                  className={`px-4 py-3 text-xs uppercase tracking-wider font-light transition ${
                    darkMode
                      ? "border border-white text-white hover:bg-white hover:text-black"
                      : "border border-black text-black hover:bg-black hover:text-white"
                  } ${processing ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {processing 
                    ? "Processing..." 
                    : confirmAction.type === 'approve' 
                      ? "Yes, Approve" 
                      : "Yes, Decline"
                  }
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}