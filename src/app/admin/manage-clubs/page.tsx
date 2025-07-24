"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { auth, db } from '../../../../firebase';
import { 
  collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp 
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { states } from '@/app/utils/states';
import PageTitle from '@/app/components/PageTitle';

// Club type definition
interface Club {
  id?: string;
  name: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  description: string;
  courts: number;
  courtType: string;
  approved: boolean;
  createdAt?: any;
  createdBy?: string;
}

export default function ManageClubsPage() {
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [clubs, setClubs] = useState<Club[]>([]);
  const [selectedClub, setSelectedClub] = useState<Club | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  // Form data for new club
  const [formData, setFormData] = useState<Club>({
    name: '',
    email: '',
    phone: '',
    website: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    description: '',
    courts: 1,
    courtType: 'hard',
    approved: false
  });

  // Initialize dark mode from localStorage
  useEffect(() => {
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode === 'true') {
      setDarkMode(true);
    }
  }, []);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('darkMode', newMode ? 'true' : 'false');
  };

  // Check if user is authorized
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      
      if (!currentUser) {
        // No user is signed in
        setIsAuthorized(false);
        setUser(null);
        router.push('/signin');
        return;
      }
      
      try {
        // Check if user has courtly role
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          if (userData.userType === 'courtly') {
            // User is authorized
            setIsAuthorized(true);
            setUser({
              ...currentUser,
              ...userData
            });
            
            // Fetch clubs
            fetchClubs();
          } else {
            // User is not authorized
            setIsAuthorized(false);
            setUser(null);
            setError("You don't have permission to access this page");
            router.push('/dashboard');
          }
        } else {
          // User document doesn't exist
          setIsAuthorized(false);
          setUser(null);
          setError("User profile not found");
          router.push('/signin');
        }
      } catch (err) {
        console.error("Error checking authorization:", err);
        setError("Failed to verify permissions. Please try again.");
        setIsAuthorized(false);
      } finally {
        setLoading(false);
      }
    });
    
    return () => unsubscribe();
  }, [router]);

  // Fetch clubs from Firestore
  const fetchClubs = async () => {
    try {
      const clubsQuery = query(
        collection(db, "publicClubs"),
        orderBy("name")
      );
      
      const querySnapshot = await getDocs(clubsQuery);
      const clubsList: Club[] = [];
      
      querySnapshot.forEach((doc) => {
        clubsList.push({
          id: doc.id,
          ...doc.data()
        } as Club);
      });
      
      setClubs(clubsList);
    } catch (error) {
      console.error("Error fetching clubs:", error);
      setError("Failed to load clubs. Please try again later.");
    }
  };

  // Handle form input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    // Handle number inputs
    if (type === 'number') {
      setFormData({
        ...formData,
        [name]: parseInt(value) || 0
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  // Handle checkbox changes
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData({
      ...formData,
      [name]: checked
    });
  };

  // Handle form submission for new club
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);
    
    try {
      // Basic validation
      if (!formData.name || !formData.email || !formData.city || !formData.state) {
        throw new Error("Please fill in all required fields");
      }
      
      // Add timestamp and user info
      const clubData = {
        ...formData,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser?.uid
      };
      
      // Check if we're editing or creating
      if (isEditing && selectedClub?.id) {
        // Update existing club
        const { id, ...dataToUpdate } = clubData;
        await updateDoc(doc(db, "publicClubs", selectedClub.id), dataToUpdate);
        setSuccess(`Club "${formData.name}" updated successfully!`);
      } else {
        // Create new club
        await addDoc(collection(db, "publicClubs"), clubData);
        setSuccess(`Club "${formData.name}" added successfully!`);
      }
      
      // Reset form and refresh clubs list
      resetForm();
      fetchClubs();
    } catch (error: any) {
      console.error("Error saving club:", error);
      setError(error.message || "Failed to save club. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Edit club
  const editClub = (club: Club) => {
    setSelectedClub(club);
    setFormData(club);
    setIsEditing(true);
    
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Delete club
  const deleteClub = async (clubId: string) => {
    if (!clubId) return;
    
    if (!window.confirm("Are you sure you want to delete this club? This action cannot be undone.")) {
      return;
    }
    
    setLoading(true);
    
    try {
      await deleteDoc(doc(db, "publicClubs", clubId));
      setSuccess("Club deleted successfully");
      fetchClubs();
    } catch (error) {
      console.error("Error deleting club:", error);
      setError("Failed to delete club. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Reset form
  const resetForm = () => {
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
      courts: 1,
      courtType: 'hard',
      approved: false
    });
    setSelectedClub(null);
    setIsEditing(false);
  };

  // Showing loading screen
  if (loading && !isAuthorized) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        darkMode ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"
      }`}>
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-t-transparent border-teal-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg">Verifying your access...</p>
        </div>
      </div>
    );
  }

  // Showing access denied
  if (!isAuthorized && !loading) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-4 ${
        darkMode ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"
      }`}>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-red-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
        <p className="mb-6 text-center">You don't have permission to access the club management panel.</p>
        <Link href="/dashboard" className={`py-2 px-4 rounded ${
          darkMode ? "bg-teal-600 text-white hover:bg-teal-700" : "bg-green-500 text-white hover:bg-green-600"
        } transition-colors`}>
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      darkMode ? "bg-gray-900 text-gray-50" : "bg-gray-50 text-gray-900"
    }`}>
      <PageTitle title="Manage Clubs - Courtly Admin" />
      
      {/* Header */}
      <header className={`py-4 px-6 shadow-md flex items-center justify-between ${
        darkMode ? "bg-gray-800" : "bg-white"
      }`}>
        <div className="flex items-center space-x-4">
          <Link href="/dashboard" className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </Link>
          <h1 className="text-xl font-bold">Club Management</h1>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={toggleDarkMode}
            className={`p-2 rounded-full ${darkMode 
              ? "bg-gray-700 text-teal-400 hover:bg-gray-600" 
              : "bg-gray-200 text-amber-500 hover:bg-gray-300"
            }`}
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
            )}
          </button>
          <div className={`px-3 py-1 rounded-full text-sm ${
            darkMode ? "bg-violet-900 text-violet-200" : "bg-violet-100 text-violet-800"
          }`}>
            Courtly Staff
          </div>
        </div>
      </header>
      
      <div className="container mx-auto px-4 py-8">
        {/* Alert messages */}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-100 text-red-700 border border-red-200">
            <div className="flex">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          </div>
        )}
        
        {success && (
          <div className="mb-6 p-4 rounded-lg bg-green-100 text-green-700 border border-green-200">
            <div className="flex">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>{success}</span>
            </div>
          </div>
        )}
        
        {/* Add/Edit Club Form */}
        <div className={`mb-10 p-6 rounded-lg shadow-md ${
          darkMode ? "bg-gray-800" : "bg-white"
        }`}>
          <h2 className="text-xl font-semibold mb-6">
            {isEditing ? `Edit Club: ${selectedClub?.name}` : "Add New Club"}
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Club Name */}
              <div>
                <label htmlFor="name" className="block mb-2 text-sm font-medium">
                  Club Name*
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className={`w-full px-4 py-2 rounded-lg ${
                    darkMode 
                      ? "bg-gray-700 border-gray-600 text-white" 
                      : "bg-white border-gray-300 text-gray-900"
                  } border focus:outline-none focus:ring-2 ${
                    darkMode ? "focus:ring-teal-500" : "focus:ring-green-500"
                  }`}
                />
              </div>
              
              {/* Email */}
              <div>
                <label htmlFor="email" className="block mb-2 text-sm font-medium">
                  Email*
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className={`w-full px-4 py-2 rounded-lg ${
                    darkMode 
                      ? "bg-gray-700 border-gray-600 text-white" 
                      : "bg-white border-gray-300 text-gray-900"
                  } border focus:outline-none focus:ring-2 ${
                    darkMode ? "focus:ring-teal-500" : "focus:ring-green-500"
                  }`}
                />
              </div>
              
              {/* Phone */}
              <div>
                <label htmlFor="phone" className="block mb-2 text-sm font-medium">
                  Phone
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 rounded-lg ${
                    darkMode 
                      ? "bg-gray-700 border-gray-600 text-white" 
                      : "bg-white border-gray-300 text-gray-900"
                  } border focus:outline-none focus:ring-2 ${
                    darkMode ? "focus:ring-teal-500" : "focus:ring-green-500"
                  }`}
                />
              </div>
              
              {/* Website */}
              <div>
                <label htmlFor="website" className="block mb-2 text-sm font-medium">
                  Website
                </label>
                <input
                  type="url"
                  id="website"
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  placeholder="https://example.com"
                  className={`w-full px-4 py-2 rounded-lg ${
                    darkMode 
                      ? "bg-gray-700 border-gray-600 text-white" 
                      : "bg-white border-gray-300 text-gray-900"
                  } border focus:outline-none focus:ring-2 ${
                    darkMode ? "focus:ring-teal-500" : "focus:ring-green-500"
                  }`}
                />
              </div>
              
              {/* Address */}
              <div>
                <label htmlFor="address" className="block mb-2 text-sm font-medium">
                  Address
                </label>
                <input
                  type="text"
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 rounded-lg ${
                    darkMode 
                      ? "bg-gray-700 border-gray-600 text-white" 
                      : "bg-white border-gray-300 text-gray-900"
                  } border focus:outline-none focus:ring-2 ${
                    darkMode ? "focus:ring-teal-500" : "focus:ring-green-500"
                  }`}
                />
              </div>
              
              {/* City */}
              <div>
                <label htmlFor="city" className="block mb-2 text-sm font-medium">
                  City*
                </label>
                <input
                  type="text"
                  id="city"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  required
                  className={`w-full px-4 py-2 rounded-lg ${
                    darkMode 
                      ? "bg-gray-700 border-gray-600 text-white" 
                      : "bg-white border-gray-300 text-gray-900"
                  } border focus:outline-none focus:ring-2 ${
                    darkMode ? "focus:ring-teal-500" : "focus:ring-green-500"
                  }`}
                />
              </div>
              
              {/* State */}
              <div>
                <label htmlFor="state" className="block mb-2 text-sm font-medium">
                  State*
                </label>
                <select
                  id="state"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  required
                  className={`w-full px-4 py-2 rounded-lg ${
                    darkMode 
                      ? "bg-gray-700 border-gray-600 text-white" 
                      : "bg-white border-gray-300 text-gray-900"
                  } border focus:outline-none focus:ring-2 ${
                    darkMode ? "focus:ring-teal-500" : "focus:ring-green-500"
                  }`}
                >
                  <option value="">Select State</option>
                  {states.map((state) => (
                    <option key={state.value} value={state.value}>
                      {state.label}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* ZIP Code */}
              <div>
                <label htmlFor="zip" className="block mb-2 text-sm font-medium">
                  ZIP Code
                </label>
                <input
                  type="text"
                  id="zip"
                  name="zip"
                  value={formData.zip}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 rounded-lg ${
                    darkMode 
                      ? "bg-gray-700 border-gray-600 text-white" 
                      : "bg-white border-gray-300 text-gray-900"
                  } border focus:outline-none focus:ring-2 ${
                    darkMode ? "focus:ring-teal-500" : "focus:ring-green-500"
                  }`}
                />
              </div>
              
              {/* Number of Courts */}
              <div>
                <label htmlFor="courts" className="block mb-2 text-sm font-medium">
                  Number of Courts
                </label>
                <input
                  type="number"
                  id="courts"
                  name="courts"
                  min="1"
                  value={formData.courts}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 rounded-lg ${
                    darkMode 
                      ? "bg-gray-700 border-gray-600 text-white" 
                      : "bg-white border-gray-300 text-gray-900"
                  } border focus:outline-none focus:ring-2 ${
                    darkMode ? "focus:ring-teal-500" : "focus:ring-green-500"
                  }`}
                />
              </div>
              
              {/* Court Type */}
              <div>
                <label htmlFor="courtType" className="block mb-2 text-sm font-medium">
                  Court Surface Type
                </label>
                <select
                  id="courtType"
                  name="courtType"
                  value={formData.courtType}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 rounded-lg ${
                    darkMode 
                      ? "bg-gray-700 border-gray-600 text-white" 
                      : "bg-white border-gray-300 text-gray-900"
                  } border focus:outline-none focus:ring-2 ${
                    darkMode ? "focus:ring-teal-500" : "focus:ring-green-500"
                  }`}
                >
                  <option value="hard">Hard</option>
                  <option value="clay">Clay</option>
                  <option value="grass">Grass</option>
                  <option value="carpet">Carpet</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>
            </div>
            
            {/* Description */}
            <div>
              <label htmlFor="description" className="block mb-2 text-sm font-medium">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={4}
                value={formData.description}
                onChange={handleChange}
                className={`w-full px-4 py-2 rounded-lg ${
                  darkMode 
                    ? "bg-gray-700 border-gray-600 text-white" 
                    : "bg-white border-gray-300 text-gray-900"
                } border focus:outline-none focus:ring-2 ${
                  darkMode ? "focus:ring-teal-500" : "focus:ring-green-500"
                }`}
                placeholder="Describe the club, facilities, and any other relevant information..."
              ></textarea>
            </div>
            
            {/* Approved Status */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="approved"
                name="approved"
                checked={formData.approved}
                onChange={handleCheckboxChange}
                className={`w-4 h-4 mr-2 ${
                  darkMode ? "bg-gray-700 border-gray-600" : "bg-white border-gray-300"
                }`}
              />
              <label htmlFor="approved" className="text-sm font-medium">
                Approve club (visible in directory)
              </label>
            </div>
            
            {/* Form Actions */}
            <div className="flex items-center justify-end space-x-4">
              {isEditing && (
                <button
                  type="button"
                  onClick={resetForm}
                  className={`px-4 py-2 rounded-lg ${
                    darkMode 
                      ? "bg-gray-700 text-white hover:bg-gray-600" 
                      : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                  } transition-colors`}
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={submitting}
                className={`px-4 py-2 rounded-lg ${
                  darkMode 
                    ? "bg-teal-600 text-white hover:bg-teal-700" 
                    : "bg-green-500 text-white hover:bg-green-600"
                } transition-colors ${submitting ? "opacity-70 cursor-not-allowed" : ""}`}
              >
                {submitting 
                  ? "Saving..." 
                  : isEditing 
                    ? "Update Club" 
                    : "Add Club"
                }
              </button>
            </div>
          </form>
        </div>
        
        {/* Clubs List */}
        <div className={`rounded-lg shadow-md overflow-hidden ${
          darkMode ? "bg-gray-800" : "bg-white"
        }`}>
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h2 className="text-xl font-semibold">
              Clubs Directory ({clubs.length})
            </h2>
            <button 
              onClick={fetchClubs}
              className={`p-2 rounded-lg ${
                darkMode 
                  ? "bg-gray-700 hover:bg-gray-600" 
                  : "bg-gray-100 hover:bg-gray-200"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
          
          {clubs.length === 0 ? (
            <div className="p-8 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-12 w-12 mx-auto mb-4 ${
                darkMode ? "text-gray-600" : "text-gray-400"
              }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <p className={darkMode ? "text-gray-400" : "text-gray-600"}>
                No clubs added yet. Add your first club using the form above.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className={darkMode ? "bg-gray-700" : "bg-gray-50"}>
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Club Name
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Location
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Courts
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${
                  darkMode ? "divide-gray-700" : "divide-gray-200"
                }`}>
                  {clubs.map((club) => (
                    <tr key={club.id} className={darkMode ? "hover:bg-gray-750" : "hover:bg-gray-50"}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium">{club.name}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{club.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>{club.city}, {club.state}</div>
                        {club.zip && <div className="text-sm text-gray-500 dark:text-gray-400">{club.zip}</div>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {club.courts} {club.courts === 1 ? 'court' : 'courts'}
                        <div className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                          {club.courtType} surface
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          club.approved
                            ? (darkMode ? "bg-green-800 text-green-200" : "bg-green-100 text-green-800")
                            : (darkMode ? "bg-yellow-800 text-yellow-200" : "bg-yellow-100 text-yellow-800")
                        }`}>
                          {club.approved ? "Approved" : "Pending"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => editClub(club)}
                          className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 mr-4"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => club.id && deleteClub(club.id)}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      
      {/* Footer */}
      <footer className={`mt-12 py-6 ${
        darkMode ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-600"
      }`}>
        <div className="container mx-auto px-4 text-center">
          <p>© {new Date().getFullYear()} Courtly by JiaYou Tennis. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}