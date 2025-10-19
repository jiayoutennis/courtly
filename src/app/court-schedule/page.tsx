"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth, db } from "../../../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { 
  doc, getDoc, collection, query, 
  getDocs, where 
} from "firebase/firestore";
import DarkModeToggle from "@/app/components/DarkModeToggle";
import PageTitle from "@/app/components/PageTitle";
import { format, addDays, startOfWeek } from "date-fns";

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
}

interface Club {
  id: string;
  name: string;
}

export default function CourtSchedulePage() {
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [club, setClub] = useState<Club | null>(null);
  const [clubId, setClubId] = useState<string>("");
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [courts, setCourts] = useState<Court[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  const router = useRouter();

  // Generate time slots from 6:00 AM to 10:00 PM (every hour)
  const timeSlots = Array.from({ length: 17 }, (_, i) => {
    const hour = i + 6;
    return `${hour.toString().padStart(2, '0')}:00`;
  });

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
        const userDoc = await getDoc(doc(db, "users", user.uid));
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          // Get club ID from user's organization
          if (userData.organization) {
            const orgId = Array.isArray(userData.organization) 
              ? userData.organization[0] 
              : userData.organization;
            
            setClubId(orgId);
            await fetchClubData(orgId);
            await fetchCourts(orgId);
            await fetchBookings(orgId);
          } else {
            setError("No organization assigned to your account");
          }
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        setError("Failed to load data");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Refetch bookings when week changes
  useEffect(() => {
    if (clubId) {
      fetchBookings(clubId);
    }
  }, [weekStart, clubId]);

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
        setClub({
          id: clubDoc.id,
          name: clubDoc.data().name || "Tennis Club"
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
      // Fetch bookings from the /orgs/{clubId}/bookings subcollection
      const startDate = format(weekStart, 'yyyy-MM-dd');
      const endDate = format(addDays(weekStart, 6), 'yyyy-MM-dd');
      
      const bookingsQuery = query(
        collection(db, `orgs/${clubId}/bookings`),
        where("date", ">=", startDate),
        where("date", "<=", endDate)
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
          userName: data.userName || "Member"
        });
      });
      
      setBookings(bookingsData);
    } catch (error) {
      console.error("Error fetching bookings:", error);
    }
  };

  const handlePreviousWeek = () => {
    const newWeekStart = addDays(weekStart, -7);
    setWeekStart(newWeekStart);
    if (clubId) {
      fetchBookings(clubId);
    }
  };

  const handleNextWeek = () => {
    const newWeekStart = addDays(weekStart, 7);
    setWeekStart(newWeekStart);
    if (clubId) {
      fetchBookings(clubId);
    }
  };

  const handleToday = () => {
    const newWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    setWeekStart(newWeekStart);
    setSelectedDate(new Date());
    if (clubId) {
      fetchBookings(clubId);
    }
  };

  const handleDateSelect = (date: Date) => {
    const newWeekStart = startOfWeek(date, { weekStartsOn: 1 });
    setWeekStart(newWeekStart);
    setSelectedDate(date);
    setShowDatePicker(false);
    if (clubId) {
      fetchBookings(clubId);
    }
  };

  const handleSlotClick = (courtId: string, date: string, time: string) => {
    // Check if slot is already booked
    const existingBooking = getBookingForSlot(courtId, date, time);
    if (existingBooking) {
      // If it's the user's booking, they could cancel it
      if (existingBooking.userId === currentUserId) {
        setSuccess("This is your booking. Use the 'My Bookings' page to manage it.");
      } else {
        setError("This time slot is already booked.");
      }
      // Clear message after 3 seconds
      setTimeout(() => {
        setError("");
        setSuccess("");
      }, 3000);
      return;
    }

    // Redirect to reserve-court page with pre-selected date, court, and time
    if (clubId) {
      router.push(`/club/${clubId}/reserve-court?date=${date}&court=${courtId}&time=${time}`);
    }
  };

  const getBookingForSlot = (courtId: string, date: string, time: string) => {
    return bookings.find(booking => 
      booking.courtId === courtId &&
      booking.date === date &&
      booking.startTime === time
    );
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
      <header className={`py-6 px-6 ${
        darkMode ? "" : "border-b border-gray-100"
      }`}>
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center">
            <div>
              <h1 className={`text-3xl font-light tracking-tight ${
                darkMode ? "text-white" : "text-gray-900"
              }`}>
                Court Schedule
              </h1>
              {club && (
                <p className={`mt-1 text-sm font-light ${
                  darkMode ? "text-gray-500" : "text-gray-400"
                }`}>
                  {club.name}
                </p>
              )}
            </div>
            <div className="flex items-center gap-4">
              <DarkModeToggle darkMode={darkMode} setDarkMode={setDarkMode} />
              <Link
                href="/dashboard"
                className={`text-sm font-light ${
                  darkMode
                    ? "text-gray-400 hover:text-white"
                    : "text-gray-500 hover:text-gray-900"
                } transition-colors`}
              >
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Messages - Minimalist */}
        {error && (
          <div className={`mb-6 p-4 text-sm font-light ${
            darkMode ? "text-red-400" : "text-red-600"
          }`}>
            {error}
          </div>
        )}

        {success && (
          <div className={`mb-6 p-4 text-sm font-light ${
            darkMode ? "text-green-400" : "text-green-600"
          }`}>
            {success}
          </div>
        )}

        {/* Minimalist Week Navigation */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              onClick={handlePreviousWeek}
              className={`p-2 transition-colors ${
                darkMode
                  ? "text-gray-500 hover:text-white"
                  : "text-gray-400 hover:text-gray-900"
              }`}
              title="Previous week"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={handleToday}
              className={`px-4 py-2 text-sm font-light transition-colors ${
                darkMode
                  ? "text-gray-400 hover:text-white"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Today
            </button>
            <button
              onClick={handleNextWeek}
              className={`p-2 transition-colors ${
                darkMode
                  ? "text-gray-500 hover:text-white"
                  : "text-gray-400 hover:text-gray-900"
              }`}
              title="Next week"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          
          {/* Date Display with Calendar */}
          <div className="relative flex items-center gap-3 date-picker-container">
            <div className={`text-sm font-light ${
              darkMode ? "text-gray-400" : "text-gray-500"
            }`}>
              {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
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
              <div className={`absolute top-full right-0 mt-3 p-4 rounded-lg shadow-2xl z-50 ${
                darkMode ? "bg-[#1a1a1a]" : "bg-white border border-gray-100"
              }`}>
                <input
                  type="date"
                  value={format(selectedDate, 'yyyy-MM-dd')}
                  onChange={(e) => handleDateSelect(new Date(e.target.value))}
                  className={`px-3 py-2 text-sm font-light cursor-pointer ${
                    darkMode 
                      ? "bg-[#0a0a0a] text-gray-300" 
                      : "bg-white text-gray-900 border border-gray-200"
                  } rounded focus:outline-none`}
                />
              </div>
            )}
          </div>
        </div>

        {/* Minimalist Schedule Grid */}
        <div className={`${
          darkMode ? "" : "border border-gray-100"
        } rounded-lg overflow-hidden`}>
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              {/* Header - Days */}
              <div className="grid grid-cols-8">
                <div className={`px-3 py-4 text-xs font-light tracking-wide ${
                  darkMode ? "text-gray-600" : "text-gray-400"
                }`}>
                  TIME
                </div>
                {Array.from({ length: 7 }, (_, dayIndex) => {
                  const currentDay = addDays(weekStart, dayIndex);
                  const isToday = format(currentDay, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                  return (
                    <div
                      key={dayIndex}
                      className="px-3 py-4 text-center"
                    >
                      <div className={`text-xs font-light tracking-wide mb-1 ${
                        isToday 
                          ? darkMode ? "text-white" : "text-gray-900"
                          : darkMode ? "text-gray-500" : "text-gray-400"
                      }`}>
                        {format(currentDay, 'EEE').toUpperCase()}
                      </div>
                      <div className={`text-sm ${
                        isToday 
                          ? darkMode ? "text-white" : "text-gray-900"
                          : darkMode ? "text-gray-600" : "text-gray-500"
                      }`}>
                        {format(currentDay, 'd')}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Time Slots */}
              {timeSlots.map((time) => (
                <div key={time} className={`grid grid-cols-8 ${
                  darkMode ? "border-t border-[#1a1a1a]" : "border-t border-gray-50"
                }`}>
                  {/* Time Label */}
                  <div className={`px-3 py-4 text-xs font-light ${
                    darkMode ? "text-gray-600" : "text-gray-400"
                  }`}>
                    {time}
                  </div>
                  
                  {/* Day Slots */}
                  {Array.from({ length: 7 }, (_, dayIndex) => {
                    const currentDay = addDays(weekStart, dayIndex);
                    const dateStr = format(currentDay, 'yyyy-MM-dd');
                    const courtId = courts[dayIndex]?.id || `court-${dayIndex + 1}`;
                    const booking = getBookingForSlot(courtId, dateStr, time);
                    const isToday = format(currentDay, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                    const isPast = currentDay < new Date() && !isToday;
                    
                    return (
                      <div
                        key={`${dayIndex}-${time}`}
                        onClick={() => !booking && !isPast && handleSlotClick(courtId, dateStr, time)}
                        className={`relative h-16 transition-colors ${
                          !booking && !isPast ? "cursor-pointer" : ""
                        }
                        ${isPast 
                          ? darkMode ? "bg-[#0a0a0a]/50" : "bg-gray-50/50 opacity-40" 
                          : darkMode ? "hover:bg-[#1a1a1a]" : "hover:bg-gray-50"
                        }`}
                      >
                        {booking && booking.startTime === time && (
                          <div
                            className={`absolute inset-x-1 top-1 rounded px-2 py-1.5 ${
                              booking.userId === currentUserId 
                                ? darkMode ? "bg-white text-black" : "bg-black text-white"
                                : darkMode ? "bg-gray-800 text-gray-200" : "bg-gray-100 text-gray-700"
                            }`}
                            style={{
                              height: `${calculateBookingHeight(booking.startTime, booking.endTime) * 0.8 - 8}px`,
                              minHeight: '48px'
                            }}
                          >
                            <div className="text-xs font-light truncate">
                              {booking.userName}
                            </div>
                            <div className="text-[10px] opacity-60 mt-0.5">
                              {booking.startTime} – {booking.endTime}
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

        {/* Minimalist Legend */}
        <div className={`mt-6 flex items-center gap-6 text-xs font-light ${
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
    </div>
  );
}
