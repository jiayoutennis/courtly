"use client";

import { useEffect } from 'react';

interface PageTitleProps {
  title: string;
}

export default function PageTitle({ title }: PageTitleProps) {
  useEffect(() => {
    // Update the document title when the component mounts or title changes
    document.title = title;
    
    // Optional: Restore the original title when component unmounts
    return () => {
      document.title = "Courtly";
    };
  }, [title]);
  
  // This component doesn't render anything visible
  return null;
} 