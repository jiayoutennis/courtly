"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { auth, db } from '../../../../firebase';
import { 
  collection, getDocs, doc, getDoc, updateDoc, deleteDoc,
  query, orderBy, serverTimestamp 
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { states } from '@/app/utils/states';
import PageTitle from '@/app/components/PageTitle';
import { initializeClubCollections } from '@/lib/initializeClub';

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
  assignedAdmins?: string[]; // Array of user IDs who are admins of this club
  createdAt?: any;
  createdBy?: string;
}

// User type for admin selection
interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  userType: string;
}

export default function ManageClubsPage() {
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [clubs, setClubs] = useState<Club[]>([]);
  const [selectedClub, setSelectedClub] = useState<Club | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [fetchingClubs, setFetchingClubs] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedAdmins, setSelectedAdmins] = useState<string[]>([]);

  // Debug: Log clubs state changes
  useEffect(() => {
    console.log('Clubs state updated:', clubs.length, 'clubs');
    console.log('Clubs data:', clubs);
  }, [clubs]);
  
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
    approved: true, // Default to true for admin-created clubs
    assignedAdmins: []
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
            
            // Fetch clubs and users
            fetchClubs();
            fetchUsers();
          } else {
            // User is not authorized
            setIsAuthorized(false);
            setError("You don't have permission to access this page");
            router.push('/dashboard');
          }
        } else {
          // User document doesn't exist
          setIsAuthorized(false);
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
    setFetchingClubs(true);
    try {
      console.log('Fetching clubs from Firestore...');
      
      // Try with orderBy first, fall back to no ordering if index doesn't exist
      let querySnapshot;
      try {
        const clubsQuery = query(
          collection(db, "orgs"),
          orderBy("name")
        );
        querySnapshot = await getDocs(clubsQuery);
        console.log('Fetched with orderBy, docs count:', querySnapshot.size);
      } catch (indexError: any) {
        console.warn('Index may not exist, fetching without ordering:', indexError);
        // Fall back to fetching without ordering
        querySnapshot = await getDocs(collection(db, "orgs"));
        console.log('Fetched without orderBy, docs count:', querySnapshot.size);
      }
      
      const clubsList: Club[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        console.log('Club document:', doc.id, data);
        const clubData = {
          id: doc.id,
          name: data.name || '',
          email: data.email || '',
          phone: data.phone || '',
          website: data.website || '',
          address: data.address || '',
          city: data.city || '',
          state: data.state || '',
          zip: data.postalCode || '',
          description: data.description || '',
          courts: data.courtCount || 1,
          courtType: 'hard', // Default
          approved: data.isVerified || false,
          assignedAdmins: data.assignedAdmins || [],
          createdAt: data.createdAt,
          createdBy: data.createdBy
        } as Club;
        console.log('Processed club:', clubData.name, 'approved:', clubData.approved);
        clubsList.push(clubData);
      });
      
      // Sort manually if we couldn't use orderBy
      clubsList.sort((a, b) => a.name.localeCompare(b.name));
      
      console.log('Total clubs fetched:', clubsList.length);
      console.log('Setting clubs state with:', clubsList);
      setClubs(clubsList);
    } catch (error) {
      console.error("Error fetching clubs:", error);
      setError("Failed to load clubs. Please try again later.");
    } finally {
      setFetchingClubs(false);
    }
  };

  // Fetch users who can be club admins (courtly admins and club admins)
  const fetchUsers = async () => {
    try {
      console.log('Fetching users for admin selection...');
      const usersQuery = collection(db, "users");
      const querySnapshot = await getDocs(usersQuery);
      const usersList: User[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Only include users who can be club admins (courtly admins or regular admins)
        if (data.userType === 'courtly' || data.userType === 'admin') {
          usersList.push({
            id: doc.id,
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            email: data.email || '',
            userType: data.userType
          });
        }
      });
      
      // Sort by name
      usersList.sort((a, b) => {
        const nameA = `${a.firstName} ${a.lastName}`.trim();
        const nameB = `${b.firstName} ${b.lastName}`.trim();
        return nameA.localeCompare(nameB);
      });
      
      console.log('Total users fetched for admin selection:', usersList.length);
      setUsers(usersList);
    } catch (error) {
      console.error("Error fetching users:", error);
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

  // Toggle admin selection
  const toggleAdminSelection = (userId: string) => {
    setSelectedAdmins(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  // Update user organizations to include club membership
  const updateUserOrganizations = async (clubId: string, adminIds: string[]) => {
    try {
      for (const userId of adminIds) {
        const userRef = doc(db, "users", userId);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const currentOrgs = userData.organization || [];
          
          // Add club to user's organizations if not already there
          if (!currentOrgs.includes(clubId)) {
            await updateDoc(userRef, {
              organization: [...currentOrgs, clubId],
              updatedAt: serverTimestamp()
            });
          }
        }
      }
    } catch (error) {
      console.error("Error updating user organizations:", error);
    }
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
      
      // Check if we're editing or creating
      if (isEditing && selectedClub?.id) {
        // Update existing club - map to org schema
        const orgData = {
          name: formData.name,
          email: formData.email,
          phone: formData.phone || '',
          website: formData.website || '',
          address: formData.address || '',
          city: formData.city,
          state: formData.state,
          postalCode: formData.zip || '',
          description: formData.description || '',
          courtCount: formData.courts || 1,
          assignedAdmins: selectedAdmins,
          updatedAt: serverTimestamp()
        };
        
        await updateDoc(doc(db, "orgs", selectedClub.id), orgData);
        
        // Update user organization field for newly assigned admins
        await updateUserOrganizations(selectedClub.id, selectedAdmins);
        
        setSuccess(`Club "${formData.name}" updated successfully!`);
      } else {
        // Create new club - automatically approved when added by Courtly admin
        // Generate a new club ID first
        const newClubRef = doc(collection(db, "orgs"));
        const newClubId = newClubRef.id;
        
        const newClubData = {
          name: formData.name,
          email: formData.email,
          phone: formData.phone || null,
          website: formData.website || null,
          address: formData.address || null,
          city: formData.city,
          state: formData.state,
          zip: formData.zip || null,
          description: formData.description || null,
          courts: formData.courts || 1,
          courtType: formData.courtType || 'hard',
          approved: true,
          assignedAdmins: selectedAdmins,
          submittedBy: auth.currentUser?.uid,
          submitterEmail: auth.currentUser?.email || '',
          submitterName: auth.currentUser?.displayName || 'Admin'
        };
        
        console.log('Creating club with ID:', newClubId);
        
        // Initialize all club subcollections (courts, members, bookings, etc.)
        // This will create the org document with FULL schema including operatingHours and bookingSettings
        await initializeClubCollections(newClubId, newClubData);
        
        // Update user organization field for assigned admins
        await updateUserOrganizations(newClubId, selectedAdmins);
        
        setSuccess(`Club "${formData.name}" added and approved successfully with all collections initialized!`);
        
        // Wait a moment for Firestore to propagate the change
        await new Promise(resolve => setTimeout(resolve, 500));
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
    setSelectedAdmins(club.assignedAdmins || []);
    setIsEditing(true);
    
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Approve club (for clubs that are pending)
  const approveClub = async (clubId: string, clubName: string) => {
    if (!clubId) return;
    
    if (!window.confirm(`Approve "${clubName}"? This will make it visible in the clubs directory.`)) {
      return;
    }
    
    try {
      await updateDoc(doc(db, "orgs", clubId), {
        isVerified: true,
        isActive: true,
        updatedAt: serverTimestamp()
      });
      
      setSuccess(`Club "${clubName}" has been approved!`);
      fetchClubs();
    } catch (error) {
      console.error("Error approving club:", error);
      setError("Failed to approve club. Please try again.");
    }
  };

  // Delete club
  const deleteClub = async (clubId: string) => {
    if (!clubId) return;
    
    if (!window.confirm("Are you sure you want to delete this club? This action cannot be undone.")) {
      return;
    }
    
    setLoading(true);
    
    try {
      await deleteDoc(doc(db, "orgs", clubId));
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
      approved: true, // Always true for admin-created clubs
      assignedAdmins: []
    });
    setSelectedAdmins([]);
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
      darkMode ? "bg-[#0a0a0a] text-white" : "bg-white text-gray-900"
    }`}>
      <PageTitle title="Manage Clubs - Courtly Admin" />
      
      {/* Header */}
      <header className={`border-b transition-colors duration-300 ${
        darkMode ? 'border-[#1a1a1a]' : 'border-gray-100'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-0 sm:h-16 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
          <div className="flex items-center space-x-3 sm:space-x-6">
            <Link href="/" className="text-base sm:text-lg font-light">Courtly</Link>
            <span className={`hidden sm:inline text-sm font-light ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>/</span>
            <h1 className="text-xs sm:text-sm font-light">Manage Clubs</h1>
          </div>
          
          <div className="flex items-center space-x-3 sm:space-x-4 w-full sm:w-auto justify-between sm:justify-end">
            <Link 
              href="/dashboard" 
              className={`text-xs sm:text-sm font-light transition-colors duration-200 ${
                darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-black'
              }`}
            >
              Dashboard
            </Link>
            <button
              onClick={toggleDarkMode}
              className={`p-2 transition-colors duration-200 ${
                darkMode ? "hover:bg-[#1a1a1a]" : "hover:bg-gray-100"
              }`}
              aria-label="Toggle dark mode"
            >
              {darkMode ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
            <div className={`px-2 sm:px-3 py-1 border text-[10px] sm:text-xs font-light uppercase tracking-wider ${
              darkMode ? "border-[#1a1a1a]" : "border-gray-200"
            }`}>
              Courtly Staff
            </div>
          </div>
        </div>
      </header>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 md:py-12">
        {/* Alert messages */}
        {error && (
          <div className={`mb-6 sm:mb-8 p-3 sm:p-4 border font-light text-xs sm:text-sm ${
            darkMode 
              ? 'border-red-900/50 bg-red-950/20 text-red-400' 
              : 'border-red-200 bg-red-50 text-red-600'
          }`}>
            {error}
          </div>
        )}
        
        {success && (
          <div className={`mb-6 sm:mb-8 p-3 sm:p-4 border font-light text-xs sm:text-sm ${
            darkMode 
              ? 'border-green-900/50 bg-green-950/20 text-green-400' 
              : 'border-green-200 bg-green-50 text-green-600'
          }`}>
            {success}
          </div>
        )}
        
        {/* Add/Edit Club Form */}
        <div className={`mb-8 sm:mb-12 p-4 sm:p-6 md:p-8 border ${
          darkMode ? "border-[#1a1a1a]" : "border-gray-100"
        }`}>
          <h2 className="text-lg sm:text-xl font-light mb-6 sm:mb-8">
            {isEditing ? `Edit Club: ${selectedClub?.name}` : "Add New Club"}
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {/* Club Name */}
              <div>
                <label htmlFor="name" className={`block text-xs font-light uppercase tracking-wider mb-2 ${
                  darkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Club Name*
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
                <label htmlFor="email" className={`block text-xs font-light uppercase tracking-wider mb-2 ${
                  darkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Email*
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
                <label htmlFor="phone" className={`block text-xs font-light uppercase tracking-wider mb-2 ${
                  darkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Phone
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
                <label htmlFor="website" className={`block text-xs font-light uppercase tracking-wider mb-2 ${
                  darkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Website
                </label>
                <input
                  type="url"
                  id="website"
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  placeholder="https://example.com"
                  className={`w-full px-4 py-3 border font-light transition-colors duration-200 ${
                    darkMode 
                      ? 'bg-[#0a0a0a] border-[#1a1a1a] text-white placeholder-gray-600 focus:border-gray-600' 
                      : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-gray-400'
                  } focus:outline-none`}
                />
              </div>
              
              {/* Address */}
              <div>
                <label htmlFor="address" className={`block text-xs font-light uppercase tracking-wider mb-2 ${
                  darkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Address
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
              
              {/* City */}
              <div>
                <label htmlFor="city" className={`block text-xs font-light uppercase tracking-wider mb-2 ${
                  darkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  City*
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
                <label htmlFor="state" className={`block text-xs font-light uppercase tracking-wider mb-2 ${
                  darkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  State*
                </label>
                <select
                  id="state"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  required
                  className={`w-full px-4 py-3 border font-light transition-colors duration-200 ${
                    darkMode 
                      ? 'bg-[#0a0a0a] border-[#1a1a1a] text-white focus:border-gray-600' 
                      : 'bg-white border-gray-200 text-gray-900 focus:border-gray-400'
                  } focus:outline-none`}
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
                <label htmlFor="zip" className={`block text-xs font-light uppercase tracking-wider mb-2 ${
                  darkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
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
              
              {/* Number of Courts */}
              <div>
                <label htmlFor="courts" className={`block text-xs font-light uppercase tracking-wider mb-2 ${
                  darkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
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
                <label htmlFor="courtType" className={`block text-xs font-light uppercase tracking-wider mb-2 ${
                  darkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Court Surface Type
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
                  <option value="mixed">Mixed</option>
                </select>
              </div>
            </div>
            
            {/* Description */}
            <div>
              <label htmlFor="description" className={`block text-xs font-light uppercase tracking-wider mb-2 ${
                darkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={4}
                value={formData.description}
                onChange={handleChange}
                className={`w-full px-4 py-3 border font-light transition-colors duration-200 ${
                  darkMode 
                    ? 'bg-[#0a0a0a] border-[#1a1a1a] text-white placeholder-gray-600 focus:border-gray-600' 
                    : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-gray-400'
                } focus:outline-none`}
                placeholder="Describe the club, facilities, and any other relevant information..."
              ></textarea>
            </div>
            
            {/* Assigned Admins */}
            <div>
              <label className={`block text-xs font-light uppercase tracking-wider mb-3 ${
                darkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Assign Club Admins
              </label>
              <p className={`text-xs font-light mb-4 ${
                darkMode ? 'text-gray-500' : 'text-gray-500'
              }`}>
                Select users who will have admin access to this club. Selected admins will be added to their organization list.
              </p>
              <div className={`border max-h-64 overflow-y-auto ${
                darkMode ? 'border-[#1a1a1a]' : 'border-gray-200'
              }`}>
                {users.length === 0 ? (
                  <div className="p-6 text-center">
                    <p className={`text-sm font-light ${
                      darkMode ? 'text-gray-600' : 'text-gray-400'
                    }`}>
                      No users available for admin assignment.
                    </p>
                  </div>
                ) : (
                  <div className={`divide-y ${
                    darkMode ? 'divide-[#1a1a1a]' : 'divide-gray-100'
                  }`}>
                    {users.map((user) => (
                      <label
                        key={user.id}
                        className={`flex items-center px-4 py-3 cursor-pointer transition-colors duration-200 ${
                          darkMode ? 'hover:bg-[#0f0f0f]' : 'hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedAdmins.includes(user.id)}
                          onChange={() => toggleAdminSelection(user.id)}
                          className="mr-3 w-4 h-4"
                        />
                        <div className="flex-1">
                          <div className="font-light text-sm">
                            {user.firstName} {user.lastName}
                          </div>
                          <div className={`text-xs font-light ${
                            darkMode ? 'text-gray-600' : 'text-gray-400'
                          }`}>
                            {user.email}
                          </div>
                        </div>
                        <span className={`px-2 py-1 border text-xs font-light uppercase tracking-wider ${
                          user.userType === 'courtly'
                            ? (darkMode ? 'border-purple-900/50 text-purple-400' : 'border-purple-200 text-purple-600')
                            : (darkMode ? 'border-blue-900/50 text-blue-400' : 'border-blue-200 text-blue-600')
                        }`}>
                          {user.userType === 'courtly' ? 'Courtly Admin' : 'Club Admin'}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              {selectedAdmins.length > 0 && (
                <p className={`text-xs font-light mt-2 ${
                  darkMode ? 'text-gray-500' : 'text-gray-500'
                }`}>
                  {selectedAdmins.length} admin{selectedAdmins.length !== 1 ? 's' : ''} selected
                </p>
              )}
            </div>
            
            {/* Form Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 sm:gap-4 pt-4 sm:pt-6">
              {isEditing && (
                <button
                  type="button"
                  onClick={resetForm}
                  className={`px-4 sm:px-6 py-3 border font-light text-xs sm:text-sm transition-colors duration-200 ${
                    darkMode 
                      ? 'border-[#1a1a1a] hover:border-gray-600' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={submitting}
                className={`px-4 sm:px-6 py-3 font-light text-xs sm:text-sm transition-colors duration-200 ${
                  darkMode
                    ? submitting ? 'bg-gray-800 text-gray-500' : 'bg-white text-black hover:bg-gray-100'
                    : submitting ? 'bg-gray-200 text-gray-400' : 'bg-black text-white hover:bg-gray-900'
                }`}
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
        <div className={`border ${
          darkMode ? "border-[#1a1a1a]" : "border-gray-100"
        }`}>
          <div className={`px-4 sm:px-6 py-3 sm:py-4 border-b flex justify-between items-center ${
            darkMode ? 'border-[#1a1a1a]' : 'border-gray-100'
          }`}>
            <h2 className="text-xs sm:text-sm font-light uppercase tracking-wider">
              Clubs Directory ({clubs.length})
              {fetchingClubs && <span className="ml-2 text-[10px] sm:text-xs">(Loading...)</span>}
            </h2>
            <button 
              onClick={fetchClubs}
              disabled={fetchingClubs}
              className={`p-2 transition-colors duration-200 ${
                darkMode 
                  ? "hover:bg-[#1a1a1a]" 
                  : "hover:bg-gray-100"
              } ${fetchingClubs ? 'opacity-50 cursor-not-allowed' : ''}`}
              aria-label="Refresh clubs list"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${fetchingClubs ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
          
          {clubs.length === 0 ? (
            <div className="p-8 sm:p-12 text-center">
              <p className={`text-sm font-light ${darkMode ? "text-gray-600" : "text-gray-400"}`}>
                No clubs added yet. Add your first club using the form above.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto">{/* Mobile: Allow horizontal scroll */}
                <thead className={darkMode ? "bg-[#0a0a0a]" : "bg-white"}>
                  <tr>
                    <th scope="col" className={`px-3 sm:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs font-light uppercase tracking-wider whitespace-nowrap ${
                      darkMode ? 'text-gray-600' : 'text-gray-400'
                    }`}>
                      Club Name
                    </th>
                    <th scope="col" className={`px-3 sm:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs font-light uppercase tracking-wider whitespace-nowrap ${
                      darkMode ? 'text-gray-600' : 'text-gray-400'
                    }`}>
                      Location
                    </th>
                    <th scope="col" className={`px-3 sm:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs font-light uppercase tracking-wider whitespace-nowrap ${
                      darkMode ? 'text-gray-600' : 'text-gray-400'
                    }`}>
                      Courts
                    </th>
                    <th scope="col" className={`hidden lg:table-cell px-3 sm:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs font-light uppercase tracking-wider whitespace-nowrap ${
                      darkMode ? 'text-gray-600' : 'text-gray-400'
                    }`}>
                      Assigned Admins
                    </th>
                    <th scope="col" className={`px-3 sm:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs font-light uppercase tracking-wider whitespace-nowrap ${
                      darkMode ? 'text-gray-600' : 'text-gray-400'
                    }`}>
                      Status
                    </th>
                    <th scope="col" className={`px-3 sm:px-6 py-3 sm:py-4 text-right text-[10px] sm:text-xs font-light uppercase tracking-wider whitespace-nowrap ${
                      darkMode ? 'text-gray-600' : 'text-gray-400'
                    }`}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className={`${
                  darkMode ? "divide-y divide-[#1a1a1a]" : "divide-y divide-gray-100"
                }`}>
                  {clubs.map((club) => (
                    <tr key={club.id} className={`transition-colors duration-200 ${
                      darkMode ? "hover:bg-[#0f0f0f]" : "hover:bg-gray-50"
                    }`}>
                      <td className="px-3 sm:px-6 py-3 sm:py-4">
                        <div className="font-light text-xs sm:text-sm">{club.name}</div>
                        <div className={`text-[10px] sm:text-xs font-light ${
                          darkMode ? "text-gray-600" : "text-gray-400"
                        }`}>{club.email}</div>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4">
                        <div className="font-light text-xs sm:text-sm">{club.city}, {club.state}</div>
                        {club.zip && <div className={`text-[10px] sm:text-xs font-light ${
                          darkMode ? "text-gray-600" : "text-gray-400"
                        }`}>{club.zip}</div>}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4">
                        <div className="font-light text-xs sm:text-sm">{club.courts} {club.courts === 1 ? 'court' : 'courts'}</div>
                        <div className={`text-[10px] sm:text-xs font-light capitalize ${
                          darkMode ? "text-gray-600" : "text-gray-400"
                        }`}>
                          {club.courtType}
                        </div>
                      </td>
                      <td className="hidden lg:table-cell px-3 sm:px-6 py-3 sm:py-4">
                        {club.assignedAdmins && club.assignedAdmins.length > 0 ? (
                          <div>
                            <div className="font-light text-xs sm:text-sm">
                              {club.assignedAdmins.length} admin{club.assignedAdmins.length !== 1 ? 's' : ''}
                            </div>
                            <div className={`text-[10px] sm:text-xs font-light ${
                              darkMode ? "text-gray-600" : "text-gray-400"
                            }`}>
                              {users
                                .filter(u => club.assignedAdmins?.includes(u.id))
                                .slice(0, 2)
                                .map(u => `${u.firstName} ${u.lastName}`)
                                .join(', ')}
                              {club.assignedAdmins.length > 2 && ` +${club.assignedAdmins.length - 2} more`}
                            </div>
                          </div>
                        ) : (
                          <span className={`text-xs sm:text-sm font-light ${
                            darkMode ? "text-gray-600" : "text-gray-400"
                          }`}>
                            None
                          </span>
                        )}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4">
                        <span className={`px-2 sm:px-3 py-1 border text-[10px] sm:text-xs font-light uppercase tracking-wider whitespace-nowrap ${
                          club.approved
                            ? (darkMode ? "border-green-900/50 text-green-400" : "border-green-200 text-green-600")
                            : (darkMode ? "border-yellow-900/50 text-yellow-400" : "border-yellow-200 text-yellow-600")
                        }`}>
                          {club.approved ? "Approved" : "Pending"}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-right text-[10px] sm:text-xs font-light whitespace-nowrap">
                        {!club.approved && (
                          <button
                            onClick={() => club.id && approveClub(club.id, club.name)}
                            className={`mr-2 sm:mr-4 underline hover:no-underline transition-colors duration-200 ${
                              darkMode ? "text-green-400" : "text-green-600"
                            }`}
                          >
                            Approve
                          </button>
                        )}
                        <button
                          onClick={() => editClub(club)}
                          className="mr-2 sm:mr-4 underline hover:no-underline transition-colors duration-200"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => club.id && deleteClub(club.id)}
                          className={`underline hover:no-underline transition-colors duration-200 ${
                            darkMode ? "text-red-400" : "text-red-600"
                          }`}
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
      <footer className={`border-t py-4 sm:py-6 mt-8 sm:mt-12 transition-colors duration-300 ${
        darkMode ? 'border-[#1a1a1a] text-gray-600' : 'border-gray-100 text-gray-400'
      }`}>
        <div className="text-center px-4">
          <p className="text-[10px] sm:text-xs font-light">
            © {new Date().getFullYear()} Courtly by JiaYou Tennis. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}