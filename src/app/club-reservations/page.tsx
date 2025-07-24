"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  auth, 
  db 
} from '../../../firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  getDoc, 
  doc,
  deleteDoc,
  serverTimestamp, 
  Timestamp 
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import Link from 'next/link';
import BackButton from "@/app/components/BackButton";
import PageTitle from "@/app/components/PageTitle";
import DarkModeToggle from "@/app/components/DarkModeToggle";

interface Court {
  id: string;
  name: string;
  surface: string;
  indoor: boolean;
}

interface Location {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
}

interface Reservation {
  id: string;
  startTime: string;
  endTime: string;
  userName: string;
  userEmail: string;
  userId: string;
  courtId: string;
  courtName?: string;
}

interface UserData {
  id: string;
  email: string;
  fullName: string;
  userType: 'admin' | 'member';
  organization?: string;
  club?: {
    name: string;
    address: string;
    city: string;
    state: string;
  };
}

export default function ClubReservationsPage() {
  // Auth and user state
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [clubId, setClubId] = useState<string>('');
  const [clubName, setClubName] = useState<string>('');
  const [darkMode, setDarkMode] = useState(false);
  
  // Data state
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [courts, setCourts] = useState<Court[]>([]);
  const [selectedCourt, setSelectedCourt] = useState<string>('');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Form state
  const [newReservation, setNewReservation] = useState({
    date: '',
    startTime: '',
    endTime: '',
  });
  
  const router = useRouter();

  // Initialize dark mode from localStorage
  useEffect(() => {
    const savedMode = localStorage.getItem("darkMode");
    if (savedMode === "true") {
      setDarkMode(true);
    }
  }, []);

  // Check authentication and get user data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        await fetchUserData(user.uid);
      } else {
        // Redirect to login if not authenticated
        router.push('/findyourorg');
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Fetch the user's profile data
  const fetchUserData = async (userId: string) => {
    try {
      setLoading(true);
      const userDocRef = doc(db, "users", userId);
      const userDocSnap = await getDoc(userDocRef);
      
      if (!userDocSnap.exists()) {
        throw new Error("User profile not found");
      }
      
      const user = {
        id: userId,
        ...userDocSnap.data()
      } as UserData;
      
      setUserData(user);
      
      // Determine the club ID
      if (user.userType === 'admin' && user.club) {
        // Admin's user ID is their club ID
        setClubId(userId);
        setClubName(user.club.name);
      } else if (user.userType === 'member' && user.organization) {
        // For members, get their club information
        const clubDocRef = doc(db, "users", user.organization);
        const clubDocSnap = await getDoc(clubDocRef);
        
        if (clubDocSnap.exists() && clubDocSnap.data().club) {
          setClubId(user.organization);
          setClubName(clubDocSnap.data().club.name);
        } else {
          throw new Error("Club information not found");
        }
      } else {
        throw new Error("No club association found");
      }
      
      setLoading(false);
    } catch (error: any) {
      console.error("Error fetching user data:", error);
      setError(error.message);
      setLoading(false);
    }
  };

  // Fetch club locations once we have the club ID
  useEffect(() => {
    if (clubId) {
      fetchClubLocations();
    }
  }, [clubId]);

  // Fetch courts when a location is selected
  useEffect(() => {
    if (selectedLocation) {
      fetchLocationCourts();
    } else {
      setCourts([]);
      setSelectedCourt('');
    }
  }, [selectedLocation]);

  // Fetch reservations when a court is selected
  useEffect(() => {
    if (selectedCourt) {
      fetchCourtReservations();
    } else {
      setReservations([]);
    }
  }, [selectedCourt]);

  const fetchClubLocations = async () => {
    try {
      setLoading(true);
      
      const locationsRef = collection(db, "locations");
      const q = query(locationsRef, where("clubId", "==", clubId));
      const querySnapshot = await getDocs(q);
      
      const locationsList: Location[] = [];
      querySnapshot.forEach((doc) => {
        locationsList.push({
          id: doc.id,
          ...doc.data() as Omit<Location, 'id'>
        });
      });
      
      setLocations(locationsList);
      setLoading(false);
    } catch (error: any) {
      console.error("Error fetching locations:", error);
      setError("Failed to load locations");
      setLoading(false);
    }
  };

  const fetchLocationCourts = async () => {
    try {
      setLoading(true);
      
      const courtsRef = collection(db, `locations/${selectedLocation}/courts`);
      const querySnapshot = await getDocs(courtsRef);
      
      const courtsList: Court[] = [];
      querySnapshot.forEach((doc) => {
        courtsList.push({
          id: doc.id,
          ...doc.data() as Omit<Court, 'id'>
        });
      });
      
      setCourts(courtsList);
      setLoading(false);
    } catch (error: any) {
      console.error("Error fetching courts:", error);
      setError("Failed to load courts");
      setLoading(false);
    }
  };

  const fetchCourtReservations = async () => {
    try {
      setLoading(true);
      
      // Get today's date at midnight for filtering
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const reservationsRef = collection(db, "reservations");
      const q = query(
        reservationsRef,
        where("clubId", "==", clubId),
        where("locationId", "==", selectedLocation),
        where("courtId", "==", selectedCourt),
        where("startTime", ">=", Timestamp.fromDate(today))
      );
      
      const querySnapshot = await getDocs(q);
      
      const reservationsList: Reservation[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        reservationsList.push({
          id: doc.id,
          startTime: data.startTime.toDate().toLocaleString(),
          endTime: data.endTime.toDate().toLocaleString(),
          userName: data.userName,
          userEmail: data.userEmail,
          userId: data.userId,
          courtId: data.courtId,
          courtName: courts.find(c => c.id === data.courtId)?.name
        });
      });
      
      // Sort by start time
      reservationsList.sort((a, b) => 
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );
      
      setReservations(reservationsList);
      setLoading(false);
    } catch (error: any) {
      console.error("Error fetching reservations:", error);
      setError("Failed to load reservations");
      setLoading(false);
    }
  };

  const handleReservationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    
    try {
      if (!currentUser || !clubId || !selectedLocation || !selectedCourt) {
        throw new Error("Missing required information");
      }

      if (!userData) {
        throw new Error("User profile not loaded");
      }

      // Construct date-time objects
      const { date, startTime, endTime } = newReservation;
      const startDateTime = new Date(`${date}T${startTime}`);
      const endDateTime = new Date(`${date}T${endTime}`);
      
      // Validate times
      if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
        throw new Error("Invalid date or time");
      }

      if (startDateTime >= endDateTime) {
        throw new Error("End time must be after start time");
      }

      const now = new Date();
      if (startDateTime < now) {
        throw new Error("Cannot book time slots in the past");
      }

      // Check for overlapping reservations
      const isOverlapping = reservations.some(reservation => {
        const resStart = new Date(reservation.startTime);
        const resEnd = new Date(reservation.endTime);
        
        // Check for overlap
        return (
          (startDateTime < resEnd && endDateTime > resStart) ||
          (resStart < endDateTime && resEnd > startDateTime)
        );
      });

      if (isOverlapping) {
        throw new Error("This time slot overlaps with an existing reservation");
      }

      // Create the reservation
      const reservationData = {
        userId: currentUser.uid,
        userName: userData.fullName || currentUser.email.split('@')[0],
        userEmail: currentUser.email,
        clubId: clubId,
        locationId: selectedLocation,
        courtId: selectedCourt,
        startTime: Timestamp.fromDate(startDateTime),
        endTime: Timestamp.fromDate(endDateTime),
        createdAt: serverTimestamp(),
      };

      // Add to Firestore
      setLoading(true);
      const docRef = await addDoc(collection(db, "reservations"), reservationData);
      
      setSuccess("Court reserved successfully!");
      // Clear form
      setNewReservation({
        date: '',
        startTime: '',
        endTime: '',
      });
      
      // Refresh the reservations list
      fetchCourtReservations();
      setLoading(false);
    } catch (error: any) {
      console.error("Error creating reservation:", error);
      setError(error.message);
      setLoading(false);
    }
  };

  const cancelReservation = async (reservationId: string) => {
    if (!confirm("Are you sure you want to cancel this reservation?")) {
      return;
    }

    try {
      setLoading(true);
      await deleteDoc(doc(db, "reservations", reservationId));
      setSuccess("Reservation cancelled successfully");
      fetchCourtReservations();
      setLoading(false);
    } catch (error: any) {
      console.error("Error cancelling reservation:", error);
      setError("Failed to cancel reservation");
      setLoading(false);
    }
  };

  const canCancelReservation = (reservation: Reservation) => {
    if (!currentUser) return false;
    
    // Users can cancel their own reservations
    if (reservation.userId === currentUser.uid) {
      return true;
    }
    
    // Admins can cancel any reservation in their club
    if (userData?.userType === 'admin') {
      return true;
    }
    
    return false;
  };

  // Loading state
  if (loading && !userData) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        darkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'
      }`}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-t-transparent border-blue-500 rounded-full animate-spin mx-auto"></div>
          <p className="mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  // If no club association is found
  if (!clubId && !loading) {
    return (
      <div className={`min-h-screen ${
        darkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'
      }`}>
        <div className="container mx-auto p-4 max-w-md text-center">
          <PageTitle title="No Club Membership - Courtly" />
          
          {/* Dark Mode Toggle Button */}
          <div className="absolute top-8 right-8">
            <DarkModeToggle darkMode={darkMode} setDarkMode={setDarkMode} />
          </div>
          
          <h1 className="text-3xl font-bold mb-4">No Club Membership Found</h1>
          <p className="mb-6">You don't seem to be associated with any club. Please contact your club administrator or sign up for a club.</p>
          <div className="space-y-4">
            <Link href="/findyourorg" className={`block px-4 py-2 rounded ${
              darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'
            } text-white`}>
              Find Your Organization
            </Link>
            <Link href="/signup" className={`block px-4 py-2 rounded ${
              darkMode ? 'bg-green-600 hover:bg-green-700' : 'bg-green-500 hover:bg-green-600'
            } text-white`}>
              Sign Up for a Club
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      darkMode ? 'bg-gray-900 text-gray-50' : 'bg-gray-50 text-gray-900'
    }`}>
      <PageTitle title={`${clubName || 'Club'} Court Reservations - Courtly`} />
      
      {/* Dark Mode Toggle Button */}
      <div className="absolute top-8 right-8">
        <DarkModeToggle darkMode={darkMode} setDarkMode={setDarkMode} />
      </div>
      
      {/* Back button */}
      <div className="absolute top-8 left-8">
        <BackButton darkMode={darkMode} fallbackPath="/dashboard" />
      </div>
      
      <div className="container mx-auto px-4 py-16 max-w-6xl">
        <header className="mb-8 text-center">
          <h1 className={`text-3xl md:text-4xl font-bold mb-2 ${
            darkMode ? 'text-white' : 'text-gray-800'
          }`}>
            {clubName} Court Reservations
          </h1>
          <p className={`${
            darkMode ? 'text-gray-400' : 'text-gray-600'
          }`}>
            Welcome, {userData?.fullName || currentUser?.email}
          </p>
        </header>
        
        {/* Status Messages */}
        {error && (
          <div className="mb-6 p-3 bg-red-100 text-red-700 rounded-lg">
            {error}
          </div>
        )}
        
        {success && (
          <div className="mb-6 p-3 bg-green-100 text-green-700 rounded-lg">
            {success}
          </div>
        )}
        
        {/* Main Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Location Selection */}
          <div className={`p-6 rounded-lg shadow-md ${
            darkMode ? 'bg-gray-800' : 'bg-white'
          }`}>
            <h2 className="text-xl font-semibold mb-4">Select Location</h2>
            
            {locations.length > 0 ? (
              <div className="space-y-3">
                {locations.map(location => (
                  <button
                    key={location.id}
                    onClick={() => {
                      setSelectedLocation(location.id);
                      setSelectedCourt('');
                    }}
                    className={`w-full text-left p-3 rounded transition ${
                      selectedLocation === location.id
                        ? (darkMode 
                          ? 'bg-blue-900 text-white border border-blue-700' 
                          : 'bg-blue-50 border border-blue-500')
                        : (darkMode 
                          ? 'border border-gray-700 hover:border-blue-700' 
                          : 'border border-gray-200 hover:border-blue-300')
                    }`}
                  >
                    <div className="font-medium">{location.name}</div>
                    <div className={`text-sm ${
                      darkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      {location.address}, {location.city}, {location.state}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className={`text-center py-6 ${
                darkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>
                {loading 
                  ? 'Loading locations...' 
                  : 'No locations found for your club'}
              </div>
            )}
          </div>
          
          {/* Court Selection */}
          <div className={`p-6 rounded-lg shadow-md ${
            darkMode ? 'bg-gray-800' : 'bg-white'
          }`}>
            <h2 className="text-xl font-semibold mb-4">Select Court</h2>
            
            {selectedLocation ? (
              courts.length > 0 ? (
                <div className="space-y-3">
                  {courts.map(court => (
                    <button
                      key={court.id}
                      onClick={() => setSelectedCourt(court.id)}
                      className={`w-full text-left p-3 rounded transition ${
                        selectedCourt === court.id
                          ? (darkMode 
                            ? 'bg-blue-900 text-white border border-blue-700' 
                            : 'bg-blue-50 border border-blue-500')
                          : (darkMode 
                            ? 'border border-gray-700 hover:border-blue-700' 
                            : 'border border-gray-200 hover:border-blue-300')
                      }`}
                    >
                      <div className="font-medium">{court.name}</div>
                      <div className={`text-sm ${
                        darkMode ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        {court.surface} • {court.indoor ? 'Indoor' : 'Outdoor'}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className={`text-center py-6 ${
                  darkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  {loading 
                    ? 'Loading courts...' 
                    : 'No courts available at this location'}
                </div>
              )
            ) : (
              <div className={`text-center py-6 ${
                darkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>
                Please select a location first
              </div>
            )}
          </div>
          
          {/* Reservation Form */}
          <div className={`p-6 rounded-lg shadow-md ${
            darkMode ? 'bg-gray-800' : 'bg-white'
          }`}>
            <h2 className="text-xl font-semibold mb-4">Reserve Court</h2>
            
            {selectedCourt ? (
              <form onSubmit={handleReservationSubmit} className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    darkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Date
                  </label>
                  <input
                    type="date"
                    value={newReservation.date}
                    onChange={(e) => setNewReservation({
                      ...newReservation,
                      date: e.target.value
                    })}
                    className={`w-full p-2 rounded ${
                      darkMode 
                        ? 'bg-gray-700 border-gray-600 text-white' 
                        : 'border border-gray-300'
                    }`}
                    required
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                
                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    darkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={newReservation.startTime}
                    onChange={(e) => setNewReservation({
                      ...newReservation,
                      startTime: e.target.value
                    })}
                    className={`w-full p-2 rounded ${
                      darkMode 
                        ? 'bg-gray-700 border-gray-600 text-white' 
                        : 'border border-gray-300'
                    }`}
                    required
                  />
                </div>
                
                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    darkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    End Time
                  </label>
                  <input
                    type="time"
                    value={newReservation.endTime}
                    onChange={(e) => setNewReservation({
                      ...newReservation,
                      endTime: e.target.value
                    })}
                    className={`w-full p-2 rounded ${
                      darkMode 
                        ? 'bg-gray-700 border-gray-600 text-white' 
                        : 'border border-gray-300'
                    }`}
                    required
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full font-medium py-3 px-4 rounded-lg transition ${
                    loading ? "opacity-70 cursor-not-allowed" : ""
                  } ${darkMode 
                    ? "bg-teal-600 text-white hover:bg-teal-700" 
                    : "bg-green-500 text-white hover:bg-green-600"}`}
                >
                  {loading ? 'Processing...' : 'Reserve Court'}
                </button>
              </form>
            ) : (
              <div className={`text-center py-6 ${
                darkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>
                Please select a court to make a reservation
              </div>
            )}
          </div>
        </div>
        
        {/* Reservations List */}
        {selectedCourt && (
          <div className={`mt-10 p-6 rounded-lg shadow-md ${
            darkMode ? 'bg-gray-800' : 'bg-white'
          }`}>
            <h2 className="text-xl font-semibold mb-4">Upcoming Reservations</h2>
            
            {reservations.length > 0 ? (
              <div className="overflow-x-auto">
                <table className={`min-w-full divide-y ${
                  darkMode ? 'divide-gray-700' : 'divide-gray-200'
                }`}>
                  <thead className={darkMode ? 'bg-gray-700' : 'bg-gray-50'}>
                    <tr>
                      <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                        darkMode ? 'text-gray-300' : 'text-gray-500'
                      }`}>
                        Member
                      </th>
                      <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                        darkMode ? 'text-gray-300' : 'text-gray-500'
                      }`}>
                        Start Time
                      </th>
                      <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                        darkMode ? 'text-gray-300' : 'text-gray-500'
                      }`}>
                        End Time
                      </th>
                      <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                        darkMode ? 'text-gray-300' : 'text-gray-500'
                      }`}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${
                    darkMode ? 'divide-gray-700' : 'divide-gray-200'
                  }`}>
                    {reservations.map((reservation) => (
                      <tr key={reservation.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className={`text-sm font-medium ${
                            darkMode ? 'text-white' : 'text-gray-900'
                          }`}>
                            {reservation.userName}
                          </div>
                          <div className={`text-sm ${
                            darkMode ? 'text-gray-400' : 'text-gray-500'
                          }`}>
                            {reservation.userEmail}
                          </div>
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${
                          darkMode ? 'text-gray-300' : 'text-gray-500'
                        }`}>
                          {reservation.startTime}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${
                          darkMode ? 'text-gray-300' : 'text-gray-500'
                        }`}>
                          {reservation.endTime}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {canCancelReservation(reservation) && (
                            <button
                              onClick={() => cancelReservation(reservation.id)}
                              className={`${
                                darkMode 
                                  ? 'text-red-400 hover:text-red-300' 
                                  : 'text-red-600 hover:text-red-900'
                              }`}
                              disabled={loading}
                            >
                              Cancel
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className={`text-center py-8 ${
                darkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>
                {loading 
                  ? 'Loading reservations...' 
                  : 'No upcoming reservations for this court'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}