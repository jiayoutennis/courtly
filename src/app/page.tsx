"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { auth } from '../../firebase';
import { onAuthStateChanged } from 'firebase/auth';

export default function Home() {
  const [darkMode, setDarkMode] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Typewriter effect
  const textToType = "Modern Tennis Club Management";
  const [typedText, setTypedText] = useState('');
  
  // Check authentication
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsLoggedIn(!!user);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setTypedText('');
    
    let i = 0;
    const typingInterval = setInterval(() => {
      if (i < textToType.length) {
        setTypedText(textToType.substring(0, i + 1));
        i++;
      } else {
        clearInterval(typingInterval);
      }
    }, 50);

    return () => clearInterval(typingInterval);
  }, []);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    localStorage.setItem("darkMode", !darkMode ? "true" : "false");
  };

  // Initialize dark mode
  useEffect(() => {
    const savedMode = localStorage.getItem("darkMode");
    if (savedMode === "true") {
      setDarkMode(true);
    }
  }, []);

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode 
      ? "bg-[#0a0a0a] text-white" 
      : "bg-white text-gray-900"}`}>
      
      {/* Minimalist Navigation */}
      <header className={`flex justify-between items-center px-6 md:px-12 py-6 ${darkMode 
        ? "" 
        : ""}`}>
        <Link href="/" className="flex items-center gap-3">
          <div className={`text-2xl font-light tracking-tight ${
            darkMode ? "text-white" : "text-black"
          }`}>
            Courtly
          </div>
        </Link>
        
        <div className="flex items-center gap-4">
          {/* Dark Mode Toggle */}
          <button 
            onClick={toggleDarkMode}
            className={`p-2 rounded-full transition-colors ${
              darkMode 
                ? "hover:bg-[#1a1a1a]" 
                : "hover:bg-gray-100"
            }`}
            aria-label="Toggle dark mode"
          >
            {darkMode ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
          
          {!loading && (
            isLoggedIn ? (
              <Link href="/dashboard" className={`px-6 py-2 text-sm font-light rounded transition-colors ${
                darkMode
                  ? "bg-white text-black hover:bg-gray-100"
                  : "bg-black text-white hover:bg-gray-800"
              }`}>
                Dashboard
              </Link>
            ) : (
              <Link href="/signin" className={`px-6 py-2 text-sm font-light rounded transition-colors ${
                darkMode
                  ? "bg-white text-black hover:bg-gray-100"
                  : "bg-black text-white hover:bg-gray-800"
              }`}>
                Sign In
              </Link>
            )
          )}
        </div>
      </header>

      {/* Hero Section */}
      <main className="px-6 md:px-12">
        {/* Main Heading */}
        <div className="max-w-4xl mx-auto pt-20 md:pt-32 pb-12">
          <h1 className={`text-5xl md:text-7xl font-light mb-6 ${
            darkMode ? "text-white" : "text-black"
          }`}>
            {typedText}<span className="animate-pulse">|</span>
          </h1>
          
          <p className={`text-lg md:text-xl font-light max-w-2xl ${
            darkMode ? "text-gray-400" : "text-gray-600"
          }`}>
            Streamline court bookings, manage members, and grow your tennis organization with ease.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="max-w-4xl mx-auto flex flex-wrap gap-4 mb-20">
          <Link href="/browse-clubs" className={`px-8 py-3 text-sm font-light rounded transition-colors ${
            darkMode
              ? "bg-white text-black hover:bg-gray-100"
              : "bg-black text-white hover:bg-gray-800"
          }`}>
            Browse Clubs
          </Link>
          
          <Link href="/register-club" className={`px-8 py-3 text-sm font-light rounded transition-colors ${
            darkMode
              ? "bg-[#1a1a1a] text-white hover:bg-[#2a2a2a]"
              : "bg-gray-100 text-black hover:bg-gray-200"
          }`}>
            Register Club
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="max-w-6xl mx-auto py-20 grid grid-cols-1 md:grid-cols-3 gap-12">
          {/* Feature 1 */}
          <div className="space-y-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              darkMode ? "bg-[#1a1a1a]" : "bg-gray-100"
            }`}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className={`text-xl font-light ${
              darkMode ? "text-white" : "text-black"
            }`}>
              Court Scheduling
            </h3>
            <p className={`text-sm font-light ${
              darkMode ? "text-gray-500" : "text-gray-600"
            }`}>
              Real-time court availability, multi-hour bookings, and seamless reservation management.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="space-y-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              darkMode ? "bg-[#1a1a1a]" : "bg-gray-100"
            }`}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h3 className={`text-xl font-light ${
              darkMode ? "text-white" : "text-black"
            }`}>
              Member Management
            </h3>
            <p className={`text-sm font-light ${
              darkMode ? "text-gray-500" : "text-gray-600"
            }`}>
              Organize members, track activity, and control access to your club facilities.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="space-y-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              darkMode ? "bg-[#1a1a1a]" : "bg-gray-100"
            }`}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className={`text-xl font-light ${
              darkMode ? "text-white" : "text-black"
            }`}>
              Analytics
            </h3>
            <p className={`text-sm font-light ${
              darkMode ? "text-gray-500" : "text-gray-600"
            }`}>
              Gain insights into usage patterns, peak hours, and member engagement.
            </p>
          </div>
        </div>

        {/* Footer Section */}
        <div className={`max-w-6xl mx-auto py-12 mt-20 border-t ${
          darkMode ? "border-[#1a1a1a]" : "border-gray-100"
        }`}>
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className={`text-sm font-light ${
              darkMode ? "text-gray-600" : "text-gray-400"
            }`}>
              © 2025 Courtly by JiaYou Tennis
            </div>
            
            <div className="flex gap-8">
              <a href="#" className={`text-sm font-light transition-colors ${
                darkMode 
                  ? "text-gray-600 hover:text-white" 
                  : "text-gray-400 hover:text-black"
              }`}>
                About
              </a>
              <a href="#" className={`text-sm font-light transition-colors ${
                darkMode 
                  ? "text-gray-600 hover:text-white" 
                  : "text-gray-400 hover:text-black"
              }`}>
                Contact
              </a>
              <a href="#" className={`text-sm font-light transition-colors ${
                darkMode 
                  ? "text-gray-600 hover:text-white" 
                  : "text-gray-400 hover:text-black"
              }`}>
                Privacy
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
