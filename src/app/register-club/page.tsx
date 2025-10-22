"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../../../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import Link from "next/link";
import PageTitle from "@/app/components/PageTitle";
import DarkModeToggle from "@/app/components/DarkModeToggle";

export default function ClubRequestPage() {
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    website: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    description: "",
    courts: "1",
    courtType: "hard",
  });
  
  const router = useRouter();
  
  // Check authentication - redirect to sign in if not logged in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        // User is not signed in, redirect to sign in page
        router.push('/signin');
      } else {
        // User is signed in, allow access
        setAuthChecking(false);
      }
    });
    
    return () => unsubscribe();
  }, [router]);
  
  // Initialize dark mode from localStorage
  useEffect(() => {
    const savedMode = localStorage.getItem("darkMode");
    if (savedMode === "true") {
      setDarkMode(true);
    }
  }, []);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!auth.currentUser) {
      setError('You must be signed in to submit a club request');
      return;
    }
    
    setLoading(true);
    
    try {
      // Validate required fields
      if (!formData.name || !formData.email || !formData.city || !formData.state) {
        throw new Error('Please fill in all required fields');
      }
      
      // Create club request document
      const clubData = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone || null,
        website: formData.website || null,
        address: formData.address || null,
        city: formData.city,
        state: formData.state,
        zip: formData.zip || null,
        description: formData.description || null,
        courts: parseInt(formData.courts) || 1,
        courtType: formData.courtType,
        status: "pending",
        submittedBy: auth.currentUser.uid,
        submitterEmail: auth.currentUser.email,
        submitterName: auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || "Unknown User",
        createdAt: serverTimestamp()
      };
      
      // Store in clubSubmissions collection
      const docRef = await addDoc(collection(db, "clubSubmissions"), clubData);
      console.log("Club submission created with ID:", docRef.id);
      
      // Show success
      setSuccess(true);
      
      // Clear form
      setFormData({
        name: '',
        email: '',
        phone: '',
        website: '',
        address: '',
        city: '',
        state: '',
        zip: '',
        description: '',
        courts: '1',
        courtType: 'hard',
      });
      
      // Redirect after 3 seconds
      setTimeout(() => {
        router.push('/dashboard');
      }, 3000);
      
    } catch (err: any) {
      console.error('Error submitting club request:', err);
      setError(err.message || 'Failed to submit club request. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Show loading state while checking authentication
  if (authChecking) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors duration-300 ${
        darkMode ? "bg-gray-900 text-white" : "bg-white text-gray-900"
      }`}>
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4">Checking authentication...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      darkMode ? "bg-[#0a0a0a] text-white" : "bg-white text-gray-900"
    }`}>
      <PageTitle title="Register Club - Courtly" />
      
      {/* Header */}
      <header className={`border-b transition-colors duration-300 ${
        darkMode ? 'border-[#1a1a1a]' : 'border-gray-100'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-lg font-light">Courtly</span>
          </Link>
          <div className="flex items-center space-x-4">
            <Link 
              href="/dashboard" 
              className={`text-sm font-light transition-colors duration-200 ${
                darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-black'
              }`}
            >
              Back to Dashboard
            </Link>
            <DarkModeToggle darkMode={darkMode} setDarkMode={setDarkMode} />
          </div>
        </div>
      </header>
      
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Success Message */}
        {success ? (
          <div className="text-center py-12">
            <div className={`w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center ${
              darkMode ? 'bg-green-950/20 border border-green-900/50' : 'bg-green-50 border border-green-200'
            }`}>
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-8 w-8 ${
                darkMode ? 'text-green-400' : 'text-green-600'
              }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-3xl font-light mb-4">Club Request Submitted</h2>
            <p className={`font-light ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Thank you for your submission. Our team will review your request shortly.
            </p>
            <p className={`mt-4 text-sm font-light ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
              Redirecting to dashboard...
            </p>
          </div>
        ) : (
          <>
            {/* Title */}
            <div className="mb-12">
              <h1 className="text-4xl sm:text-5xl font-light mb-4">Register Your Club</h1>
              <p className={`font-light ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Submit your club information to join the Courtly platform. Our team will review your request and get back to you shortly.
              </p>
            </div>
            
            {/* Error Message */}
            {error && (
              <div className={`mb-6 p-4 border font-light text-sm ${
                darkMode 
                  ? 'border-red-900/50 bg-red-950/20 text-red-400' 
                  : 'border-red-200 bg-red-50 text-red-600'
              }`}>
                {error}
              </div>
            )}
            
            {/* Club Request Form */}
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Club Information Section */}
              <div>
                <h2 className={`text-xs font-light uppercase tracking-wider mb-6 ${
                  darkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Club Information
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Club Name */}
                  <div>
                    <label 
                      htmlFor="name" 
                      className={`block text-xs font-light uppercase tracking-wider mb-2 ${
                        darkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}
                    >
                      Club Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      className={`w-full px-4 py-3 border font-light transition-colors duration-200 ${
                        darkMode 
                          ? 'bg-[#0a0a0a] border-[#1a1a1a] text-white placeholder-gray-600 focus:border-gray-600' 
                          : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-gray-400'
                      } focus:outline-none`}
                    />
                  </div>
                  
                  {/* Email */}
                  <div>
                    <label 
                      htmlFor="email" 
                      className={`block text-xs font-light uppercase tracking-wider mb-2 ${
                        darkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}
                    >
                      Club Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      className={`w-full px-4 py-3 border font-light transition-colors duration-200 ${
                        darkMode 
                          ? 'bg-[#0a0a0a] border-[#1a1a1a] text-white placeholder-gray-600 focus:border-gray-600' 
                          : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-gray-400'
                      } focus:outline-none`}
                    />
                  </div>
                  
                  {/* Phone */}
                  <div>
                    <label 
                      htmlFor="phone" 
                      className={`block text-xs font-light uppercase tracking-wider mb-2 ${
                        darkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}
                    >
                      Club Phone Number
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 border font-light transition-colors duration-200 ${
                        darkMode 
                          ? 'bg-[#0a0a0a] border-[#1a1a1a] text-white placeholder-gray-600 focus:border-gray-600' 
                          : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-gray-400'
                      } focus:outline-none`}
                    />
                  </div>
                  
                  {/* Website */}
                  <div>
                    <label 
                      htmlFor="website" 
                      className={`block text-xs font-light uppercase tracking-wider mb-2 ${
                        darkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}
                    >
                      Club Website
                    </label>
                    <input
                      type="url"
                      id="website"
                      name="website"
                      value={formData.website}
                      onChange={handleChange}
                      placeholder="https://"
                      className={`w-full px-4 py-3 border font-light transition-colors duration-200 ${
                        darkMode 
                          ? 'bg-[#0a0a0a] border-[#1a1a1a] text-white placeholder-gray-600 focus:border-gray-600' 
                          : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-gray-400'
                      } focus:outline-none`}
                    />
                  </div>
                </div>
              </div>
              
              {/* Location Section */}
              <div className={`pt-8 border-t ${darkMode ? 'border-[#1a1a1a]' : 'border-gray-100'}`}>
                <h2 className={`text-xs font-light uppercase tracking-wider mb-6 ${
                  darkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Location
                </h2>
                
                <div className="space-y-6">
                  {/* Address */}
                  <div>
                    <label 
                      htmlFor="address" 
                      className={`block text-xs font-light uppercase tracking-wider mb-2 ${
                        darkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}
                    >
                      Street Address
                    </label>
                    <input
                      type="text"
                      id="address"
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 border font-light transition-colors duration-200 ${
                        darkMode 
                          ? 'bg-[#0a0a0a] border-[#1a1a1a] text-white placeholder-gray-600 focus:border-gray-600' 
                          : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-gray-400'
                      } focus:outline-none`}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* City */}
                    <div>
                      <label 
                        htmlFor="city" 
                        className={`block text-xs font-light uppercase tracking-wider mb-2 ${
                          darkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}
                      >
                        City <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        id="city"
                        name="city"
                        value={formData.city}
                        onChange={handleChange}
                        required
                        className={`w-full px-4 py-3 border font-light transition-colors duration-200 ${
                          darkMode 
                            ? 'bg-[#0a0a0a] border-[#1a1a1a] text-white placeholder-gray-600 focus:border-gray-600' 
                            : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-gray-400'
                        } focus:outline-none`}
                      />
                    </div>
                    
                    {/* State */}
                    <div>
                      <label 
                        htmlFor="state" 
                        className={`block text-xs font-light uppercase tracking-wider mb-2 ${
                          darkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}
                      >
                        State <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        id="state"
                        name="state"
                        value={formData.state}
                        onChange={handleChange}
                        required
                        className={`w-full px-4 py-3 border font-light transition-colors duration-200 ${
                          darkMode 
                            ? 'bg-[#0a0a0a] border-[#1a1a1a] text-white placeholder-gray-600 focus:border-gray-600' 
                            : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-gray-400'
                        } focus:outline-none`}
                      />
                    </div>
                    
                    {/* ZIP */}
                    <div>
                      <label 
                        htmlFor="zip" 
                        className={`block text-xs font-light uppercase tracking-wider mb-2 ${
                          darkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}
                      >
                        ZIP Code
                      </label>
                      <input
                        type="text"
                        id="zip"
                        name="zip"
                        value={formData.zip}
                        onChange={handleChange}
                        className={`w-full px-4 py-3 border font-light transition-colors duration-200 ${
                          darkMode 
                            ? 'bg-[#0a0a0a] border-[#1a1a1a] text-white placeholder-gray-600 focus:border-gray-600' 
                            : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-gray-400'
                        } focus:outline-none`}
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Facility Information Section */}
              <div className={`pt-8 border-t ${darkMode ? 'border-[#1a1a1a]' : 'border-gray-100'}`}>
                <h2 className={`text-xs font-light uppercase tracking-wider mb-6 ${
                  darkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Facility Information
                </h2>
                
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Number of Courts */}
                    <div>
                      <label 
                        htmlFor="courts" 
                        className={`block text-xs font-light uppercase tracking-wider mb-2 ${
                          darkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}
                      >
                        Number of Courts
                      </label>
                      <input
                        type="number"
                        id="courts"
                        name="courts"
                        min="1"
                        value={formData.courts}
                        onChange={handleChange}
                        className={`w-full px-4 py-3 border font-light transition-colors duration-200 ${
                          darkMode 
                            ? 'bg-[#0a0a0a] border-[#1a1a1a] text-white placeholder-gray-600 focus:border-gray-600' 
                            : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-gray-400'
                        } focus:outline-none`}
                      />
                    </div>
                    
                    {/* Court Type */}
                    <div>
                      <label 
                        htmlFor="courtType" 
                        className={`block text-xs font-light uppercase tracking-wider mb-2 ${
                          darkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}
                      >
                        Court Type
                      </label>
                      <select
                        id="courtType"
                        name="courtType"
                        value={formData.courtType}
                        onChange={handleChange}
                        className={`w-full px-4 py-3 border font-light transition-colors duration-200 ${
                          darkMode 
                            ? 'bg-[#0a0a0a] border-[#1a1a1a] text-white focus:border-gray-600' 
                            : 'bg-white border-gray-200 text-gray-900 focus:border-gray-400'
                        } focus:outline-none`}
                      >
                        <option value="hard">Hard</option>
                        <option value="clay">Clay</option>
                        <option value="grass">Grass</option>
                        <option value="carpet">Carpet</option>
                        <option value="mixed">Mixed (Multiple Types)</option>
                      </select>
                    </div>
                  </div>
                  
                  {/* Description */}
                  <div>
                    <label 
                      htmlFor="description" 
                      className={`block text-xs font-light uppercase tracking-wider mb-2 ${
                        darkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}
                    >
                      Club Description
                    </label>
                    <textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      rows={4}
                      className={`w-full px-4 py-3 border font-light transition-colors duration-200 ${
                        darkMode 
                          ? 'bg-[#0a0a0a] border-[#1a1a1a] text-white placeholder-gray-600 focus:border-gray-600' 
                          : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-gray-400'
                      } focus:outline-none`}
                    ></textarea>
                  </div>
                </div>
              </div>
              
              {/* Submit Button */}
              <div className={`pt-8 border-t ${darkMode ? 'border-[#1a1a1a]' : 'border-gray-100'}`}>
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-3 px-6 font-light text-sm transition-colors duration-200 ${
                    darkMode
                      ? loading ? 'bg-gray-800 text-gray-500' : 'bg-white text-black hover:bg-gray-100'
                      : loading ? 'bg-gray-200 text-gray-400' : 'bg-black text-white hover:bg-gray-900'
                  }`}
                >
                  {loading ? "Submitting..." : "Submit Club Request"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
      
      {/* Footer */}
      <footer className={`border-t py-6 transition-colors duration-300 ${
        darkMode ? 'border-[#1a1a1a] text-gray-600' : 'border-gray-100 text-gray-400'
      }`}>
        <div className="text-center">
          <p className="text-xs font-light">
            © {new Date().getFullYear()} Courtly by JiaYou Tennis. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}