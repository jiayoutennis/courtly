"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { auth, db } from "../../../../../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { 
  doc, getDoc, collection, query, 
  getDocs, where, addDoc, serverTimestamp, deleteDoc
} from "firebase/firestore";
import DarkModeToggle from "@/app/components/DarkModeToggle";
import PageTitle from "@/app/components/PageTitle";
import { format, addDays } from "date-fns";

interface Court {
  id: string;
  name: string;
  courtType: string;
  isIndoor: boolean;
}

interface Booking {
  id: string;
  courtId: string;
  date: string;
  startTime: string;
  endTime: string;
  userId: string;
  userName: string;
  notes?: string;
}

interface Club {
  id: string;
  name: string;
  operatingHours?: {
    startTime: string;
    endTime: string;
  };
  maxAdvanceBookingDays?: number; // Default 30 days if not specified
}

export default function CourtSchedulePage() {
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [club, setClub] = useState<Club | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [courts, setCourts] = useState<Court[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [bookingData, setBookingData] = useState({
    courtId: "",
    courtName: "",
    date: "",
    startTime: "",
    endTime: "",
    duration: 1,
    notes: ""
  });
  const [currentUserName, setCurrentUserName] = useState("");
  const [isCoach, setIsCoach] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const router = useRouter();
  const params = useParams();
  const clubId = params?.clubId as string;

  // Generate time slots based on club operating hours (default 6:00 AM to 10:00 PM)
  const generateTimeSlots = () => {
    const startHour = club?.operatingHours?.startTime 
      ? parseInt(club.operatingHours.startTime.split(':')[0] || '6') 
      : 6;
    const endHour = club?.operatingHours?.endTime 
      ? parseInt(club.operatingHours.endTime.split(':')[0] || '22') 
      : 22;
    
    const slots = [];
    for (let hour = startHour; hour <= endHour; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  useEffect(() => {
    const savedMode = localStorage.getItem("darkMode");
    if (savedMode === "true") {
      setDarkMode(true);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/signin");
        return;
      }

      try {
        setCurrentUserId(user.uid);
        
        // Get user's name and check if they're a coach or admin
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setCurrentUserName(userData.name || user.email || "Member");
          setIsCoach(userData.userType === "coach");
          setIsAdmin(userData.userType === "admin");
        }
        
        if (clubId) {
          await fetchClubData(clubId);
          await fetchCourts(clubId);
          await fetchBookings(clubId);
        } else {
          setError("Invalid club ID");
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        setError("Failed to load data");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router, clubId]);

  // Refetch bookings when selected date changes
  useEffect(() => {
    if (clubId) {
      fetchBookings(clubId);
    }
  }, [selectedDate, clubId]);

  // Close date picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showDatePicker && !target.closest('.date-picker-container')) {
        setShowDatePicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDatePicker]);

  const fetchClubData = async (clubId: string) => {
    try {
      const clubDoc = await getDoc(doc(db, "orgs", clubId));
      if (clubDoc.exists()) {
        const data = clubDoc.data();
        setClub({
          id: clubDoc.id,
          name: data.name || "Tennis Club",
          operatingHours: data.reservationSettings ? {
            startTime: data.reservationSettings.startTime || "08:00",
            endTime: data.reservationSettings.endTime || "20:00"
          } : {
            startTime: "08:00",
            endTime: "20:00"
          },
          maxAdvanceBookingDays: data.maxAdvanceBookingDays || 30
        });
      }
    } catch (error) {
      console.error("Error fetching club:", error);
    }
  };

  const fetchCourts = async (clubId: string) => {
    try {
      // Fetch courts from the /orgs/{clubId}/courts subcollection
      const courtsQuery = query(collection(db, `orgs/${clubId}/courts`));
      const courtsSnapshot = await getDocs(courtsQuery);
      
      if (!courtsSnapshot.empty) {
        const courtsData: Court[] = [];
        courtsSnapshot.forEach((doc) => {
          const data = doc.data();
          courtsData.push({
            id: doc.id,
            name: data.name || `Court ${data.number || ''}`,
            courtType: data.surface || "Hard",
            isIndoor: data.indoor || false
          });
        });
        setCourts(courtsData);
      } else {
        // Fallback: generate default courts if none exist
        const defaultCourts = Array.from({ length: 7 }, (_, i) => ({
          id: `court-${i + 1}`,
          name: `Court ${i + 1}`,
          courtType: "Hard",
          isIndoor: false
        }));
        setCourts(defaultCourts);
      }
    } catch (error) {
      console.error("Error fetching courts:", error);
    }
  };

  const fetchBookings = async (clubId: string) => {
    try {
      // Fetch bookings for the selected date only
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      const bookingsQuery = query(
        collection(db, `orgs/${clubId}/bookings`),
        where("date", "==", dateStr)
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
          userName: data.userName || "Member",
          notes: data.notes || ""
        });
      });
      
      setBookings(bookingsData);
    } catch (error) {
      console.error("Error fetching bookings:", error);
    }
  };

  const handlePreviousDay = () => {
    const newDate = addDays(selectedDate, -1);
    // Don't allow going before today (unless admin/coach)
    if (!isCoach && !isAdmin && newDate < new Date(new Date().setHours(0, 0, 0, 0))) {
      return;
    }
    setSelectedDate(newDate);
    if (clubId) {
      fetchBookings(clubId);
    }
  };

  const handleNextDay = () => {
    const newDate = addDays(selectedDate, 1);
    // Don't allow going beyond max advance booking days (unless admin/coach)
    if (!isCoach && !isAdmin) {
      const maxDate = addDays(new Date(), club?.maxAdvanceBookingDays || 30);
      if (newDate > maxDate) {
        return;
      }
    }
    setSelectedDate(newDate);
    if (clubId) {
      fetchBookings(clubId);
    }
  };

  const handleToday = () => {
    setSelectedDate(new Date());
    if (clubId) {
      fetchBookings(clubId);
    }
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setShowDatePicker(false);
    if (clubId) {
      fetchBookings(clubId);
    }
  };

  const handleDateInputChange = (dateString: string) => {
    // Parse date string as local time to avoid timezone issues
    const [year, month, day] = dateString.split('-').map(Number);
    if (year && month && day) {
      const localDate = new Date(year, month - 1, day);
      handleDateSelect(localDate);
    }
  };

  const handleSlotClick = (courtId: string, courtName: string, date: string, time: string) => {
    // Check if slot is blocked by any booking (including multi-hour bookings)
    if (isSlotBlocked(courtId, date, time)) {
      // Coaches and admins can override existing bookings if needed, but first show the existing booking
      const currentHour = parseInt(time.split(':')[0] || '0');
      const blockingBooking = bookings.find(booking => {
        if (booking.courtId !== courtId || booking.date !== date) {
          return false;
        }
        const bookingStartHour = parseInt(booking.startTime.split(':')[0] || '0');
        const bookingEndHour = parseInt(booking.endTime.split(':')[0] || '0');
        return currentHour >= bookingStartHour && currentHour < bookingEndHour;
      });

      if (blockingBooking) {
        setSelectedBooking(blockingBooking);
        setShowViewModal(true);
      }
      return;
    }

    // Check if slot is in the past (coaches and admins can book past slots)
    const isPast = new Date(`${date} ${time}`) < new Date();
    if (isPast && !isCoach && !isAdmin) {
      setError("Cannot book past time slots");
      setTimeout(() => setError(""), 3000);
      return;
    }

    // Check advance booking day limit (coaches and admins can book beyond limit)
    if (!isCoach && !isAdmin) {
      const maxAdvanceDays = club?.maxAdvanceBookingDays || 30;
      const maxDate = addDays(new Date(), maxAdvanceDays);
      const selectedDateTime = new Date(`${date} ${time}`);
      
      if (selectedDateTime > maxDate) {
        setError(`Cannot book more than ${maxAdvanceDays} days in advance`);
        setTimeout(() => setError(""), 3000);
        return;
      }
    }

    // Open booking modal for available slots
    setBookingData({
      courtId,
      courtName,
      date,
      startTime: time,
      endTime: calculateEndTime(time, 1),
      duration: 1,
      notes: ""
    });
    setShowBookingModal(true);
  };

  const calculateEndTime = (startTime: string, hours: number) => {
    const [hour] = startTime.split(':');
    const endHour = parseInt(hour || '0') + hours;
    return `${endHour.toString().padStart(2, '0')}:00`;
  };

  const handleDurationChange = (duration: number) => {
    const newEndTime = calculateEndTime(bookingData.startTime, duration);
    const operatingEndTime = club?.operatingHours?.endTime || "22:00";
    const endHour = parseInt(newEndTime.split(':')[0] || '0');
    const operatingEndHour = parseInt(operatingEndTime.split(':')[0] || '22');
    
    setBookingData(prev => ({
      ...prev,
      duration,
      endTime: newEndTime
    }));
    
    // Show warning if booking extends beyond operating hours (coaches and admins are exempt)
    if (endHour > operatingEndHour && !isCoach && !isAdmin) {
      setError(`Note: Booking extends beyond operating hours (${operatingEndTime}). It will be adjusted when confirmed.`);
    } else if (endHour > operatingEndHour && (isCoach || isAdmin)) {
      setError(`Note: As a ${isCoach ? 'coach' : 'club admin'}, you can book beyond operating hours (${operatingEndTime}).`);
      setTimeout(() => setError(""), 3000);
    } else {
      setError("");
    }
  };

  const handleConfirmBooking = async () => {
    try {
      setError("");
      setSuccess("");

      // Validate booking
      if (!currentUserId || !clubId) {
        setError("Missing user or club information");
        return;
      }

      // Check if slot is in the past (coaches and admins can book past slots)
      const isPast = new Date(`${bookingData.date} ${bookingData.startTime}`) < new Date();
      if (isPast && !isCoach && !isAdmin) {
        setError("Cannot book past time slots");
        return;
      }

      // Check advance booking day limit (coaches and admins can book beyond limit)
      if (!isCoach && !isAdmin) {
        const maxAdvanceDays = club?.maxAdvanceBookingDays || 30;
        const maxDate = addDays(new Date(), maxAdvanceDays);
        const bookingDateTime = new Date(`${bookingData.date} ${bookingData.startTime}`);
        
        if (bookingDateTime > maxDate) {
          setError(`Cannot book more than ${maxAdvanceDays} days in advance`);
          return;
        }
      }

      // Get operating hours
      const operatingEndTime = club?.operatingHours?.endTime || "22:00";
      const endHour = parseInt(bookingData.endTime.split(':')[0] || '0');
      const operatingEndHour = parseInt(operatingEndTime.split(':')[0] || '22');
      
      // Check if booking extends beyond operating hours (coaches and admins are exempt)
      let adjustedEndTime = bookingData.endTime;
      let showWarning = false;
      
      if (endHour > operatingEndHour && !isCoach && !isAdmin) {
        adjustedEndTime = operatingEndTime;
        showWarning = true;
        setError(`Court schedule ends at ${operatingEndTime}. Your booking has been adjusted to end at ${operatingEndTime}.`);
      }

      // Check if any slot in the duration is already booked
      const startHour = parseInt(bookingData.startTime.split(':')[0] || '0');
      const adjustedEndHour = parseInt(adjustedEndTime.split(':')[0] || '0');
      
      for (let hour = startHour; hour < adjustedEndHour; hour++) {
        const timeSlot = `${hour.toString().padStart(2, '0')}:00`;
        const existingBooking = getBookingForSlot(bookingData.courtId, bookingData.date, timeSlot);
        if (existingBooking) {
          setError(`Time slot ${timeSlot} is already booked`);
          return;
        }
      }

      // Create booking with adjusted end time
      await addDoc(collection(db, `orgs/${clubId}/bookings`), {
        courtId: bookingData.courtId,
        courtName: bookingData.courtName,
        date: bookingData.date,
        startTime: bookingData.startTime,
        endTime: adjustedEndTime,
        userId: currentUserId,
        userName: currentUserName,
        notes: bookingData.notes || "",
        createdAt: serverTimestamp(),
        status: "confirmed"
      });

      if (showWarning) {
        setSuccess("Court booked successfully (adjusted to operating hours)!");
      } else {
        setSuccess("Court booked successfully!");
      }
      setShowBookingModal(false);
      
      // Refresh bookings
      await fetchBookings(clubId);

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess("");
      }, 3000);

    } catch (error) {
      console.error("Error booking court:", error);
      setError("Failed to book court. Please try again.");
    }
  };

  const handleCancelBooking = async () => {
    if (!selectedBooking || !clubId) {
      return;
    }

    try {
      setError("");
      setSuccess("");

      // Delete the booking
      await deleteDoc(doc(db, `orgs/${clubId}/bookings`, selectedBooking.id));

      setSuccess("Booking cancelled successfully!");
      setShowViewModal(false);
      setSelectedBooking(null);
      
      // Refresh bookings
      await fetchBookings(clubId);

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess("");
      }, 3000);

    } catch (error) {
      console.error("Error cancelling booking:", error);
      setError("Failed to cancel booking. Please try again.");
    }
  };

  const getBookingForSlot = (courtId: string, date: string, time: string) => {
    return bookings.find(booking => 
      booking.courtId === courtId &&
      booking.date === date &&
      booking.startTime === time
    );
  };

  const isSlotBlocked = (courtId: string, date: string, time: string) => {
    // Check if this slot is blocked by any booking (even if the booking started earlier)
    const currentHour = parseInt(time.split(':')[0] || '0');
    
    return bookings.some(booking => {
      if (booking.courtId !== courtId || booking.date !== date) {
        return false;
      }
      
      const bookingStartHour = parseInt(booking.startTime.split(':')[0] || '0');
      const bookingEndHour = parseInt(booking.endTime.split(':')[0] || '0');
      
      // Check if current time slot falls within the booking period
      return currentHour >= bookingStartHour && currentHour < bookingEndHour;
    });
  };

  const calculateBookingHeight = (startTime: string, endTime: string) => {
    const start = parseInt(startTime.split(':')[0] || '0');
    const end = parseInt(endTime.split(':')[0] || '0');
    return (end - start) * 80; // 80px per hour
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        darkMode ? "bg-[#0a0a0a]" : "bg-white"
      }`}>
        <div className={`w-8 h-8 border-2 border-t-transparent rounded-full animate-spin ${
          darkMode ? "border-white" : "border-black"
        }`}></div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors ${
      darkMode ? "bg-[#0a0a0a]" : "bg-white"
    }`}>
      <PageTitle title="Court Schedule - Courtly" />
      
      {/* Minimalist Header */}
      <header className={`py-4 sm:py-6 px-4 sm:px-6 ${
        darkMode ? "" : "border-b border-gray-100"
      }`}>
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
            <div>
              <h1 className={`text-xl sm:text-2xl md:text-3xl font-light tracking-tight ${
                darkMode ? "text-white" : "text-gray-900"
              }`}>
                Court Schedule
              </h1>
              {club && (
                <>
                  <p className={`mt-1 text-xs sm:text-sm font-light ${
                    darkMode ? "text-gray-500" : "text-gray-400"
                  }`}>
                    {club.name}
                  </p>
                  {!isCoach && !isAdmin && (
                    <p className={`mt-1 text-[10px] sm:text-xs font-light ${
                      darkMode ? "text-gray-600" : "text-gray-500"
                    }`}>
                      Hours: {club.operatingHours?.startTime || '08:00'} - {club.operatingHours?.endTime || '20:00'} • 
                      Book up to {club.maxAdvanceBookingDays || 30} days ahead
                    </p>
                  )}
                </>
              )}
              {(isCoach || isAdmin) && (
                <span className={`mt-2 inline-flex items-center px-2 py-1 text-xs font-light border ${
                  darkMode ? "border-green-900/50 text-green-400" : "border-green-200 text-green-600"
                }`}>
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {isCoach ? 'Coach' : 'Club Admin'} - Unrestricted Booking
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 sm:gap-4">
              <DarkModeToggle darkMode={darkMode} setDarkMode={setDarkMode} />
              <Link
                href="/dashboard"
                className={`text-xs sm:text-sm font-light ${
                  darkMode
                    ? "text-gray-400 hover:text-white"
                    : "text-gray-500 hover:text-gray-900"
                } transition-colors`}
              >
                Dashboard
              </Link>
              <Link
                href={`/club/${clubId}`}
                className={`text-xs sm:text-sm font-light ${
                  darkMode
                    ? "text-gray-400 hover:text-white"
                    : "text-gray-500 hover:text-gray-900"
                } transition-colors`}
              >
                Back to Club
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Messages - Minimalist */}
        {error && (
          <div className={`mb-4 sm:mb-6 p-3 sm:p-4 text-xs sm:text-sm font-light ${
            darkMode ? "text-red-400" : "text-red-600"
          }`}>
            {error}
          </div>
        )}

        {success && (
          <div className={`mb-4 sm:mb-6 p-3 sm:p-4 text-xs sm:text-sm font-light ${
            darkMode ? "text-green-400" : "text-green-600"
          }`}>
            {success}
          </div>
        )}

        {/* Minimalist Day Navigation */}
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-0">
          <div className="flex items-center justify-center sm:justify-start gap-1">
            <button
              onClick={handlePreviousDay}
              className={`p-2 transition-colors ${
                darkMode
                  ? "text-gray-500 hover:text-white"
                  : "text-gray-400 hover:text-gray-900"
              }`}
              title="Previous day"
            >
              <svg className="w-5 h-5 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={handleToday}
              className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-light transition-colors ${
                darkMode
                  ? "text-gray-400 hover:text-white"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Today
            </button>
            <button
              onClick={handleNextDay}
              className={`p-2 transition-colors ${
                darkMode
                  ? "text-gray-500 hover:text-white"
                  : "text-gray-400 hover:text-gray-900"
              }`}
              title="Next day"
            >
              <svg className="w-5 h-5 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          
          {/* Date Display with Calendar */}
          <div className="relative flex items-center justify-center sm:justify-end gap-2 sm:gap-3 date-picker-container">
            <div className={`text-xs sm:text-sm font-light ${
              darkMode ? "text-gray-400" : "text-gray-500"
            }`}>
              {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </div>
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className={`p-1.5 transition-colors ${
                darkMode
                  ? "text-gray-500 hover:text-white"
                  : "text-gray-400 hover:text-gray-900"
              }`}
              title="Pick a date"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
            
            {/* Minimalist Date Picker */}
            {showDatePicker && (
              <div className={`absolute top-full right-0 mt-3 p-3 sm:p-4 rounded-lg shadow-2xl z-50 ${
                darkMode ? "bg-[#1a1a1a]" : "bg-white border border-gray-100"
              }`}>
                <input
                  type="date"
                  value={format(selectedDate, 'yyyy-MM-dd')}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  max={format(addDays(new Date(), club?.maxAdvanceBookingDays || 30), 'yyyy-MM-dd')}
                  onChange={(e) => handleDateInputChange(e.target.value)}
                  className={`px-2 sm:px-3 py-2 text-xs sm:text-sm font-light cursor-pointer ${
                    darkMode 
                      ? "bg-[#0a0a0a] text-gray-300" 
                      : "bg-white text-gray-900 border border-gray-200"
                  } rounded focus:outline-none`}
                />
              </div>
            )}
          </div>
        </div>

        {/* Minimalist Schedule Grid - Courts as Columns */}
        <div className={`${
          darkMode ? "" : "border border-gray-100"
        } rounded-lg overflow-hidden`}>
          <div className="overflow-x-auto">
            <div className="min-w-full">
              {/* Header - Courts */}
              <div className={`grid gap-px ${darkMode ? "bg-[#1a1a1a]" : "bg-gray-100"}`} style={{
                gridTemplateColumns: `80px repeat(${courts.length}, minmax(120px, 1fr))`
              }}>
                <div className={`px-2 sm:px-3 py-3 sm:py-4 text-[10px] sm:text-xs font-light tracking-wide ${
                  darkMode ? "text-gray-600 bg-[#0a0a0a]" : "text-gray-400 bg-white"
                }`}>
                  TIME
                </div>
                {courts.map((court) => (
                  <div
                    key={court.id}
                    className={`px-2 sm:px-3 py-3 sm:py-4 text-center ${
                      darkMode ? "bg-[#0a0a0a]" : "bg-white"
                    }`}
                  >
                    <div className={`text-xs sm:text-sm font-light ${
                      darkMode ? "text-white" : "text-gray-900"
                    }`}>
                      {court.name}
                    </div>
                    <div className={`text-[10px] sm:text-xs mt-1 ${
                      darkMode ? "text-gray-600" : "text-gray-500"
                    }`}>
                      {court.courtType}
                    </div>
                  </div>
                ))}
              </div>

              {/* Time Slots */}
              <div className={`grid gap-px ${darkMode ? "bg-[#1a1a1a]" : "bg-gray-100"}`}>
                {timeSlots.map((time) => (
                  <div key={time} className="grid gap-px" style={{
                    gridTemplateColumns: `120px repeat(${courts.length}, minmax(150px, 1fr))`
                  }}>
                    {/* Time Label */}
                    <div className={`px-2 sm:px-3 py-3 sm:py-4 text-[10px] sm:text-xs font-light flex items-center ${
                      darkMode ? "text-gray-600 bg-[#0a0a0a]" : "text-gray-400 bg-white"
                    }`}>
                      {time}
                    </div>
                    
                    {/* Court Slots */}
                    {courts.map((court) => {
                      const dateStr = format(selectedDate, 'yyyy-MM-dd');
                      const booking = getBookingForSlot(court.id, dateStr, time);
                      const isBlocked = isSlotBlocked(court.id, dateStr, time);
                      const isPast = new Date(`${dateStr} ${time}`) < new Date();
                      
                      return (
                        <div
                          key={`${court.id}-${time}`}
                          onClick={() => handleSlotClick(court.id, court.name, dateStr, time)}
                          className={`relative h-14 sm:h-16 transition-colors ${
                            darkMode ? "bg-[#0a0a0a]" : "bg-white"
                          } ${
                            isPast 
                              ? "opacity-40" 
                              : isBlocked
                                ? "cursor-pointer" // Blocked slots are clickable to view booking
                                : "cursor-pointer" // Available slots are clickable to book
                          }
                          ${isPast 
                            ? "" 
                            : isBlocked
                              ? "" // Blocked slots keep normal appearance
                              : darkMode ? "hover:bg-[#1a1a1a]" : "hover:bg-gray-50"
                          }`}
                        >
                          {booking && booking.startTime === time && (
                            <div
                              className={`absolute inset-x-1 top-1 rounded px-1.5 sm:px-2 py-1 sm:py-1.5 z-10 ${
                                booking.userId === currentUserId 
                                  ? "bg-black text-white"
                                  : "bg-black text-white"
                              }`}
                              style={{
                                height: `${calculateBookingHeight(booking.startTime, booking.endTime) * 1 - 8}px`,
                                minHeight: '40px'
                              }}
                            >
                              <div className="text-[10px] sm:text-xs font-light truncate">
                                {booking.userName}
                              </div>
                              <div className="text-[9px] sm:text-[10px] opacity-60 mt-0.5">
                                {booking.startTime} – {booking.endTime}
                              </div>
                              {booking.notes && (
                                <div className="text-[9px] sm:text-[10px] opacity-80 mt-1 truncate italic">
                                  {booking.notes}
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* Show subtle indicator for continuation of multi-hour booking */}
                          {!booking && isBlocked && !isPast && (
                            <div className={`absolute inset-0 flex items-center justify-center ${
                              darkMode ? "bg-gray-900/30" : "bg-gray-100/50"
                            }`}>
                              <div className={`text-[10px] font-light ${
                                darkMode ? "text-gray-600" : "text-gray-400"
                              }`}>
                                Booked
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Minimalist Legend */}
        <div className={`mt-4 sm:mt-6 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6 text-[10px] sm:text-xs font-light ${
          darkMode ? "text-gray-500" : "text-gray-400"
        }`}>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded ${darkMode ? "bg-white" : "bg-black"}`}></div>
            <span>Your bookings</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded ${darkMode ? "bg-gray-800" : "bg-gray-100"}`}></div>
            <span>Other bookings</span>
          </div>
        </div>
      </div>

      {/* Booking Modal */}
      {showBookingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`max-w-sm sm:max-w-md w-full rounded-lg p-4 sm:p-6 ${
            darkMode ? "bg-[#1a1a1a]" : "bg-white"
          }`}>
            <h2 className={`text-lg sm:text-xl font-light mb-3 sm:mb-4 ${
              darkMode ? "text-white" : "text-gray-900"
            }`}>
              Book Court
            </h2>

            <div className="space-y-3 sm:space-y-4">
              {/* Court Info */}
              <div>
                <label className={`text-[10px] sm:text-xs font-light ${
                  darkMode ? "text-gray-500" : "text-gray-400"
                }`}>
                  Court
                </label>
                <div className={`text-xs sm:text-sm font-light ${
                  darkMode ? "text-white" : "text-gray-900"
                }`}>
                  {bookingData.courtName}
                </div>
              </div>

              {/* Date */}
              <div>
                <label className={`text-[10px] sm:text-xs font-light ${
                  darkMode ? "text-gray-500" : "text-gray-400"
                }`}>
                  Date
                </label>
                <div className={`text-xs sm:text-sm font-light ${
                  darkMode ? "text-white" : "text-gray-900"
                }`}>
                  {format(new Date(bookingData.date), 'EEEE, MMMM d, yyyy')}
                </div>
              </div>

              {/* Start Time */}
              <div>
                <label className={`text-[10px] sm:text-xs font-light ${
                  darkMode ? "text-gray-500" : "text-gray-400"
                }`}>
                  Start Time
                </label>
                <div className={`text-xs sm:text-sm font-light ${
                  darkMode ? "text-white" : "text-gray-900"
                }`}>
                  {bookingData.startTime}
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className={`block text-[10px] sm:text-xs font-light mb-2 ${
                  darkMode ? "text-gray-500" : "text-gray-400"
                }`}>
                  Duration
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3].map((hours) => (
                    <button
                      key={hours}
                      onClick={() => handleDurationChange(hours)}
                      className={`flex-1 px-2 sm:px-3 py-2 text-xs sm:text-sm font-light rounded transition-colors ${
                        bookingData.duration === hours
                          ? darkMode
                            ? "bg-white text-black"
                            : "bg-black text-white"
                          : darkMode
                            ? "bg-[#0a0a0a] text-gray-400 hover:text-white"
                            : "bg-gray-100 text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      {hours} {hours === 1 ? 'hour' : 'hours'}
                    </button>
                  ))}
                </div>
              </div>

              {/* End Time */}
              <div>
                <label className={`text-[10px] sm:text-xs font-light ${
                  darkMode ? "text-gray-500" : "text-gray-400"
                }`}>
                  End Time
                </label>
                <div className={`text-xs sm:text-sm font-light ${
                  darkMode ? "text-white" : "text-gray-900"
                }`}>
                  {bookingData.endTime}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className={`block text-[10px] sm:text-xs font-light mb-2 ${
                  darkMode ? "text-gray-500" : "text-gray-400"
                }`}>
                  Notes (Optional)
                </label>
                <textarea
                  value={bookingData.notes}
                  onChange={(e) => setBookingData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Add any notes about this booking..."
                  rows={3}
                  className={`w-full px-2 sm:px-3 py-2 text-xs sm:text-sm font-light rounded transition-colors resize-none ${
                    darkMode
                      ? "bg-[#0a0a0a] text-white placeholder-gray-600 border border-gray-800 focus:border-gray-700"
                      : "bg-white text-gray-900 placeholder-gray-400 border border-gray-200 focus:border-gray-300"
                  } focus:outline-none`}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 mt-4 sm:mt-6">
              <button
                onClick={() => setShowBookingModal(false)}
                className={`flex-1 px-3 sm:px-4 py-2 text-xs sm:text-sm font-light rounded transition-colors ${
                  darkMode
                    ? "bg-[#0a0a0a] text-gray-400 hover:text-white"
                    : "bg-gray-100 text-gray-600 hover:text-gray-900"
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmBooking}
                className={`flex-1 px-3 sm:px-4 py-2 text-xs sm:text-sm font-light rounded transition-colors ${
                  darkMode
                    ? "bg-white text-black hover:bg-gray-100"
                    : "bg-black text-white hover:bg-gray-800"
                }`}
              >
                Confirm Booking
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Booking Modal */}
      {showViewModal && selectedBooking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`max-w-sm sm:max-w-md w-full rounded-lg p-4 sm:p-6 ${
            darkMode ? "bg-[#1a1a1a]" : "bg-white"
          }`}>
            <h2 className={`text-lg sm:text-xl font-light mb-3 sm:mb-4 ${
              darkMode ? "text-white" : "text-gray-900"
            }`}>
              Booking Details
            </h2>

            <div className="space-y-3 sm:space-y-4">
              {/* Court Info */}
              <div>
                <label className={`text-[10px] sm:text-xs font-light ${
                  darkMode ? "text-gray-500" : "text-gray-400"
                }`}>
                  Court
                </label>
                <div className={`text-xs sm:text-sm font-light ${
                  darkMode ? "text-white" : "text-gray-900"
                }`}>
                  {courts.find(c => c.id === selectedBooking.courtId)?.name || "Court"}
                </div>
              </div>

              {/* Date */}
              <div>
                <label className={`text-[10px] sm:text-xs font-light ${
                  darkMode ? "text-gray-500" : "text-gray-400"
                }`}>
                  Date
                </label>
                <div className={`text-xs sm:text-sm font-light ${
                  darkMode ? "text-white" : "text-gray-900"
                }`}>
                  {format(new Date(selectedBooking.date), 'EEEE, MMMM d, yyyy')}
                </div>
              </div>

              {/* Time */}
              <div>
                <label className={`text-[10px] sm:text-xs font-light ${
                  darkMode ? "text-gray-500" : "text-gray-400"
                }`}>
                  Time
                </label>
                <div className={`text-xs sm:text-sm font-light ${
                  darkMode ? "text-white" : "text-gray-900"
                }`}>
                  {selectedBooking.startTime} – {selectedBooking.endTime}
                </div>
              </div>

              {/* Booked By */}
              <div>
                <label className={`text-[10px] sm:text-xs font-light ${
                  darkMode ? "text-gray-500" : "text-gray-400"
                }`}>
                  Booked By
                </label>
                <div className={`text-xs sm:text-sm font-light ${
                  darkMode ? "text-white" : "text-gray-900"
                }`}>
                  {selectedBooking.userName}
                  {selectedBooking.userId === currentUserId && (
                    <span className={`ml-2 text-[10px] sm:text-xs ${
                      darkMode ? "text-gray-500" : "text-gray-400"
                    }`}>
                      (You)
                    </span>
                  )}
                </div>
              </div>

              {/* Notes */}
              {selectedBooking.notes && (
                <div>
                  <label className={`text-[10px] sm:text-xs font-light ${
                    darkMode ? "text-gray-500" : "text-gray-400"
                  }`}>
                    Notes
                  </label>
                  <div className={`text-xs sm:text-sm font-light ${
                    darkMode ? "text-white" : "text-gray-900"
                  }`}>
                    {selectedBooking.notes}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 mt-4 sm:mt-6">
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setSelectedBooking(null);
                }}
                className={`flex-1 px-3 sm:px-4 py-2 text-xs sm:text-sm font-light rounded transition-colors ${
                  darkMode
                    ? "bg-[#0a0a0a] text-gray-400 hover:text-white"
                    : "bg-gray-100 text-gray-600 hover:text-gray-900"
                }`}
              >
                Close
              </button>
              {selectedBooking.userId === currentUserId && (
                <button
                  onClick={handleCancelBooking}
                  className={`flex-1 px-3 sm:px-4 py-2 text-xs sm:text-sm font-light rounded transition-colors ${
                    darkMode
                      ? "bg-red-600 text-white hover:bg-red-700"
                      : "bg-red-500 text-white hover:bg-red-600"
                  }`}
                >
                  Cancel Booking
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
