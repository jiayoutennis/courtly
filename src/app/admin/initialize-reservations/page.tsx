"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth, db } from "../../../../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import DarkModeToggle from "@/app/components/DarkModeToggle";
import PageTitle from "@/app/components/PageTitle";
import { 
  initializeAllClubReservations, 
  checkClubReservationStatus,
  getAllClubs,
  initializeClubReservationSystem
} from "@/app/utils/initializeCourtReservations";

export default function InitializeReservationsPage() {
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [, setUser] = useState<any>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [results, setResults] = useState<any>(null);
  const [clubs, setClubs] = useState<any[]>([]);
  const [selectedClub, setSelectedClub] = useState<string | null>(null);
  const [clubStatus, setClubStatus] = useState<any>(null);

  useEffect(() => {
    // Check dark mode preference
    const savedDarkMode = localStorage.getItem("darkMode") === "true";
    setDarkMode(savedDarkMode);

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", currentUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // Only Courtly admins can access this page
            if (userData.userType === 'courtly') {
              setIsAuthorized(true);
              setUser({
                ...currentUser,
                ...userData
              });
              
              // Load clubs list
              loadClubs();
            } else {
              setIsAuthorized(false);
              setUser(null);
              setError("You don't have permission to access this page");
              router.push('/dashboard');
            }
          } else {
            setIsAuthorized(false);
            setUser(null);
            setError("User profile not found");
            router.push('/signin');
          }
        } catch (err) {
          console.error("Error checking authorization:", err);
          setError("Failed to verify permissions");
          setIsAuthorized(false);
        } finally {
          setLoading(false);
        }
      } else {
        router.push('/signin');
      }
    });

    return () => unsubscribe();
  }, [router]);

  const loadClubs = async () => {
    const clubsResult = await getAllClubs();
    if (clubsResult.success && clubsResult.clubs) {
      setClubs(clubsResult.clubs);
    }
  };

  const handleInitializeAll = async () => {
    if (!window.confirm(
      "This will initialize court reservation systems for ALL clubs. " +
      "Existing data will NOT be overwritten. Continue?"
    )) {
      return;
    }

    setProcessing(true);
    setError("");
    setSuccess("");
    setResults(null);

    try {
      const result = await initializeAllClubReservations();
      
      if (result.success) {
        setSuccess(
          `Successfully initialized ${result.totalClubs} clubs! ` +
          `Check the console for detailed results.`
        );
        setResults(result);
      } else {
        setError(`Failed to initialize clubs: ${result.error}`);
      }
    } catch (err: any) {
      console.error("Error during initialization:", err);
      setError(`Error: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleCheckClubStatus = async (clubId: string) => {
    setProcessing(true);
    setError("");
    setClubStatus(null);

    try {
      const status = await checkClubReservationStatus(clubId);
      
      if (status.success) {
        setClubStatus(status);
      } else {
        setError(`Failed to check status: ${status.error}`);
      }
    } catch (err: any) {
      setError(`Error: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleInitializeSingleClub = async (clubId: string, clubName: string) => {
    if (!window.confirm(
      `Initialize reservation system for ${clubName}? ` +
      `Existing data will NOT be overwritten.`
    )) {
      return;
    }

    setProcessing(true);
    setError("");
    setSuccess("");

    try {
      const club = clubs.find(c => c.id === clubId);
      const courtCount = club?.courtCount || club?.courts || 4;
      
      await initializeClubReservationSystem(
        clubId, 
        clubName, 
        courtCount
      );
      
      setSuccess(`Successfully initialized ${clubName}!`);
      
      // Refresh status
      await handleCheckClubStatus(clubId);
    } catch (err: any) {
      setError(`Error: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${darkMode ? "bg-gray-900 text-white" : "bg-gray-50"}`}>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-t-transparent border-teal-500 rounded-full animate-spin mx-auto mb-4"></div>
            <p>Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className={`min-h-screen ${darkMode ? "bg-gray-900 text-white" : "bg-gray-50"}`}>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <p className="text-xl text-red-500">Access Denied</p>
            <p className="mt-2">You don't have permission to access this page</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${darkMode ? "bg-gray-900 text-white" : "bg-gray-50"}`}>
      {/* Navigation */}
      <nav className={`${darkMode ? "bg-gray-800" : "bg-white"} shadow-md`}>
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="text-xl font-bold text-teal-500">
            Courtly
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className={`${
                darkMode ? "text-gray-300 hover:text-white" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Dashboard
            </Link>
            <DarkModeToggle darkMode={darkMode} setDarkMode={setDarkMode} />
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <PageTitle title="Initialize Court Reservation Systems" />

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

        {/* Bulk Initialization */}
        <div className={`p-6 mb-8 rounded-lg shadow-md ${
          darkMode ? "bg-gray-800" : "bg-white"
        }`}>
          <h2 className="text-2xl font-bold mb-4">Bulk Initialization</h2>
          <p className={`mb-4 ${darkMode ? "text-gray-300" : "text-gray-600"}`}>
            This will initialize court reservation systems for ALL clubs in the system. 
            It will:
          </p>
          <ul className={`mb-6 list-disc list-inside ${darkMode ? "text-gray-300" : "text-gray-600"}`}>
            <li>Create default courts (if none exist)</li>
            <li>Set default operating hours (8am - 8pm, 7 days/week)</li>
            <li>Set default booking settings (2 weeks advance, 1-2 hour slots)</li>
            <li>Skip clubs that already have these configured</li>
          </ul>
          
          <button
            onClick={handleInitializeAll}
            disabled={processing}
            className={`px-6 py-3 rounded-lg font-semibold ${
              processing
                ? "bg-gray-400 cursor-not-allowed"
                : darkMode
                  ? "bg-teal-600 hover:bg-teal-700 text-white"
                  : "bg-teal-500 hover:bg-teal-600 text-white"
            }`}
          >
            {processing ? "Processing..." : "Initialize All Clubs"}
          </button>

          {results && (
            <div className={`mt-6 p-4 rounded-lg ${
              darkMode ? "bg-gray-700" : "bg-gray-100"
            }`}>
              <h3 className="font-semibold mb-2">Initialization Results:</h3>
              <p>Total clubs processed: {results.totalClubs}</p>
              <p className="text-green-600">
                Successful: {results.results.filter((r: any) => !r.error).length}
              </p>
              <p className="text-red-600">
                Failed: {results.results.filter((r: any) => r.error).length}
              </p>
            </div>
          )}
        </div>

        {/* Individual Club Management */}
        <div className={`p-6 rounded-lg shadow-md ${
          darkMode ? "bg-gray-800" : "bg-white"
        }`}>
          <h2 className="text-2xl font-bold mb-4">Individual Club Management</h2>
          
          <div className="mb-6">
            <label className="block mb-2 font-medium">Select a Club:</label>
            <select
              value={selectedClub || ""}
              onChange={(e) => {
                setSelectedClub(e.target.value);
                setClubStatus(null);
              }}
              className={`w-full px-4 py-2 rounded border ${
                darkMode
                  ? "bg-gray-700 border-gray-600 text-white"
                  : "bg-white border-gray-300"
              }`}
            >
              <option value="">-- Select a club --</option>
              {clubs.map((club) => (
                <option key={club.id} value={club.id}>
                  {club.name || "Unnamed Club"} ({club.city}, {club.state})
                </option>
              ))}
            </select>
          </div>

          {selectedClub && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <button
                  onClick={() => handleCheckClubStatus(selectedClub)}
                  disabled={processing}
                  className={`px-4 py-2 rounded-lg ${
                    processing
                      ? "bg-gray-400 cursor-not-allowed"
                      : darkMode
                        ? "bg-blue-600 hover:bg-blue-700 text-white"
                        : "bg-blue-500 hover:bg-blue-600 text-white"
                  }`}
                >
                  Check Status
                </button>
                
                <button
                  onClick={() => {
                    const club = clubs.find(c => c.id === selectedClub);
                    if (club) {
                      handleInitializeSingleClub(selectedClub, club.name);
                    }
                  }}
                  disabled={processing}
                  className={`px-4 py-2 rounded-lg ${
                    processing
                      ? "bg-gray-400 cursor-not-allowed"
                      : darkMode
                        ? "bg-teal-600 hover:bg-teal-700 text-white"
                        : "bg-teal-500 hover:bg-teal-600 text-white"
                  }`}
                >
                  Initialize This Club
                </button>
              </div>

              {clubStatus && (
                <div className={`p-4 rounded-lg ${
                  darkMode ? "bg-gray-700" : "bg-gray-100"
                }`}>
                  <h3 className="font-semibold text-lg mb-3">
                    {clubStatus.clubName}
                  </h3>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={clubStatus.hasOperatingHours ? "text-green-500" : "text-red-500"}>
                        {clubStatus.hasOperatingHours ? "✓" : "✗"}
                      </span>
                      <span>Operating Hours</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className={clubStatus.hasBookingSettings ? "text-green-500" : "text-red-500"}>
                        {clubStatus.hasBookingSettings ? "✓" : "✗"}
                      </span>
                      <span>Booking Settings</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className={clubStatus.courtCount > 0 ? "text-green-500" : "text-red-500"}>
                        {clubStatus.courtCount > 0 ? "✓" : "✗"}
                      </span>
                      <span>Courts: {clubStatus.courtCount}</span>
                    </div>
                  </div>

                  {clubStatus.courts && clubStatus.courts.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-semibold mb-2">Courts:</h4>
                      <ul className="space-y-1">
                        {clubStatus.courts.map((court: any) => (
                          <li key={court.id} className={darkMode ? "text-gray-300" : "text-gray-600"}>
                            {court.name} - {court.surface} 
                            {court.isActive ? "" : " (Inactive)"}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {clubStatus.operatingHours && (
                    <div className="mt-4">
                      <h4 className="font-semibold mb-2">Operating Hours:</h4>
                      <div className={`text-sm ${darkMode ? "text-gray-300" : "text-gray-600"}`}>
                        {Object.entries(clubStatus.operatingHours).map(([day, hours]: [string, any]) => (
                          <div key={day}>
                            {day.charAt(0).toUpperCase() + day.slice(1)}: 
                            {hours.closed ? " Closed" : ` ${hours.open} - ${hours.close}`}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {clubStatus.bookingSettings && (
                    <div className="mt-4">
                      <h4 className="font-semibold mb-2">Booking Settings:</h4>
                      <div className={`text-sm ${darkMode ? "text-gray-300" : "text-gray-600"}`}>
                        <div>Max days in advance: {clubStatus.bookingSettings.maxDaysInAdvance}</div>
                        <div>Min duration: {clubStatus.bookingSettings.minBookingDuration} hour(s)</div>
                        <div>Max duration: {clubStatus.bookingSettings.maxBookingDuration} hour(s)</div>
                        <div>Slot interval: {clubStatus.bookingSettings.slotInterval} minutes</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
