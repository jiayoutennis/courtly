// src/app/findyourorg/page.tsx

"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import DarkModeToggle from "@/app/components/DarkModeToggle";
import BackButton from "@/app/components/BackButton";
import PageTitle from "@/app/components/PageTitle";

export default function FindYourOrgPage() {
  const [selectedOrg, setSelectedOrg] = useState("");
  const [darkMode, setDarkMode] = useState(false);

  const handleOrgChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedOrg(e.target.value);
  };

  // Initialize dark mode from localStorage on component mount
  useEffect(() => {
    const savedMode = localStorage.getItem("darkMode");
    if (savedMode === "true") {
      setDarkMode(true);
    }
  }, []);

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode 
      ? "bg-gray-900 text-gray-50" 
      : "bg-white text-slate-800"}`}>
      
      <PageTitle title="Find Your Organization - Courtly" />
      
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

        {/* Welcome text */}
        <h1 className={`text-3xl md:text-4xl font-bold mb-2 text-center ${darkMode 
          ? "text-white" 
          : "text-slate-800"} transition-colors`}>Yooo, welcome back!</h1>
        <p className={`${darkMode 
          ? "text-gray-400" 
          : "text-gray-600"} mb-8 text-center transition-colors`}>
          Get ready to play some tennis!
        </p>
        
        {/* Login form */}
        <div className="w-full max-w-md space-y-4">
          <div className="space-y-4">
            {/* Tennis Organization Dropdown */}
            <div className="relative">
              <select 
                className={`w-full appearance-none rounded-lg px-4 py-3 focus:outline-none focus:ring-2 ${darkMode 
                  ? "bg-gray-800 border-gray-700 text-white focus:ring-teal-500" 
                  : "bg-white border border-gray-200 text-slate-800 focus:ring-green-400"} transition-colors`}
                defaultValue=""
                onChange={handleOrgChange}
              >
                <option value="" disabled>Select your tennis organization</option>
                <option value="jiayou">JiaYou Tennis</option>
                <option value="nyc">NYC Tennis Club</option>
                <option value="bay">Bay Area Tennis</option>
                <option value="la">LA Tennis Academy</option>
                <option value="other">Other</option>
              </select>
              <div className={`pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 ${darkMode 
                ? "text-teal-400" 
                : "text-amber-400"} transition-colors`}>
                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            
            {/* Conditional rendering based on selection */}
            {selectedOrg && (
              <>
                <input 
                  type="email" 
                  placeholder="Your email" 
                  className={`w-full rounded-lg px-4 py-3 placeholder-gray-500 focus:outline-none focus:ring-2 ${darkMode 
                    ? "bg-gray-800 border-gray-700 text-white focus:ring-teal-500" 
                    : "bg-white border border-gray-200 text-slate-800 focus:ring-green-400"} transition-colors`}
                />
                <input 
                  type="password" 
                  placeholder="Password" 
                  className={`w-full rounded-lg px-4 py-3 placeholder-gray-500 focus:outline-none focus:ring-2 ${darkMode 
                    ? "bg-gray-800 border-gray-700 text-white focus:ring-teal-500" 
                    : "bg-white border border-gray-200 text-slate-800 focus:ring-green-400"} transition-colors`}
                />
              </>
            )}
          </div>
          
          {/* Show Sign In button only if org is selected */}
          {selectedOrg && (
            <button className={`w-full font-medium py-3 px-4 rounded-lg transition-colors ${darkMode 
              ? "bg-teal-600 text-white hover:bg-violet-600" 
              : "bg-green-400 text-white hover:bg-amber-400"}`}>
              Sign in
            </button>
          )}
          
          <div className="flex items-center justify-center">
            <div className={`h-px w-full ${darkMode 
              ? "bg-gray-700" 
              : "bg-gray-200"} transition-colors`}></div>
            <span className={`px-4 text-sm ${darkMode 
              ? "text-gray-500" 
              : "text-gray-500"} transition-colors`}>or</span>
            <div className={`h-px w-full ${darkMode 
              ? "bg-gray-700" 
              : "bg-gray-200"} transition-colors`}></div>
          </div>
          
          {/* Club connection options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Link 
              href="/signup?option=connect"
              className={`font-medium py-3 px-4 rounded-lg flex items-center justify-center transition-colors ${darkMode 
                ? "bg-gray-800 text-white border border-gray-700 hover:bg-teal-600" 
                : "bg-green-400 text-white hover:bg-amber-400"}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-white" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
              Connect to your club
            </Link>
            <Link 
              href="/signup?option=register"
              className={`font-medium py-3 px-4 rounded-lg flex items-center justify-center transition-colors ${darkMode 
                ? "bg-gray-800 text-white border border-gray-700 hover:bg-teal-600" 
                : "bg-green-400 text-white hover:bg-amber-400"}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-white" viewBox="0 0 20 20" fill="currentColor">
                <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z" />
              </svg>
              Register your club
            </Link>
          </div>
        </div>
        
        {/* Terms */}
        <div className={`mt-12 text-xs text-center max-w-md ${darkMode 
          ? "text-gray-500" 
          : "text-gray-500"} transition-colors`}>
          You acknowledge that you read, and agree, to our 
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
  
  