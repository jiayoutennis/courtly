"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";

export default function Home() {
  const [darkMode, setDarkMode] = useState(false);
  const featureRefs = useRef<(HTMLDivElement | null)[]>([]);
  
  // Typewriter effect implementation
  const textToType = "The Ultimate Tennis Organization Platform.";
  const [typedText, setTypedText] = useState('');
  
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
    }, 75); // typing speed

    return () => clearInterval(typingInterval);
  }, []);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    localStorage.setItem("darkMode", !darkMode ? "true" : "false");
  };

  // Initialize dark mode from localStorage on component mount
  useEffect(() => {
    const savedMode = localStorage.getItem("darkMode");
    if (savedMode === "true") {
      setDarkMode(true);
    }
  }, []);

  // Setup Intersection Observer for fade-in animation
  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '0px',
      threshold: 0.1
    };

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry: IntersectionObserverEntry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-fadeIn');
          entry.target.classList.remove('opacity-0');
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);
    
    // Fix the exhaustive deps warning by copying the refs to a local variable
    const currentFeatureRefs = featureRefs.current;
    
    // Observe all feature items
    currentFeatureRefs.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => {
      // Use the local variable in the cleanup function
      currentFeatureRefs.forEach((ref) => {
        if (ref) observer.unobserve(ref);
      });
    };
  }, []);

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode 
      ? "bg-gray-900 text-white" 
      : "bg-white text-slate-800"}`}>
      
      {/* Navigation */}
      <header className={`flex flex-wrap justify-between items-center px-2 sm:px-6 md:px-12 py-3 sm:py-4 md:py-6 border-b ${darkMode 
        ? "border-gray-700" 
        : "border-gray-200"} transition-colors`}>
        <div className="flex items-center">
          <div className={`w-8 h-8 sm:w-10 sm:h-10 mr-2 ${darkMode 
            ? "bg-teal-600" 
            : "bg-green-400"} rounded-full flex items-center justify-center transition-colors`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
            </svg>
          </div>
          <div className="flex flex-col xs:flex-row sm:flex-row items-start xs:items-center sm:items-center">
            <span className={`text-sm sm:text-base md:text-lg font-bold leading-tight mr-1 ${darkMode 
              ? "text-white" 
              : "text-slate-800"} transition-colors`}>
              Courtly
            </span>
            <span className={`text-[10px] xs:text-xs sm:text-sm md:text-base ${darkMode 
              ? "text-gray-300" 
              : "text-gray-600"} transition-colors`}>
              by JiaYou Tennis
            </span>
          </div>
        </div>
        
        <nav className="hidden md:flex space-x-6">
          <a href="#" className={`${darkMode 
            ? "text-gray-400 hover:text-teal-400" 
            : "text-gray-600 hover:text-amber-400"} transition-colors`}>FEATURES</a>
          <a href="#" className={`${darkMode 
            ? "text-gray-400 hover:text-teal-400" 
            : "text-gray-600 hover:text-amber-400"} transition-colors`}>PRICING</a>
          <a href="#" className={`${darkMode 
            ? "text-gray-400 hover:text-teal-400" 
            : "text-gray-600 hover:text-amber-400"} transition-colors`}>ABOUT US</a>
          <a href="#" className={`${darkMode 
            ? "text-gray-400 hover:text-teal-400" 
            : "text-gray-600 hover:text-amber-400"} transition-colors`}>JIAYOU TENNIS</a>
        </nav>
        
        <div className="flex items-center space-x-1 sm:space-x-2 md:space-x-3">
          {/* Dark Mode Toggle Button */}
          <button 
            onClick={toggleDarkMode}
            className={`p-1.5 sm:p-2 rounded-full ${darkMode 
              ? "bg-gray-800 text-teal-400 hover:bg-gray-700" 
              : "bg-gray-100 text-amber-500 hover:bg-gray-200"} transition-colors`}
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
            )}
          </button>
          
          <Link href="/signup" className={`border rounded-lg px-1.5 sm:px-3 md:px-4 py-1 sm:py-1.5 md:py-2 text-[10px] sm:text-xs md:text-sm font-medium transition-all duration-300 flex-shrink-0 ${darkMode 
            ? "border-teal-600 text-white hover:bg-teal-600" 
            : "border-green-400 text-slate-800 hover:bg-green-400 hover:text-white"}`}>
            SIGN UP
          </Link>
          <Link href="/findyourorg" className={`text-white rounded-lg px-1.5 sm:px-3 md:px-4 py-1 sm:py-1.5 md:py-2 text-[9px] sm:text-xs md:text-sm font-medium transition-all duration-300 flex items-center flex-shrink-0 ${darkMode 
            ? "bg-teal-600 hover:bg-violet-600" 
            : "bg-green-400 hover:bg-amber-400"}`}>
            <span className="whitespace-nowrap">FIND YOUR ORG</span>
            <svg viewBox="0 0 24 24" width="8" height="8" className="ml-0.5 w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3" stroke="currentColor" fill="none">
              <path d="M15.3 13.71l-3 3a1 1 0 0 1-1.4 0l-3-3a1 1 0 0 1 1.4-1.42L11 14v-4a1 1 0 0 1 2 0v4l1.7-1.71a1 1 0 0 1 1.6 1.42z"></path>
            </svg>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className={`py-10 md:py-16 px-4 text-center transition-colors ${darkMode 
        ? "bg-gray-900" 
        : "bg-gradient-to-b from-white to-gray-50"}`}>
        <h1 className={`text-xl sm:text-2xl md:text-4xl lg:text-5xl font-bold mb-4 mt-6 ${darkMode 
          ? "text-white" 
          : "text-slate-800"} transition-colors px-0 mx-auto max-w-full`}>
          <span className="block text-left sm:text-center break-normal">
            {typedText}<span className="inline-block animate-pulse">|</span>
          </span>
        </h1>
        
        <p className={`text-base sm:text-lg md:text-xl mb-8 max-w-2xl mx-auto ${darkMode 
          ? "text-gray-400" 
          : "text-gray-600"} transition-colors`}>
          Built to help your club grow, Courtly is the easiest way to manage your tennis organization.
        </p>

        {/* Image Container */}
        <div className={`mt-12 max-w-3xl mx-auto rounded-lg overflow-hidden shadow-lg ${darkMode 
          ? "border border-gray-700 bg-gray-800" 
          : "border border-gray-200 bg-white"} transition-colors`}>
          <div className="relative">
            <Image
              src="/PreviewImage.png" 
              alt="Tennis Court Schedule" 
              width={1200}
              height={800}
              className="w-full h-auto max-h-[80vh] object-contain mx-auto"
              priority
            />
          </div>
        </div>
      </main>

      {/* Feature Analytics Section - With Fade-in Animation */}
      <section className={`py-16 px-4 transition-colors ${darkMode 
        ? "bg-[#121927]" 
        : "bg-gray-50"}`}>
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row gap-10 items-center">
            {/* Analytics Image */}
            <div className="md:w-1/2">
              <div className={`relative p-4 rounded-lg shadow-xl transition-colors ${darkMode 
                ? "bg-[#1a2235]" 
                : "bg-white"}`}>
                <Image
                  src="/analytics-dashboard.png"
                  alt="Tennis Analytics Dashboard"
                  width={800}
                  height={600}
                  className="w-full h-auto rounded-lg"
                />
                {/* Green Circle Backgrounds */}
                <div className="absolute -z-10 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] rounded-full bg-green-400 opacity-10"></div>
                <div className="absolute -z-10 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[105%] h-[105%] rounded-full border-4 border-green-400 border-opacity-20"></div>
              </div>
            </div>
            
            {/* Features List */}
            <div className="md:w-1/2 space-y-8">
              {/* Manage Members & Access */}
              <div 
                ref={(el: HTMLDivElement | null) => {
                  if (el) featureRefs.current[0] = el;
                }}
                className="space-y-2 opacity-0 transition-opacity duration-1000 ease-in-out"
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-full ${darkMode 
                    ? "bg-[#1a2235]" 
                    : "bg-gray-100"} transition-colors`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <h3 className={`text-xl md:text-2xl font-bold ${darkMode 
                    ? "text-white" 
                    : "text-gray-800"}`}>Manage Members & Access</h3>
                </div>
              </div>
              
              {/* Run Events & Programs */}
              <div 
                ref={(el: HTMLDivElement | null) => {
                  if (el) featureRefs.current[1] = el;
                }}
                className="space-y-2 opacity-0 transition-opacity duration-1000 ease-in-out"
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-full ${darkMode 
                    ? "bg-[#1a2235]" 
                    : "bg-gray-100"} transition-colors`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className={`text-xl md:text-2xl font-bold ${darkMode 
                    ? "text-white" 
                    : "text-gray-800"}`}>Run Events & Programs</h3>
                </div>
              </div>
              
              {/* Book Courts & Lessons */}
              <div 
                ref={(el: HTMLDivElement | null) => {
                  if (el) featureRefs.current[2] = el;
                }}
                className="space-y-2 opacity-0 transition-opacity duration-1000 ease-in-out"
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-full ${darkMode 
                    ? "bg-[#1a2235]" 
                    : "bg-gray-100"} transition-colors`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <h3 className={`text-xl md:text-2xl font-bold ${darkMode 
                    ? "text-white" 
                    : "text-gray-800"}`}>Book Courts & Lessons</h3>
                </div>
              </div>
              
              {/* Engage with Email & Alerts */}
              <div 
                ref={(el: HTMLDivElement | null) => {
                  if (el) featureRefs.current[3] = el;
                }}
                className="space-y-2 opacity-0 transition-opacity duration-1000 ease-in-out"
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-full ${darkMode 
                    ? "bg-[#1a2235]" 
                    : "bg-gray-100"} transition-colors`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </div>
                  <h3 className={`text-xl md:text-2xl font-bold ${darkMode 
                    ? "text-white" 
                    : "text-gray-800"}`}>Engage with Email & Alerts</h3>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Get Started Section */}
      <section className={`py-16 px-4 relative overflow-hidden transition-colors ${darkMode 
        ? "bg-gradient-to-r from-teal-600 to-violet-700" 
        : "bg-gradient-to-r from-green-400 to-green-300"}`}>
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="md:w-1/2 space-y-6 flex flex-col items-center md:items-start">
              <h2 className="text-3xl md:text-5xl font-bold text-white text-center md:text-left">Get started with Courtly</h2>
              <p className="text-white text-lg md:text-xl text-center md:text-left">
                Modernize your tennis organization with the ultimate
                club management platform.
              </p>
              <div className="flex flex-wrap justify-center md:justify-start gap-4 w-full">
                <a href="#" className={`bg-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-lg font-medium flex items-center transition-colors ${darkMode 
                  ? "text-gray-800 hover:text-violet-700" 
                  : "text-slate-800 hover:text-amber-500"}`}>
                  Pricing
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 sm:h-5 w-4 sm:w-5 ml-2 ${darkMode 
                    ? "text-teal-600" 
                    : "text-amber-400"} transition-colors`} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </a>
                <a href="#" className={`bg-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-lg font-medium flex items-center transition-colors ${darkMode 
                  ? "text-gray-800 hover:text-violet-700" 
                  : "text-slate-800 hover:text-amber-500"}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 sm:h-5 w-4 sm:w-5 mr-2 ${darkMode 
                    ? "text-teal-600" 
                    : "text-amber-400"} transition-colors`} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                  Sign Up 
                </a>
              </div>
            </div>
            <div className="md:w-1/2 relative">
              <Image
                src="/tennis-player-phone.png" 
                alt="Tennis player using mobile app" 
                width={600}
                height={800}
                className={`rounded-lg w-full h-auto object-cover shadow-xl ${darkMode 
                  ? "border border-gray-700" 
                  : "border border-white border-opacity-30"} transition-colors`}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
