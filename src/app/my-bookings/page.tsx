"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { db, auth } from "../../../firebase";
import { collection, query, getDocs, where, doc, updateDoc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import PageTitle from "@/app/components/PageTitle";
import DarkModeToggle from "@/app/components/DarkModeToggle";
import { format, parseISO, isPast } from "date-fns";
import { refundBookingToBalance, formatBalance } from "../../lib/accountBalance";

interface Booking {
  id: string;
  clubId: string;
  clubName: string;
  courtId: string;
  courtName: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  notes?: string;
  createdAt: any;
}

export default function MyBookingsPage() {
  const router = useRouter();
  
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [userClubs, setUserClubs] = useState<string[]>([]);

  // Initialize dark mode
  useEffect(() => {
    const savedMode = localStorage.getItem("darkMode");
    if (savedMode === "true") {
      setDarkMode(true);
    }
  }, []);

  // Check authentication
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        console.log('🔐 User authenticated:', user.uid);
        setCurrentUser(user);
        setCurrentUserId(user.uid);
      } else {
        console.log('❌ User not authenticated, redirecting to signin');
        router.push(`/signin?redirect=/my-bookings`);
      }
    });
    
    return () => unsubscribe();
  }, [router]);
  
  // Fetch data when currentUser changes
  useEffect(() => {
    if (currentUser) {
      console.log('👤 Current user set, fetching bookings...');
      fetchData();
    }
  }, [currentUser]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      if (!currentUser) return;
      
      // Get user's organizations (all clubs they're a member of)
      const userDoc = await getDoc(doc(db, "users", currentUser.uid));
      if (!userDoc.exists()) {
        setError("User profile not found.");
        setLoading(false);
        return;
      }
      
      const userData = userDoc.data();
      const organization = userData.organization;
      
      console.log('User data:', userData);
      console.log('User organization field:', organization);
      
      // Get list of club IDs user is a member of
      let clubIds: string[] = [];
      if (organization) {
        clubIds = Array.isArray(organization) ? organization : [organization];
      }
      
      console.log('Club IDs user is member of:', clubIds);
      setUserClubs(clubIds); // Store for display
      
      if (clubIds.length === 0) {
        console.log('User is not a member of any clubs');
        setBookings([]);
        setLoading(false);
        return;
      }
      
      // Fetch all club names
      const clubsMap = new Map<string, string>();
      const orgsSnapshot = await getDocs(collection(db, "orgs"));
      orgsSnapshot.forEach((doc) => {
        clubsMap.set(doc.id, doc.data().name || "Unknown Club");
      });
      
      // Fetch bookings from all clubs
      const allBookings: Booking[] = [];
      
      for (const currentClubId of clubIds) {
        try {
          // Fetch bookings for this club (removed orderBy to avoid index requirements)
          const bookingsQuery = query(
            collection(db, `orgs/${currentClubId}/bookings`),
            where("userId", "==", currentUser.uid)
          );
          
          console.log(`Fetching bookings for club ${currentClubId} and user ${currentUser.uid}`);
          const bookingsSnapshot = await getDocs(bookingsQuery);
          console.log(`Found ${bookingsSnapshot.size} bookings for club ${currentClubId}`);
          
          // Get all courts to map court IDs to names
          const courtsSnapshot = await getDocs(collection(db, `orgs/${currentClubId}/courts`));
          const courtsMap = new Map();
          courtsSnapshot.forEach((doc) => {
            const data = doc.data();
            courtsMap.set(doc.id, data.name || `Court ${data.courtNumber}`);
          });
          
          // Add bookings from this club
          bookingsSnapshot.forEach((doc) => {
            const data = doc.data();
            console.log(`Booking found:`, doc.id, data);
            allBookings.push({
              id: doc.id,
              clubId: currentClubId,
              clubName: clubsMap.get(currentClubId) || "Unknown Club",
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
        } catch (error) {
          console.error(`Error fetching bookings for club ${currentClubId}:`, error);
        }
      }
      
      // Sort all bookings by date (most recent first)
      allBookings.sort((a, b) => {
        if (a.date === b.date) {
          return b.startTime.localeCompare(a.startTime);
        }
        return b.date.localeCompare(a.date);
      });
      
      console.log(`Total bookings found across all clubs: ${allBookings.length}`);
      console.log('All bookings:', allBookings);
      
      setBookings(allBookings);
      
    } catch (error) {
      console.error("Error fetching data:", error);
      setError("Failed to load bookings.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = async (bookingId: string, bookingClubId: string) => {
    try {
      // First, get the booking details and club settings
      const bookingDoc = await getDoc(doc(db, `orgs/${bookingClubId}/bookings`, bookingId));
      const clubDoc = await getDoc(doc(db, "orgs", bookingClubId));
      
      if (!bookingDoc.exists() || !clubDoc.exists()) {
        setError("Booking or club not found.");
        return;
      }
      
      const bookingData = bookingDoc.data();
      const clubData = clubDoc.data();
      const cancellationPeriodHours = clubData.reservationSettings?.cancellationPeriodHours || 24;
      
      // Calculate if cancellation is within free period
      const bookingDateTime = new Date(`${bookingData.date}T${bookingData.startTime}:00`);
      const now = new Date();
      const hoursUntilBooking = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      const isWithinFreePeriod = hoursUntilBooking >= cancellationPeriodHours;
      const refundAmount = isWithinFreePeriod ? (bookingData.cost || 0) : 0;
      
      console.log(`Cancellation check: ${hoursUntilBooking.toFixed(1)} hours until booking, free period: ${cancellationPeriodHours} hours, within free period: ${isWithinFreePeriod}`);
      
      // Show confirmation with refund information
      const confirmMessage = isWithinFreePeriod 
        ? `Are you sure you want to cancel this booking? You will receive a full refund of $${(bookingData.cost || 0).toFixed(2)}.`
        : `Are you sure you want to cancel this booking? You will not receive a refund as the cancellation is within ${cancellationPeriodHours} hours of the booking time.`;
      
      if (!confirm(confirmMessage)) {
        return;
      }
      
      // Process refund if applicable
      if (refundAmount > 0 && currentUserId) {
        await refundBookingToBalance(
          currentUserId,
          bookingClubId,
          refundAmount,
          bookingId,
          `Refund: ${bookingData.courtId} - ${bookingData.date} ${bookingData.startTime}`
        );
        console.log(`Refunded ${formatBalance(refundAmount)} to account balance`);
      }
      
      // Update the booking status to cancelled
      await updateDoc(doc(db, `orgs/${bookingClubId}/bookings`, bookingId), {
        status: "cancelled",
        cancelledAt: new Date().toISOString(),
        refundAmount: refundAmount,
        isWithinFreePeriod: isWithinFreePeriod
      });
      
      console.log('✅ Booking cancelled in database:', bookingId);
      
      // Show appropriate success message
      if (isWithinFreePeriod && refundAmount > 0) {
        setSuccess(`Booking cancelled successfully. You will receive a full refund of $${(bookingData.cost || 0).toFixed(2)}.`);
      } else if (!isWithinFreePeriod) {
        setSuccess("Booking cancelled successfully. No refund will be issued due to late cancellation.");
      } else {
        setSuccess("Booking cancelled successfully!");
      }
      
      await fetchData();
      
      setTimeout(() => setSuccess(""), 5000);
    } catch (error) {
      console.error("Error canceling booking:", error);
      setError("Failed to cancel booking.");
      setTimeout(() => setError(""), 3000);
    }
  };

  const isBookingPast = (date: string, endTime: string) => {
    try {
      // Create a proper ISO string by combining date and endTime
      const bookingDateTime = new Date(`${date}T${endTime}:00`);
      const isPastResult = isPast(bookingDateTime);
      console.log(`Checking if booking is past: ${date} ${endTime} -> ${bookingDateTime.toISOString()} -> ${isPastResult}`);
      return isPastResult;
    } catch (error) {
      console.error('Error parsing booking date:', error, 'date:', date, 'endTime:', endTime);
      return false;
    }
  };

  // Calculate cancellation status for a booking
  const getCancellationStatus = (booking: any, clubCancellationPeriod: number = 24) => {
    try {
      const bookingDateTime = new Date(`${booking.date}T${booking.startTime}:00`);
      const now = new Date();
      const hoursUntilBooking = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      if (hoursUntilBooking < 0) {
        return { status: 'past', message: 'Booking has passed' };
      } else if (hoursUntilBooking >= clubCancellationPeriod) {
        return { 
          status: 'free', 
          message: `Free cancellation (${Math.floor(hoursUntilBooking)}h remaining)` 
        };
      } else {
        return { 
          status: 'late', 
          message: `Late cancellation (no refund within ${clubCancellationPeriod}h)` 
        };
      }
    } catch (error) {
      console.error('Error calculating cancellation status:', error);
      return { status: 'unknown', message: 'Unable to determine cancellation status' };
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

  const upcomingBookings = bookings.filter(b => 
    !isBookingPast(b.date, b.endTime) && b.status !== "cancelled"
  );
  const pastBookings = bookings.filter(b => 
    isBookingPast(b.date, b.endTime) && b.status !== "cancelled"
  );

  // Debug logging
  console.log('All bookings:', bookings);
  console.log('Upcoming bookings:', upcomingBookings);
  console.log('Past bookings:', pastBookings);
  console.log('Bookings with status:', bookings.map(b => ({ id: b.id, date: b.date, endTime: b.endTime, status: b.status, isPast: isBookingPast(b.date, b.endTime) })));

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      darkMode ? "bg-[#0a0a0a] text-white" : "bg-white text-black"
    }`}>
      <PageTitle title="My Bookings - Courtly" />
      
      {/* Header */}
      <header className={`py-4 sm:py-6 px-4 sm:px-6 border-b ${
        darkMode ? "border-[#1a1a1a]" : "border-gray-100"
      }`}>
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
            <div>
              <h1 className={`text-xl sm:text-2xl font-light ${
                darkMode ? "text-white" : "text-black"
              }`}>
                My Bookings
              </h1>
              <p className={`mt-1 text-xs sm:text-sm font-light ${
                darkMode ? "text-gray-500" : "text-gray-400"
              }`}>
                All your court reservations across all clubs
              </p>
            </div>
            
            <div className="flex items-center gap-3 sm:gap-4">
              <button
                onClick={() => {
                  console.log('🔄 Manual refresh triggered');
                  fetchData();
                }}
                disabled={loading}
                className={`text-xs sm:text-sm font-light ${
                  darkMode
                    ? "text-gray-400 hover:text-white"
                    : "text-gray-600 hover:text-black"
                } transition-colors disabled:opacity-50`}
              >
                {loading ? 'Loading...' : '🔄 Refresh'}
              </button>
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
              <DarkModeToggle darkMode={darkMode} setDarkMode={setDarkMode} />
            </div>
          </div>
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
        
        {userClubs.length === 0 && !loading && bookings.length === 0 && (
          <div className={`mb-6 p-4 border ${
            darkMode ? "border-[#1a1a1a] bg-[#0a0a0a]" : "border-gray-100 bg-white"
          }`}>
            <p className={`text-sm font-light ${
              darkMode ? "text-gray-400" : "text-gray-600"
            }`}>
              You are not a member of any clubs yet. Book a court at any club to join automatically.
            </p>
          </div>
        )}
        
        {/* Upcoming Bookings */}
        <div className={`mb-8 ${
          darkMode ? "border-[#1a1a1a] bg-[#0a0a0a]" : "border-gray-100 bg-white"
        } border`}>
          <div className="p-6">
            <h2 className={`text-lg font-light mb-6 ${
              darkMode ? "text-white" : "text-black"
            }`}>Upcoming Bookings</h2>
          
          {upcomingBookings.length > 0 ? (
            <div className="space-y-4">
              {upcomingBookings.map(booking => (
                <div
                  key={booking.id}
                  className={`p-4 border ${
                    darkMode
                      ? "border-[#1a1a1a] bg-[#0a0a0a]"
                      : "border-gray-100 bg-white"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs ${
                          darkMode ? "text-gray-400" : "text-gray-500"
                        }`}>
                          {booking.clubName}
                        </span>
                      </div>
                      <h3 className={`font-light text-lg ${
                        darkMode ? "text-white" : "text-black"
                      }`}>{booking.courtName}</h3>
                      <p className={`text-sm mt-1 ${
                        darkMode ? "text-gray-400" : "text-gray-600"
                      }`}>
                        {format(parseISO(booking.date), 'EEEE, MMMM d, yyyy')}
                      </p>
                      <p className={`text-sm ${
                        darkMode ? "text-gray-400" : "text-gray-600"
                      }`}>
                        {booking.startTime} - {booking.endTime}
                      </p>
                      {booking.notes && (
                        <p className={`text-sm mt-2 ${
                          darkMode ? "text-gray-300" : "text-gray-700"
                        }`}>
                          {booking.notes}
                        </p>
                      )}
                      <div className={`text-xs mt-2 ${
                        darkMode ? "text-gray-500" : "text-gray-500"
                      }`}>
                        {getCancellationStatus(booking).message}
                      </div>
                    </div>
                    <div className="flex flex-col space-y-2">
                      <span className={`text-xs ${
                        darkMode ? "text-gray-400" : "text-gray-500"
                      }`}>
                        {booking.status}
                      </span>
                      <button
                        onClick={() => handleCancelBooking(booking.id, booking.clubId)}
                        className={`text-xs transition ${
                          darkMode
                            ? "text-red-400 hover:text-red-300"
                            : "text-red-600 hover:text-red-700"
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
                href="/dashboard"
                className={`inline-block mt-4 px-4 py-2 border transition ${
                  darkMode
                    ? "border-white text-white hover:bg-white hover:text-black"
                    : "border-black text-black hover:bg-black hover:text-white"
                }`}
              >
                Go to Dashboard
              </Link>
            </div>
          )}
          </div>
        </div>
        
        {/* Past Bookings */}
        {pastBookings.length > 0 && (
          <div className={`${
            darkMode ? "border-[#1a1a1a] bg-[#0a0a0a]" : "border-gray-100 bg-white"
          } border`}>
            <div className="p-6">
              <h2 className={`text-lg font-light mb-6 ${
                darkMode ? "text-white" : "text-black"
              }`}>Past Bookings</h2>
              
              <div className="space-y-4">
                {pastBookings.map(booking => (
                  <div
                    key={booking.id}
                    className={`p-4 border ${
                      darkMode
                        ? "border-[#1a1a1a] bg-[#0a0a0a]"
                        : "border-gray-100 bg-white"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-xs ${
                            darkMode ? "text-gray-400" : "text-gray-500"
                          }`}>
                            {booking.clubName}
                          </span>
                        </div>
                        <h3 className={`font-light ${
                          darkMode ? "text-white" : "text-black"
                        }`}>{booking.courtName}</h3>
                        <p className={`text-sm mt-1 ${
                          darkMode ? "text-gray-400" : "text-gray-600"
                        }`}>
                          {format(parseISO(booking.date), 'MMM d, yyyy')} • {booking.startTime} - {booking.endTime}
                        </p>
                      </div>
                      <div className="flex flex-col items-end space-y-2">
                        <span className={`text-xs ${
                          darkMode ? "text-gray-400" : "text-gray-500"
                        }`}>
                          Completed
                        </span>
                        <button
                          onClick={() => handleCancelBooking(booking.id, booking.clubId)}
                          className={`text-xs ${
                            darkMode ? "text-red-400 hover:text-red-300" : "text-red-600 hover:text-red-700"
                          }`}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
