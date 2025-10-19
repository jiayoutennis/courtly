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

export default function MemberRequestsPage() {
  const params = useParams();
  const router = useRouter();
  const clubId = params.clubId as string;
  
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [requests, setRequests] = useState<MemberRequest[]>([]);
  const [clubName, setClubName] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);

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

  // Fetch club name and member requests
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
        console.error("Error fetching requests:", error);
        setError("Failed to load member requests.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [clubId, isAdmin]);

  const handleApprove = async (requestId: string, userId: string, userEmail: string) => {
    setProcessingRequest(requestId);
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
      }

      // Step 2: Delete the request
      await deleteDoc(doc(db, "clubJoinRequests", requestId));

      setSuccessMessage(`Approved membership for ${userEmail}`);
      
      // Remove from list
      setRequests(prev => prev.filter(req => req.id !== requestId));
      
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (error) {
      console.error("Error approving request:", error);
      setError("Failed to approve request. Please try again.");
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleDecline = async (requestId: string, userEmail: string) => {
    setProcessingRequest(requestId);
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
      setProcessingRequest(null);
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        darkMode ? "bg-gray-900 text-gray-50" : "bg-gray-50 text-gray-900"
      }`}>
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        darkMode ? "bg-gray-900 text-gray-50" : "bg-gray-50 text-gray-900"
      }`}>
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="mb-4">{error || "You don't have permission to view this page."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      darkMode ? "bg-gray-900 text-gray-50" : "bg-gray-50 text-gray-900"
    }`}>
      <PageTitle title={`Member Requests - ${clubName} - Courtly`} />
      
      <header className={`py-6 px-4 shadow-md ${
        darkMode ? "bg-gray-800" : "bg-white"
      }`}>
        <div className="container mx-auto">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Member Requests</h1>
              <p className={`mt-1 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                {clubName}
              </p>
            </div>
            <Link
              href={`/club/${clubId}`}
              className={`px-4 py-2 rounded-lg ${
                darkMode
                  ? "bg-gray-700 hover:bg-gray-600 text-gray-200"
                  : "bg-gray-200 hover:bg-gray-300 text-gray-700"
              } transition-colors`}
            >
              Back to Club
            </Link>
          </div>
        </div>
      </header>
      
      <div className="container mx-auto px-4 py-8">
        {/* Success/Error Messages */}
        {successMessage && (
          <div className="mb-6 p-4 rounded-lg bg-green-100 border border-green-400 text-green-700">
            {successMessage}
          </div>
        )}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-100 border border-red-400 text-red-700">
            {error}
          </div>
        )}
        
        {/* Requests List */}
        {requests.length > 0 ? (
          <div className={`rounded-lg shadow-md overflow-hidden ${
            darkMode ? "bg-gray-800" : "bg-white"
          }`}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={darkMode ? "bg-gray-700" : "bg-gray-100"}>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      User Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Requested Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${darkMode ? "divide-gray-700" : "divide-gray-200"}`}>
                  {requests.map((request) => {
                    const requestDate = request.requestedAt?.toDate?.() || new Date(request.createdAt);
                    return (
                      <tr key={request.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {request.userEmail}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {requestDate.toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            request.status === 'pending'
                              ? darkMode 
                                ? "bg-yellow-900 text-yellow-200"
                                : "bg-yellow-100 text-yellow-800"
                              : ""
                          }`}>
                            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button
                            onClick={() => handleApprove(request.id, request.userId, request.userEmail)}
                            disabled={processingRequest === request.id}
                            className={`mr-2 px-4 py-2 rounded text-white transition ${
                              processingRequest === request.id
                                ? "bg-gray-400 cursor-not-allowed"
                                : "bg-green-600 hover:bg-green-700"
                            }`}
                          >
                            {processingRequest === request.id ? "Processing..." : "Approve"}
                          </button>
                          <button
                            onClick={() => handleDecline(request.id, request.userEmail)}
                            disabled={processingRequest === request.id}
                            className={`px-4 py-2 rounded text-white transition ${
                              processingRequest === request.id
                                ? "bg-gray-400 cursor-not-allowed"
                                : "bg-red-600 hover:bg-red-700"
                            }`}
                          >
                            {processingRequest === request.id ? "Processing..." : "Decline"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className={`p-8 rounded-lg shadow-md text-center ${
            darkMode ? "bg-gray-800" : "bg-white"
          }`}>
            <p className={`text-lg ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
              No pending member requests at this time.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
