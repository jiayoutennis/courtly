"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { auth, db } from '../../../../firebase';
import { 
  collection, getDocs, doc, getDoc, updateDoc, deleteDoc,
  query, where, orderBy, Timestamp, addDoc, serverTimestamp 
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import DarkModeToggle from '@/app/components/DarkModeToggle';
import PageTitle from '@/app/components/PageTitle';

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
  const [user, setUser] = useState<any>(null);
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
        // Check if user has courtly role
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          if (userData.userType === 'courtly') {
            // User is authorized
            setIsAuthorized(true);
            setUser({
              ...currentUser,
              ...userData
            });
            
            // Fetch club requests
            fetchClubRequests();
          } else {
            // User is not authorized
            setIsAuthorized(false);
            setError("You don't have permission to access this page");
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

  // Fetch pending club requests
  const fetchClubRequests = async () => {
    try {
      setLoading(true);
      
      // Get all club submissions instead of publicClubs with approved=false
      const clubsQuery = query(
        collection(db, "clubSubmissions"),
        orderBy("createdAt", "desc")
      );
      
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
    } catch (error) {
      console.error("Error fetching club requests:", error);
      setError("Failed to load club requests. Please try again later.");
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
        // 1. Create a new document in publicClubs
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
          approved: true,
          submittedBy: submissionData.submittedBy,
          submitterEmail: submissionData.submitterEmail || submissionData.email,
          submitterName: submissionData.submitterName || "Unknown",
          createdAt: serverTimestamp(),
          originalRequestId: requestId
        };
        
        // Add the club to publicClubs
        const newClubRef = await addDoc(collection(db, "publicClubs"), clubData);
        console.log("New club created with ID:", newClubRef.id);
        
        // 2. Update the submitter's organization array to include the new club ID
        if (submissionData.submittedBy) {
          const submitterRef = doc(db, "users", submissionData.submittedBy);
          const submitterDoc = await getDoc(submitterRef);
          
          if (submitterDoc.exists()) {
            const userData = submitterDoc.data();
            
            // Handle organization as an array
            let organizations = [];
            
            // If organization already exists as an array, use it
            if (userData.organization && Array.isArray(userData.organization)) {
              organizations = userData.organization;
            } 
            // If it exists as a string (old format), convert to array
            else if (userData.organization) {
              organizations = [userData.organization];
            }
            
            // Add the new club ID if not already present
            if (!organizations.includes(newClubRef.id)) {
              organizations.push(newClubRef.id);
            }
            
            // Update user with the new organizations array and admin status
            await updateDoc(submitterRef, {
              organization: organizations,
              userType: userData.userType === 'member' ? 'admin' : userData.userType
            });
            
            console.log(`Updated user ${submissionData.submittedBy} with club ${newClubRef.id} in organization array`);
          }
        }
        
        // 3. Delete the submission instead of updating it
        await deleteDoc(submissionRef);
        console.log("Club submission deleted:", requestId);
        
        setSuccess("Club has been approved, added to the directory, and the request has been deleted. The submitter now has admin access to this club.");
      } else {
        // For decline, just delete the submission
        await deleteDoc(submissionRef);
        
        setSuccess("Club request has been declined and deleted.");
      }
      
      // Refresh club requests
      await fetchClubRequests();
      
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
      darkMode ? "bg-gray-900 text-gray-50" : "bg-gray-50 text-gray-900"
    }`}>
      <PageTitle title="Club Requests - Courtly Admin" />
      
      {/* Header */}
      <header className={`py-4 px-6 shadow-md flex items-center justify-between ${
        darkMode ? "bg-gray-800" : "bg-white"
      }`}>
        <div className="flex items-center space-x-4">
          <Link href="/dashboard" className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </Link>
          <h1 className="text-xl font-bold">Club Registration Requests</h1>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={toggleDarkMode}
            className={`p-2 rounded-full ${darkMode 
              ? "bg-gray-700 text-teal-400 hover:bg-gray-600" 
              : "bg-gray-200 text-amber-500 hover:bg-gray-300"
            }`}
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
          <div className={`px-3 py-1 rounded-full text-sm ${
            darkMode ? "bg-violet-900 text-violet-200" : "bg-violet-100 text-violet-800"
          }`}>
            Courtly Staff
          </div>
        </div>
      </header>
      
      <div className="container mx-auto px-4 py-8">
        {/* Alert messages */}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-100 text-red-700 border border-red-200">
            <div className="flex">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          </div>
        )}
        
        {success && (
          <div className="mb-6 p-4 rounded-lg bg-green-100 text-green-700 border border-green-200">
            <div className="flex">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>{success}</span>
            </div>
          </div>
        )}
        
        {/* Main content */}
        {isDetailView && selectedRequest ? (
          // Detail view of a club request
          <div className={`rounded-lg shadow-md ${
            darkMode ? "bg-gray-800" : "bg-white"
          }`}>
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center mb-4">
                <button
                  onClick={backToList}
                  className={`flex items-center text-sm ${
                    darkMode ? "text-gray-300 hover:text-white" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to all requests
                </button>
                
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
              </div>
              
              <h2 className="text-2xl font-bold mb-2">{selectedRequest.name}</h2>
              <div className={`inline-block px-2 py-1 rounded-full text-xs ${
                darkMode ? "bg-teal-900 text-teal-200" : "bg-teal-100 text-teal-800"
              } mb-4`}>
                Submitted on {formatDate(selectedRequest.createdAt)}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold mb-3">Contact Information</h3>
                  <div className={`p-4 rounded-lg ${
                    darkMode ? "bg-gray-700" : "bg-gray-50"
                  }`}>
                    <div className="mb-3">
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Email</label>
                      <p>{selectedRequest.email}</p>
                    </div>
                    {selectedRequest.phone && (
                      <div className="mb-3">
                        <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Phone</label>
                        <p>{selectedRequest.phone}</p>
                      </div>
                    )}
                    {selectedRequest.website && (
                      <div>
                        <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Website</label>
                        <a
                          href={selectedRequest.website.startsWith('http') ? selectedRequest.website : `https://${selectedRequest.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`${
                            darkMode ? "text-teal-400 hover:text-teal-300" : "text-teal-600 hover:text-teal-700"
                          }`}
                        >
                          {selectedRequest.website}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-3">Location</h3>
                  <div className={`p-4 rounded-lg ${
                    darkMode ? "bg-gray-700" : "bg-gray-50"
                  }`}>
                    {selectedRequest.address && (
                      <div className="mb-3">
                        <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Address</label>
                        <p>{selectedRequest.address}</p>
                      </div>
                    )}
                    <div className="mb-3">
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">City, State</label>
                      <p>{selectedRequest.city}, {selectedRequest.state}</p>
                    </div>
                    {selectedRequest.zip && (
                      <div>
                        <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">ZIP Code</label>
                        <p>{selectedRequest.zip}</p>
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
            </div>
          </div>
        ) : (
          // List view of club requests
          <>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold mb-2">Pending Club Requests</h2>
                <p className={darkMode ? "text-gray-400" : "text-gray-600"}>
                  Review and approve club submissions from the public registration form.
                </p>
              </div>
              
              <div className="mt-4 md:mt-0 flex items-center space-x-2">
                <button
                  onClick={fetchClubRequests}
                  className={`px-4 py-2 rounded-lg flex items-center ${
                    darkMode 
                      ? "bg-teal-600 text-white hover:bg-teal-700" 
                      : "bg-green-500 text-white hover:bg-green-600"
                  } transition-colors`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </button>
              </div>
            </div>
            
            {/* Search and filter bar */}
            <div className={`p-4 rounded-lg shadow-md mb-6 ${
              darkMode ? "bg-gray-800" : "bg-white"
            }`}>
              <div className="flex flex-col md:flex-row space-y-3 md:space-y-0 md:space-x-4">
                <div className="relative flex-grow">
                  <input
                    type="text"
                    placeholder="Search club requests..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`w-full px-4 py-2 pr-10 rounded-lg ${
                      darkMode 
                        ? "bg-gray-700 border-gray-600 text-white" 
                        : "bg-white border-gray-300 text-gray-900"
                    } border focus:outline-none focus:ring-2 ${
                      darkMode ? "focus:ring-teal-500" : "focus:ring-green-500"
                    }`}
                  />
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-5 w-5 absolute right-3 top-2.5 ${
                      darkMode ? "text-gray-400" : "text-gray-500"
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                
                <div className="flex-shrink-0">
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value as any)}
                    className={`px-4 py-2 rounded-lg ${
                      darkMode 
                        ? "bg-gray-700 border-gray-600 text-white" 
                        : "bg-white border-gray-300 text-gray-900"
                    } border focus:outline-none focus:ring-2 ${
                      darkMode ? "focus:ring-teal-500" : "focus:ring-green-500"
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
            <div className={`w-full max-w-md rounded-lg shadow-lg ${
              darkMode ? "bg-gray-800" : "bg-white"
            } p-6`}>
              <h3 className="text-xl font-semibold mb-4">
                {confirmAction.type === 'approve' ? 'Approve' : 'Decline'} Club
              </h3>
              <p className={`mb-6 ${
                darkMode ? "text-gray-300" : "text-gray-700"
              }`}>
                Are you sure you want to {confirmAction.type === 'approve' ? 'approve' : 'decline'} the registration for <span className="font-medium">{confirmAction.clubName}</span>?
                {confirmAction.type === 'approve' 
                  ? " This will make the club visible in the public directory." 
                  : " This will permanently remove the request."}
              </p>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={cancelConfirmation}
                  disabled={processing}
                  className={`px-4 py-2 rounded ${
                    darkMode 
                      ? "bg-gray-700 text-gray-200 hover:bg-gray-600" 
                      : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmAction}
                  disabled={processing}
                  className={`px-4 py-2 rounded text-white ${
                    confirmAction.type === 'approve'
                      ? "bg-green-500 hover:bg-green-600"
                      : "bg-red-500 hover:bg-red-600"
                  } ${processing ? "opacity-70 cursor-not-allowed" : ""}`}
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