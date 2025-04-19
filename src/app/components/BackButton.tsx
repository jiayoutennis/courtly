"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface BackButtonProps {
  fallbackPath?: string;
  darkMode: boolean;
}

export default function BackButton({ fallbackPath = "/", darkMode }: BackButtonProps) {
  const router = useRouter();
  const [hasHistory, setHasHistory] = useState(false);
  
  // Check if there's history to go back to
  useEffect(() => {
    setHasHistory(window.history.length > 1);
  }, []);
  
  const handleBack = () => {
    if (hasHistory) {
      router.back();
    } else {
      router.push(fallbackPath);
    }
  };
  
  return (
    <button 
      onClick={handleBack}
      className={`flex items-center ${darkMode 
        ? "text-gray-400 hover:text-teal-400" 
        : "text-gray-600 hover:text-amber-400"} transition-colors`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
      </svg>
      Back
    </button>
  );
} 