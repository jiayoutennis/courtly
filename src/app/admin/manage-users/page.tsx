"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth, db } from "../../../../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy, setDoc, Timestamp } from "firebase/firestore";
import DarkModeToggle from "@/app/components/DarkModeToggle";
import PageTitle from "@/app/components/PageTitle";

interface User {
  id: string;
  uid: string;
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  joinedAt?: any;
  lastLogin?: any;
  userType: 'admin' | 'member' | 'courtly';
  organizations?: Array<{ orgId: string; role: string }>;
  defaultOrgId?: string | null;
  isActive?: boolean;
  photoURL?: string | null;
  phone?: string | null;
  language?: string;
  timezone?: string;
  authProvider?: string;
  notifications?: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  permissions?: string[];
  stripeCustomerId?: string | null;
  createdBy?: string;
  referralCode?: string | null;
  inviteToken?: string | null;
  lastActivityAt?: any;
  notificationTokens?: string[];
  deletedAt?: any | null;
  schemaVersion?: number;
  // Legacy fields
  organization?: string | string[];
  createdAt?: string;
}

export default function ManageUsersPage() {
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<'all' | 'admin' | 'member' | 'courtly'>('all');
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserData, setNewUserData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    userType: 'member' as 'admin' | 'member' | 'courtly',
    language: 'en',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Los_Angeles'
  });
  
  const router = useRouter();

  // Initialize dark mode
  useEffect(() => {
    const savedMode = localStorage.getItem("darkMode");
    if (savedMode === "true") {
      setDarkMode(true);
    }
  }, []);

  // Check authentication and authorization
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDocSnap = await getDocs(collection(db, "users"));
          
          let isAuthorized = false;
          userDocSnap.forEach((doc) => {
            if (doc.id === user.uid && doc.data().userType === 'courtly') {
              isAuthorized = true;
            }
          });
          
          if (!isAuthorized) {
            setError("Access denied. Only Courtly admins can access this page.");
            setTimeout(() => router.push('/dashboard'), 2000);
            return;
          }
          
          await fetchUsers();
        } catch (error) {
          console.error("Error checking authorization:", error);
          setError("Failed to verify permissions.");
          setTimeout(() => router.push('/dashboard'), 2000);
        }
      } else {
        router.push('/signin');
      }
    });
    
    return () => unsubscribe();
  }, [router]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const usersQuery = query(collection(db, "users"), orderBy("joinedAt", "desc"));
      const usersSnapshot = await getDocs(usersQuery);
      
      const usersData: User[] = [];
      usersSnapshot.forEach((doc) => {
        const data = doc.data();
        usersData.push({
          id: doc.id,
          uid: data.uid || doc.id,
          email: data.email || '',
          firstName: data.firstName,
          lastName: data.lastName,
          fullName: data.fullName,
          joinedAt: data.joinedAt,
          lastLogin: data.lastLogin,
          userType: data.userType || 'member',
          organizations: data.organizations || [],
          defaultOrgId: data.defaultOrgId,
          isActive: data.isActive !== undefined ? data.isActive : true,
          photoURL: data.photoURL,
          phone: data.phone,
          language: data.language,
          timezone: data.timezone,
          authProvider: data.authProvider,
          notifications: data.notifications,
          permissions: data.permissions || [],
          stripeCustomerId: data.stripeCustomerId,
          createdBy: data.createdBy,
          referralCode: data.referralCode,
          inviteToken: data.inviteToken,
          lastActivityAt: data.lastActivityAt,
          notificationTokens: data.notificationTokens || [],
          deletedAt: data.deletedAt,
          schemaVersion: data.schemaVersion,
          // Legacy fields
          organization: data.organization,
          createdAt: data.createdAt,
        });
      });
      
      setUsers(usersData);
      setFilteredUsers(usersData);
    } catch (error) {
      console.error("Error fetching users:", error);
      setError("Failed to load users. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Filter users based on search and type
  useEffect(() => {
    let filtered = users;
    
    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(user => user.userType === filterType);
    }
    
    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    setFilteredUsers(filtered);
  }, [searchTerm, filterType, users]);

  const handleChangeUserType = async (userId: string, newType: 'admin' | 'member' | 'courtly') => {
    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, { userType: newType });
      
      setSuccess(`User type updated successfully to ${newType}`);
      await fetchUsers();
      
      setTimeout(() => setSuccess(""), 3000);
    } catch (error) {
      console.error("Error updating user type:", error);
      setError("Failed to update user type. Please try again.");
      setTimeout(() => setError(""), 3000);
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Are you sure you want to delete user ${userEmail}? This action cannot be undone.`)) {
      return;
    }
    
    try {
      await deleteDoc(doc(db, "users", userId));
      
      setSuccess("User deleted successfully");
      await fetchUsers();
      
      setTimeout(() => setSuccess(""), 3000);
    } catch (error) {
      console.error("Error deleting user:", error);
      setError("Failed to delete user. Please try again.");
      setTimeout(() => setError(""), 3000);
    }
  };

  const handleAddUser = async () => {
    if (!newUserData.email || !newUserData.firstName || !newUserData.lastName) {
      setError("Email, first name, and last name are required");
      setTimeout(() => setError(""), 3000);
      return;
    }

    try {
      // Generate a unique user ID (in production, this would come from Firebase Auth)
      const userId = `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const fullName = `${newUserData.firstName} ${newUserData.lastName}`;
      const now = Timestamp.now();
      const currentAdminUid = auth.currentUser?.uid || 'system';

      // Create user document with all required fields
      await setDoc(doc(db, "users", userId), {
        uid: userId,
        email: newUserData.email,
        firstName: newUserData.firstName,
        lastName: newUserData.lastName,
        fullName: fullName,
        joinedAt: now,
        lastLogin: null,
        userType: newUserData.userType,
        organizations: [],
        defaultOrgId: null,
        isActive: true,
        photoURL: null,
        phone: newUserData.phone || null,
        language: newUserData.language,
        timezone: newUserData.timezone,
        authProvider: 'manual', // Manually created by admin
        notifications: {
          email: true,
          sms: false,
          push: false
        },
        permissions: [],
        stripeCustomerId: null,
        createdBy: currentAdminUid,
        referralCode: null,
        inviteToken: null,
        lastActivityAt: now,
        notificationTokens: [],
        deletedAt: null,
        schemaVersion: 1,
        // Legacy fields for backward compatibility
        createdAt: now.toDate().toISOString(),
        updatedAt: now.toDate().toISOString(),
        organization: []
      });

      setSuccess(`User ${fullName} created successfully! Note: This user cannot sign in until they register with Firebase Auth.`);
      setShowAddUser(false);
      setNewUserData({
        email: '',
        firstName: '',
        lastName: '',
        phone: '',
        userType: 'member',
        language: 'en',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Los_Angeles'
      });
      await fetchUsers();
      
      setTimeout(() => setSuccess(""), 5000);
    } catch (error) {
      console.error("Error adding user:", error);
      setError("Failed to add user. Please try again.");
      setTimeout(() => setError(""), 3000);
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors duration-300 ${
        darkMode ? "bg-gray-900 text-white" : "bg-white text-gray-900"
      }`}>
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      darkMode ? "bg-[#0a0a0a] text-white" : "bg-white text-gray-900"
    }`}>
      <PageTitle title="Manage All Users - Courtly Admin" />
      
      {/* Header */}
      <header className={`border-b transition-colors duration-300 ${
        darkMode ? 'border-[#1a1a1a]' : 'border-gray-100'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <Link href="/" className="text-lg font-light">Courtly</Link>
            <span className={`text-sm font-light ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>/</span>
            <h1 className="text-sm font-light">Manage Users</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <Link 
              href="/dashboard" 
              className={`text-sm font-light transition-colors duration-200 ${
                darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-black'
              }`}
            >
              Dashboard
            </Link>
            <DarkModeToggle darkMode={darkMode} setDarkMode={setDarkMode} />
            <div className={`px-3 py-1 border text-xs font-light uppercase tracking-wider ${
              darkMode ? "border-[#1a1a1a]" : "border-gray-200"
            }`}>
              Courtly Staff
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {error && (
          <div className={`mb-8 p-4 border font-light text-sm ${
            darkMode 
              ? 'border-red-900/50 bg-red-950/20 text-red-400' 
              : 'border-red-200 bg-red-50 text-red-600'
          }`}>
            {error}
          </div>
        )}
        {success && (
          <div className={`mb-8 p-4 border font-light text-sm ${
            darkMode 
              ? 'border-green-900/50 bg-green-950/20 text-green-400' 
              : 'border-green-200 bg-green-50 text-green-600'
          }`}>
            {success}
          </div>
        )}
        
        {/* Filters and Search */}
        <div className={`p-8 border mb-8 ${
          darkMode ? "border-[#1a1a1a]" : "border-gray-100"
        }`}>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Search */}
            <div>
              <label className={`block text-xs font-light uppercase tracking-wider mb-2 ${
                darkMode ? "text-gray-400" : "text-gray-600"
              }`}>
                Search Users
              </label>
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full px-4 py-3 border font-light transition-colors duration-200 ${
                  darkMode
                    ? "bg-[#0a0a0a] border-[#1a1a1a] text-white placeholder-gray-600 focus:border-gray-600"
                    : "bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-gray-400"
                } focus:outline-none`}
              />
            </div>
            
            {/* Filter by Type */}
            <div>
              <label className={`block text-xs font-light uppercase tracking-wider mb-2 ${
                darkMode ? "text-gray-400" : "text-gray-600"
              }`}>
                Filter by Type
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as typeof filterType)}
                className={`w-full px-4 py-3 border font-light transition-colors duration-200 ${
                  darkMode
                    ? "bg-[#0a0a0a] border-[#1a1a1a] text-white focus:border-gray-600"
                    : "bg-white border-gray-200 text-gray-900 focus:border-gray-400"
                } focus:outline-none`}
              >
                <option value="all">All Users</option>
                <option value="courtly">Courtly Admins</option>
                <option value="admin">Club Admins</option>
                <option value="member">Members</option>
              </select>
            </div>
          </div>
          
          {/* Stats */}
          <div className="mt-6 flex items-center justify-between">
            <p className={`text-sm font-light ${darkMode ? "text-gray-600" : "text-gray-400"}`}>
              Showing {filteredUsers.length} of {users.length} users
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowAddUser(!showAddUser)}
                className={`px-6 py-3 border font-light text-sm transition-colors duration-200 ${
                  darkMode 
                    ? "border-[#1a1a1a] hover:border-gray-600" 
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                {showAddUser ? 'Cancel' : 'Add User'}
              </button>
              <button
                onClick={fetchUsers}
                className={`px-6 py-3 font-light text-sm transition-colors duration-200 ${
                  darkMode
                    ? "bg-white text-black hover:bg-gray-100"
                    : "bg-black text-white hover:bg-gray-900"
                }`}
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
        
        {/* Add User Form */}
        {showAddUser && (
          <div className={`p-8 border mb-8 ${
            darkMode ? "border-[#1a1a1a]" : "border-gray-100"
          }`}>
            <h2 className="text-xl font-light mb-8">Add New User</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={`block text-xs font-light uppercase tracking-wider mb-2 ${
                  darkMode ? "text-gray-400" : "text-gray-600"
                }`}>
                  First Name *
                </label>
                <input
                  type="text"
                  value={newUserData.firstName}
                  onChange={(e) => setNewUserData({...newUserData, firstName: e.target.value})}
                  className={`w-full px-4 py-3 border font-light transition-colors duration-200 ${
                    darkMode
                      ? "bg-[#0a0a0a] border-[#1a1a1a] text-white placeholder-gray-600 focus:border-gray-600"
                      : "bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-gray-400"
                  } focus:outline-none`}
                  placeholder="John"
                />
              </div>
              <div>
                <label className={`block text-xs font-light uppercase tracking-wider mb-2 ${
                  darkMode ? "text-gray-400" : "text-gray-600"
                }`}>
                  Last Name *
                </label>
                <input
                  type="text"
                  value={newUserData.lastName}
                  onChange={(e) => setNewUserData({...newUserData, lastName: e.target.value})}
                  className={`w-full px-4 py-3 border font-light transition-colors duration-200 ${
                    darkMode
                      ? "bg-[#0a0a0a] border-[#1a1a1a] text-white placeholder-gray-600 focus:border-gray-600"
                      : "bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-gray-400"
                  } focus:outline-none`}
                  placeholder="Doe"
                />
              </div>
              <div>
                <label className={`block text-xs font-light uppercase tracking-wider mb-2 ${
                  darkMode ? "text-gray-400" : "text-gray-600"
                }`}>
                  Email *
                </label>
                <input
                  type="email"
                  value={newUserData.email}
                  onChange={(e) => setNewUserData({...newUserData, email: e.target.value})}
                  className={`w-full px-4 py-3 border font-light transition-colors duration-200 ${
                    darkMode
                      ? "bg-[#0a0a0a] border-[#1a1a1a] text-white placeholder-gray-600 focus:border-gray-600"
                      : "bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-gray-400"
                  } focus:outline-none`}
                  placeholder="john@example.com"
                />
              </div>
              <div>
                <label className={`block text-xs font-light uppercase tracking-wider mb-2 ${
                  darkMode ? "text-gray-400" : "text-gray-600"
                }`}>
                  Phone
                </label>
                <input
                  type="tel"
                  value={newUserData.phone}
                  onChange={(e) => setNewUserData({...newUserData, phone: e.target.value})}
                  className={`w-full px-4 py-3 border font-light transition-colors duration-200 ${
                    darkMode
                      ? "bg-[#0a0a0a] border-[#1a1a1a] text-white placeholder-gray-600 focus:border-gray-600"
                      : "bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-gray-400"
                  } focus:outline-none`}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
              <div>
                <label className={`block text-xs font-light uppercase tracking-wider mb-2 ${
                  darkMode ? "text-gray-400" : "text-gray-600"
                }`}>
                  User Type
                </label>
                <select
                  value={newUserData.userType}
                  onChange={(e) => setNewUserData({...newUserData, userType: e.target.value as typeof newUserData.userType})}
                  className={`w-full px-4 py-3 border font-light transition-colors duration-200 ${
                    darkMode
                      ? "bg-[#0a0a0a] border-[#1a1a1a] text-white focus:border-gray-600"
                      : "bg-white border-gray-200 text-gray-900 focus:border-gray-400"
                  } focus:outline-none`}
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  <option value="courtly">Courtly Admin</option>
                </select>
              </div>
              <div>
                <label className={`block text-xs font-light uppercase tracking-wider mb-2 ${
                  darkMode ? "text-gray-400" : "text-gray-600"
                }`}>
                  Language
                </label>
                <select
                  value={newUserData.language}
                  onChange={(e) => setNewUserData({...newUserData, language: e.target.value})}
                  className={`w-full px-4 py-3 border font-light transition-colors duration-200 ${
                    darkMode
                      ? "bg-[#0a0a0a] border-[#1a1a1a] text-white focus:border-gray-600"
                      : "bg-white border-gray-200 text-gray-900 focus:border-gray-400"
                  } focus:outline-none`}
                >
                  <option value="en">English</option>
                  <option value="zh">Chinese (Simplified)</option>
                  <option value="zh-HK">Chinese (Traditional - HK)</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                </select>
              </div>
            </div>
            <div className="mt-8">
              <button
                onClick={handleAddUser}
                className={`px-6 py-3 font-light text-sm transition-colors duration-200 ${
                  darkMode
                    ? "bg-white text-black hover:bg-gray-100"
                    : "bg-black text-white hover:bg-gray-900"
                }`}
              >
                Create User
              </button>
              <p className={`mt-4 text-xs font-light ${darkMode ? "text-gray-500" : "text-gray-500"}`}>
                Note: Manually created users cannot sign in until they register with Firebase Auth using the same email.
              </p>
            </div>
          </div>
        )}
        
        {/* Users Table */}
        <div className={`rounded-lg shadow-md overflow-hidden ${
          darkMode ? "bg-gray-800" : "bg-white"
        }`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={darkMode ? "bg-gray-700" : "bg-gray-50"}>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Organizations
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Auth
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Last Login
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className={`divide-y ${darkMode ? "divide-gray-700" : "divide-gray-200"}`}>
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className={darkMode ? "hover:bg-gray-700" : "hover:bg-gray-50"}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {user.photoURL && (
                            <img 
                              src={user.photoURL} 
                              alt={user.fullName || 'User'} 
                              className="h-8 w-8 rounded-full mr-3"
                            />
                          )}
                          <div>
                            <div className="font-medium">{user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'N/A'}</div>
                            {user.phone && (
                              <div className={`text-xs ${darkMode ? "text-gray-500" : "text-gray-400"}`}>
                                {user.phone}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={darkMode ? "text-gray-400" : "text-gray-500"}>
                          {user.email}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={user.userType}
                          onChange={(e) => handleChangeUserType(user.id, e.target.value as typeof user.userType)}
                          className={`px-3 py-1 rounded-lg border text-sm ${
                            darkMode
                              ? "bg-gray-700 border-gray-600 text-white"
                              : "bg-white border-gray-300 text-gray-900"
                          }`}
                        >
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                          <option value="courtly">Courtly Admin</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          user.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                          {user.organizations && user.organizations.length > 0
                            ? `${user.organizations.length} org${user.organizations.length > 1 ? 's' : ''}`
                            : user.organization
                            ? Array.isArray(user.organization)
                              ? `${user.organization.length} org(s)`
                              : '1 org'
                            : 'None'
                          }
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                          {user.authProvider || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                          {user.joinedAt 
                            ? user.joinedAt.toDate 
                              ? user.joinedAt.toDate().toLocaleDateString()
                              : new Date(user.joinedAt).toLocaleDateString()
                            : user.createdAt
                            ? new Date(user.createdAt).toLocaleDateString()
                            : 'N/A'
                          }
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                          {user.lastLogin
                            ? user.lastLogin.toDate
                              ? user.lastLogin.toDate().toLocaleDateString()
                              : new Date(user.lastLogin).toLocaleDateString()
                            : 'Never'
                          }
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => handleDeleteUser(user.id, user.email)}
                          className="text-red-600 hover:text-red-800 font-medium"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center">
                      <p className={darkMode ? "text-gray-400" : "text-gray-500"}>
                        No users found matching your criteria.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        
        {/* User Type Legend */}
        <div className={`mt-6 p-6 rounded-lg shadow-md ${
          darkMode ? "bg-gray-800" : "bg-white"
        }`}>
          <h3 className="text-lg font-semibold mb-4">User Type Descriptions</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <h4 className={`font-medium mb-2 ${darkMode ? "text-teal-400" : "text-teal-600"}`}>
                Courtly Admin
              </h4>
              <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                Full platform access. Can manage all clubs, users, and system settings.
              </p>
            </div>
            <div>
              <h4 className={`font-medium mb-2 ${darkMode ? "text-blue-400" : "text-blue-600"}`}>
                Club Admin
              </h4>
              <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                Can manage their club's settings, courts, members, and requests.
              </p>
            </div>
            <div>
              <h4 className={`font-medium mb-2 ${darkMode ? "text-green-400" : "text-green-600"}`}>
                Member
              </h4>
              <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                Regular user. Can book courts and participate in club activities.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
