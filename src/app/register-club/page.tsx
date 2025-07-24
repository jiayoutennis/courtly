"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../../../firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import Link from "next/link";
import PageTitle from "@/app/components/PageTitle";
import DarkModeToggle from "@/app/components/DarkModeToggle";

export default function ClubRequestPage() {
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(false);
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
  
  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      darkMode ? "bg-gray-900 text-gray-50" : "bg-gray-50 text-gray-900"
    }`}>
      <PageTitle title="Submit Club Request - Courtly" />
      
      {/* Dark Mode Toggle */}
      <div className="absolute top-8 right-8">
        <DarkModeToggle darkMode={darkMode} setDarkMode={setDarkMode} />
      </div>
      
      {/* Top Navigation */}
      <nav className={`py-4 px-6 flex items-center justify-between shadow-md ${
        darkMode ? "bg-gray-800" : "bg-white"
      }`}>
        <div className="flex items-center space-x-4">
          <Link href="/dashboard" className="flex items-center">
            <div className={`p-2 rounded-full ${darkMode ? "bg-teal-600" : "bg-green-400"}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
              </svg>
            </div>
            <h1 className="text-xl font-bold ml-2">Courtly</h1>
          </Link>
        </div>
        
        <div>
          <Link href="/dashboard" className={`px-4 py-2 rounded ${
            darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"
          }`}>
            Back to Dashboard
          </Link>
        </div>
      </nav>
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          {/* Success Message */}
          {success ? (
            <div className={`p-8 rounded-lg shadow-md text-center ${
              darkMode ? "bg-gray-800" : "bg-white"
            }`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="text-2xl font-bold mt-4">Club Request Submitted!</h2>
              <p className={`mt-2 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                Thank you for your submission. The Courtly team will review your request soon.
              </p>
              <p className="mt-4">Redirecting to dashboard...</p>
            </div>
          ) : (
            <>
              <h1 className="text-3xl font-bold mb-6">Submit a Club Request</h1>
              <p className={`mb-6 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                Fill out this form to request your club to be added to the Courtly platform. 
                Our team will review your submission and get back to you shortly.
              </p>
              
              {/* Error Message */}
              {error && (
                <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg">
                  {error}
                </div>
              )}
              
              {/* Club Request Form */}
              <form onSubmit={handleSubmit} className={`p-6 rounded-lg shadow-md ${
                darkMode ? "bg-gray-800" : "bg-white"
              }`}>
                <h2 className="text-xl font-semibold mb-4">Club Information</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {/* Club Name */}
                  <div>
                    <label htmlFor="name" className="block mb-1 font-medium">
                      Club Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      className={`w-full px-4 py-2 rounded border ${
                        darkMode 
                          ? "bg-gray-700 border-gray-600 text-white" 
                          : "bg-white border-gray-300"
                      }`}
                    />
                  </div>
                  
                  {/* Email */}
                  <div>
                    <label htmlFor="email" className="block mb-1 font-medium">
                      Club Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      className={`w-full px-4 py-2 rounded border ${
                        darkMode 
                          ? "bg-gray-700 border-gray-600 text-white" 
                          : "bg-white border-gray-300"
                      }`}
                    />
                  </div>
                  
                  {/* Phone */}
                  <div>
                    <label htmlFor="phone" className="block mb-1 font-medium">
                      Club Phone Number
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className={`w-full px-4 py-2 rounded border ${
                        darkMode 
                          ? "bg-gray-700 border-gray-600 text-white" 
                          : "bg-white border-gray-300"
                      }`}
                    />
                  </div>
                  
                  {/* Website */}
                  <div>
                    <label htmlFor="website" className="block mb-1 font-medium">
                      Club Website
                    </label>
                    <input
                      type="url"
                      id="website"
                      name="website"
                      value={formData.website}
                      onChange={handleChange}
                      placeholder="https://"
                      className={`w-full px-4 py-2 rounded border ${
                        darkMode 
                          ? "bg-gray-700 border-gray-600 text-white" 
                          : "bg-white border-gray-300"
                      }`}
                    />
                  </div>
                </div>
                
                <h2 className="text-xl font-semibold mb-4">Location</h2>
                
                <div className="grid grid-cols-1 gap-4 mb-6">
                  {/* Address */}
                  <div>
                    <label htmlFor="address" className="block mb-1 font-medium">
                      Street Address
                    </label>
                    <input
                      type="text"
                      id="address"
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      className={`w-full px-4 py-2 rounded border ${
                        darkMode 
                          ? "bg-gray-700 border-gray-600 text-white" 
                          : "bg-white border-gray-300"
                      }`}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {/* City */}
                  <div>
                    <label htmlFor="city" className="block mb-1 font-medium">
                      City <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="city"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      required
                      className={`w-full px-4 py-2 rounded border ${
                        darkMode 
                          ? "bg-gray-700 border-gray-600 text-white" 
                          : "bg-white border-gray-300"
                      }`}
                    />
                  </div>
                  
                  {/* State */}
                  <div>
                    <label htmlFor="state" className="block mb-1 font-medium">
                      State <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="state"
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      required
                      className={`w-full px-4 py-2 rounded border ${
                        darkMode 
                          ? "bg-gray-700 border-gray-600 text-white" 
                          : "bg-white border-gray-300"
                      }`}
                    />
                  </div>
                  
                  {/* ZIP */}
                  <div>
                    <label htmlFor="zip" className="block mb-1 font-medium">
                      ZIP Code
                    </label>
                    <input
                      type="text"
                      id="zip"
                      name="zip"
                      value={formData.zip}
                      onChange={handleChange}
                      className={`w-full px-4 py-2 rounded border ${
                        darkMode 
                          ? "bg-gray-700 border-gray-600 text-white" 
                          : "bg-white border-gray-300"
                      }`}
                    />
                  </div>
                </div>
                
                <h2 className="text-xl font-semibold mb-4">Facility Information</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {/* Number of Courts */}
                  <div>
                    <label htmlFor="courts" className="block mb-1 font-medium">
                      Number of Courts
                    </label>
                    <input
                      type="number"
                      id="courts"
                      name="courts"
                      min="1"
                      value={formData.courts}
                      onChange={handleChange}
                      className={`w-full px-4 py-2 rounded border ${
                        darkMode 
                          ? "bg-gray-700 border-gray-600 text-white" 
                          : "bg-white border-gray-300"
                      }`}
                    />
                  </div>
                  
                  {/* Court Type */}
                  <div>
                    <label htmlFor="courtType" className="block mb-1 font-medium">
                      Court Type
                    </label>
                    <select
                      id="courtType"
                      name="courtType"
                      value={formData.courtType}
                      onChange={handleChange}
                      className={`w-full px-4 py-2 rounded border ${
                        darkMode 
                          ? "bg-gray-700 border-gray-600 text-white" 
                          : "bg-white border-gray-300"
                      }`}
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
                <div className="mb-6">
                  <label htmlFor="description" className="block mb-1 font-medium">
                    Club Description
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={4}
                    className={`w-full px-4 py-2 rounded border ${
                      darkMode 
                        ? "bg-gray-700 border-gray-600 text-white" 
                        : "bg-white border-gray-300"
                    }`}
                  ></textarea>
                </div>
                
                {/* Submit Button */}
                <div className="text-center">
                  <button
                    type="submit"
                    disabled={loading}
                    className={`px-6 py-3 rounded-lg font-medium ${
                      darkMode
                        ? "bg-teal-600 hover:bg-teal-700 text-white"
                        : "bg-green-500 hover:bg-green-600 text-white"
                    } ${loading ? "opacity-70 cursor-not-allowed" : ""}`}
                  >
                    {loading ? "Submitting..." : "Submit Club Request"}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}