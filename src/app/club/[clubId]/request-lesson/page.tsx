"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { db, auth } from "../../../../../firebase";
import { collection, query, getDocs, where, addDoc, Timestamp, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import PageTitle from "@/app/components/PageTitle";
import DarkModeToggle from "@/app/components/DarkModeToggle";
import { format, addDays } from "date-fns";

interface Coach {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
}

interface ClubInfo {
  id: string;
  name: string;
}

export default function RequestLessonPage() {
  const params = useParams();
  const router = useRouter();
  const clubId = params.clubId as string;
  
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [clubInfo, setClubInfo] = useState<ClubInfo | null>(null);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Form state
  const [selectedCoach, setSelectedCoach] = useState("");
  const [lessonType, setLessonType] = useState("private");
  const [preferredDate, setPreferredDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [preferredTime, setPreferredTime] = useState("");
  const [duration, setDuration] = useState("60");
  const [skillLevel, setSkillLevel] = useState("beginner");
  const [goals, setGoals] = useState("");
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
              setError("You must be a member to request lessons.");
              setTimeout(() => router.push(`/club/${clubId}`), 2000);
              return;
            }
            
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
        router.push(`/signin?redirect=/club/${clubId}/request-lesson`);
      }
    });
    
    return () => unsubscribe();
  }, [clubId, router]);

  const fetchClubData = async () => {
    try {
      setLoading(true);
      
      // Fetch club info
      const clubSnapshot = await getDocs(collection(db, "publicClubs"));
      clubSnapshot.forEach((doc) => {
        if (doc.id === clubId) {
          setClubInfo({
            id: doc.id,
            name: doc.data().name || "Unknown Club"
          });
        }
      });
      
      // Fetch coaches
      const membersQuery = collection(db, `publicClubs/${clubId}/members`);
      const membersSnapshot = await getDocs(membersQuery);
      const coachesData: Coach[] = [];
      
      membersSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.role === 'coach' || data.role === 'admin') {
          coachesData.push({
            id: doc.id,
            userId: data.userId,
            name: data.name || "Unknown",
            email: data.email || "",
            role: data.role
          });
        }
      });
      
      setCoaches(coachesData);
      
      if (coachesData.length > 0 && coachesData[0]) {
        setSelectedCoach(coachesData[0].id);
      }
      
    } catch (error) {
      console.error("Error fetching club data:", error);
      setError("Failed to load club information.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentUser) {
      setError("You must be logged in to request a lesson.");
      return;
    }
    
    if (!selectedCoach || !preferredDate || !preferredTime) {
      setError("Please fill in all required fields.");
      return;
    }
    
    setSubmitting(true);
    setError("");
    setSuccess("");
    
    try {
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
      
      // Get coach info
      const selectedCoachData = coaches.find(c => c.id === selectedCoach);
      
      // Create lesson request
      await addDoc(collection(db, `publicClubs/${clubId}/lessonRequests`), {
        userId: currentUser.uid,
        userName,
        userEmail: currentUser.email,
        coachId: selectedCoach,
        coachName: selectedCoachData?.name || "Unknown Coach",
        lessonType,
        preferredDate,
        preferredTime,
        duration: parseInt(duration),
        skillLevel,
        goals: goals || "",
        notes: notes || "",
        status: "pending",
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      
      setSuccess("Lesson request submitted successfully! The coach will contact you soon.");
      
      // Reset form
      setPreferredTime("");
      setGoals("");
      setNotes("");
      
      setTimeout(() => {
        router.push(`/club/${clubId}`);
      }, 3000);
      
    } catch (error) {
      console.error("Error creating lesson request:", error);
      setError("Failed to submit lesson request. Please try again.");
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

  if (coaches.length === 0) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        darkMode ? "bg-gray-900 text-gray-50" : "bg-gray-50 text-gray-900"
      }`}>
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">No Coaches Available</h1>
          <p className={`mb-4 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
            This club doesn't have any coaches available for lessons yet.
          </p>
          <Link
            href={`/club/${clubId}`}
            className={`px-4 py-2 rounded-lg ${
              darkMode
                ? "bg-teal-600 hover:bg-teal-700 text-white"
                : "bg-green-500 hover:bg-green-600 text-white"
            }`}
          >
            Back to Club
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      darkMode ? "bg-[#0a0a0a] text-white" : "bg-white text-black"
    }`}>
      <PageTitle title={`Request Lesson - ${clubInfo?.name || 'Club'}`} />
      
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
                Request a Lesson
              </h1>
              {clubInfo && (
                <p className={`mt-1 text-xs sm:text-sm font-light ${
                  darkMode ? "text-gray-500" : "text-gray-400"
                }`}>
                  {clubInfo.name}
                </p>
              )}
            </div>
            
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
              <Link
                href={`/club/${clubId}`}
                className={`text-xs sm:text-sm font-light ${
                  darkMode
                    ? "text-gray-400 hover:text-white"
                    : "text-gray-600 hover:text-black"
                } transition-colors`}
              >
                Back to Club
              </Link>
              <DarkModeToggle darkMode={darkMode} setDarkMode={setDarkMode} />
            </div>
          </div>
        </div>
      </header>
      
      <div className="container mx-auto px-4 py-8 max-w-3xl">
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
        
        <div className={`p-6 rounded-lg shadow-md ${
          darkMode ? "bg-gray-800" : "bg-white"
        }`}>
          <h2 className="text-xl font-bold mb-6">Lesson Request Form</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Coach Selection */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                darkMode ? "text-gray-300" : "text-gray-700"
              }`}>
                Select Coach *
              </label>
              <select
                value={selectedCoach}
                onChange={(e) => setSelectedCoach(e.target.value)}
                required
                className={`w-full px-4 py-2 rounded-lg border ${
                  darkMode
                    ? "bg-gray-700 border-gray-600 text-white"
                    : "bg-white border-gray-300 text-gray-900"
                }`}
              >
                {coaches.map(coach => (
                  <option key={coach.id} value={coach.id}>
                    {coach.name} ({coach.role})
                  </option>
                ))}
              </select>
            </div>
            
            {/* Lesson Type */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                darkMode ? "text-gray-300" : "text-gray-700"
              }`}>
                Lesson Type *
              </label>
              <select
                value={lessonType}
                onChange={(e) => setLessonType(e.target.value)}
                required
                className={`w-full px-4 py-2 rounded-lg border ${
                  darkMode
                    ? "bg-gray-700 border-gray-600 text-white"
                    : "bg-white border-gray-300 text-gray-900"
                }`}
              >
                <option value="private">Private (1-on-1)</option>
                <option value="semi-private">Semi-Private (2-3 people)</option>
                <option value="group">Group (4+ people)</option>
              </select>
            </div>
            
            {/* Preferred Date */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                darkMode ? "text-gray-300" : "text-gray-700"
              }`}>
                Preferred Date *
              </label>
              <input
                type="date"
                value={preferredDate}
                min={format(new Date(), 'yyyy-MM-dd')}
                max={format(addDays(new Date(), 60), 'yyyy-MM-dd')}
                onChange={(e) => setPreferredDate(e.target.value)}
                required
                className={`w-full px-4 py-2 rounded-lg border ${
                  darkMode
                    ? "bg-gray-700 border-gray-600 text-white"
                    : "bg-white border-gray-300 text-gray-900"
                }`}
              />
            </div>
            
            {/* Preferred Time */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                darkMode ? "text-gray-300" : "text-gray-700"
              }`}>
                Preferred Time *
              </label>
              <input
                type="time"
                value={preferredTime}
                onChange={(e) => setPreferredTime(e.target.value)}
                required
                className={`w-full px-4 py-2 rounded-lg border ${
                  darkMode
                    ? "bg-gray-700 border-gray-600 text-white"
                    : "bg-white border-gray-300 text-gray-900"
                }`}
              />
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
            
            {/* Skill Level */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                darkMode ? "text-gray-300" : "text-gray-700"
              }`}>
                Skill Level *
              </label>
              <select
                value={skillLevel}
                onChange={(e) => setSkillLevel(e.target.value)}
                required
                className={`w-full px-4 py-2 rounded-lg border ${
                  darkMode
                    ? "bg-gray-700 border-gray-600 text-white"
                    : "bg-white border-gray-300 text-gray-900"
                }`}
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            
            {/* Goals */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                darkMode ? "text-gray-300" : "text-gray-700"
              }`}>
                What are your goals for this lesson?
              </label>
              <textarea
                value={goals}
                onChange={(e) => setGoals(e.target.value)}
                rows={3}
                placeholder="E.g., improve serve, work on forehand, match strategy..."
                className={`w-full px-4 py-2 rounded-lg border ${
                  darkMode
                    ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                    : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
                }`}
              />
            </div>
            
            {/* Additional Notes */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                darkMode ? "text-gray-300" : "text-gray-700"
              }`}>
                Additional Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Any other information the coach should know..."
                className={`w-full px-4 py-2 rounded-lg border ${
                  darkMode
                    ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                    : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
                }`}
              />
            </div>
            
            {/* Info Box */}
            <div className={`p-4 rounded-lg ${
              darkMode ? "bg-blue-900/30 border border-blue-700" : "bg-blue-50 border border-blue-200"
            }`}>
              <p className={`text-sm ${darkMode ? "text-blue-200" : "text-blue-800"}`}>
                📌 This is a request only. The coach will review your request and contact you to confirm the lesson details and availability.
              </p>
            </div>
            
            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className={`w-full px-6 py-3 rounded-lg font-semibold transition ${
                submitting
                  ? "bg-gray-400 cursor-not-allowed"
                  : darkMode
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-blue-500 hover:bg-blue-600 text-white"
              }`}
            >
              {submitting ? "Submitting..." : "Submit Lesson Request"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
