"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { db, auth } from "../../../../../firebase";
import { collection, query, getDocs, where, doc, updateDoc, deleteDoc, orderBy, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import PageTitle from "@/app/components/PageTitle";
import DarkModeToggle from "@/app/components/DarkModeToggle";
import { format, parseISO, isPast } from "date-fns";

interface Booking {
  id: string;
  courtId: string;
  courtName: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  notes?: string;
  createdAt: any;
}

interface ClubInfo {
  id: string;
  name: string;
}

export default function MyBookingsPage() {
  const params = useParams();
  const router = useRouter();
  const clubId = params.clubId as string;
  
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [clubInfo, setClubInfo] = useState<ClubInfo | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Initialize dark mode
  useEffect(() => {
    const savedMode = localStorage.getItem("darkMode");
    if (savedMode === "true") {
      setDarkMode(true);
    }
  }, []);

  // Check authentication and membership
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        
        // Check if user is a member by checking their organization field
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const organization = userData.organization;
            
            // Check if the clubId is in the organization field
            const isMemberOfClub = organization
              ? (Array.isArray(organization)
                  ? organization.includes(clubId)
                  : organization === clubId)
              : false;
            
            if (!isMemberOfClub) {
              setError("You must be a member to view bookings.");
              setTimeout(() => router.push(`/club/${clubId}`), 2000);
              return;
            }
            
            await fetchData();
          } else {
            setError("User profile not found.");
            setTimeout(() => router.push(`/club/${clubId}`), 2000);
          }
        } catch (error) {
          console.error("Error checking membership:", error);
          setError("Failed to verify membership.");
        }
      } else {
        router.push(`/signin?redirect=/club/${clubId}/my-bookings`);
      }
    });
    
    return () => unsubscribe();
  }, [clubId, router]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch club info
      const clubDoc = await getDocs(collection(db, "publicClubs"));
      clubDoc.forEach((doc) => {
        if (doc.id === clubId) {
          setClubInfo({
            id: doc.id,
            name: doc.data().name || "Unknown Club"
          });
        }
      });
      
      // Fetch user's bookings
      if (currentUser) {
        const bookingsQuery = query(
          collection(db, `publicClubs/${clubId}/bookings`),
          where("userId", "==", currentUser.uid),
          orderBy("date", "desc")
        );
        
        const bookingsSnapshot = await getDocs(bookingsQuery);
        
        // Get all courts to map court IDs to names
        const courtsSnapshot = await getDocs(collection(db, `publicClubs/${clubId}/courts`));
        const courtsMap = new Map();
        courtsSnapshot.forEach((doc) => {
          const data = doc.data();
          courtsMap.set(doc.id, data.name || `Court ${data.courtNumber}`);
        });
        
        const bookingsData: Booking[] = [];
        bookingsSnapshot.forEach((doc) => {
          const data = doc.data();
          bookingsData.push({
            id: doc.id,
            courtId: data.courtId,
            courtName: courtsMap.get(data.courtId) || "Unknown Court",
            date: data.date,
            startTime: data.startTime,
            endTime: data.endTime,
            status: data.status || "confirmed",
            notes: data.notes,
            createdAt: data.createdAt
          });
        });
        
        setBookings(bookingsData);
      }
      
    } catch (error) {
      console.error("Error fetching data:", error);
      setError("Failed to load bookings.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    if (!confirm("Are you sure you want to cancel this booking?")) {
      return;
    }
    
    try {
      await updateDoc(doc(db, `publicClubs/${clubId}/bookings`, bookingId), {
        status: "canceled"
      });
      
      setSuccess("Booking canceled successfully.");
      await fetchData();
      
      setTimeout(() => setSuccess(""), 3000);
    } catch (error) {
      console.error("Error canceling booking:", error);
      setError("Failed to cancel booking.");
      setTimeout(() => setError(""), 3000);
    }
  };

  const handleDeleteBooking = async (bookingId: string) => {
    if (!confirm("Are you sure you want to delete this booking? This action cannot be undone.")) {
      return;
    }
    
    try {
      await deleteDoc(doc(db, `publicClubs/${clubId}/bookings`, bookingId));
      
      setSuccess("Booking deleted successfully.");
      await fetchData();
      
      setTimeout(() => setSuccess(""), 3000);
    } catch (error) {
      console.error("Error deleting booking:", error);
      setError("Failed to delete booking.");
      setTimeout(() => setError(""), 3000);
    }
  };

  const isBookingPast = (date: string, endTime: string) => {
    try {
      const bookingDateTime = parseISO(`${date}T${endTime}`);
      return isPast(bookingDateTime);
    } catch {
      return false;
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

  const upcomingBookings = bookings.filter(b => !isBookingPast(b.date, b.endTime) && b.status !== 'canceled');
  const pastBookings = bookings.filter(b => isBookingPast(b.date, b.endTime) || b.status === 'canceled');

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      darkMode ? "bg-gray-900 text-gray-50" : "bg-gray-50 text-gray-900"
    }`}>
      <PageTitle title={`My Bookings - ${clubInfo?.name || 'Club'}`} />
      
      {/* Header */}
      <header className={`py-4 px-6 flex items-center justify-between shadow-md ${
        darkMode ? "bg-gray-800" : "bg-white"
      }`}>
        <div className="flex items-center space-x-4">
          <Link href={`/club/${clubId}`} className={`flex items-center px-3 py-1.5 rounded-lg transition ${
            darkMode 
              ? "bg-gray-700 hover:bg-gray-600 text-gray-200" 
              : "bg-gray-100 hover:bg-gray-200 text-gray-700"
          }`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Club
          </Link>
          <h1 className="text-2xl font-bold">My Bookings</h1>
        </div>
        
        <div className="flex items-center space-x-4">
          <Link
            href={`/club/${clubId}/court-schedule`}
            className={`px-4 py-2 rounded-lg transition ${
              darkMode
                ? "bg-teal-600 hover:bg-teal-700 text-white"
                : "bg-green-500 hover:bg-green-600 text-white"
            }`}
          >
            View Court Schedule
          </Link>
          <DarkModeToggle darkMode={darkMode} setDarkMode={setDarkMode} />
        </div>
      </header>
      
      <div className="container mx-auto px-4 py-8 max-w-6xl">
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
        
        {/* Upcoming Bookings */}
        <div className={`p-6 mb-8 rounded-lg shadow-md ${
          darkMode ? "bg-gray-800" : "bg-white"
        }`}>
          <h2 className="text-xl font-bold mb-6">Upcoming Bookings</h2>
          
          {upcomingBookings.length > 0 ? (
            <div className="space-y-4">
              {upcomingBookings.map(booking => (
                <div
                  key={booking.id}
                  className={`p-4 rounded-lg border ${
                    darkMode
                      ? "bg-gray-700 border-gray-600"
                      : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{booking.courtName}</h3>
                      <p className={`text-sm mt-1 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                        📅 {format(parseISO(booking.date), 'EEEE, MMMM d, yyyy')}
                      </p>
                      <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                        🕐 {booking.startTime} - {booking.endTime}
                      </p>
                      {booking.notes && (
                        <p className={`text-sm mt-2 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                          📝 {booking.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col space-y-2">
                      <span className={`px-3 py-1 rounded-full text-xs text-center ${
                        booking.status === 'confirmed'
                          ? darkMode ? "bg-green-900 text-green-200" : "bg-green-100 text-green-800"
                          : darkMode ? "bg-yellow-900 text-yellow-200" : "bg-yellow-100 text-yellow-800"
                      }`}>
                        {booking.status}
                      </span>
                      <button
                        onClick={() => handleCancelBooking(booking.id)}
                        className={`px-3 py-1 rounded text-xs transition ${
                          darkMode
                            ? "bg-red-900 hover:bg-red-800 text-red-200"
                            : "bg-red-100 hover:bg-red-200 text-red-800"
                        }`}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className={darkMode ? "text-gray-400" : "text-gray-600"}>
                No upcoming bookings.
              </p>
              <Link
                href={`/club/${clubId}/court-schedule`}
                className={`inline-block mt-4 px-6 py-2 rounded-lg transition ${
                  darkMode
                    ? "bg-teal-600 hover:bg-teal-700 text-white"
                    : "bg-green-500 hover:bg-green-600 text-white"
                }`}
              >
                View Court Schedule
              </Link>
            </div>
          )}
        </div>
        
        {/* Past Bookings */}
        {pastBookings.length > 0 && (
          <div className={`p-6 rounded-lg shadow-md ${
            darkMode ? "bg-gray-800" : "bg-white"
          }`}>
            <h2 className="text-xl font-bold mb-6">Past Bookings</h2>
            
            <div className="space-y-4">
              {pastBookings.map(booking => (
                <div
                  key={booking.id}
                  className={`p-4 rounded-lg border opacity-75 ${
                    darkMode
                      ? "bg-gray-700 border-gray-600"
                      : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-semibold">{booking.courtName}</h3>
                      <p className={`text-sm mt-1 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                        {format(parseISO(booking.date), 'MMM d, yyyy')} • {booking.startTime} - {booking.endTime}
                      </p>
                    </div>
                    <div className="flex flex-col items-end space-y-2">
                      <span className={`px-3 py-1 rounded-full text-xs ${
                        booking.status === 'canceled'
                          ? darkMode ? "bg-red-900 text-red-200" : "bg-red-100 text-red-800"
                          : darkMode ? "bg-gray-600 text-gray-300" : "bg-gray-200 text-gray-700"
                      }`}>
                        {booking.status === 'canceled' ? 'Canceled' : 'Completed'}
                      </span>
                      <button
                        onClick={() => handleDeleteBooking(booking.id)}
                        className="text-xs text-red-600 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
