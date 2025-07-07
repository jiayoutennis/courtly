"use client";

import Link from "next/link";
import { useState, useEffect, Suspense, FormEvent } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import DarkModeToggle from "@/app/components/DarkModeToggle";
import BackButton from "@/app/components/BackButton";
import PageTitle from "@/app/components/PageTitle";
import { auth, db } from "../../../firebase"; // Adjust the import path based on your project structure
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, collection, getDocs } from "firebase/firestore";

interface Club {
  id: string;
  name: string;
}

// Client component that uses searchParams
function SignUpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const optionParam = searchParams ? searchParams.get('option') : null;
  
  const [darkMode, setDarkMode] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(optionParam || null);
  const [showForm, setShowForm] = useState(!!optionParam); // Show form immediately if option is provided
  
  // Form states
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [clubName, setClubName] = useState("");
  const [clubAddress, setClubAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [organization, setOrganization] = useState("");
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loadingClubs, setLoadingClubs] = useState(false);
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  // Initialize dark mode from localStorage on component mount
  useEffect(() => {
    const savedMode = localStorage.getItem("darkMode");
    if (savedMode === "true") {
      setDarkMode(true);
    }
  }, []);

  // Fetch clubs from Firestore
  useEffect(() => {
    if (selectedOption === 'connect' && showForm) {
      const fetchClubs = async () => {
        setLoadingClubs(true);
        try {
          const clubsCollection = collection(db, "users");
          const querySnapshot = await getDocs(clubsCollection);
          
          const clubsData: Club[] = [];
          querySnapshot.forEach((doc) => {
            const data = doc.data();
            // Only include documents that have club data and are admin type users
            if (data.userType === 'admin' && data.club && data.club.name) {
              clubsData.push({
                id: doc.id,
                name: data.club.name
              });
            }
          });
          
          setClubs(clubsData);
        } catch (error) {
          console.error("Error fetching clubs:", error);
        } finally {
          setLoadingClubs(false);
        }
      };

      fetchClubs();
    }
  }, [selectedOption, showForm]);
  
  const handleOptionSelect = (option: string) => {
    setSelectedOption(option);
  };
  
  const proceedToForm = () => {
    if (selectedOption) {
      setShowForm(true);
    }
  };

  const validateForm = () => {
    setError("");
    
    if (!email || !password || !confirmPassword || !fullName) {
      setError("Please fill in all required fields");
      return false;
    }
    
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return false;
    }
    
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return false;
    }
    
    if (selectedOption === 'register' && (!clubName || !clubAddress || !city || !state)) {
      setError("Please fill in all club information");
      return false;
    }
    
    if (selectedOption === 'connect' && !organization) {
      setError("Please select your tennis organization");
      return false;
    }
    
    return true;
  };
  
  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);
    
    try {
      // Create user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Store additional user info in Firestore
      await setDoc(doc(db, "users", user.uid), {
        fullName,
        email,
        userType: selectedOption === 'connect' ? 'member' : 'admin',
        createdAt: new Date().toISOString(),
        ...(selectedOption === 'register' 
          ? { 
              club: {
                name: clubName,
                address: clubAddress,
                city,
                state
              }
            } 
          : { organization }
        )
      });
      
      setSuccess("Account created successfully!");
      
      // Redirect to dashboard or confirmation page after brief delay
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
    } catch (error: any) {
      console.error("Error signing up:", error);
      
      // Provide user-friendly error messages
      if (error.code === 'auth/invalid-credential' || 
          error.code === 'auth/user-not-found' || 
          error.code === 'auth/wrong-password' ||
          error.code === 'auth/invalid-email') {
        setError("Wrong email or password");
      } else if (error.code === 'auth/email-already-in-use') {
        setError("This email is already registered");
      } else if (error.code === 'auth/weak-password') {
        setError("Password is too weak, please choose a stronger password");
      } else if (error.code === 'auth/network-request-failed') {
        setError("Network error. Please check your connection");
      } else {
        setError("Failed to create account. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode 
      ? "bg-gray-900 text-gray-50" 
      : "bg-white text-slate-800"}`}>
      
      {/* Dynamic title based on current state */}
      <PageTitle 
        title={
          showForm
            ? (selectedOption === 'connect' 
               ? "Connect to Your Club - Courtly" 
               : "Register Your Club - Courtly")
            : "Sign Up - Courtly"
        } 
      />
      
      <div className="flex flex-col items-center justify-center min-h-screen px-4">
        {/* Dark Mode Toggle Button */}
        <div className="absolute top-8 right-8">
          <DarkModeToggle darkMode={darkMode} setDarkMode={setDarkMode} />
        </div>
        
        {/* Back button */}
        <div className="absolute top-8 left-8">
          <BackButton darkMode={darkMode} fallbackPath="/" />
        </div>

        {/* Logo */}
        <div className={`mb-8 ${darkMode 
          ? "bg-teal-600" 
          : "bg-green-400"} p-4 rounded-full shadow-md transition-colors`}>
          <div className="w-16 h-16 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
            </svg>
          </div>
        </div>

        {!showForm ? (
          <>
            {/* Option Selection Screen */}
            <h1 className={`text-3xl md:text-4xl font-bold mb-2 text-center ${darkMode 
              ? "text-white" 
              : "text-slate-800"} transition-colors`}>Join Courtly</h1>
            <p className={`${darkMode 
              ? "text-gray-400" 
              : "text-gray-600"} mb-8 text-center transition-colors`}>
              Choose how you&apos;d like to get started
            </p>
            
            {/* Option Cards */}
            <div className="w-full max-w-md space-y-4">
              {/* Connect to Club Option */}
              <button 
                onClick={() => handleOptionSelect('connect')}
                className={`w-full font-medium py-3 px-4 rounded-lg flex items-center justify-center transition-colors ${
                  selectedOption === 'connect'
                    ? (darkMode ? 'bg-teal-600 text-white' : 'bg-green-400 text-white')
                    : (darkMode 
                      ? 'bg-gray-800 text-white hover:bg-gray-700 border border-gray-700' 
                      : 'bg-white text-slate-800 hover:bg-gray-50 border border-gray-200')
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
                Connect to your club
              </button>
              
              {/* Register a Club Option */}
              <button 
                onClick={() => handleOptionSelect('register')}
                className={`w-full font-medium py-3 px-4 rounded-lg flex items-center justify-center transition-colors ${
                  selectedOption === 'register'
                    ? (darkMode ? 'bg-teal-600 text-white' : 'bg-green-400 text-white')
                    : (darkMode 
                      ? 'bg-gray-800 text-white hover:bg-gray-700 border border-gray-700' 
                      : 'bg-white text-slate-800 hover:bg-gray-50 border border-gray-200')
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z" />
                </svg>
                Register your club
              </button>
              
              {/* Continue Button - only show if an option is selected */}
              {selectedOption && (
                <button 
                  onClick={proceedToForm}
                  className={`w-full mt-6 font-medium py-3 px-4 rounded-lg transition-colors ${darkMode 
                    ? "bg-teal-600 text-white hover:bg-violet-600" 
                    : "bg-green-400 text-white hover:bg-amber-400"}`}>
                  Continue
                </button>
              )}
            </div>
            
            {/* Already have an account */}
            <div className="mt-8 text-center">
              <p className={`${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                Already have an account?{" "}
                <Link href="/findyourorg" className={`font-medium ${darkMode 
                  ? "text-teal-400 hover:text-violet-400" 
                  : "text-amber-400 hover:text-green-400"} transition-colors`}>
                  Sign in here
                </Link>
              </p>
            </div>
          </>
        ) : (
          <>
            {/* Sign Up Form Screen */}
            <h1 className={`text-3xl md:text-4xl font-bold mb-2 text-center ${darkMode 
              ? "text-white" 
              : "text-slate-800"} transition-colors`}>
              {selectedOption === 'connect' ? 'Connect to your club' : 'Register your club'}
            </h1>
            <p className={`${darkMode 
              ? "text-gray-400" 
              : "text-gray-600"} mb-8 text-center transition-colors`}>
              {selectedOption === 'connect' 
                ? 'Join your existing tennis organization on Courtly'
                : 'Create and manage your own tennis organization on Courtly'
              }
            </p>
            
            {/* Display error or success message */}
            {error && (
              <div className="w-full max-w-md mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
                {error}
              </div>
            )}
            
            {success && (
              <div className="w-full max-w-md mb-4 p-3 bg-green-100 text-green-700 rounded-lg">
                {success}
              </div>
            )}
            
            {/* Signup form */}
            <form onSubmit={handleSignUp} className="w-full max-w-md space-y-4">
              <div className="space-y-4">
                {selectedOption === 'connect' ? (
                  <>
                    {/* Connect to Club Form */}
                    {/* Tennis Organization Dropdown */}
                    <div className="relative">
                      <select 
                        value={organization}
                        onChange={(e) => setOrganization(e.target.value)}
                        className={`w-full appearance-none rounded-lg px-4 py-3 focus:outline-none focus:ring-2 ${darkMode 
                          ? "bg-gray-800 border-gray-700 text-white focus:ring-teal-500" 
                          : "bg-white border border-gray-200 text-slate-800 focus:ring-green-400"} transition-colors`}
                        required
                        disabled={loadingClubs}
                      >
                        <option value="" disabled>
                          {loadingClubs ? 'Loading clubs...' : 'Select your tennis organization'}
                        </option>
                        {clubs.length > 0 ? (
                          clubs.map((club) => (
                            <option key={club.id} value={club.id}>
                              {club.name}
                            </option>
                          ))
                        ) : !loadingClubs ? (
                          <option value="" disabled>No clubs found</option>
                        ) : null}
                      </select>
                      <div className={`pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 ${darkMode 
                        ? "text-teal-400" 
                        : "text-amber-400"} transition-colors`}>
                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Register Club Form */}
                    <input 
                      type="text" 
                      placeholder="Club Name" 
                      value={clubName}
                      onChange={(e) => setClubName(e.target.value)}
                      className={`w-full rounded-lg px-4 py-3 placeholder-gray-500 focus:outline-none focus:ring-2 ${darkMode 
                        ? "bg-gray-800 border-gray-700 text-white focus:ring-teal-500" 
                        : "bg-white border border-gray-200 text-slate-800 focus:ring-green-400"} transition-colors`}
                      required
                    />
                    <input 
                      type="text" 
                      placeholder="Club Address" 
                      value={clubAddress}
                      onChange={(e) => setClubAddress(e.target.value)}
                      className={`w-full rounded-lg px-4 py-3 placeholder-gray-500 focus:outline-none focus:ring-2 ${darkMode 
                        ? "bg-gray-800 border-gray-700 text-white focus:ring-teal-500" 
                        : "bg-white border border-gray-200 text-slate-800 focus:ring-green-400"} transition-colors`}
                      required
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <input 
                        type="text" 
                        placeholder="City" 
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className={`w-full rounded-lg px-4 py-3 placeholder-gray-500 focus:outline-none focus:ring-2 ${darkMode 
                          ? "bg-gray-800 border-gray-700 text-white focus:ring-teal-500" 
                          : "bg-white border border-gray-200 text-slate-800 focus:ring-green-400"} transition-colors`}
                        required
                      />
                      <input 
                        type="text" 
                        placeholder="State/Province" 
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        className={`w-full rounded-lg px-4 py-3 placeholder-gray-500 focus:outline-none focus:ring-2 ${darkMode 
                          ? "bg-gray-800 border-gray-700 text-white focus:ring-teal-500" 
                          : "bg-white border border-gray-200 text-slate-800 focus:ring-green-400"} transition-colors`}
                        required
                      />
                    </div>
                  </>
                )}
                
                {/* Common fields for both options */}
                <input
                  type="text"
                  placeholder="Full Name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={`w-full rounded-lg px-4 py-3 placeholder-gray-500 focus:outline-none focus:ring-2 ${darkMode 
                    ? "bg-gray-800 border-gray-700 text-white focus:ring-teal-500" 
                    : "bg-white border border-gray-200 text-slate-800 focus:ring-green-400"} transition-colors`}
                  required
                />
                <input
                  type="email"
                  placeholder="Email Address" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full rounded-lg px-4 py-3 placeholder-gray-500 focus:outline-none focus:ring-2 ${darkMode 
                    ? "bg-gray-800 border-gray-700 text-white focus:ring-teal-500" 
                    : "bg-white border border-gray-200 text-slate-800 focus:ring-green-400"} transition-colors`}
                  required
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full rounded-lg px-4 py-3 placeholder-gray-500 focus:outline-none focus:ring-2 ${darkMode 
                    ? "bg-gray-800 border-gray-700 text-white focus:ring-teal-500" 
                    : "bg-white border border-gray-200 text-slate-800 focus:ring-green-400"} transition-colors`}
                  required
                  minLength={6}
                />
                <input 
                  type="password" 
                  placeholder="Confirm Password" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full rounded-lg px-4 py-3 placeholder-gray-500 focus:outline-none focus:ring-2 ${darkMode 
                    ? "bg-gray-800 border-gray-700 text-white focus:ring-teal-500" 
                    : "bg-white border border-gray-200 text-slate-800 focus:ring-green-400"} transition-colors`}
                  required
                />
              </div>
              
              {/* Sign Up button */}
              <button 
                type="submit"
                disabled={loading}
                className={`w-full font-medium py-3 px-4 rounded-lg transition-colors ${
                  loading ? "opacity-70 cursor-not-allowed" : ""
                } ${darkMode 
                  ? "bg-teal-600 text-white hover:bg-violet-600" 
                  : "bg-green-400 text-white hover:bg-amber-400"}`}
              >
                {loading 
                  ? "Creating Account..." 
                  : (selectedOption === 'connect' ? 'Create Account' : 'Register Club')
                }
              </button>
              
              {/* Back button */}
              <button
                type="button"
                onClick={() => setShowForm(false)}
                disabled={loading}
                className={`w-full font-medium py-3 px-4 rounded-lg transition-colors ${
                  loading ? "opacity-70 cursor-not-allowed" : ""
                } ${darkMode 
                  ? "bg-gray-800 text-white hover:bg-gray-700 border border-gray-700" 
                  : "bg-white text-slate-800 hover:bg-gray-50 border border-gray-200"}`}
              >
                Back to options
              </button>
            </form>
          </>
        )}
        
        {/* Terms */}
        <div className={`mt-12 text-xs text-center max-w-md ${darkMode 
          ? "text-gray-500" 
          : "text-gray-500"} transition-colors`}>
          By creating an account, you agree to our
          <Link href="#" className={`mx-1 ${darkMode 
            ? "text-teal-400 hover:text-violet-400" 
            : "text-amber-400 hover:text-green-400"} transition-colors`}>Terms of Service</Link>
          and our
          <Link href="#" className={`ml-1 ${darkMode 
            ? "text-teal-400 hover:text-violet-400" 
            : "text-amber-400 hover:text-green-400"} transition-colors`}>Privacy Policy</Link>.
        </div>
      </div>
    </div>
  );
}

// Main page component with Suspense
export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <SignUpContent />
    </Suspense>
  );
}