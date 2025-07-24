"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth, db } from "../../../../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { 
  doc, getDoc, updateDoc, collection, query, 
  getDocs, serverTimestamp, addDoc, deleteDoc, where 
} from "firebase/firestore";
import DarkModeToggle from "@/app/components/DarkModeToggle";
import PageTitle from "@/app/components/PageTitle";

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

interface ClubSettings {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip?: string;
  phone?: string;
  website?: string;
  email?: string;
  description?: string;
  reservationSettings: {
    minDuration: number; // in minutes
    maxDuration: number; // in minutes
    incrementMinutes: number; // Time slot increments (15, 30, 60 mins)
    maxDaysInAdvance: number; // How many days ahead can bookings be made
    startTime: string; // Format: "HH:MM" (24-hour)
    endTime: string; // Format: "HH:MM" (24-hour)
    allowedDaysOfWeek: number[]; // 0 = Sunday, 6 = Saturday
  };
}

export default function ManageClubPage() {
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [clubId, setClubId] = useState<string>("");
  const [clubSettings, setClubSettings] = useState<ClubSettings | null>(null);
  const [courts, setCourts] = useState<Court[]>([]);
  const [isEditingClub, setIsEditingClub] = useState(false);
  const [isAddingCourt, setIsAddingCourt] = useState(false);
  const [editingCourtId, setEditingCourtId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  // New court form data
  const [newCourt, setNewCourt] = useState<Omit<Court, 'id'>>({
    name: "",
    courtNumber: 1,
    courtType: "Hard",
    isActive: true,
    openTime: "08:00",
    closeTime: "20:00"
  });

  // Court types for dropdown
  const courtTypes = ["Hard", "Clay", "Grass", "Carpet", "Indoor"];

  // Initialize dark mode from localStorage
  useEffect(() => {
    const savedMode = localStorage.getItem("darkMode");
    if (savedMode === "true") {
      setDarkMode(true);
    }
  }, []);

  // Authentication and authorization check
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push('/signin');
        return;
      }
      
      try {
        setLoading(true);
        
        // Check if user is a club admin
        const userDocRef = doc(db, "users", currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          if (userData.userType === 'admin' && userData.organization) {
            // User is authorized
            setIsAuthorized(true);
            setUser({
              ...currentUser,
              ...userData
            });
            setClubId(userData.organization);
            
            // Fetch club data
            await fetchClubData(userData.organization);
            await fetchCourtData(userData.organization);
            
          } else {
            // User is not an admin
            setIsAuthorized(false);
            setError("You don't have permission to access club settings");
            router.push('/dashboard');
          }
        } else {
          router.push('/signin');
        }
      } catch (err) {
        console.error("Error checking authorization:", err);
        setError("Failed to verify permissions. Please try again.");
      } finally {
        setLoading(false);
      }
    });
    
    return () => unsubscribe();
  }, [router]);
  
  // Fetch club data
  const fetchClubData = async (clubId: string) => {
    try {
      const clubRef = doc(db, "publicClubs", clubId);
      const clubDoc = await getDoc(clubRef);
      
      if (clubDoc.exists()) {
        const data = clubDoc.data();
        
        // Create default reservation settings if they don't exist
        const reservationSettings = data.reservationSettings || {
          minDuration: 60,
          maxDuration: 120,
          incrementMinutes: 30,
          maxDaysInAdvance: 7,
          startTime: "08:00",
          endTime: "20:00",
          allowedDaysOfWeek: [0, 1, 2, 3, 4, 5, 6] // All days
        };
        
        setClubSettings({
          id: clubId,
          name: data.name || "Unknown Club",
          address: data.address || "",
          city: data.city || "",
          state: data.state || "",
          zip: data.zip || "",
          phone: data.phone || "",
          website: data.website || "",
          email: data.email || "",
          description: data.description || "",
          reservationSettings
        });
      } else {
        setError("Club not found in database");
      }
    } catch (error) {
      console.error("Error fetching club data:", error);
      setError("Failed to load club information");
    }
  };
  
  // Fetch court data
  const fetchCourtData = async (clubId: string) => {
    try {
      // Use subcollection path instead of where clause
      const courtsQuery = collection(db, `publicClubs/${clubId}/courts`);
      const querySnapshot = await getDocs(courtsQuery);
      
      const courtsData: Court[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        courtsData.push({
          id: doc.id,
          name: data.name || `Court ${data.courtNumber}`,
          courtNumber: data.courtNumber || 1, // Changed from 0 to 1 as minimum
          courtType: data.courtType || "Hard",
          isActive: data.isActive !== false, // default to true if not specified
          openTime: data.openTime || "08:00",
          closeTime: data.closeTime || "20:00"
        });
      });
      
      setCourts(courtsData.sort((a, b) => a.courtNumber - b.courtNumber));
    } catch (error) {
      console.error("Error fetching court data:", error);
      setError("Failed to load court information");
    }
  };
  
  // Update club settings
  const updateClubSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clubSettings) return;
    
    try {
      setLoading(true);
      setError("");
      
      await updateDoc(doc(db, "publicClubs", clubId), {
        name: clubSettings.name,
        address: clubSettings.address,
        city: clubSettings.city,
        state: clubSettings.state,
        zip: clubSettings.zip,
        phone: clubSettings.phone,
        website: clubSettings.website,
        email: clubSettings.email,
        description: clubSettings.description,
        reservationSettings: clubSettings.reservationSettings,
        updatedAt: serverTimestamp()
      });
      
      setSuccess("Club settings updated successfully");
      setIsEditingClub(false);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess("");
      }, 3000);
    } catch (error) {
      console.error("Error updating club settings:", error);
      setError("Failed to update club settings");
    } finally {
      setLoading(false);
    }
  };
  
  // Add new court
  const addNewCourt = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError("");
      
      // Check for duplicate court number
      if (courts.some(court => court.courtNumber === newCourt.courtNumber)) {
        setError(`Court number ${newCourt.courtNumber} already exists`);
        setLoading(false);
        return;
      }
      
      // Use subcollection path for adding courts
      const courtRef = await addDoc(collection(db, `publicClubs/${clubId}/courts`), {
        ...newCourt,
        createdAt: serverTimestamp()
      });
      
      // Add the new court to the local state
      setCourts([
        ...courts, 
        { 
          id: courtRef.id,
          ...newCourt 
        }
      ].sort((a, b) => a.courtNumber - b.courtNumber));
      
      setSuccess("Court added successfully");
      setIsAddingCourt(false);
      
      // Reset new court form
      setNewCourt({
        name: "",
        courtNumber: courts.length > 0 ? Math.max(...courts.map(c => c.courtNumber)) + 1 : 1,
        courtType: "Hard",
        isActive: true,
        openTime: "08:00",
        closeTime: "20:00"
      });
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess("");
      }, 3000);
    } catch (error) {
      console.error("Error adding court:", error);
      setError("Failed to add court");
    } finally {
      setLoading(false);
    }
  };
  
  // Update court
  const updateCourt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourtId) return;
    
    try {
      setLoading(true);
      setError("");
      
      const courtToUpdate = courts.find(court => court.id === editingCourtId);
      if (!courtToUpdate) {
        setError("Court not found");
        return;
      }
      
      // Check for duplicate court number with other courts
      if (courts.some(court => 
        court.id !== editingCourtId && 
        court.courtNumber === courtToUpdate.courtNumber
      )) {
        setError(`Court number ${courtToUpdate.courtNumber} already exists`);
        setLoading(false);
        return;
      }
      
      // Use subcollection path for updating courts
      await updateDoc(doc(db, `publicClubs/${clubId}/courts`, editingCourtId), {
        name: courtToUpdate.name,
        courtNumber: courtToUpdate.courtNumber,
        courtType: courtToUpdate.courtType,
        isActive: courtToUpdate.isActive,
        openTime: courtToUpdate.openTime,
        closeTime: courtToUpdate.closeTime,
        updatedAt: serverTimestamp()
      });
      
      setSuccess("Court updated successfully");
      setEditingCourtId(null);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess("");
      }, 3000);
    } catch (error) {
      console.error("Error updating court:", error);
      setError("Failed to update court");
    } finally {
      setLoading(false);
    }
  };
  
  // Delete court
  const deleteCourt = async (courtId: string) => {
    if (!confirm("Are you sure you want to delete this court? All reservations for this court will also be deleted.")) {
      return;
    }
    
    try {
      setLoading(true);
      setError("");
      
      // Use subcollection path for deleting courts
      await deleteDoc(doc(db, `publicClubs/${clubId}/courts`, courtId));
      
      // Update local state
      setCourts(courts.filter(court => court.id !== courtId));
      
      setSuccess("Court deleted successfully");
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess("");
      }, 3000);
    } catch (error) {
      console.error("Error deleting court:", error);
      setError("Failed to delete court");
    } finally {
      setLoading(false);
    }
  };
  
  // Handle court form changes
  const handleCourtChange = (courtId: string, field: keyof Court, value: string | number | boolean) => {
    setCourts(courts.map(court => {
      if (court.id === courtId) {
        return { ...court, [field]: value };
      }
      return court;
    }));
  };
  
  // Handle new court form changes
  const handleNewCourtChange = (field: keyof Omit<Court, 'id'>, value: string | number | boolean) => {
    setNewCourt({ ...newCourt, [field]: value });
  };
  
  // Handle club settings changes
  const handleClubSettingChange = (field: keyof ClubSettings, value: any) => {
    if (!clubSettings) return;
    
    setClubSettings({
      ...clubSettings,
      [field]: value
    });
  };
  
  // Handle reservation settings changes
  const handleReservationSettingChange = (field: keyof ClubSettings['reservationSettings'], value: any) => {
    if (!clubSettings) return;
    
    setClubSettings({
      ...clubSettings,
      reservationSettings: {
        ...clubSettings.reservationSettings,
        [field]: value
      }
    });
  };
  
  // Day of week selection
  const toggleDayOfWeek = (day: number) => {
    if (!clubSettings) return;
    
    const currentDays = [...clubSettings.reservationSettings.allowedDaysOfWeek];
    
    if (currentDays.includes(day)) {
      // Remove the day
      const newDays = currentDays.filter(d => d !== day);
      handleReservationSettingChange('allowedDaysOfWeek', newDays);
    } else {
      // Add the day
      const newDays = [...currentDays, day].sort();
      handleReservationSettingChange('allowedDaysOfWeek', newDays);
    }
  };
  
  // Format time options for select inputs
  const generateTimeOptions = () => {
    const options = [];
    
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const formattedHour = hour.toString().padStart(2, '0');
        const formattedMinute = minute.toString().padStart(2, '0');
        const time = `${formattedHour}:${formattedMinute}`;
        options.push(time);
      }
    }
    
    return options;
  };
  
  // Day names for allowed days of week
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  
  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors duration-300 ${
        darkMode ? "bg-gray-900 text-white" : "bg-white text-gray-900"
      }`}>
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4">Loading club settings...</p>
        </div>
      </div>
    );
  }
  
  if (!isAuthorized) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors duration-300 ${
        darkMode ? "bg-gray-900 text-white" : "bg-white text-gray-900"
      }`}>
        <div className="text-center p-8">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h1 className="text-2xl font-bold mt-4">Access Denied</h1>
          <p className="mt-2">You don&apos;t have permission to access club settings.</p>
          <Link href="/dashboard" className={`mt-6 inline-block px-4 py-2 rounded-lg ${
            darkMode ? "bg-teal-600 hover:bg-teal-700 text-white" : "bg-green-500 hover:bg-green-600 text-white"
          } transition-colors`}>
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      darkMode ? "bg-gray-900 text-gray-50" : "bg-gray-50 text-gray-900"
    }`}>
      <PageTitle title="Club Settings - Courtly" />
      
      {/* Dark Mode Toggle Button */}
      <div className="absolute top-8 right-8">
        <DarkModeToggle darkMode={darkMode} setDarkMode={setDarkMode} />
      </div>
      
      {/* Top Navigation Bar */}
      <nav className={`py-4 px-6 flex items-center justify-between shadow-md ${
        darkMode ? "bg-gray-800" : "bg-white"
      }`}>
        <div className="flex items-center space-x-4">
          {/* Back Button */}
          <Link href="/dashboard" className={`flex items-center px-3 py-1.5 rounded-lg ${
            darkMode 
              ? "bg-gray-700 hover:bg-gray-600 text-gray-200" 
              : "bg-gray-100 hover:bg-gray-200 text-gray-700"
            } transition-colors mr-2`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
          
          <div className={`p-2 rounded-full ${darkMode ? "bg-teal-600" : "bg-green-400"}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold">Club Settings</h1>
        </div>
      </nav>
      
      <div className="container mx-auto px-4 py-8">
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
        
        {/* Club Details Section */}
        <div className={`p-6 mb-8 rounded-lg shadow-md ${
          darkMode ? "bg-gray-800" : "bg-white"
        }`}>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Club Details</h2>
            {isEditingClub ? (
              <div className="space-x-2">
                <button
                  onClick={() => {
                    setIsEditingClub(false);
                    // Reset club settings by re-fetching
                    fetchClubData(clubId);
                  }}
                  className={`px-4 py-2 rounded-lg ${
                    darkMode 
                      ? "bg-gray-700 hover:bg-gray-600 text-gray-200" 
                      : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                  } transition-colors`}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  onClick={updateClubSettings}
                  className={`px-4 py-2 rounded-lg ${
                    darkMode 
                      ? "bg-teal-600 hover:bg-teal-700 text-white" 
                      : "bg-green-500 hover:bg-green-600 text-white"
                  } transition-colors`}
                  disabled={loading}
                >
                  {loading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsEditingClub(true)}
                className={`px-4 py-2 rounded-lg ${
                  darkMode 
                    ? "bg-teal-600 hover:bg-teal-700 text-white" 
                    : "bg-green-500 hover:bg-green-600 text-white"
                } transition-colors`}
              >
                Edit Details
              </button>
            )}
          </div>
          
          {clubSettings && (
            <div className={isEditingClub ? "block" : "hidden"}>
              <form onSubmit={updateClubSettings} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Club Name */}
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${
                      darkMode ? "text-gray-300" : "text-gray-700"
                    }`}>
                      Club Name
                    </label>
                    <input
                      type="text"
                      value={clubSettings.name}
                      onChange={(e) => handleClubSettingChange('name', e.target.value)}
                      className={`w-full p-2 rounded-md ${
                        darkMode 
                          ? "bg-gray-700 border-gray-600 text-white" 
                          : "bg-white border-gray-300 text-gray-900"
                      } border`}
                      required
                    />
                  </div>
                  
                  {/* Email */}
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${
                      darkMode ? "text-gray-300" : "text-gray-700"
                    }`}>
                      Email
                    </label>
                    <input
                      type="email"
                      value={clubSettings.email || ""}
                      onChange={(e) => handleClubSettingChange('email', e.target.value)}
                      className={`w-full p-2 rounded-md ${
                        darkMode 
                          ? "bg-gray-700 border-gray-600 text-white" 
                          : "bg-white border-gray-300 text-gray-900"
                      } border`}
                    />
                  </div>
                  
                  {/* Phone */}
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${
                      darkMode ? "text-gray-300" : "text-gray-700"
                    }`}>
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={clubSettings.phone || ""}
                      onChange={(e) => handleClubSettingChange('phone', e.target.value)}
                      className={`w-full p-2 rounded-md ${
                        darkMode 
                          ? "bg-gray-700 border-gray-600 text-white" 
                          : "bg-white border-gray-300 text-gray-900"
                      } border`}
                    />
                  </div>
                  
                  {/* Website */}
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${
                      darkMode ? "text-gray-300" : "text-gray-700"
                    }`}>
                      Website
                    </label>
                    <input
                      type="url"
                      value={clubSettings.website || ""}
                      onChange={(e) => handleClubSettingChange('website', e.target.value)}
                      className={`w-full p-2 rounded-md ${
                        darkMode 
                          ? "bg-gray-700 border-gray-600 text-white" 
                          : "bg-white border-gray-300 text-gray-900"
                      } border`}
                    />
                  </div>
                  
                  {/* Address */}
                  <div className="md:col-span-2">
                    <label className={`block text-sm font-medium mb-1 ${
                      darkMode ? "text-gray-300" : "text-gray-700"
                    }`}>
                      Address
                    </label>
                    <input
                      type="text"
                      value={clubSettings.address || ""}
                      onChange={(e) => handleClubSettingChange('address', e.target.value)}
                      className={`w-full p-2 rounded-md ${
                        darkMode 
                          ? "bg-gray-700 border-gray-600 text-white" 
                          : "bg-white border-gray-300 text-gray-900"
                      } border`}
                    />
                  </div>
                  
                  {/* City */}
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${
                      darkMode ? "text-gray-300" : "text-gray-700"
                    }`}>
                      City
                    </label>
                    <input
                      type="text"
                      value={clubSettings.city || ""}
                      onChange={(e) => handleClubSettingChange('city', e.target.value)}
                      className={`w-full p-2 rounded-md ${
                        darkMode 
                          ? "bg-gray-700 border-gray-600 text-white" 
                          : "bg-white border-gray-300 text-gray-900"
                      } border`}
                    />
                  </div>
                  
                  {/* State */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${
                        darkMode ? "text-gray-300" : "text-gray-700"
                      }`}>
                        State
                      </label>
                      <input
                        type="text"
                        value={clubSettings.state || ""}
                        onChange={(e) => handleClubSettingChange('state', e.target.value)}
                        className={`w-full p-2 rounded-md ${
                          darkMode 
                            ? "bg-gray-700 border-gray-600 text-white" 
                            : "bg-white border-gray-300 text-gray-900"
                        } border`}
                      />
                    </div>
                    
                    {/* ZIP */}
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${
                        darkMode ? "text-gray-300" : "text-gray-700"
                      }`}>
                        ZIP Code
                      </label>
                      <input
                        type="text"
                        value={clubSettings.zip || ""}
                        onChange={(e) => handleClubSettingChange('zip', e.target.value)}
                        className={`w-full p-2 rounded-md ${
                          darkMode 
                            ? "bg-gray-700 border-gray-600 text-white" 
                            : "bg-white border-gray-300 text-gray-900"
                        } border`}
                      />
                    </div>
                  </div>
                  
                  {/* Description */}
                  <div className="md:col-span-2">
                    <label className={`block text-sm font-medium mb-1 ${
                      darkMode ? "text-gray-300" : "text-gray-700"
                    }`}>
                      Description
                    </label>
                    <textarea
                      value={clubSettings.description || ""}
                      onChange={(e) => handleClubSettingChange('description', e.target.value)}
                      rows={4}
                      className={`w-full p-2 rounded-md ${
                        darkMode 
                          ? "bg-gray-700 border-gray-600 text-white" 
                          : "bg-white border-gray-300 text-gray-900"
                      } border`}
                    />
                  </div>
                </div>
              </form>
            </div>
          )}
          
          {/* Display Club Info when not editing */}
          {clubSettings && !isEditingClub && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className={`text-lg font-semibold ${
                  darkMode ? "text-white" : "text-gray-900"
                }`}>
                  {clubSettings.name}
                </h3>
                <p className={`mt-1 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                  {[
                    clubSettings.address,
                    clubSettings.city,
                    clubSettings.state,
                    clubSettings.zip
                  ].filter(Boolean).join(", ")}
                </p>
              </div>
              
              <div>
                {clubSettings.phone && (
                  <p className={`${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                    <span className="font-medium">Phone:</span> {clubSettings.phone}
                  </p>
                )}
                {clubSettings.email && (
                  <p className={`${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                    <span className="font-medium">Email:</span> {clubSettings.email}
                  </p>
                )}
                {clubSettings.website && (
                  <p className={`${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                    <span className="font-medium">Website:</span> {clubSettings.website}
                  </p>
                )}
              </div>
              
              {clubSettings.description && (
                <div className="md:col-span-2 mt-4">
                  <h4 className={`text-md font-medium ${
                    darkMode ? "text-gray-300" : "text-gray-700"
                  }`}>
                    Description:
                  </h4>
                  <p className={`mt-1 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                    {clubSettings.description}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Reservation Settings Section */}
        <div className={`p-6 mb-8 rounded-lg shadow-md ${
          darkMode ? "bg-gray-800" : "bg-white"
        }`}>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Reservation Settings</h2>
            {isEditingClub ? (
              <button
                onClick={updateClubSettings}
                className={`px-4 py-2 rounded-lg ${
                  darkMode 
                    ? "bg-teal-600 hover:bg-teal-700 text-white" 
                    : "bg-green-500 hover:bg-green-600 text-white"
                } transition-colors`}
                disabled={loading}
              >
                {loading ? "Saving..." : "Save Settings"}
              </button>
            ) : (
              <button
                onClick={() => setIsEditingClub(true)}
                className={`px-4 py-2 rounded-lg ${
                  darkMode 
                    ? "bg-teal-600 hover:bg-teal-700 text-white" 
                    : "bg-green-500 hover:bg-green-600 text-white"
                } transition-colors`}
              >
                Edit Settings
              </button>
            )}
          </div>
          
          {clubSettings && (
            <div className={isEditingClub ? "block" : "hidden"}>
              <form className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Default Open Hours */}
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${
                      darkMode ? "text-gray-300" : "text-gray-700"
                    }`}>
                      Default Opening Time
                    </label>
                    <select
                      value={clubSettings.reservationSettings.startTime}
                      onChange={(e) => handleReservationSettingChange('startTime', e.target.value)}
                      className={`w-full p-2 rounded-md ${
                        darkMode 
                          ? "bg-gray-700 border-gray-600 text-white" 
                          : "bg-white border-gray-300 text-gray-900"
                      } border`}
                    >
                      {generateTimeOptions().map(time => (
                        <option key={time} value={time}>
                          {time.split(':')[0].padStart(2, '0')}:{time.split(':')[1]} {parseInt(time.split(':')[0]) >= 12 ? 'PM' : 'AM'}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Default Close Hours */}
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${
                      darkMode ? "text-gray-300" : "text-gray-700"
                    }`}>
                      Default Closing Time
                    </label>
                    <select
                      value={clubSettings.reservationSettings.endTime}
                      onChange={(e) => handleReservationSettingChange('endTime', e.target.value)}
                      className={`w-full p-2 rounded-md ${
                        darkMode 
                          ? "bg-gray-700 border-gray-600 text-white" 
                          : "bg-white border-gray-300 text-gray-900"
                      } border`}
                    >
                      {generateTimeOptions().map(time => (
                        <option key={time} value={time}>
                          {time.split(':')[0].padStart(2, '0')}:{time.split(':')[1]} {parseInt(time.split(':')[0]) >= 12 ? 'PM' : 'AM'}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Days of week */}
                  <div className="md:col-span-2 lg:col-span-3">
                    <label className={`block text-sm font-medium mb-2 ${
                      darkMode ? "text-gray-300" : "text-gray-700"
                    }`}>
                      Days Open for Bookings
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {dayNames.map((day, index) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleDayOfWeek(index)}
                          className={`px-3 py-1 rounded-full ${
                            clubSettings.reservationSettings.allowedDaysOfWeek.includes(index)
                              ? darkMode
                                ? "bg-teal-600 text-white"
                                : "bg-green-500 text-white"
                              : darkMode
                                ? "bg-gray-700 text-gray-300"
                                : "bg-gray-200 text-gray-700"
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Minimum Duration */}
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${
                      darkMode ? "text-gray-300" : "text-gray-700"
                    }`}>
                      Minimum Booking Duration (minutes)
                    </label>
                    <select
                      value={clubSettings.reservationSettings.minDuration}
                      onChange={(e) => handleReservationSettingChange('minDuration', parseInt(e.target.value))}
                      className={`w-full p-2 rounded-md ${
                        darkMode 
                          ? "bg-gray-700 border-gray-600 text-white" 
                          : "bg-white border-gray-300 text-gray-900"
                      } border`}
                    >
                      <option value="30">30 minutes</option>
                      <option value="60">60 minutes</option>
                      <option value="90">90 minutes</option>
                      <option value="120">120 minutes</option>
                    </select>
                  </div>
                  
                  {/* Maximum Duration */}
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${
                      darkMode ? "text-gray-300" : "text-gray-700"
                    }`}>
                      Maximum Booking Duration (minutes)
                    </label>
                    <select
                      value={clubSettings.reservationSettings.maxDuration}
                      onChange={(e) => handleReservationSettingChange('maxDuration', parseInt(e.target.value))}
                      className={`w-full p-2 rounded-md ${
                        darkMode 
                          ? "bg-gray-700 border-gray-600 text-white" 
                          : "bg-white border-gray-300 text-gray-900"
                      } border`}
                    >
                      <option value="60">60 minutes</option>
                      <option value="90">90 minutes</option>
                      <option value="120">120 minutes</option>
                      <option value="180">180 minutes</option>
                      <option value="240">240 minutes</option>
                    </select>
                  </div>
                  
                  {/* Time Increment */}
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${
                      darkMode ? "text-gray-300" : "text-gray-700"
                    }`}>
                      Time Slot Increments
                    </label>
                    <select
                      value={clubSettings.reservationSettings.incrementMinutes}
                      onChange={(e) => handleReservationSettingChange('incrementMinutes', parseInt(e.target.value))}
                      className={`w-full p-2 rounded-md ${
                        darkMode 
                          ? "bg-gray-700 border-gray-600 text-white" 
                          : "bg-white border-gray-300 text-gray-900"
                      } border`}
                    >
                      <option value="15">15 minutes</option>
                      <option value="30">30 minutes</option>
                      <option value="60">60 minutes</option>
                    </select>
                  </div>
                  
                  {/* Max Days in Advance */}
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${
                      darkMode ? "text-gray-300" : "text-gray-700"
                    }`}>
                      Maximum Days in Advance
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={clubSettings.reservationSettings.maxDaysInAdvance}
                      onChange={(e) => handleReservationSettingChange('maxDaysInAdvance', parseInt(e.target.value))}
                      className={`w-full p-2 rounded-md ${
                        darkMode 
                          ? "bg-gray-700 border-gray-600 text-white" 
                          : "bg-white border-gray-300 text-gray-900"
                      } border`}
                    />
                    <p className={`text-xs mt-1 ${
                      darkMode ? "text-gray-400" : "text-gray-500"
                    }`}>
                      How many days ahead members can book courts
                    </p>
                  </div>
                </div>
              </form>
            </div>
          )}
          
          {/* Display Reservation Settings when not editing */}
          {clubSettings && !isEditingClub && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className={`${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                  <span className="font-medium">Operating Hours:</span> {
                    clubSettings.reservationSettings.startTime.split(':')[0].padStart(2, '0')
                  }:{
                    clubSettings.reservationSettings.startTime.split(':')[1]
                  } AM - {
                    (parseInt(clubSettings.reservationSettings.endTime.split(':')[0]) % 12) || 12
                  }:{
                    clubSettings.reservationSettings.endTime.split(':')[1]
                  } {parseInt(clubSettings.reservationSettings.endTime.split(':')[0]) >= 12 ? 'PM' : 'AM'}
                </p>
                
                <p className={`${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                  <span className="font-medium">Booking Duration:</span> {
                    clubSettings.reservationSettings.minDuration
                  } - {
                    clubSettings.reservationSettings.maxDuration
                  } minutes
                </p>
                
                <p className={`${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                  <span className="font-medium">Time Slot Increments:</span> {
                    clubSettings.reservationSettings.incrementMinutes
                  } minutes
                </p>
              </div>
              
              <div>
                <p className={`${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                  <span className="font-medium">Max Booking Window:</span> {
                    clubSettings.reservationSettings.maxDaysInAdvance
                  } days in advance
                </p>
                
                <p className={`${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                  <span className="font-medium">Days Open:</span> {
                    clubSettings.reservationSettings.allowedDaysOfWeek
                      .map(day => dayNames[day])
                      .join(', ')
                  }
                </p>
              </div>
            </div>
          )}
        </div>
        
        {/* Courts Section */}
        <div className={`p-6 mb-8 rounded-lg shadow-md ${
          darkMode ? "bg-gray-800" : "bg-white"
        }`}>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Tennis Courts</h2>
            {!isAddingCourt && (
              <button
                onClick={() => {
                  setIsAddingCourt(true);
                  setNewCourt({
                    name: "",
                    courtNumber: courts.length > 0 ? Math.max(...courts.map(c => c.courtNumber)) + 1 : 1,
                    courtType: "Hard",
                    isActive: true,
                    openTime: "08:00",
                    closeTime: "20:00"
                  });
                }}
                className={`px-4 py-2 rounded-lg ${
                  darkMode 
                    ? "bg-teal-600 hover:bg-teal-700 text-white" 
                    : "bg-green-500 hover:bg-green-600 text-white"
                } transition-colors`}
              >
                Add Court
              </button>
            )}
          </div>
          
          {/* Add Court Form */}
          {isAddingCourt && (
            <div className={`mb-8 p-4 rounded-lg border ${
              darkMode ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-200"
            }`}>
              <h3 className="text-xl font-semibold mb-4">Add New Court</h3>
              <form onSubmit={addNewCourt} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Court Name */}
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${
                      darkMode ? "text-gray-300" : "text-gray-700"
                    }`}>
                      Court Name
                    </label>
                    <input
                      type="text"
                      value={newCourt.name}
                      onChange={(e) => handleNewCourtChange('name', e.target.value)}
                      className={`w-full p-2 rounded-md ${
                        darkMode 
                          ? "bg-gray-800 border-gray-600 text-white" 
                          : "bg-white border-gray-300 text-gray-900"
                      } border`}
                      placeholder="Court Name (optional)"
                    />
                  </div>
                  
                  {/* Court Number */}
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${
                      darkMode ? "text-gray-300" : "text-gray-700"
                    }`}>
                      Court Number*
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={newCourt.courtNumber}
                      onChange={(e) => handleNewCourtChange('courtNumber', parseInt(e.target.value))}
                      className={`w-full p-2 rounded-md ${
                        darkMode 
                          ? "bg-gray-800 border-gray-600 text-white" 
                          : "bg-white border-gray-300 text-gray-900"
                      } border`}
                      required
                    />
                  </div>
                  
                  {/* Court Type */}
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${
                      darkMode ? "text-gray-300" : "text-gray-700"
                    }`}>
                      Court Surface
                    </label>
                    <select
                      value={newCourt.courtType}
                      onChange={(e) => handleNewCourtChange('courtType', e.target.value)}
                      className={`w-full p-2 rounded-md ${
                        darkMode 
                          ? "bg-gray-800 border-gray-600 text-white" 
                          : "bg-white border-gray-300 text-gray-900"
                      } border`}
                    >
                      {courtTypes.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Court Status */}
                  <div className="flex items-center h-full">
                    <label className="inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newCourt.isActive}
                        onChange={(e) => handleNewCourtChange('isActive', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className={`relative w-11 h-6 rounded-full peer ${
                        darkMode ? "bg-gray-600" : "bg-gray-300"
                      } peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${
                        darkMode ? "peer-checked:bg-teal-600" : "peer-checked:bg-green-600"
                      }`}></div>
                      <span className={`ms-3 text-sm font-medium ${
                        darkMode ? "text-gray-300" : "text-gray-700"
                      }`}>
                        Active
                      </span>
                    </label>
                  </div>
                  
                  {/* Opening Time */}
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${
                      darkMode ? "text-gray-300" : "text-gray-700"
                    }`}>
                      Opening Time
                    </label>
                    <select
                      value={newCourt.openTime}
                      onChange={(e) => handleNewCourtChange('openTime', e.target.value)}
                      className={`w-full p-2 rounded-md ${
                        darkMode 
                          ? "bg-gray-800 border-gray-600 text-white" 
                          : "bg-white border-gray-300 text-gray-900"
                      } border`}
                    >
                      {generateTimeOptions().map(time => (
                        <option key={time} value={time}>
                          {time.split(':')[0].padStart(2, '0')}:{time.split(':')[1]} {parseInt(time.split(':')[0]) >= 12 ? 'PM' : 'AM'}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Closing Time */}
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${
                      darkMode ? "text-gray-300" : "text-gray-700"
                    }`}>
                      Closing Time
                    </label>
                    <select
                      value={newCourt.closeTime}
                      onChange={(e) => handleNewCourtChange('closeTime', e.target.value)}
                      className={`w-full p-2 rounded-md ${
                        darkMode 
                          ? "bg-gray-800 border-gray-600 text-white" 
                          : "bg-white border-gray-300 text-gray-900"
                      } border`}
                    >
                      {generateTimeOptions().map(time => (
                        <option key={time} value={time}>
                          {time.split(':')[0].padStart(2, '0')}:{time.split(':')[1]} {parseInt(time.split(':')[0]) >= 12 ? 'PM' : 'AM'}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-2 mt-4">
                  <button
                    type="button"
                    onClick={() => setIsAddingCourt(false)}
                    className={`px-4 py-2 rounded-lg ${
                      darkMode 
                        ? "bg-gray-700 hover:bg-gray-600 text-gray-200" 
                        : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                    } transition-colors`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className={`px-4 py-2 rounded-lg ${
                      darkMode 
                        ? "bg-teal-600 hover:bg-teal-700 text-white" 
                        : "bg-green-500 hover:bg-green-600 text-white"
                    } transition-colors`}
                  >
                    {loading ? "Adding..." : "Add Court"}
                  </button>
                </div>
              </form>
            </div>
          )}
          
          {/* List of Courts */}
          {courts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className={`w-full border-collapse ${
                darkMode ? "text-gray-300" : "text-gray-700"
              }`}>
                <thead className={`${
                  darkMode ? "bg-gray-700" : "bg-gray-100"
                }`}>
                  <tr>
                    <th className="p-3 text-left">Court</th>
                    <th className="p-3 text-left">Surface</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Hours</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {courts.map(court => (
                    <tr key={court.id} className={`border-b ${
                      darkMode ? "border-gray-700" : "border-gray-200"
                    }`}>
                      {/* Court Name & Number */}
                      <td className="p-3">
                        {editingCourtId === court.id ? (
                          <input
                            type="text"
                            value={court.name}
                            onChange={(e) => handleCourtChange(court.id, 'name', e.target.value)}
                            className={`w-full p-1 rounded ${
                              darkMode 
                                ? "bg-gray-700 border-gray-600 text-white" 
                                : "bg-white border-gray-300 text-gray-900"
                            } border`}
                          />
                        ) : (
                          <div>
                            <span className="font-medium">Court {court.courtNumber}</span>
                            {court.name && <span className="ml-1 text-sm opacity-70">({court.name})</span>}
                          </div>
                        )}
                      </td>
                      
                      {/* Surface Type */}
                      <td className="p-3">
                        {editingCourtId === court.id ? (
                          <select
                            value={court.courtType}
                            onChange={(e) => handleCourtChange(court.id, 'courtType', e.target.value)}
                            className={`w-full p-1 rounded ${
                              darkMode 
                                ? "bg-gray-700 border-gray-600 text-white" 
                                : "bg-white border-gray-300 text-gray-900"
                            } border`}
                          >
                            {courtTypes.map(type => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                        ) : (
                          court.courtType
                        )}
                      </td>
                      
                      {/* Status */}
                      <td className="p-3 text-center">
                        {editingCourtId === court.id ? (
                          <label className="inline-flex items-center cursor-pointer justify-center">
                            <input
                              type="checkbox"
                              checked={court.isActive}
                              onChange={(e) => handleCourtChange(court.id, 'isActive', e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className={`relative w-11 h-6 rounded-full peer ${
                              darkMode ? "bg-gray-600" : "bg-gray-300"
                            } peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${
                              darkMode ? "peer-checked:bg-teal-600" : "peer-checked:bg-green-600"
                            }`}></div>
                          </label>
                        ) : (
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${
                            court.isActive
                              ? darkMode 
                                ? "bg-teal-900 text-teal-200" 
                                : "bg-green-100 text-green-800"
                              : darkMode
                                ? "bg-red-900 text-red-200"
                                : "bg-red-100 text-red-800"
                          }`}>
                            {court.isActive ? "Active" : "Inactive"}
                          </span>
                        )}
                      </td>
                      
                      {/* Hours */}
                      <td className="p-3 text-center">
                        {editingCourtId === court.id ? (
                          <div className="flex items-center space-x-1">
                            <select
                              value={court.openTime}
                              onChange={(e) => handleCourtChange(court.id, 'openTime', e.target.value)}
                              className={`w-24 p-1 rounded ${
                                darkMode 
                                  ? "bg-gray-700 border-gray-600 text-white" 
                                  : "bg-white border-gray-300 text-gray-900"
                              } border`}
                            >
                              {generateTimeOptions().map(time => (
                                <option key={time} value={time}>
                                  {time.split(':')[0].padStart(2, '0')}:{time.split(':')[1]}
                                </option>
                              ))}
                            </select>
                            <span>to</span>
                            <select
                              value={court.closeTime}
                              onChange={(e) => handleCourtChange(court.id, 'closeTime', e.target.value)}
                              className={`w-24 p-1 rounded ${
                                darkMode 
                                  ? "bg-gray-700 border-gray-600 text-white" 
                                  : "bg-white border-gray-300 text-gray-900"
                              } border`}
                            >
                              {generateTimeOptions().map(time => (
                                <option key={time} value={time}>
                                  {time.split(':')[0].padStart(2, '0')}:{time.split(':')[1]}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <>
                            {court.openTime} - {court.closeTime}
                          </>
                        )}
                      </td>
                      
                      {/* Actions */}
                      <td className="p-3 text-right whitespace-nowrap">
                        {editingCourtId === court.id ? (
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() => {
                                setEditingCourtId(null);
                                // Reset court data by re-fetching
                                fetchCourtData(clubId);
                              }}
                              className={`px-2 py-1 rounded ${
                                darkMode 
                                  ? "bg-gray-700 hover:bg-gray-600 text-gray-200" 
                                  : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                              } transition-colors`}
                            >
                              Cancel
                            </button>
                            <button
                              onClick={updateCourt}
                              className={`px-2 py-1 rounded ${
                                darkMode 
                                  ? "bg-teal-600 hover:bg-teal-700 text-white" 
                                  : "bg-green-500 hover:bg-green-600 text-white"
                              } transition-colors`}
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() => setEditingCourtId(court.id)}
                              className={`px-2 py-1 rounded ${
                                darkMode 
                                  ? "bg-blue-600 hover:bg-blue-700 text-white" 
                                  : "bg-blue-500 hover:bg-blue-600 text-white"
                              } transition-colors`}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteCourt(court.id)}
                              className={`px-2 py-1 rounded ${
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
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={`text-center py-8 ${
darkMode ? "text-gray-400" : "text-gray-500"
}`}>
<svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
</svg>
<h3 className="mt-4 text-lg font-semibold">No Courts Added Yet</h3>
<p className="mt-2">Add courts to allow members to make reservations.</p>
<button
  onClick={() => {
    setIsAddingCourt(true);
    setNewCourt({
      name: "",
      courtNumber: 1,
      courtType: "Hard",
      isActive: true,
      openTime: "08:00",
      closeTime: "20:00"
    });
  }}
  className={`mt-4 px-4 py-2 rounded-lg ${
    darkMode 
      ? "bg-teal-600 hover:bg-teal-700 text-white" 
      : "bg-green-500 hover:bg-green-600 text-white"
  } transition-colors`}
>
  Add Your First Court
</button>
</div>
)}
</div>

{/* Court Schedule Viewer Section */}
<div className={`p-6 mb-8 rounded-lg shadow-md ${
darkMode ? "bg-gray-800" : "bg-white"
}`}>
<h2 className="text-2xl font-bold mb-6">Court Availability Schedule</h2>

<div className="flex flex-col md:flex-row gap-6">
  <div className="w-full md:w-1/3">
    <h3 className={`text-lg font-medium mb-3 ${
      darkMode ? "text-gray-300" : "text-gray-700"
    }`}>
      View Schedule By Day
    </h3>
    
    <div className={`p-4 rounded-lg ${
      darkMode ? "bg-gray-700" : "bg-gray-100"
    }`}>
      <p className={`mb-4 ${
        darkMode ? "text-gray-400" : "text-gray-600"
      }`}>
        Select a day to view all court availabilities and existing bookings.
      </p>
      
      <Link 
        href="/admin/schedule" 
        className={`w-full py-2 px-4 rounded flex items-center justify-center ${
          darkMode 
            ? "bg-teal-600 hover:bg-teal-700 text-white" 
            : "bg-green-500 hover:bg-green-600 text-white"
        } transition-colors`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
        </svg>
        View Court Schedule
      </Link>
    </div>
  </div>
  
  <div className="w-full md:w-1/3">
    <h3 className={`text-lg font-medium mb-3 ${
      darkMode ? "text-gray-300" : "text-gray-700"
    }`}>
      Club Members
    </h3>
    
    <div className={`p-4 rounded-lg ${
      darkMode ? "bg-gray-700" : "bg-gray-100"
    }`}>
      <p className={`mb-4 ${
        darkMode ? "text-gray-400" : "text-gray-600"
      }`}>
        Manage your club's members and member requests.
      </p>
      
      <Link 
        href="/admin/requests" 
        className={`w-full py-2 px-4 rounded flex items-center justify-center ${
          darkMode 
            ? "bg-blue-600 hover:bg-blue-700 text-white" 
            : "bg-blue-500 hover:bg-blue-600 text-white"
        } transition-colors`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
          <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
        </svg>
        Manage Members
      </Link>
    </div>
  </div>
  
  <div className="w-full md:w-1/3">
    <h3 className={`text-lg font-medium mb-3 ${
      darkMode ? "text-gray-300" : "text-gray-700"
    }`}>
      Reservation Analytics
    </h3>
    
    <div className={`p-4 rounded-lg ${
      darkMode ? "bg-gray-700" : "bg-gray-100"
    }`}>
      <p className={`mb-4 ${
        darkMode ? "text-gray-400" : "text-gray-600"
      }`}>
        View insights about court usage and popular booking times.
      </p>
      
      <button 
        onClick={() => alert("Analytics feature coming soon!")}
        className={`w-full py-2 px-4 rounded flex items-center justify-center ${
          darkMode 
            ? "bg-purple-600 hover:bg-purple-700 text-white" 
            : "bg-purple-500 hover:bg-purple-600 text-white"
        } transition-colors`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
          <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
        </svg>
        View Analytics
      </button>
    </div>
  </div>
</div>
</div>

{/* Court Import/Export Section */}
<div className={`p-6 rounded-lg shadow-md ${
darkMode ? "bg-gray-800" : "bg-white"
}`}>
<h2 className="text-2xl font-bold mb-6">Bulk Court Management</h2>

<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
  <div>
    <h3 className={`text-lg font-medium mb-3 ${
      darkMode ? "text-gray-300" : "text-gray-700"
    }`}>
      Import Courts
    </h3>
    
    <div className={`p-4 rounded-lg ${
      darkMode ? "bg-gray-700" : "bg-gray-100"
    }`}>
      <p className={`mb-4 ${
        darkMode ? "text-gray-400" : "text-gray-600"
      }`}>
        Import multiple courts at once using a CSV file.
      </p>
      
      <label className={`flex items-center justify-center w-full py-2 px-4 rounded cursor-pointer ${
        darkMode 
          ? "bg-gray-600 hover:bg-gray-500 text-white" 
          : "bg-gray-300 hover:bg-gray-400 text-gray-800"
      } transition-colors`}>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        Upload CSV
        <input type="file" accept=".csv" className="hidden" onChange={() => alert("CSV import feature coming soon!")} />
      </label>
      <p className={`mt-2 text-xs ${
        darkMode ? "text-gray-400" : "text-gray-500"
      }`}>
        CSV Format: Court Number, Name, Type, Open Time, Close Time, Active
      </p>
    </div>
  </div>
  
  <div>
    <h3 className={`text-lg font-medium mb-3 ${
      darkMode ? "text-gray-300" : "text-gray-700"
    }`}>
      Export Courts
    </h3>
    
    <div className={`p-4 rounded-lg ${
      darkMode ? "bg-gray-700" : "bg-gray-100"
    }`}>
      <p className={`mb-4 ${
        darkMode ? "text-gray-400" : "text-gray-600"
      }`}>
        Export your courts data as a CSV file.
      </p>
      
      <button
        onClick={() => {
          // Logic for exporting courts to CSV
          if (courts.length === 0) {
            alert("No courts to export.");
            return;
          }
          
          // Create CSV content
          const headers = ["Court Number", "Name", "Type", "Open Time", "Close Time", "Active"];
          const csvContent = [
            headers.join(","),
            ...courts.map(court => [
              court.courtNumber,
              court.name || "",
              court.courtType,
              court.openTime,
              court.closeTime,
              court.isActive ? "Yes" : "No"
            ].join(","))
          ].join("\n");
          
          // Create download link
          const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.setAttribute("href", url);
          link.setAttribute("download", `${clubSettings?.name.replace(/\s+/g, "-")}-courts.csv`);
          link.style.visibility = "hidden";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }}
        className={`w-full py-2 px-4 rounded flex items-center justify-center ${
          darkMode 
            ? "bg-gray-600 hover:bg-gray-500 text-white" 
            : "bg-gray-300 hover:bg-gray-400 text-gray-800"
        } transition-colors`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Export Courts to CSV
      </button>
    </div>
  </div>
</div>
</div>
      </div>
    </div>
  );
}