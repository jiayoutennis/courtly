"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { auth, db } from "../../../../../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { 
  doc, getDoc, collection, query, 
  getDocs, addDoc, where, serverTimestamp 
} from "firebase/firestore";
import DarkModeToggle from "@/app/components/DarkModeToggle";
import PageTitle from "@/app/components/PageTitle";
import { format, addDays, isBefore, isAfter } from "date-fns";

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
  userEmail: string;
}

interface Club {
  id: string;
  name: string;
  courts?: Court[];
  operatingHours?: {
    monday?: { open: string; close: string; closed?: boolean };
    tuesday?: { open: string; close: string; closed?: boolean };
    wednesday?: { open: string; close: string; closed?: boolean };
    thursday?: { open: string; close: string; closed?: boolean };
    friday?: { open: string; close: string; closed?: boolean };
    saturday?: { open: string; close: string; closed?: boolean };
    sunday?: { open: string; close: string; closed?: boolean };
  };
  bookingSettings?: {
    maxDaysInAdvance?: number; // How far ahead users can book
    minBookingDuration?: number; // Minimum hours per booking
    maxBookingDuration?: number; // Maximum hours per booking
    slotInterval?: number; // Time interval in minutes (e.g., 30, 60)
  };
}

interface UserData {
  id: string;
  email: string;
  fullName?: string;
  organization?: string | string[];
  userType: string;
}

