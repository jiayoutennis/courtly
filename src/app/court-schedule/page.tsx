"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../../../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { 
  doc, getDoc, collection, query, 
  getDocs, addDoc, updateDoc, deleteDoc, where, serverTimestamp 
} from "firebase/firestore";
import DarkModeToggle from "@/app/components/DarkModeToggle";
import PageTitle from "@/app/components/PageTitle";
import { format, addDays, startOfWeek, addWeeks, isSameDay } from "date-fns";

// Define types
interface Court {
  id: string;
  name: string;
  courtNumber: number;
  courtType: string;
  isActive: boolean;
  openTime: string; // Format: "HH:MM" (24-hour)
  closeTime: string; // Format: "HH:MM" (24-hour)
}

interface ScheduleSlot {
  id?: string;
  courtId: string;
  date: string; // YYYY-MM-DD format
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  isBlocked: boolean;
  reason?: string; // Optional reason for blocking
  createdBy?: string; // User ID who created this slot
  createdAt?: any;
  updatedAt?: any;
}

interface ClubSettings {
  id: string;
  name: string;
}

export default function CourtSchedulePage() {
  const [darkMode, setDarkMode] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [clubId, setClubId] = useState<string | null>(null);
  const [clubSettings, setClubSettings] = useState<ClubSettings | null>(null);
  const [courts, setCourts] = useState<Court[]>([]);
  const [scheduleSlots, setScheduleSlots] = useState<ScheduleSlot[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedCourt, setSelectedCourt] = useState<string | null>(null);
  const [isAddingSlot, setIsAddingSlot] = useState(false);
  const [newSlot, setNewSlot] = useState<Omit<ScheduleSlot, 'id'>>({
    courtId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '08:00',
    endTime: '09:00',
    isBlocked: true,
    reason: 'Maintenance'
  });
  const [weekStartDate, setWeekStartDate] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [showClubDropdown, setShowClubDropdown] = useState(false);
  
  const router = useRouter();

  // Handle dark mode toggle
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    localStorage.setItem("darkMode", String(!darkMode));
  };

  // Check auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUser({ ...userData, id: user.uid });
            
            // Always fetch available clubs for club switcher
            await fetchAvailableClubs();
            
            // Check if user is an admin and has an organization
            if (userData.userType === 'admin' && userData.organization) {
              setClubId(userData.organization);
              await fetchClubData(userData.organization);
              await fetchCourtData(userData.organization);
            }
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          setError("Failed to load user information");
        }
      } else {
        // Not logged in
        router.push('/signin');
      }
      setLoading(false);
    });

    // Check for dark mode preference
    const darkModePref = localStorage.getItem("darkMode");
    if (darkModePref !== null) {
      setDarkMode(darkModePref === "true");
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setDarkMode(true);
    }

    return () => unsubscribe();
  }, [router]);

  // Fetch club data
  const fetchClubData = async (clubId: string) => {
    try {
      const clubDoc = await getDoc(doc(db, "publicClubs", clubId));
      if (clubDoc.exists()) {
        setClubSettings({
          id: clubDoc.id,
          name: clubDoc.data().name,
        });
      } else {
        setError("Club not found");
      }
    } catch (error) {
      console.error("Error fetching club data:", error);
      setError("Failed to load club information");
    }
  };

  // Fetch court data
  const fetchCourtData = async (clubId: string) => {
    try {
      const courtsQuery = collection(db, `publicClubs/${clubId}/courts`);
      const querySnapshot = await getDocs(courtsQuery);
      
      const courtsData: Court[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        courtsData.push({
          id: doc.id,
          name: data.name || `Court ${data.courtNumber}`,
          courtNumber: data.courtNumber || 1,
          courtType: data.courtType || "Hard",
          isActive: data.isActive !== false,
          openTime: data.openTime || "08:00",
          closeTime: data.closeTime || "20:00"
        });
      });
      
      setCourts(courtsData.sort((a, b) => a.courtNumber - b.courtNumber));
      
      if (courtsData.length > 0) {
        setSelectedCourt(courtsData[0].id);
        // Fetch schedule for this court and date
        fetchSchedule(clubId, courtsData[0].id, format(selectedDate, 'yyyy-MM-dd'));
      }
    } catch (error) {
      console.error("Error fetching court data:", error);
      setError("Failed to load court information");
    }
  };

  // Fetch schedule data for a specific court and date
  const fetchSchedule = async (clubId: string, courtId: string, date: string) => {
    try {
      const scheduleQuery = query(
        collection(db, `publicClubs/${clubId}/courtSchedule`),
        where("courtId", "==", courtId),
        where("date", "==", date)
      );
      
      const querySnapshot = await getDocs(scheduleQuery);
      
      const slotsData: ScheduleSlot[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        slotsData.push({
          id: doc.id,
          courtId: data.courtId,
          date: data.date,
          startTime: data.startTime,
          endTime: data.endTime,
          isBlocked: data.isBlocked,
          reason: data.reason || "",
          createdBy: data.createdBy || "", // Add this line
        });
      });
      
      // Sort by start time
      setScheduleSlots(slotsData.sort((a, b) => 
        a.startTime.localeCompare(b.startTime)
      ));
    } catch (error) {
      console.error("Error fetching schedule data:", error);
      setError("Failed to load schedule information");
    }
  };

  // Add a new schedule slot
  const addScheduleSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!clubId || !selectedCourt) {
      setError("No club or court selected");
      return;
    }
    
    try {
      setLoading(true);
      setError("");
      
      // Validate the times
      if (newSlot.startTime >= newSlot.endTime) {
        setError("End time must be after start time");
        setLoading(false);
        return;
      }
      
      // Add the new slot to Firestore
      const slotData = {
        ...newSlot,
        courtId: selectedCourt,
        date: format(selectedDate, 'yyyy-MM-dd'),
        createdBy: user?.id, // Add the creator's ID
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, `publicClubs/${clubId}/courtSchedule`), slotData);
      
      // Add to local state
      setScheduleSlots([
        ...scheduleSlots,
        {
          id: docRef.id,
          ...slotData
        }
      ].sort((a, b) => a.startTime.localeCompare(b.startTime)));
      
      setIsAddingSlot(false);
      setSuccess("Schedule slot added successfully");
      
      // Reset form
      setNewSlot({
        courtId: selectedCourt,
        date: format(selectedDate, 'yyyy-MM-dd'),
        startTime: '08:00',
        endTime: '09:00',
        isBlocked: true,
        reason: 'Maintenance'
      });
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess("");
      }, 3000);
    } catch (error) {
      console.error("Error adding schedule slot:", error);
      setError("Failed to add schedule slot");
    } finally {
      setLoading(false);
    }
  };

  // Update an existing schedule slot
  const updateScheduleSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!clubId || !selectedCourt || !editingSlotId) {
      setError("No club, court, or slot selected for editing");
      return;
    }
    
    try {
      setLoading(true);
      setError("");
      
      // Validate the times
      if (newSlot.startTime >= newSlot.endTime) {
        setError("End time must be after start time");
        setLoading(false);
        return;
      }
      
      // Update the slot in Firestore
      const slotData = {
        ...newSlot,
        courtId: selectedCourt,
        date: format(selectedDate, 'yyyy-MM-dd'),
        updatedAt: serverTimestamp()
      };
      
      await updateDoc(doc(db, `publicClubs/${clubId}/courtSchedule`, editingSlotId), slotData);
      
      // Update in local state
      setScheduleSlots(
        scheduleSlots.map(slot => 
          slot.id === editingSlotId 
            ? { ...slotData, id: editingSlotId } 
            : slot
        ).sort((a, b) => a.startTime.localeCompare(b.startTime))
      );
      
      setIsAddingSlot(false);
      setEditingSlotId(null);
      setSuccess("Schedule slot updated successfully");
      
      // Reset form
      setNewSlot({
        courtId: selectedCourt,
        date: format(selectedDate, 'yyyy-MM-dd'),
        startTime: '08:00',
        endTime: '09:00',
        isBlocked: true,
        reason: 'Maintenance'
      });
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess("");
      }, 3000);
    } catch (error) {
      console.error("Error updating schedule slot:", error);
      setError("Failed to update schedule slot");
    } finally {
      setLoading(false);
    }
  };

  // Delete a schedule slot
  const deleteScheduleSlot = async (slotId: string) => {
    if (!confirm("Are you sure you want to delete this schedule slot?")) {
      return;
    }
    
    if (!clubId) {
      setError("No club selected");
      return;
    }
    
    try {
      setLoading(true);
      setError("");
      
      await deleteDoc(doc(db, `publicClubs/${clubId}/courtSchedule`, slotId));
      
      // Update local state
      setScheduleSlots(scheduleSlots.filter(slot => slot.id !== slotId));
      
      setSuccess("Schedule slot deleted successfully");
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess("");
      }, 3000);
    } catch (error) {
      console.error("Error deleting schedule slot:", error);
      setError("Failed to delete schedule slot");
    } finally {
      setLoading(false);
    }
  };

  // Handle date change
  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
    if (clubId && selectedCourt) {
      fetchSchedule(clubId, selectedCourt, format(date, 'yyyy-MM-dd'));
    }
  };

  // Handle court change
  const handleCourtChange = (courtId: string) => {
    setSelectedCourt(courtId);
    if (clubId) {
      fetchSchedule(clubId, courtId, format(selectedDate, 'yyyy-MM-dd'));
    }
  };

  // Generate array of dates for the week
  const weekDates = Array(7).fill(0).map((_, i) => addDays(weekStartDate, i));

  // Navigate to previous week
  const previousWeek = () => {
    const newWeekStart = addWeeks(weekStartDate, -1);
    setWeekStartDate(newWeekStart);
  };

  // Navigate to next week
  const nextWeek = () => {
    const newWeekStart = addWeeks(weekStartDate, 1);
    setWeekStartDate(newWeekStart);
  };

  // Add state for available clubs
  const [availableClubs, setAvailableClubs] = useState<{id: string, name: string}[]>([]);

  // Add function to fetch available clubs
  const fetchAvailableClubs = async () => {
    try {
      const clubsQuery = query(collection(db, "publicClubs"));
      const querySnapshot = await getDocs(clubsQuery);
      
      const clubsData: {id: string, name: string}[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        clubsData.push({
          id: doc.id,
          name: data.name || "Unnamed Club"
        });
      });
      
      setAvailableClubs(clubsData);
    } catch (error) {
      console.error("Error fetching available clubs:", error);
      setError("Failed to load available clubs");
    }
  };

  // Add club selection handler
  const handleClubSelect = async (selectedClubId: string) => {
    setClubId(selectedClubId);
    await fetchClubData(selectedClubId);
    await fetchCourtData(selectedClubId);
  };

  // Add isAdmin check
  const isAdmin = user?.userType === 'admin' || user?.userType === 'courtly';

  // Add this useEffect for handling clicks outside the dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (showClubDropdown && !target.closest('.club-dropdown')) {
        setShowClubDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showClubDropdown]);

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
      <PageTitle title="Court Schedule - Courtly" />
      
      <div className="fixed top-4 right-4 z-10">
        <DarkModeToggle darkMode={darkMode} setDarkMode={toggleDarkMode} />
      </div>
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Court Schedule</h1>
            
            {/* Club Selector Dropdown */}
            <div className={`relative mt-2 club-dropdown`}>
              <button
                onClick={() => setShowClubDropdown(!showClubDropdown)}
                className={`flex items-center justify-between w-full md:w-64 px-4 py-2 rounded ${
                  darkMode ? "bg-gray-700 text-gray-200" : "bg-gray-200 text-gray-800"
                }`}
              >
                <span>{clubSettings?.name || "Select Club"}</span>
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className={`h-4 w-4 transition-transform ${showClubDropdown ? "rotate-180" : ""}`} 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {showClubDropdown && (
                <div className={`absolute z-10 mt-1 w-full md:w-64 rounded-md shadow-lg ${
                  darkMode ? "bg-gray-700" : "bg-white"
                }`}>
                  <div className="py-1 max-h-64 overflow-y-auto">
                    {availableClubs.map(club => (
                      <button
                        key={club.id}
                        onClick={() => {
                          handleClubSelect(club.id);
                          setShowClubDropdown(false);
                        }}
                        className={`block w-full text-left px-4 py-2 ${
                          clubId === club.id
                            ? (darkMode ? "bg-blue-600 text-white" : "bg-blue-100 text-blue-800")
                            : (darkMode ? "hover:bg-gray-600 text-gray-200" : "hover:bg-gray-100 text-gray-800")
                        }`}
                      >
                        {club.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="mt-4 md:mt-0">
            <button
              onClick={() => router.back()}
              className={`px-4 py-2 rounded-lg flex items-center ${
                darkMode 
                  ? "bg-gray-700 hover:bg-gray-600 text-gray-200" 
                  : "bg-gray-200 hover:bg-gray-300 text-gray-700"
              } transition-colors`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
              Back
            </button>
          </div>
        </div>
        
        {/* Alert Messages */}
        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded" role="alert">
            <p>{error}</p>
          </div>
        )}
        {success && (
          <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-6 rounded" role="alert">
            <p>{success}</p>
          </div>
        )}
        
        {/* Wrap the court selection and schedule sections in a conditional check */}
        {clubId && (
          <>
            {/* Court Selection */}
            <div className={`p-6 mb-8 rounded-lg shadow-md ${
              darkMode ? "bg-gray-800" : "bg-white"
            }`}>
              <h2 className="text-2xl font-bold mb-6">Select Court</h2>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {courts.map(court => (
                  <button
                    key={court.id}
                    onClick={() => handleCourtChange(court.id)}
                    className={`p-4 rounded-lg flex flex-col items-center justify-center transition-colors ${
                      selectedCourt === court.id
                        ? (darkMode ? "bg-blue-600 text-white" : "bg-blue-500 text-white")
                        : (darkMode ? "bg-gray-700 hover:bg-gray-600 text-gray-300" : "bg-gray-100 hover:bg-gray-200 text-gray-700")
                    }`}
                  >
                    <div className="text-lg font-semibold">{court.name}</div>
                    <div className={`text-sm ${selectedCourt === court.id ? "text-blue-100" : (darkMode ? "text-gray-400" : "text-gray-500")}`}>
                      {court.courtType}
                    </div>
                    <div className={`text-xs mt-1 ${selectedCourt === court.id ? "text-blue-100" : (darkMode ? "text-gray-400" : "text-gray-500")}`}>
                      {court.openTime} - {court.closeTime}
                    </div>
                    {!court.isActive && (
                      <div className="mt-2 px-2 py-1 rounded bg-red-500 text-white text-xs">
                        Inactive
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Week Navigation */}
            <div className={`p-6 mb-8 rounded-lg shadow-md ${
              darkMode ? "bg-gray-800" : "bg-white"
            }`}>
              <div className="flex justify-between items-center mb-6">
                <button
                  onClick={previousWeek}
                  className={`px-4 py-2 rounded-lg flex items-center ${
                    darkMode 
                      ? "bg-gray-700 hover:bg-gray-600 text-gray-200" 
                      : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                  } transition-colors`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Previous Week
                </button>
                
                <h2 className="text-xl font-bold">
                  {format(weekStartDate, 'MMMM d')} - {format(addDays(weekStartDate, 6), 'MMMM d, yyyy')}
                </h2>
                
                <button
                  onClick={nextWeek}
                  className={`px-4 py-2 rounded-lg flex items-center ${
                    darkMode 
                      ? "bg-gray-700 hover:bg-gray-600 text-gray-200" 
                      : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                  } transition-colors`}
                >
                  Next Week
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              
              <div className="grid grid-cols-7 gap-2">
                {weekDates.map((date, index) => (
                  <button
                    key={index}
                    onClick={() => handleDateChange(date)}
                    className={`p-4 rounded-lg flex flex-col items-center justify-center transition-colors ${
                      isSameDay(selectedDate, date)
                        ? (darkMode ? "bg-blue-600 text-white" : "bg-blue-500 text-white")
                        : (darkMode ? "bg-gray-700 hover:bg-gray-600 text-gray-300" : "bg-gray-100 hover:bg-gray-200 text-gray-700")
                    }`}
                  >
                    <div className={`text-sm ${isSameDay(selectedDate, date) ? "text-blue-100" : (darkMode ? "text-gray-400" : "text-gray-500")}`}>
                      {format(date, 'EEE')}
                    </div>
                    <div className="text-2xl font-bold my-1">
                      {format(date, 'd')}
                    </div>
                    <div className={`text-sm ${isSameDay(selectedDate, date) ? "text-blue-100" : (darkMode ? "text-gray-400" : "text-gray-500")}`}>
                      {format(date, 'MMM')}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Schedule Display */}
            <div className={`p-6 mb-8 rounded-lg shadow-md ${
              darkMode ? "bg-gray-800" : "bg-white"
            }`}>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">
                  Schedule for {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                </h2>
                
                <button
                  onClick={() => setIsAddingSlot(true)}
                  className={`mt-4 px-4 py-2 rounded-lg flex items-center ${
                    darkMode 
                      ? "bg-teal-600 hover:bg-teal-700 text-white" 
                      : "bg-green-500 hover:bg-green-600 text-white"
                  } transition-colors`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                  Block Time Slot
                </button>
              </div>
              
              {isAddingSlot && (
                <div className={`p-6 mb-6 rounded-lg ${
                  darkMode ? "bg-gray-700" : "bg-gray-100"
                }`}>
                  <h3 className="text-xl font-bold mb-4">
                    {editingSlotId ? "Edit Blocked Time Slot" : "Add Blocked Time Slot"}
                  </h3>
                  
                  <form onSubmit={editingSlotId ? updateScheduleSlot : addScheduleSlot}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Start Time
                        </label>
                        <input
                          type="time"
                          value={newSlot.startTime}
                          onChange={(e) => setNewSlot({...newSlot, startTime: e.target.value})}
                          className={`w-full p-2 rounded border ${
                            darkMode 
                              ? "bg-gray-800 border-gray-600 text-white" 
                              : "bg-white border-gray-300 text-gray-900"
                          }`}
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          End Time
                        </label>
                        <input
                          type="time"
                          value={newSlot.endTime}
                          onChange={(e) => setNewSlot({...newSlot, endTime: e.target.value})}
                          className={`w-full p-2 rounded border ${
                            darkMode 
                              ? "bg-gray-800 border-gray-600 text-white" 
                              : "bg-white border-gray-300 text-gray-900"
                          }`}
                          required
                        />
                      </div>
                      
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium mb-1">
                          Reason (optional)
                        </label>
                        <input
                          type="text"
                          value={newSlot.reason || ''}
                          onChange={(e) => setNewSlot({...newSlot, reason: e.target.value})}
                          placeholder="e.g., Maintenance, Tournament, Private Event"
                          className={`w-full p-2 rounded border ${
                            darkMode 
                              ? "bg-gray-800 border-gray-600 text-white" 
                              : "bg-white border-gray-300 text-gray-900"
                          }`}
                        />
                      </div>
                    </div>
                    
                    <div className="flex justify-end mt-4 space-x-2">
                      <button
                        type="button"
                        onClick={() => setIsAddingSlot(false)}
                        className={`px-4 py-2 rounded ${
                          darkMode 
                            ? "bg-gray-600 hover:bg-gray-500 text-white" 
                            : "bg-gray-300 hover:bg-gray-400 text-gray-800"
                        } transition-colors`}
                      >
                        Cancel
                      </button>
                      
                      <button
                        type="submit"
                        disabled={loading}
                        className={`px-4 py-2 rounded ${
                          darkMode 
                            ? "bg-teal-600 hover:bg-teal-700 text-white" 
                            : "bg-green-500 hover:bg-green-600 text-white"
                        } ${loading ? "opacity-50 cursor-not-allowed" : ""} transition-colors`}
                      >
                        {loading ? (editingSlotId ? "Updating..." : "Adding...") : (editingSlotId ? "Update Block" : "Add Block")}
                      </button>
                    </div>
                  </form>
                </div>
              )}
              
              {scheduleSlots.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className={`w-full border-collapse ${
                    darkMode ? "text-gray-300" : "text-gray-700"
                  }`}>
                    <thead>
                      <tr className={`border-b ${
                        darkMode ? "border-gray-700" : "border-gray-200"
                      }`}>
                        <th className="text-left p-3">Start Time</th>
                        <th className="text-left p-3">End Time</th>
                        <th className="text-left p-3">Duration</th>
                        <th className="text-left p-3">Reason</th>
                        <th className="text-right p-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scheduleSlots.map(slot => {
                        // Calculate duration
                        const startParts = slot.startTime.split(':').map(Number);
                        const endParts = slot.endTime.split(':').map(Number);
                        const startMinutes = startParts[0] * 60 + startParts[1];
                        const endMinutes = endParts[0] * 60 + endParts[1];
                        const durationMinutes = endMinutes - startMinutes;
                        const hours = Math.floor(durationMinutes / 60);
                        const minutes = durationMinutes % 60;
                        const duration = `${hours}h ${minutes > 0 ? `${minutes}m` : ''}`;
                        
                        return (
                          <tr key={slot.id} className={`border-b ${
                            darkMode ? "border-gray-700" : "border-gray-200"
                          }`}>
                            <td className="p-3">
                              {slot.startTime}
                            </td>
                            <td className="p-3">
                              {slot.endTime}
                            </td>
                            <td className="p-3">
                              {duration}
                            </td>
                            <td className="p-3">
                              {slot.reason || "Blocked"}
                            </td>
                            <td className="p-3 text-right">
                              {(isAdmin || slot.createdBy === user?.id) && (
                                <div className="flex justify-end space-x-2">
                                  <button
                                    onClick={() => {
                                      setNewSlot({
                                        courtId: slot.courtId,
                                        date: slot.date,
                                        startTime: slot.startTime,
                                        endTime: slot.endTime,
                                        isBlocked: true,
                                        reason: slot.reason || ''
                                      });
                                      setEditingSlotId(slot.id || null);
                                      setIsAddingSlot(true);
                                    }}
                                    className={`px-3 py-1 rounded ${
                                      darkMode 
                                        ? "bg-blue-600 hover:bg-blue-700 text-white" 
                                        : "bg-blue-500 hover:bg-blue-600 text-white"
                                    } transition-colors`}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => deleteScheduleSlot(slot.id!)}
                                    className={`px-3 py-1 rounded ${
                                      darkMode 
                                        ? "bg-red-600 hover:bg-red-700 text-white" 
                                        : "bg-red-500 hover:bg-red-600 text-white"
                                    } transition-colors`}
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className={`text-center py-8 ${
                  darkMode ? "text-gray-400" : "text-gray-500"
                }`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="mt-4 text-lg font-semibold">No Blocked Time Slots</h3>
                  <p className="mt-2">This court is fully available on the selected date.</p>
                </div>
              )}
            </div>
            
            {/* Visual Timeline */}
            <div className="mt-8">
              <h3 className="text-xl font-bold mb-4">Daily Timeline</h3>
              
              {courts.length > 0 && selectedCourt && (
                <div>
                  {/* Find the selected court to get operating hours */}
                  {(() => {
                    const court = courts.find(c => c.id === selectedCourt);
                    if (!court) return null;
                    
                    // Parse court hours
                    const openParts = court.openTime.split(':').map(Number);
                    const closeParts = court.closeTime.split(':').map(Number);
                    const openHour = openParts[0];
                    const closeHour = closeParts[0] + (closeParts[1] > 0 ? 1 : 0); // Round up to include partial hour
                    
                    // Create array of hours from open to close
                    const hours = Array.from({length: closeHour - openHour + 1}, (_, i) => openHour + i);
                    
                    return (
                      <div className={`relative rounded-lg overflow-hidden ${
                        darkMode ? "bg-gray-700" : "bg-gray-100"
                      }`}>
                        {/* Hour labels */}
                        <div className="flex border-b">
                          {hours.map(hour => (
                            <div 
                              key={hour} 
                              className={`flex-1 p-2 text-center text-sm ${
                                darkMode ? "text-gray-400 border-gray-600" : "text-gray-500 border-gray-300"
                              }`}
                            >
                              {hour === 0 ? '12 AM' : 
                               hour < 12 ? `${hour} AM` : 
                               hour === 12 ? '12 PM' : 
                               `${hour - 12} PM`}
                            </div>
                          ))}
                        </div>
                        
                        {/* Timeline */}
                        <div className="h-16 relative">
                          {/* Render hour grid lines */}
                          {hours.map((hour, index) => (
                            <div 
                              key={hour}
                              className={`absolute top-0 bottom-0 w-px ${
                                darkMode ? "bg-gray-600" : "bg-gray-300"
                              }`}
                              style={{ left: `${(index / hours.length) * 100}%` }}
                            />
                          ))}
                          
                          {/* Render scheduled blocks */}
                          {scheduleSlots.map(slot => {
                            // Calculate position and width based on time
                            const startParts = slot.startTime.split(':').map(Number);
                            const endParts = slot.endTime.split(':').map(Number);
                            
                            const startDecimal = startParts[0] + (startParts[1] / 60);
                            const endDecimal = endParts[0] + (endParts[1] / 60);
                            
                            const startPercentage = ((startDecimal - openHour) / (closeHour - openHour)) * 100;
                            const widthPercentage = ((endDecimal - startDecimal) / (closeHour - openHour)) * 100;
                            
                            return (
                              <div
                                key={slot.id}
                                className={`absolute top-2 h-12 rounded-lg flex items-center justify-center px-2 cursor-pointer ${
                                  darkMode ? "bg-red-800 hover:bg-red-700" : "bg-red-500 hover:bg-red-400"
                                } text-white text-sm font-medium overflow-hidden`}
                                style={{
                                  left: `${startPercentage}%`,
                                  width: `${widthPercentage}%`,
                                  minWidth: '60px'
                                }}
                                onClick={() => {
                                  setNewSlot({
                                    courtId: slot.courtId,
                                    date: slot.date,
                                    startTime: slot.startTime,
                                    endTime: slot.endTime,
                                    isBlocked: true,
                                    reason: slot.reason || ''
                                  });
                                  setEditingSlotId(slot.id || null);
                                  setIsAddingSlot(true);
                                }}
                              >
                                {slot.reason || "Blocked"}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </>
        )}
        
        {/* Show message to select a club */}
        {!clubId && (
          <div className={`text-center py-20 ${
            darkMode ? "text-gray-300" : "text-gray-700"
          }`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
            <h3 className="mt-4 text-xl font-semibold">Please Select a Club</h3>
            <p className="mt-2">Use the dropdown menu above to select a club.</p>
          </div>
        )}
      </div>
    </div>
  );
}