"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth, db } from "../../../../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { 
  doc, getDoc, updateDoc,
  serverTimestamp
} from "firebase/firestore";
import DarkModeToggle from "@/app/components/DarkModeToggle";
import PageTitle from "@/app/components/PageTitle";

interface CoachProfile {
  userId: string;
  email: string;
  name: string;
  hourlyRate: number;
  isActive: boolean;
  specialties: string[];
  bio: string;
  phone: string;
  profileImage: string;
  age: number | null;
  gender: string | null;
  birthday: string | null;
  availability: {
    [key: string]: {
      start?: string;
      end?: string;
      available?: boolean;
    };
  };
  createdAt: any;
  updatedAt: any;
}

export default function CoachProfilePage() {
  const router = useRouter();
  
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [coachProfile, setCoachProfile] = useState<CoachProfile | null>(null);
  const [clubs, setClubs] = useState<Array<{id: string, name: string}>>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isEditing, setIsEditing] = useState(false);

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
        setCurrentUser(user);
        setCurrentUserId(user.uid);
      } else {
        router.push("/signin?redirect=/coach/profile");
      }
    });
    
    return () => unsubscribe();
  }, [router]);

  // Fetch coach profile and clubs
  useEffect(() => {
    if (currentUser) {
      fetchCoachData();
    }
  }, [currentUser]);

  const fetchCoachData = async () => {
    try {
      setLoading(true);
      
      // Get user's organization to find which clubs they coach at
      const userDoc = await getDoc(doc(db, "users", currentUserId));
      if (!userDoc.exists()) {
        setError("User profile not found.");
        return;
      }
      
      const userData = userDoc.data();
      const organization = userData.organization || [];
      const clubIds = Array.isArray(organization) ? organization : [organization];
      
      // Fetch club information
      const clubsData = [];
      for (const clubId of clubIds) {
        const clubDoc = await getDoc(doc(db, "orgs", clubId));
        if (clubDoc.exists()) {
          clubsData.push({
            id: clubId,
            name: clubDoc.data().name || "Unknown Club"
          });
        }
      }
      setClubs(clubsData);
      
      // Fetch coach profile from the first club (coaches can be at multiple clubs)
      if (clubIds.length > 0) {
        const coachDoc = await getDoc(doc(db, `orgs/${clubIds[0]}/coaches`, currentUserId));
        if (coachDoc.exists()) {
          setCoachProfile(coachDoc.data() as CoachProfile);
        }
      }
      
    } catch (error) {
      console.error("Error fetching coach data:", error);
      setError("Failed to load coach profile.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!coachProfile || clubs.length === 0) return;
    
    try {
      setError("");
      setSuccess("");
      
      // Update coach profile in all clubs they're associated with
      for (const club of clubs) {
        await updateDoc(doc(db, `orgs/${club.id}/coaches`, currentUserId), {
          ...coachProfile,
          updatedAt: serverTimestamp()
        });
      }
      
      setSuccess("Profile updated successfully!");
      setIsEditing(false);
      setTimeout(() => setSuccess(""), 3000);
      
    } catch (error) {
      console.error("Error updating profile:", error);
      setError("Failed to update profile.");
      setTimeout(() => setError(""), 3000);
    }
  };

  const handleProfileChange = (field: keyof CoachProfile, value: any) => {
    if (!coachProfile) return;
    
    setCoachProfile({
      ...coachProfile,
      [field]: value
    });
  };

  const handleAvailabilityChange = (day: string, field: 'start' | 'end' | 'available', value: any) => {
    if (!coachProfile) return;
    
    setCoachProfile({
      ...coachProfile,
      availability: {
        ...coachProfile.availability,
        [day]: {
          ...coachProfile.availability[day],
          [field]: value
        }
      }
    });
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        darkMode ? "bg-[#0a0a0a] text-white" : "bg-white text-black"
      }`}>
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!coachProfile) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        darkMode ? "bg-[#0a0a0a] text-white" : "bg-white text-black"
      }`}>
        <div className="text-center">
          <h1 className="text-lg font-light mb-4">Coach Profile Not Found</h1>
          <p className={`text-sm mb-6 ${
            darkMode ? "text-gray-400" : "text-gray-600"
          }`}>
            You need to be promoted to coach by a club admin first.
          </p>
          <Link
            href="/dashboard"
            className={`px-4 py-2 text-sm font-light border transition-colors ${
              darkMode
                ? "border-white text-white hover:bg-white hover:text-black"
                : "border-black text-black hover:bg-black hover:text-white"
            }`}
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      darkMode ? "bg-[#0a0a0a] text-white" : "bg-white text-black"
    }`}>
      {/* Header */}
      <div className={`px-4 sm:px-6 md:px-12 py-4 sm:py-6 flex justify-between items-center ${
        darkMode ? "border-b border-[#1a1a1a]" : "border-b border-gray-100"
      }`}>
        <div className="flex items-center gap-3 sm:gap-4">
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
          <span className={`text-xs ${
            darkMode ? "text-gray-600" : "text-gray-400"
          }`}>/</span>
          <span className={`text-xs sm:text-sm font-light ${
            darkMode ? "text-white" : "text-black"
          }`}>
            Coach Profile
          </span>
        </div>
        <DarkModeToggle darkMode={darkMode} setDarkMode={setDarkMode} />
      </div>

      {/* Main Content */}
      <div className="px-4 sm:px-6 md:px-12 py-6 sm:py-8">
        <PageTitle 
          title="Coach Profile" 
        />

        {/* Error/Success Messages */}
        {error && (
          <div className={`mb-6 p-4 border ${
            darkMode 
              ? "border-red-500 bg-red-900/20 text-red-400" 
              : "border-red-300 bg-red-50 text-red-600"
          }`}>
            {error}
          </div>
        )}
        
        {success && (
          <div className={`mb-6 p-4 border ${
            darkMode 
              ? "border-green-500 bg-green-900/20 text-green-400" 
              : "border-green-300 bg-green-50 text-green-600"
          }`}>
            {success}
          </div>
        )}

        {/* Clubs */}
        <div className={`mb-8 p-6 border ${
          darkMode ? "border-[#1a1a1a] bg-[#0a0a0a]" : "border-gray-100 bg-white"
        }`}>
          <h2 className={`text-lg font-light mb-4 ${
            darkMode ? "text-white" : "text-black"
          }`}>
            Coaching at Clubs
          </h2>
          <div className="space-y-2">
            {clubs.map((club) => (
              <div key={club.id} className={`text-sm ${
                darkMode ? "text-gray-300" : "text-gray-700"
              }`}>
                {club.name}
              </div>
            ))}
          </div>
        </div>

        {/* Profile Information */}
        <div className={`mb-8 p-6 border ${
          darkMode ? "border-[#1a1a1a] bg-[#0a0a0a]" : "border-gray-100 bg-white"
        }`}>
          <div className="flex justify-between items-center mb-6">
            <h2 className={`text-lg font-light ${
              darkMode ? "text-white" : "text-black"
            }`}>
              Personal Information
            </h2>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className={`px-4 py-2 text-sm font-light border transition-colors ${
                  darkMode
                    ? "border-white text-white hover:bg-white hover:text-black"
                    : "border-black text-black hover:bg-black hover:text-white"
                }`}
              >
                Edit Profile
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Name */}
            <div>
              <label className={`block text-xs uppercase tracking-wider mb-2 font-light ${
                darkMode ? "text-gray-400" : "text-gray-600"
              }`}>
                Full Name
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={coachProfile.name}
                  onChange={(e) => handleProfileChange('name', e.target.value)}
                  className={`w-full px-4 py-3 border font-light focus:outline-none ${
                    darkMode 
                      ? "bg-[#0a0a0a] border-[#1a1a1a] text-white" 
                      : "bg-white border-gray-100 text-gray-900"
                  }`}
                />
              ) : (
                <p className={`text-sm ${
                  darkMode ? "text-white" : "text-black"
                }`}>
                  {coachProfile.name}
                </p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className={`block text-xs uppercase tracking-wider mb-2 font-light ${
                darkMode ? "text-gray-400" : "text-gray-600"
              }`}>
                Email
              </label>
              <p className={`text-sm ${
                darkMode ? "text-gray-300" : "text-gray-600"
              }`}>
                {coachProfile.email}
              </p>
            </div>

            {/* Phone */}
            <div>
              <label className={`block text-xs uppercase tracking-wider mb-2 font-light ${
                darkMode ? "text-gray-400" : "text-gray-600"
              }`}>
                Phone
              </label>
              {isEditing ? (
                <input
                  type="tel"
                  value={coachProfile.phone}
                  onChange={(e) => handleProfileChange('phone', e.target.value)}
                  className={`w-full px-4 py-3 border font-light focus:outline-none ${
                    darkMode 
                      ? "bg-[#0a0a0a] border-[#1a1a1a] text-white" 
                      : "bg-white border-gray-100 text-gray-900"
                  }`}
                />
              ) : (
                <p className={`text-sm ${
                  darkMode ? "text-white" : "text-black"
                }`}>
                  {coachProfile.phone || "Not provided"}
                </p>
              )}
            </div>

            {/* Age */}
            <div>
              <label className={`block text-xs uppercase tracking-wider mb-2 font-light ${
                darkMode ? "text-gray-400" : "text-gray-600"
              }`}>
                Age
              </label>
              {isEditing ? (
                <input
                  type="number"
                  value={coachProfile.age || ""}
                  onChange={(e) => handleProfileChange('age', e.target.value ? parseInt(e.target.value) : null)}
                  className={`w-full px-4 py-3 border font-light focus:outline-none ${
                    darkMode 
                      ? "bg-[#0a0a0a] border-[#1a1a1a] text-white" 
                      : "bg-white border-gray-100 text-gray-900"
                  }`}
                />
              ) : (
                <p className={`text-sm ${
                  darkMode ? "text-white" : "text-black"
                }`}>
                  {coachProfile.age || "Not provided"}
                </p>
              )}
            </div>

            {/* Gender */}
            <div>
              <label className={`block text-xs uppercase tracking-wider mb-2 font-light ${
                darkMode ? "text-gray-400" : "text-gray-600"
              }`}>
                Gender
              </label>
              {isEditing ? (
                <select
                  value={coachProfile.gender || ""}
                  onChange={(e) => handleProfileChange('gender', e.target.value || null)}
                  className={`w-full px-4 py-3 border font-light focus:outline-none ${
                    darkMode 
                      ? "bg-[#0a0a0a] border-[#1a1a1a] text-white" 
                      : "bg-white border-gray-100 text-gray-900"
                  }`}
                >
                  <option value="">Prefer not to say</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="non-binary">Non-binary</option>
                  <option value="other">Other</option>
                </select>
              ) : (
                <p className={`text-sm ${
                  darkMode ? "text-white" : "text-black"
                }`}>
                  {coachProfile.gender || "Not provided"}
                </p>
              )}
            </div>

            {/* Birthday */}
            <div>
              <label className={`block text-xs uppercase tracking-wider mb-2 font-light ${
                darkMode ? "text-gray-400" : "text-gray-600"
              }`}>
                Birthday
              </label>
              {isEditing ? (
                <input
                  type="date"
                  value={coachProfile.birthday || ""}
                  onChange={(e) => handleProfileChange('birthday', e.target.value || null)}
                  className={`w-full px-4 py-3 border font-light focus:outline-none ${
                    darkMode 
                      ? "bg-[#0a0a0a] border-[#1a1a1a] text-white" 
                      : "bg-white border-gray-100 text-gray-900"
                  }`}
                />
              ) : (
                <p className={`text-sm ${
                  darkMode ? "text-white" : "text-black"
                }`}>
                  {coachProfile.birthday || "Not provided"}
                </p>
              )}
            </div>
          </div>

          {/* Bio */}
          <div className="mt-6">
            <label className={`block text-xs uppercase tracking-wider mb-2 font-light ${
              darkMode ? "text-gray-400" : "text-gray-600"
            }`}>
              Bio
            </label>
            {isEditing ? (
              <textarea
                value={coachProfile.bio}
                onChange={(e) => handleProfileChange('bio', e.target.value)}
                rows={4}
                className={`w-full px-4 py-3 border font-light focus:outline-none ${
                  darkMode 
                    ? "bg-[#0a0a0a] border-[#1a1a1a] text-white" 
                    : "bg-white border-gray-100 text-gray-900"
                }`}
                placeholder="Tell members about your coaching experience and specialties..."
              />
            ) : (
              <p className={`text-sm ${
                darkMode ? "text-white" : "text-black"
              }`}>
                {coachProfile.bio || "No bio provided"}
              </p>
            )}
          </div>

          {/* Specialties */}
          <div className="mt-6">
            <label className={`block text-xs uppercase tracking-wider mb-2 font-light ${
              darkMode ? "text-gray-400" : "text-gray-600"
            }`}>
              Specialties
            </label>
            {isEditing ? (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Add specialty (press Enter to add)"
                  className={`w-full px-4 py-3 border font-light focus:outline-none ${
                    darkMode 
                      ? "bg-[#0a0a0a] border-[#1a1a1a] text-white" 
                      : "bg-white border-gray-100 text-gray-900"
                  }`}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const input = e.target as HTMLInputElement;
                      if (input.value.trim()) {
                        handleProfileChange('specialties', [...coachProfile.specialties, input.value.trim()]);
                        input.value = '';
                      }
                    }
                  }}
                />
                <div className="flex flex-wrap gap-2">
                  {coachProfile.specialties.map((specialty, index) => (
                    <span
                      key={index}
                      className={`px-3 py-1 text-xs border ${
                        darkMode
                          ? "border-[#1a1a1a] bg-[#0a0a0a] text-white"
                          : "border-gray-200 bg-gray-50 text-gray-700"
                      }`}
                    >
                      {specialty}
                      <button
                        onClick={() => {
                          const newSpecialties = coachProfile.specialties.filter((_, i) => i !== index);
                          handleProfileChange('specialties', newSpecialties);
                        }}
                        className="ml-2 hover:text-red-500"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {coachProfile.specialties.length > 0 ? (
                  coachProfile.specialties.map((specialty, index) => (
                    <span
                      key={index}
                      className={`px-3 py-1 text-xs border ${
                        darkMode
                          ? "border-[#1a1a1a] bg-[#0a0a0a] text-white"
                          : "border-gray-200 bg-gray-50 text-gray-700"
                      }`}
                    >
                      {specialty}
                    </span>
                  ))
                ) : (
                  <p className={`text-sm ${
                    darkMode ? "text-gray-400" : "text-gray-500"
                  }`}>
                    No specialties added
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          {isEditing && (
            <div className="flex gap-4 mt-6">
              <button
                onClick={handleSaveProfile}
                className={`px-6 py-2 text-sm font-light border transition-colors ${
                  darkMode
                    ? "border-green-500 text-green-400 hover:bg-green-500 hover:text-white"
                    : "border-green-600 text-green-600 hover:bg-green-600 hover:text-white"
                }`}
              >
                Save Changes
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className={`px-6 py-2 text-sm font-light border transition-colors ${
                  darkMode
                    ? "border-gray-500 text-gray-400 hover:bg-gray-500 hover:text-white"
                    : "border-gray-400 text-gray-600 hover:bg-gray-400 hover:text-white"
                }`}
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Availability */}
        <div className={`mb-8 p-6 border ${
          darkMode ? "border-[#1a1a1a] bg-[#0a0a0a]" : "border-gray-100 bg-white"
        }`}>
          <h2 className={`text-lg font-light mb-6 ${
            darkMode ? "text-white" : "text-black"
          }`}>
            Weekly Availability
          </h2>
          
          <div className="space-y-4">
            {Object.entries(coachProfile.availability).map(([day, schedule]) => (
              <div key={day} className={`p-4 border ${
                darkMode ? "border-[#1a1a1a]" : "border-gray-100"
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className={`text-sm font-light capitalize ${
                    darkMode ? "text-white" : "text-black"
                  }`}>
                    {day}
                  </h3>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={schedule.available}
                      onChange={(e) => handleAvailabilityChange(day, 'available', e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className={`text-xs ${
                      darkMode ? "text-gray-300" : "text-gray-600"
                    }`}>
                      Available
                    </span>
                  </label>
                </div>
                
                {schedule.available && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-xs uppercase tracking-wider mb-1 font-light ${
                        darkMode ? "text-gray-400" : "text-gray-600"
                      }`}>
                        Start Time
                      </label>
                      <input
                        type="time"
                        value={schedule.start}
                        onChange={(e) => handleAvailabilityChange(day, 'start', e.target.value)}
                        className={`w-full px-3 py-2 text-sm border font-light focus:outline-none ${
                          darkMode 
                            ? "bg-[#0a0a0a] border-[#1a1a1a] text-white" 
                            : "bg-white border-gray-100 text-gray-900"
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`block text-xs uppercase tracking-wider mb-1 font-light ${
                        darkMode ? "text-gray-400" : "text-gray-600"
                      }`}>
                        End Time
                      </label>
                      <input
                        type="time"
                        value={schedule.end}
                        onChange={(e) => handleAvailabilityChange(day, 'end', e.target.value)}
                        className={`w-full px-3 py-2 text-sm border font-light focus:outline-none ${
                          darkMode 
                            ? "bg-[#0a0a0a] border-[#1a1a1a] text-white" 
                            : "bg-white border-gray-100 text-gray-900"
                        }`}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          
          <div className="mt-6">
            <button
              onClick={handleSaveProfile}
              className={`px-6 py-2 text-sm font-light border transition-colors ${
                darkMode
                  ? "border-white text-white hover:bg-white hover:text-black"
                  : "border-black text-black hover:bg-black hover:text-white"
              }`}
            >
              Save Availability
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