export default function CourtReservationPage() {
  const params = useParams();
  const clubId = params?.clubId as string;
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [club, setClub] = useState<Club | null>(null);
  const [courts, setCourts] = useState<Court[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedCourt, setSelectedCourt] = useState<string>("");
  const [selectedStartTime, setSelectedStartTime] = useState("");
  const [selectedDuration, setSelectedDuration] = useState(1);
  const [showBookingModal, setShowBookingModal] = useState(false);
  
  const router = useRouter();

  // Generate time slots based on club operating hours
  const generateTimeSlots = () => {
    if (!club?.operatingHours) {
      return Array.from({ length: 15 }, (_, i) => {
        const hour = i + 6;
        return `${hour.toString().padStart(2, '0')}:00`;
      });
    }

    const dayOfWeek = format(selectedDate, 'EEEE').toLowerCase() as keyof typeof club.operatingHours;
    const hours = club.operatingHours[dayOfWeek];

    if (!hours || hours.closed) {
      return [];
    }

    const openHour = parseInt(hours.open?.split(':')[0] || '0');
    const closeHour = parseInt(hours.close?.split(':')[0] || '0');
    const interval = club.bookingSettings?.slotInterval || 60;

    const slots: string[] = [];
    for (let hour = openHour; hour < closeHour; hour++) {
      if (interval === 30) {
        slots.push(`${hour.toString().padStart(2, '0')}:00`);
        slots.push(`${hour.toString().padStart(2, '0')}:30`);
      } else {
        slots.push(`${hour.toString().padStart(2, '0')}:00`);
      }
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
        const userDoc = await getDoc(doc(db, "users", user.uid));
        
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserData({
            id: user.uid,
            email: user.email || "",
            fullName: data.fullName || data.name || "",
            organization: data.organization,
            userType: data.userType
          });

          await fetchClubData();
          await fetchBookings();
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

  useEffect(() => {
    if (clubId) {
      fetchBookings();
    }
  }, [selectedDate, clubId]);

  const fetchClubData = async () => {
    try {
      const clubDoc = await getDoc(doc(db, "orgs", clubId));
      if (clubDoc.exists()) {
        const clubData = clubDoc.data();
        const clubInfo: Club = {
          id: clubDoc.id,
          name: clubData.name || "Tennis Club",
          courts: clubData.courts || [],
          operatingHours: clubData.operatingHours || {
            monday: { open: "06:00", close: "22:00" },
            tuesday: { open: "06:00", close: "22:00" },
            wednesday: { open: "06:00", close: "22:00" },
            thursday: { open: "06:00", close: "22:00" },
            friday: { open: "06:00", close: "22:00" },
            saturday: { open: "08:00", close: "20:00" },
            sunday: { open: "08:00", close: "20:00" }
          },
          bookingSettings: clubData.bookingSettings || {
            maxDaysInAdvance: 14,
            minBookingDuration: 1,
            maxBookingDuration: 3,
            slotInterval: 60
          }
        };
        
        setClub(clubInfo);
        
        if (clubInfo.courts && clubInfo.courts.length > 0) {
          setCourts(clubInfo.courts);
          if (clubInfo.courts[0]) {
            setSelectedCourt(clubInfo.courts[0].id);
          }
        } else {
          // Generate default courts if none exist
          const defaultCourts = Array.from({ length: 4 }, (_, i) => ({
            id: `court-${i + 1}`,
            name: `Court ${i + 1}`,
            courtType: "Hard",
            isIndoor: false
          }));
          setCourts(defaultCourts);
          if (defaultCourts[0]) {
            setSelectedCourt(defaultCourts[0].id);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching club:", error);
      setError("Failed to load club information");
    }
  };

  const fetchBookings = async () => {
    try {
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
          userEmail: data.userEmail || ""
        });
      });
      
      setBookings(bookingsData);
    } catch (error) {
      console.error("Error fetching bookings:", error);
    }
  };

  const isTimeSlotAvailable = (courtId: string, time: string) => {
    return !bookings.some(booking => 
      booking.courtId === courtId &&
      booking.startTime === time
    );
  };

  const canBookDate = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const maxDays = club?.bookingSettings?.maxDaysInAdvance || 14;
    const maxDate = addDays(today, maxDays);
    
    return !isBefore(date, today) && !isAfter(date, maxDate);
  };

  const handleDateChange = (days: number) => {
    const newDate = addDays(selectedDate, days);
    if (canBookDate(newDate)) {
      setSelectedDate(newDate);
    }
  };

  const handleBooking = async () => {
    if (!userData || !selectedCourt || !selectedStartTime) {
      setError("Please select a court and time");
      return;
    }

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      // Calculate end time
      const [hours, minutes] = selectedStartTime.split(':').map(Number);
      const endHour = (hours || 0) + selectedDuration;
      const endTime = `${endHour.toString().padStart(2, '0')}:${(minutes || 0).toString().padStart(2, '0')}`;

      console.log("Creating booking with data:", {
        clubId,
        courtId: selectedCourt,
        date: format(selectedDate, 'yyyy-MM-dd'),
        startTime: selectedStartTime,
        endTime: endTime,
        userId: userData.id
      });

      // Create booking
      await addDoc(collection(db, `orgs/${clubId}/bookings`), {
        courtId: selectedCourt,
        date: format(selectedDate, 'yyyy-MM-dd'),
        startTime: selectedStartTime,
        endTime: endTime,
        userId: userData.id,
        userName: userData.fullName || userData.email,
        userEmail: userData.email,
        createdAt: serverTimestamp(),
        status: 'confirmed'
      });

      setSuccess("Court reserved successfully!");
      setShowBookingModal(false);
      setSelectedStartTime("");
      await fetchBookings();

      setTimeout(() => setSuccess(""), 3000);
    } catch (error: any) {
      console.error("Error creating booking:", error);
      console.error("Error code:", error.code);
      console.error("Error message:", error.message);
      
      // Provide specific error messages
      if (error.code === 'permission-denied') {
        setError("Permission denied. Please make sure you are a member of this club. Contact your club administrator if you believe this is an error.");
      } else if (error.code === 'failed-precondition') {
        setError("Booking validation failed. Please check that all required fields are filled.");
      } else {
        setError(`Failed to create booking: ${error.message || "Unknown error"}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const openBookingModal = (courtId: string, time: string) => {
    if (!isTimeSlotAvailable(courtId, time)) {
      setError("This time slot is already booked");
      setTimeout(() => setError(""), 3000);
      return;
    }

    setSelectedCourt(courtId);
    setSelectedStartTime(time);
    setShowBookingModal(true);
  };

  const getBookingForSlot = (courtId: string, time: string) => {
    return bookings.find(booking => 
      booking.courtId === courtId &&
      booking.startTime === time
    );
  };

  const calculateBookingHeight = (startTime: string, endTime: string) => {
    const start = parseInt(startTime.split(':')[0] || '0');
    const end = parseInt(endTime.split(':')[0] || '0');
    return (end - start) * 80; // 80px per hour
  };

  const getDayOfWeekLabel = () => {
    if (!club?.operatingHours) return "06:00 - 22:00";
    
    const dayOfWeek = format(selectedDate, 'EEEE').toLowerCase();
    const hours = club.operatingHours[dayOfWeek as keyof typeof club.operatingHours];
    
    if (!hours || hours.closed) {
      return "Closed";
    }
    
    return `${hours.open} - ${hours.close}`;
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

  const dayOfWeek = format(selectedDate, 'EEEE').toLowerCase();
  const isClosed = club?.operatingHours?.[dayOfWeek as keyof typeof club.operatingHours]?.closed || false;

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      darkMode ? "bg-gray-900 text-gray-50" : "bg-gray-50 text-gray-900"
    }`}>
      <PageTitle title={`Court Reservation - ${club?.name || 'Club'} - Courtly`} />
      
      {/* Header */}
      <header className={`py-6 px-4 shadow-md ${
        darkMode ? "bg-gray-800" : "bg-white"
      }`}>
        <div className="container mx-auto">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Court Reservation</h1>
              {club && (
                <p className={`mt-1 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                  {club.name}
                </p>
              )}
            </div>
            <div className="flex items-center gap-4">
              <DarkModeToggle darkMode={darkMode} setDarkMode={setDarkMode} />
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
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Success/Error Messages */}
        {success && (
          <div className="mb-6 p-4 rounded-lg bg-green-100 border border-green-400 text-green-700">
            {success}
          </div>
        )}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-100 border border-red-400 text-red-700">
            {error}
          </div>
        )}

        {/* Booking Info */}
        <div className={`mb-6 p-6 rounded-lg ${
          darkMode ? "bg-gray-800" : "bg-white"
        } shadow-md`}>
          <h2 className="text-xl font-bold mb-4">Booking Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                Maximum Advance Booking
              </p>
              <p className="text-lg font-semibold">
                {club?.bookingSettings?.maxDaysInAdvance || 14} days
              </p>
            </div>
            <div>
              <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                Booking Duration
              </p>
              <p className="text-lg font-semibold">
                {club?.bookingSettings?.minBookingDuration || 1}h - {club?.bookingSettings?.maxBookingDuration || 3}h
              </p>
            </div>
            <div>
              <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                Time Slots
              </p>
              <p className="text-lg font-semibold">
                {club?.bookingSettings?.slotInterval || 60} minutes
              </p>
            </div>
          </div>
        </div>

        {/* Date Navigation */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => handleDateChange(-1)}
              disabled={!canBookDate(addDays(selectedDate, -1))}
              className={`px-4 py-2 rounded-lg ${
                canBookDate(addDays(selectedDate, -1))
                  ? darkMode
                    ? "bg-gray-800 hover:bg-gray-700 text-white"
                    : "bg-white hover:bg-gray-50 text-gray-900"
                  : "bg-gray-400 cursor-not-allowed text-gray-600"
              } border ${darkMode ? "border-gray-700" : "border-gray-300"} transition-colors`}
            >
              ← Previous Day
            </button>
            <button
              onClick={() => setSelectedDate(new Date())}
              className={`px-4 py-2 rounded-lg ${
                darkMode
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              } transition-colors`}
            >
              Today
            </button>
            <button
              onClick={() => handleDateChange(1)}
              disabled={!canBookDate(addDays(selectedDate, 1))}
              className={`px-4 py-2 rounded-lg ${
                canBookDate(addDays(selectedDate, 1))
                  ? darkMode
                    ? "bg-gray-800 hover:bg-gray-700 text-white"
                    : "bg-white hover:bg-gray-50 text-gray-900"
                  : "bg-gray-400 cursor-not-allowed text-gray-600"
              } border ${darkMode ? "border-gray-700" : "border-gray-300"} transition-colors`}
            >
              Next Day →
            </button>
          </div>
          <div>
            <div className="text-lg font-semibold">
              {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </div>
            <div className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
              Hours: {getDayOfWeekLabel()}
            </div>
          </div>
        </div>

        {/* Schedule Grid */}
        {isClosed ? (
          <div className={`p-12 rounded-lg text-center ${
            darkMode ? "bg-gray-800" : "bg-white"
          } shadow-md`}>
            <h2 className="text-2xl font-bold mb-2">Club Closed</h2>
            <p className={darkMode ? "text-gray-400" : "text-gray-600"}>
              The club is closed on {format(selectedDate, 'EEEE')}s. Please select another day.
            </p>
          </div>
        ) : timeSlots.length === 0 ? (
          <div className={`p-12 rounded-lg text-center ${
            darkMode ? "bg-gray-800" : "bg-white"
          } shadow-md`}>
            <h2 className="text-2xl font-bold mb-2">No Available Times</h2>
            <p className={darkMode ? "text-gray-400" : "text-gray-600"}>
              There are no available time slots for this day.
            </p>
          </div>
        ) : (
          <div className={`rounded-lg shadow-lg overflow-hidden ${
            darkMode ? "bg-gray-800" : "bg-white"
          }`}>
            <div className="overflow-x-auto">
              <div className="min-w-[800px]">
                {/* Header Row */}
                <div className={`grid border-b-2 border-yellow-600`} style={{ gridTemplateColumns: `120px repeat(${courts.length}, 1fr)` }}>
                  <div className={`p-4 font-bold text-center ${
                    darkMode ? "bg-gray-700 text-yellow-400" : "bg-green-800 text-yellow-400"
                  }`}>
                    Time
                  </div>
                  {courts.map((court) => (
                    <div
                      key={court.id}
                      className={`p-4 font-bold text-center ${
                        darkMode ? "bg-gray-700 text-yellow-400" : "bg-green-800 text-yellow-400"
                      }`}
                    >
                      <div>{court.name}</div>
                      <div className="text-xs font-normal opacity-90">
                        {court.courtType} {court.isIndoor ? '(Indoor)' : '(Outdoor)'}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Time Slots */}
                {timeSlots.map((time) => (
                  <div key={time} className="grid border-b border-yellow-700" style={{ gridTemplateColumns: `120px repeat(${courts.length}, 1fr)` }}>
                    {/* Time Column */}
                    <div className={`p-4 font-semibold text-center border-r-2 border-yellow-700 ${
                      darkMode ? "bg-gray-700 text-white" : "bg-green-800 text-white"
                    }`}>
                      {time}
                    </div>
                    
                    {/* Court Columns */}
                    {courts.map((court, courtIndex) => {
                      const booking = getBookingForSlot(court.id, time);
                      const isAvailable = isTimeSlotAvailable(court.id, time);
                      
                      return (
                        <div
                          key={`${court.id}-${time}`}
                          className={`relative h-20 border-r border-yellow-700 ${
                            isAvailable 
                              ? darkMode ? "bg-gray-800 hover:bg-gray-750 cursor-pointer" : "bg-gray-50 hover:bg-gray-100 cursor-pointer"
                              : darkMode ? "bg-gray-800" : "bg-gray-50"
                          } ${courtIndex === courts.length - 1 ? "border-r-2" : ""}`}
                          onClick={() => isAvailable && openBookingModal(court.id, time)}
                        >
                          {booking && booking.startTime === time ? (
                            <div
                              className={`absolute inset-x-1 top-1 rounded-md p-2 text-white text-sm font-medium flex flex-col justify-center items-center ${
                                booking.userId === userData?.id
                                  ? "bg-blue-700"
                                  : "bg-green-700"
                              }`}
                              style={{
                                height: `${calculateBookingHeight(booking.startTime, booking.endTime) - 8}px`
                              }}
                            >
                              <div className="font-bold">{booking.userName}</div>
                              <div className="text-xs opacity-90">
                                {booking.startTime} - {booking.endTime}
                              </div>
                            </div>
                          ) : isAvailable ? (
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                              <div className={`text-xs font-semibold ${
                                darkMode ? "text-green-400" : "text-green-600"
                              }`}>
                                Click to Book
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="mt-6 flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-green-700 rounded"></div>
            <span className="text-sm">Booked by Others</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-700 rounded"></div>
            <span className="text-sm">Your Bookings</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded border-2 ${
              darkMode ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-300"
            }`}></div>
            <span className="text-sm">Available (Click to Book)</span>
          </div>
        </div>
      </div>

      {/* Booking Modal */}
      {showBookingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`rounded-lg shadow-xl max-w-md w-full ${
            darkMode ? "bg-gray-800" : "bg-white"
          }`}>
            <div className={`p-6 border-b ${
              darkMode ? "border-gray-700" : "border-gray-200"
            }`}>
              <h2 className="text-2xl font-bold">Book Court</h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Court</label>
                <select
                  value={selectedCourt}
                  onChange={(e) => setSelectedCourt(e.target.value)}
                  className={`w-full px-4 py-2 rounded-lg border ${
                    darkMode
                      ? "bg-gray-700 border-gray-600 text-white"
                      : "bg-white border-gray-300 text-gray-900"
                  }`}
                >
                  {courts.map((court) => (
                    <option key={court.id} value={court.id}>
                      {court.name} - {court.courtType} {court.isIndoor ? '(Indoor)' : '(Outdoor)'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Date</label>
                <input
                  type="text"
                  value={format(selectedDate, 'EEEE, MMMM d, yyyy')}
                  disabled
                  className={`w-full px-4 py-2 rounded-lg border ${
                    darkMode
                      ? "bg-gray-700 border-gray-600 text-gray-400"
                      : "bg-gray-100 border-gray-300 text-gray-600"
                  }`}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Start Time</label>
                <input
                  type="text"
                  value={selectedStartTime}
                  disabled
                  className={`w-full px-4 py-2 rounded-lg border ${
                    darkMode
                      ? "bg-gray-700 border-gray-600 text-gray-400"
                      : "bg-gray-100 border-gray-300 text-gray-600"
                  }`}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Duration (hours)</label>
                <select
                  value={selectedDuration}
                  onChange={(e) => setSelectedDuration(parseInt(e.target.value))}
                  className={`w-full px-4 py-2 rounded-lg border ${
                    darkMode
                      ? "bg-gray-700 border-gray-600 text-white"
                      : "bg-white border-gray-300 text-gray-900"
                  }`}
                >
                  {Array.from(
                    { length: (club?.bookingSettings?.maxBookingDuration || 3) - (club?.bookingSettings?.minBookingDuration || 1) + 1 },
                    (_, i) => (club?.bookingSettings?.minBookingDuration || 1) + i
                  ).map((duration) => (
                    <option key={duration} value={duration}>
                      {duration} hour{duration > 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={`p-6 border-t flex gap-4 ${
              darkMode ? "border-gray-700" : "border-gray-200"
            }`}>
              <button
                onClick={handleBooking}
                className="flex-1 py-2 rounded-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors"
              >
                Confirm Booking
              </button>
              <button
                onClick={() => {
                  setShowBookingModal(false);
                  setSelectedStartTime("");
                }}
                className={`px-6 py-2 rounded-lg font-semibold ${
                  darkMode
                    ? "bg-gray-700 hover:bg-gray-600 text-gray-200"
                    : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                }`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
