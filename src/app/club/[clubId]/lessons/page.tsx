"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { auth, db } from "../../../../../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { 
  doc, getDoc, collection, getDocs, query, where
} from "firebase/firestore";
import DarkModeToggle from "@/app/components/DarkModeToggle";
import PageTitle from "@/app/components/PageTitle";

// Define types
interface Coach {
  id: string;
  name: string;
  email: string;
  phone?: string;
  bio?: string;
  specialties: string[];
  hourlyRate: number;
  isActive: boolean;
  profileImage?: string;
  age?: number;
  gender?: string;
  availability?: {
    [key: string]: {
      start: string;
      end: string;
      available: boolean;
    };
  };
}

interface GroupLesson {
  id: string;
  title: string;
  description: string;
  coachId: string;
  coachName: string;
  date: string;
  startTime: string;
  endTime: string;
  maxParticipants: number;
  currentParticipants: number;
  price: number;
  isActive: boolean;
  createdAt: string;
}


export default function LessonsPage() {
  const params = useParams();
  const router = useRouter();
  const clubId = params.clubId as string;
  
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [clubInfo, setClubInfo] = useState<any>(null);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [groupLessons, setGroupLessons] = useState<GroupLesson[]>([]);
  const [activeTab, setActiveTab] = useState<'private' | 'group'>('private');
  const [selectedCoach, setSelectedCoach] = useState<Coach | null>(null);
  const [showCoachModal, setShowCoachModal] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
      } else {
        router.push(`/signin?redirect=/club/${clubId}/lessons`);
      }
    });
    
    return () => unsubscribe();
  }, [router, clubId]);

  // Fetch club and lessons data
  useEffect(() => {
    if (currentUser && clubId) {
      fetchData();
    }
  }, [currentUser, clubId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch club info
      const clubDoc = await getDoc(doc(db, "orgs", clubId));
      if (clubDoc.exists()) {
        setClubInfo(clubDoc.data());
      }

      // Fetch coaches
      const coachesSnapshot = await getDocs(collection(db, `orgs/${clubId}/coaches`));
      const coachesData: Coach[] = [];
      coachesSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.isActive) {
          coachesData.push({
            id: doc.id,
            name: data.name || "Unknown Coach",
            email: data.email || "",
            phone: data.phone,
            bio: data.bio,
            specialties: data.specialties || [],
            hourlyRate: data.hourlyRate || 0,
            isActive: data.isActive,
            profileImage: data.profileImage,
            age: data.age,
            gender: data.gender,
            availability: data.availability
          });
        }
      });
      setCoaches(coachesData);

      // Fetch group lessons
      const groupLessonsSnapshot = await getDocs(
        query(
          collection(db, `orgs/${clubId}/groupLessons`),
          where("isActive", "==", true)
        )
      );
      const groupLessonsData: GroupLesson[] = [];
      groupLessonsSnapshot.forEach((doc) => {
        const data = doc.data();
        groupLessonsData.push({
          id: doc.id,
          title: data.title,
          description: data.description,
          coachId: data.coachId,
          coachName: data.coachName,
          date: data.date,
          startTime: data.startTime,
          endTime: data.endTime,
          maxParticipants: data.maxParticipants,
          currentParticipants: data.currentParticipants || 0,
          price: data.price,
          isActive: data.isActive,
          createdAt: data.createdAt
        });
      });
      
      // Sort group lessons by date
      groupLessonsData.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateA.getTime() - dateB.getTime();
      });
      
      setGroupLessons(groupLessonsData);

    } catch (error) {
      console.error("Error fetching data:", error);
      setError("Failed to load lessons data.");
    } finally {
      setLoading(false);
    }
  };

  const handlePrivateLessonRequest = async (_coachId: string, coachName: string) => {
    // This will open a modal for lesson request details
    // For now, just show a placeholder
    setSuccess(`Lesson request for ${coachName} will be implemented soon!`);
    setTimeout(() => setSuccess(""), 3000);
  };

  const handleGroupLessonRegistration = async (_lessonId: string) => {
    // This will handle group lesson registration and payment
    setSuccess("Group lesson registration will be implemented soon!");
    setTimeout(() => setSuccess(""), 3000);
  };

  const handleCoachClick = (coach: Coach) => {
    setSelectedCoach(coach);
    setShowCoachModal(true);
  };

  const closeCoachModal = () => {
    setShowCoachModal(false);
    setSelectedCoach(null);
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
          <Link
            href={`/club/${clubId}`}
            className={`text-xs sm:text-sm font-light ${
              darkMode
                ? "text-gray-400 hover:text-white"
                : "text-gray-600 hover:text-black"
            } transition-colors`}
          >
            {clubInfo?.name || "Club"}
          </Link>
          <span className={`text-xs ${
            darkMode ? "text-gray-600" : "text-gray-400"
          }`}>/</span>
          <span className={`text-xs sm:text-sm font-light ${
            darkMode ? "text-white" : "text-black"
          }`}>
            Lessons
          </span>
        </div>
        <DarkModeToggle darkMode={darkMode} setDarkMode={setDarkMode} />
      </div>

      {/* Main Content */}
      <div className="px-4 sm:px-6 md:px-12 py-6 sm:py-8">
        <PageTitle 
          title="Lessons & Classes" 
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

        {/* Tab Navigation */}
        <div className={`mb-8 border-b ${
          darkMode ? "border-[#1a1a1a]" : "border-gray-100"
        }`}>
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('private')}
              className={`py-4 px-1 text-sm font-light border-b-2 transition-colors ${
                activeTab === 'private'
                  ? darkMode
                    ? "border-white text-white"
                    : "border-black text-black"
                  : darkMode
                    ? "border-transparent text-gray-400 hover:text-white"
                    : "border-transparent text-gray-500 hover:text-black"
              }`}
            >
              Private Lessons
            </button>
            <button
              onClick={() => setActiveTab('group')}
              className={`py-4 px-1 text-sm font-light border-b-2 transition-colors ${
                activeTab === 'group'
                  ? darkMode
                    ? "border-white text-white"
                    : "border-black text-black"
                  : darkMode
                    ? "border-transparent text-gray-400 hover:text-white"
                    : "border-transparent text-gray-500 hover:text-black"
              }`}
            >
              Group Classes
            </button>
          </nav>
        </div>

        {/* Private Lessons Tab */}
        {activeTab === 'private' && (
          <div>
            <h2 className={`text-lg font-light mb-6 ${
              darkMode ? "text-white" : "text-black"
            }`}>
              Private Lessons
            </h2>
            
            {coaches.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {coaches.map((coach) => (
                  <div
                    key={coach.id}
                    onClick={() => handleCoachClick(coach)}
                    className={`p-6 border cursor-pointer transition-colors hover:opacity-90 ${
                      darkMode
                        ? "border-[#1a1a1a] bg-[#0a0a0a] hover:bg-[#1a1a1a]"
                        : "border-gray-100 bg-white hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className={`font-light text-lg ${
                          darkMode ? "text-white" : "text-black"
                        }`}>
                          {coach.name}
                        </h3>
                        <p className={`text-sm ${
                          darkMode ? "text-gray-400" : "text-gray-600"
                        }`}>
                          ${coach.hourlyRate}/hour
                        </p>
                      </div>
                    </div>
                    
                    {coach.bio && (
                      <p className={`text-sm mb-4 ${
                        darkMode ? "text-gray-300" : "text-gray-700"
                      }`}>
                        {coach.bio}
                      </p>
                    )}
                    
                    {coach.specialties.length > 0 && (
                      <div className="mb-4">
                        <p className={`text-xs uppercase tracking-wider mb-2 ${
                          darkMode ? "text-gray-400" : "text-gray-500"
                        }`}>
                          Specialties
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {coach.specialties.map((specialty, index) => (
                            <span
                              key={index}
                              className={`px-2 py-1 text-xs ${
                                darkMode
                                  ? "bg-[#1a1a1a] text-gray-300"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {specialty}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePrivateLessonRequest(coach.id, coach.name);
                      }}
                      className={`w-full py-2 px-4 text-sm font-light border transition-colors ${
                        darkMode
                          ? "border-white text-white hover:bg-white hover:text-black"
                          : "border-black text-black hover:bg-black hover:text-white"
                      }`}
                    >
                      Request Lesson
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className={`text-center py-12 ${
                darkMode ? "text-gray-400" : "text-gray-600"
              }`}>
                <p>No coaches available for private lessons.</p>
              </div>
            )}
          </div>
        )}

        {/* Group Lessons Tab */}
        {activeTab === 'group' && (
          <div>
            <h2 className={`text-lg font-light mb-6 ${
              darkMode ? "text-white" : "text-black"
            }`}>
              Group Classes & Clinics
            </h2>
            
            {groupLessons.length > 0 ? (
              <div className="space-y-6">
                {groupLessons.map((lesson) => (
                  <div
                    key={lesson.id}
                    className={`p-6 border ${
                      darkMode
                        ? "border-[#1a1a1a] bg-[#0a0a0a]"
                        : "border-gray-100 bg-white"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className={`font-light text-lg ${
                          darkMode ? "text-white" : "text-black"
                        }`}>
                          {lesson.title}
                        </h3>
                        <p className={`text-sm ${
                          darkMode ? "text-gray-400" : "text-gray-600"
                        }`}>
                          with {lesson.coachName}
                        </p>
                      </div>
                      <div className={`text-right ${
                        darkMode ? "text-white" : "text-black"
                      }`}>
                        <p className="font-light text-lg">${lesson.price}</p>
                      </div>
                    </div>
                    
                    {lesson.description && (
                      <p className={`text-sm mb-4 ${
                        darkMode ? "text-gray-300" : "text-gray-700"
                      }`}>
                        {lesson.description}
                      </p>
                    )}
                    
                    <div className="flex justify-between items-center mb-4">
                      <div className={`text-sm ${
                        darkMode ? "text-gray-400" : "text-gray-600"
                      }`}>
                        <p>{lesson.date} • {lesson.startTime} - {lesson.endTime}</p>
                        <p>
                          {lesson.currentParticipants}/{lesson.maxParticipants} spots filled
                        </p>
                      </div>
                    </div>
                    
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${(lesson.currentParticipants / lesson.maxParticipants) * 100}%`
                        }}
                      ></div>
                    </div>
                    
                    <button
                      onClick={() => handleGroupLessonRegistration(lesson.id)}
                      disabled={lesson.currentParticipants >= lesson.maxParticipants}
                      className={`w-full py-2 px-4 text-sm font-light border transition-colors ${
                        lesson.currentParticipants >= lesson.maxParticipants
                          ? darkMode
                            ? "border-gray-600 text-gray-500 cursor-not-allowed"
                            : "border-gray-300 text-gray-400 cursor-not-allowed"
                          : darkMode
                            ? "border-white text-white hover:bg-white hover:text-black"
                            : "border-black text-black hover:bg-black hover:text-white"
                      }`}
                    >
                      {lesson.currentParticipants >= lesson.maxParticipants
                        ? "Class Full"
                        : "Register for Class"
                      }
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className={`text-center py-12 ${
                darkMode ? "text-gray-400" : "text-gray-600"
              }`}>
                <p>No group classes or clinics scheduled.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Coach Details Modal */}
      {showCoachModal && selectedCoach && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`max-w-2xl w-full max-h-[90vh] overflow-y-auto ${
            darkMode ? "bg-[#0a0a0a] border-[#1a1a1a]" : "bg-white border-gray-100"
          } border`}>
            <div className="p-6">
              {/* Header */}
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className={`text-2xl font-light ${
                    darkMode ? "text-white" : "text-black"
                  }`}>
                    {selectedCoach.name}
                  </h2>
                  <p className={`text-lg ${
                    darkMode ? "text-gray-400" : "text-gray-600"
                  }`}>
                    ${selectedCoach.hourlyRate}/hour
                  </p>
                </div>
                <button
                  onClick={closeCoachModal}
                  className={`p-2 transition-colors ${
                    darkMode 
                      ? "text-gray-400 hover:text-white" 
                      : "text-gray-600 hover:text-black"
                  }`}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Coach Information */}
              <div className="space-y-6">
                {/* Bio */}
                {selectedCoach.bio && (
                  <div>
                    <h3 className={`text-lg font-light mb-3 ${
                      darkMode ? "text-white" : "text-black"
                    }`}>
                      About
                    </h3>
                    <p className={`text-sm leading-relaxed ${
                      darkMode ? "text-gray-300" : "text-gray-700"
                    }`}>
                      {selectedCoach.bio}
                    </p>
                  </div>
                )}

                {/* Personal Information */}
                <div>
                  <h3 className={`text-lg font-light mb-3 ${
                    darkMode ? "text-white" : "text-black"
                  }`}>
                    Personal Information
                  </h3>
                  <div className="space-y-2">
                    <p className={`text-sm ${
                      darkMode ? "text-gray-300" : "text-gray-700"
                    }`}>
                      <span className="font-medium">Email:</span> {selectedCoach.email}
                    </p>
                    {selectedCoach.phone && (
                      <p className={`text-sm ${
                        darkMode ? "text-gray-300" : "text-gray-700"
                      }`}>
                        <span className="font-medium">Phone:</span> {selectedCoach.phone}
                      </p>
                    )}
                    {selectedCoach.age && (
                      <p className={`text-sm ${
                        darkMode ? "text-gray-300" : "text-gray-700"
                      }`}>
                        <span className="font-medium">Age:</span> {selectedCoach.age}
                      </p>
                    )}
                    {selectedCoach.gender && (
                      <p className={`text-sm ${
                        darkMode ? "text-gray-300" : "text-gray-700"
                      }`}>
                        <span className="font-medium">Gender:</span> {selectedCoach.gender.charAt(0).toUpperCase() + selectedCoach.gender.slice(1)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Specialties */}
                {selectedCoach.specialties.length > 0 && (
                  <div>
                    <h3 className={`text-lg font-light mb-3 ${
                      darkMode ? "text-white" : "text-black"
                    }`}>
                      Specialties
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedCoach.specialties.map((specialty, index) => (
                        <span
                          key={index}
                          className={`px-3 py-1 text-sm border ${
                            darkMode
                              ? "border-[#1a1a1a] bg-[#0a0a0a] text-white"
                              : "border-gray-200 bg-gray-50 text-gray-700"
                          }`}
                        >
                          {specialty}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Availability */}
                {selectedCoach.availability && (
                  <div>
                    <h3 className={`text-lg font-light mb-3 ${
                      darkMode ? "text-white" : "text-black"
                    }`}>
                      Availability
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {Object.entries(selectedCoach.availability).map(([day, schedule]) => (
                        <div key={day} className={`p-3 border ${
                          darkMode ? "border-[#1a1a1a]" : "border-gray-100"
                        }`}>
                          <div className="flex justify-between items-center">
                            <span className={`text-sm font-medium capitalize ${
                              darkMode ? "text-white" : "text-black"
                            }`}>
                              {day}
                            </span>
                            <span className={`text-xs ${
                              schedule.available 
                                ? (darkMode ? "text-green-400" : "text-green-600")
                                : (darkMode ? "text-gray-500" : "text-gray-400")
                            }`}>
                              {schedule.available ? `${schedule.start} - ${schedule.end}` : "Not available"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 mt-8">
                <button
                  onClick={() => {
                    closeCoachModal();
                    handlePrivateLessonRequest(selectedCoach.id, selectedCoach.name);
                  }}
                  className={`flex-1 py-3 px-6 text-sm font-light border transition-colors ${
                    darkMode
                      ? "border-white text-white hover:bg-white hover:text-black"
                      : "border-black text-black hover:bg-black hover:text-white"
                  }`}
                >
                  Request Lesson
                </button>
                <button
                  onClick={closeCoachModal}
                  className={`px-6 py-3 text-sm font-light border transition-colors ${
                    darkMode
                      ? "border-gray-500 text-gray-400 hover:bg-gray-500 hover:text-white"
                      : "border-gray-400 text-gray-600 hover:bg-gray-400 hover:text-white"
                  }`}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
