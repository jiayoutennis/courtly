"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { db, auth } from "../../../../../firebase";
import { doc, getDoc, collection, query, getDocs, where, addDoc, Timestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import PageTitle from "@/app/components/PageTitle";
import DarkModeToggle from "@/app/components/DarkModeToggle";
import { format, addDays } from "date-fns";

interface Court {
  id: string;
  name: string;
  courtNumber: number;
  courtType: string;
  isActive: boolean;
  openTime: string;
  closeTime: string;
}

interface ClubInfo {
  id: string;
  name: string;
}

interface Booking {
  id: string;
  courtId: string;
  date: string;
  startTime: string;
  endTime: string;
  userId: string;
  userName: string;
  status: string;
}

export default function BookCourtPage() {
  const params = useParams();
  const router = useRouter();
  const clubId = params.clubId as string;
  
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [clubInfo, setClubInfo] = useState<ClubInfo | null>(null);
  const [courts, setCourts] = useState<Court[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isMember, setIsMember] = useState(false);
  
  // Form state
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedCourt, setSelectedCourt] = useState("");
  const [startTime, setStartTime] = useState("");
  const [duration, setDuration] = useState("60"); // in minutes
  const [notes, setNotes] = useState("");
  
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
              setError("You must be a member to book courts.");
              setTimeout(() => router.push(`/club/${clubId}`), 2000);
              return;
            }
            
            setIsMember(true);
            await fetchClubData();
          } else {
            setError("User profile not found.");
            setTimeout(() => router.push(`/club/${clubId}`), 2000);
          }
        } catch (error) {
          console.error("Error checking membership:", error);
          setError("Failed to verify membership.");
        }
      } else {
        router.push(`/signin?redirect=/club/${clubId}/book-court`);
      }
    });
    
    return () => unsubscribe();
  }, [clubId, router]);

  const fetchClubData = async () => {
    try {
      setLoading(true);
      
      // Fetch club info
      const clubDoc = await getDoc(doc(db, "publicClubs", clubId));
      if (clubDoc.exists()) {
        setClubInfo({
          id: clubDoc.id,
          name: clubDoc.data().name || "Unknown Club"
        });
      }
      
      // Fetch courts
      const courtsQuery = collection(db, `publicClubs/${clubId}/courts`);
      const courtsSnapshot = await getDocs(courtsQuery);
      const courtsData: Court[] = [];
      
      courtsSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.isActive !== false) {
          courtsData.push({
            id: doc.id,
            name: data.name || `Court ${data.courtNumber}`,
            courtNumber: data.courtNumber || 1,
            courtType: data.courtType || "Hard",
            isActive: data.isActive !== false,
            openTime: data.openTime || "08:00",
            closeTime: data.closeTime || "20:00"
          });
        }
      });
      
      setCourts(courtsData.sort((a, b) => a.courtNumber - b.courtNumber));
      
      if (courtsData.length > 0 && courtsData[0]) {
        setSelectedCourt(courtsData[0].id);
      }
      
    } catch (error) {
      console.error("Error fetching club data:", error);
      setError("Failed to load club information.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch bookings when date or court changes
  useEffect(() => {
    if (selectedDate && selectedCourt && clubId) {
      fetchBookings();
    }
  }, [selectedDate, selectedCourt, clubId]);

  const fetchBookings = async () => {
    try {
      const bookingsQuery = query(
        collection(db, `publicClubs/${clubId}/bookings`),
        where("courtId", "==", selectedCourt),
        where("date", "==", selectedDate)
      );
      
      const bookingsSnapshot = await getDocs(bookingsQuery);
      const bookingsData: Booking[] = [];
      
      bookingsSnapshot.forEach((doc) => {
        const data = doc.data();
        bookingsData.push({
          id: doc.id,
          courtId: data.courtId,
          date: data.date,
          startTime: data.startTime,
          endTime: data.endTime,
          userId: data.userId,
          userName: data.userName || "Unknown",
          status: data.status || "confirmed"
        });
      });
      
      setBookings(bookingsData.sort((a, b) => a.startTime.localeCompare(b.startTime)));
    } catch (error) {
      console.error("Error fetching bookings:", error);
    }
  };

  const generateTimeSlots = () => {
    const selectedCourtData = courts.find(c => c.id === selectedCourt);
    if (!selectedCourtData) return [];
    
    const slots: string[] = [];
    const openTimeParts = selectedCourtData.openTime.split(':').map(Number);
    const closeTimeParts = selectedCourtData.closeTime.split(':').map(Number);
    
    const openHour = openTimeParts[0];
    const openMin = openTimeParts[1];
    const closeHour = closeTimeParts[0];
    const closeMin = closeTimeParts[1];
    
    if (openHour === undefined || openMin === undefined || closeHour === undefined || closeMin === undefined) {
      return [];
    }
    
    let currentHour = openHour;
    let currentMin = openMin;
    
    while (currentHour < closeHour || (currentHour === closeHour && currentMin < closeMin)) {
      const timeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
      slots.push(timeStr);
      
      currentMin += 30;
      if (currentMin >= 60) {
        currentMin = 0;
        currentHour++;
      }
    }
    
    return slots;
  };

  const calculateEndTime = (start: string, durationMin: number) => {
    const timeParts = start.split(':').map(Number);
    const hour = timeParts[0];
    const min = timeParts[1];
    
    if (hour === undefined || min === undefined) {
      return "00:00";
    }
    
    let endMin = min + durationMin;
    let endHour = hour;
    
    while (endMin >= 60) {
      endMin -= 60;
      endHour++;
    }
    
    return `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;
  };

  const isSlotAvailable = (start: string, end: string) => {
    return !bookings.some(booking => {
      return (
        (start >= booking.startTime && start < booking.endTime) ||
        (end > booking.startTime && end <= booking.endTime) ||
        (start <= booking.startTime && end >= booking.endTime)
      );
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentUser || !isMember) {
      setError("You must be logged in as a member to book.");
      return;
    }
    
    if (!selectedCourt || !startTime || !selectedDate) {
      setError("Please fill in all required fields.");
      return;
    }
    
    setSubmitting(true);
    setError("");
    setSuccess("");
    
    try {
      const endTime = calculateEndTime(startTime, parseInt(duration));
      
      // Check if slot is available
      if (!isSlotAvailable(startTime, endTime)) {
        setError("This time slot is not available. Please choose another time.");
        setSubmitting(false);
        return;
      }
      
      // Get user's name from member data
      const membersQuery = query(
        collection(db, `publicClubs/${clubId}/members`),
        where("userId", "==", currentUser.uid)
      );
      const memberSnapshot = await getDocs(membersQuery);
      let userName = currentUser.email || "Unknown";
      
      if (!memberSnapshot.empty && memberSnapshot.docs[0]) {
        const memberData = memberSnapshot.docs[0].data();
        userName = memberData.name || memberData.email || "Unknown";
      }
      
      // Create booking
      await addDoc(collection(db, `publicClubs/${clubId}/bookings`), {
        courtId: selectedCourt,
        date: selectedDate,
        startTime,
        endTime,
        userId: currentUser.uid,
        userName,
        status: "confirmed",
        notes: notes || "",
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      
      setSuccess("Court booked successfully!");
      
      // Reset form
      setStartTime("");
      setNotes("");
      
      // Refresh bookings
      await fetchBookings();
      
      setTimeout(() => {
        router.push(`/club/${clubId}/my-bookings`);
      }, 2000);
      
    } catch (error) {
      console.error("Error creating booking:", error);
      setError("Failed to create booking. Please try again.");
    } finally {
      setSubmitting(false);
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

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      darkMode ? "bg-gray-900 text-gray-50" : "bg-gray-50 text-gray-900"
    }`}>
      <PageTitle title={`Book Court - ${clubInfo?.name || 'Club'}`} />
      
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
          <h1 className="text-2xl font-bold">Book a Court</h1>
        </div>
        
        <DarkModeToggle darkMode={darkMode} setDarkMode={setDarkMode} />
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
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Booking Form */}
          <div className={`p-6 rounded-lg shadow-md ${
            darkMode ? "bg-gray-800" : "bg-white"
          }`}>
            <h2 className="text-xl font-bold mb-6">Reserve Your Court</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Date Selection */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  darkMode ? "text-gray-300" : "text-gray-700"
                }`}>
                  Date *
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  max={format(addDays(new Date(), 30), 'yyyy-MM-dd')}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  required
                  className={`w-full px-4 py-2 rounded-lg border ${
                    darkMode
                      ? "bg-gray-700 border-gray-600 text-white"
                      : "bg-white border-gray-300 text-gray-900"
                  }`}
                />
              </div>
              
              {/* Court Selection */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  darkMode ? "text-gray-300" : "text-gray-700"
                }`}>
                  Court *
                </label>
                <select
                  value={selectedCourt}
                  onChange={(e) => setSelectedCourt(e.target.value)}
                  required
                  className={`w-full px-4 py-2 rounded-lg border ${
                    darkMode
                      ? "bg-gray-700 border-gray-600 text-white"
                      : "bg-white border-gray-300 text-gray-900"
                  }`}
                >
                  {courts.map(court => (
                    <option key={court.id} value={court.id}>
                      {court.name} - {court.courtType}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Start Time */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  darkMode ? "text-gray-300" : "text-gray-700"
                }`}>
                  Start Time *
                </label>
                <select
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                  className={`w-full px-4 py-2 rounded-lg border ${
                    darkMode
                      ? "bg-gray-700 border-gray-600 text-white"
                      : "bg-white border-gray-300 text-gray-900"
                  }`}
                >
                  <option value="">Select time...</option>
                  {generateTimeSlots().map(time => {
                    const endTime = calculateEndTime(time, parseInt(duration));
                    const available = isSlotAvailable(time, endTime);
                    return (
                      <option key={time} value={time} disabled={!available}>
                        {time} {!available ? "(Unavailable)" : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
              
              {/* Duration */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  darkMode ? "text-gray-300" : "text-gray-700"
                }`}>
                  Duration *
                </label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  required
                  className={`w-full px-4 py-2 rounded-lg border ${
                    darkMode
                      ? "bg-gray-700 border-gray-600 text-white"
                      : "bg-white border-gray-300 text-gray-900"
                  }`}
                >
                  <option value="30">30 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="90">1.5 hours</option>
                  <option value="120">2 hours</option>
                </select>
              </div>
              
              {/* Notes */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  darkMode ? "text-gray-300" : "text-gray-700"
                }`}>
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Any special requests or notes..."
                  className={`w-full px-4 py-2 rounded-lg border ${
                    darkMode
                      ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                      : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
                  }`}
                />
              </div>
              
              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className={`w-full px-6 py-3 rounded-lg font-semibold transition ${
                  submitting
                    ? "bg-gray-400 cursor-not-allowed"
                    : darkMode
                    ? "bg-teal-600 hover:bg-teal-700 text-white"
                    : "bg-green-500 hover:bg-green-600 text-white"
                }`}
              >
                {submitting ? "Booking..." : "Book Court"}
              </button>
            </form>
          </div>
          
          {/* Existing Bookings */}
          <div className={`p-6 rounded-lg shadow-md ${
            darkMode ? "bg-gray-800" : "bg-white"
          }`}>
            <h2 className="text-xl font-bold mb-6">
              Bookings for {format(new Date(selectedDate), 'MMM d, yyyy')}
            </h2>
            
            {bookings.length > 0 ? (
              <div className="space-y-3">
                {bookings.map(booking => (
                  <div
                    key={booking.id}
                    className={`p-4 rounded-lg border ${
                      darkMode
                        ? "bg-gray-700 border-gray-600"
                        : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold">
                          {booking.startTime} - {booking.endTime}
                        </p>
                        <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                          {booking.userName}
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs ${
                        booking.status === 'confirmed'
                          ? darkMode ? "bg-green-900 text-green-200" : "bg-green-100 text-green-800"
                          : darkMode ? "bg-yellow-900 text-yellow-200" : "bg-yellow-100 text-yellow-800"
                      }`}>
                        {booking.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className={darkMode ? "text-gray-400" : "text-gray-600"}>
                No bookings for this court on this date. All time slots are available!
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
