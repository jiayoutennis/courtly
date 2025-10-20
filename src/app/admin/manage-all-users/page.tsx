"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth, db } from "../../../../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc,
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy,
  serverTimestamp
} from "firebase/firestore";
import PageTitle from "@/app/components/PageTitle";

interface User {
  id: string;
  email: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  userType: 'admin' | 'member' | 'courtly';
  organization?: string | string[];
  isActive?: boolean;
  createdAt?: string;
  phone?: string;
}

interface Club {
  id: string;
  name: string;
  city: string;
  state: string;
}

type TabType = "users" | "organizations";

export default function ManageAllUsersPage() {
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("users");
  const [users, setUsers] = useState<User[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<'all' | 'admin' | 'member' | 'courtly'>('all');
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // Organization management state
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userOrganizations, setUserOrganizations] = useState<string[]>([]);
  const [showOrgModal, setShowOrgModal] = useState(false);
  
  const router = useRouter();

  useEffect(() => {
    const savedMode = localStorage.getItem("darkMode");
    if (savedMode === "true") {
      setDarkMode(true);
    }
  }, []);

  // Check authorization
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/signin");
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        
        if (userDoc.exists() && userDoc.data().userType === 'courtly') {
          await fetchData();
        } else {
          setError("Access denied. Only Courtly admins can access this page.");
          setTimeout(() => router.push('/dashboard'), 2000);
        }
      } catch (error) {
        console.error("Error checking authorization:", error);
        setError("Failed to verify permissions");
      }
    });

    return () => unsubscribe();
  }, [router]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch users
      const usersQuery = query(collection(db, "users"), orderBy("email"));
      const usersSnapshot = await getDocs(usersQuery);
      const usersData: User[] = [];
      
      usersSnapshot.forEach((doc) => {
        const data = doc.data();
        usersData.push({
          id: doc.id,
          email: data.email || "",
          fullName: data.fullName || data.name || "",
          firstName: data.firstName,
          lastName: data.lastName,
          userType: data.userType || 'member',
          organization: data.organization,
          isActive: data.isActive !== false,
          createdAt: data.createdAt,
          phone: data.phone
        });
      });
      
      setUsers(usersData);
      setFilteredUsers(usersData);

      // Fetch clubs
      const clubsSnapshot = await getDocs(collection(db, "orgs"));
      const clubsData: Club[] = [];
      
      clubsSnapshot.forEach((doc) => {
        const data = doc.data();
        clubsData.push({
          id: doc.id,
          name: data.name || "Unknown Club",
          city: data.city || "",
          state: data.state || ""
        });
      });
      
      setClubs(clubsData);
    } catch (error) {
      console.error("Error fetching data:", error);
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  // Filter users
  useEffect(() => {
    let filtered = users;
    
    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(user => user.userType === filterType);
    }
    
    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.fullName && user.fullName.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    
    setFilteredUsers(filtered);
  }, [users, filterType, searchTerm]);

  const handleChangeUserType = async (userId: string, newType: 'admin' | 'member' | 'courtly') => {
    if (!confirm(`Are you sure you want to change this user's type to ${newType}?`)) {
      return;
    }

    setProcessingId(userId);
    setError("");
    setSuccess("");

    try {
      await updateDoc(doc(db, "users", userId), {
        userType: newType,
        updatedAt: serverTimestamp()
      });

      setSuccess(`User type updated to ${newType}`);
      setUsers(prev => prev.map(user => 
        user.id === userId ? { ...user, userType: newType } : user
      ));
      
      setTimeout(() => setSuccess(""), 3000);
    } catch (error) {
      console.error("Error updating user type:", error);
      setError("Failed to update user type");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Are you sure you want to delete ${userEmail}? This action cannot be undone.`)) {
      return;
    }

    setProcessingId(userId);
    setError("");
    setSuccess("");

    try {
      await deleteDoc(doc(db, "users", userId));

      setSuccess(`User ${userEmail} deleted successfully`);
      setUsers(prev => prev.filter(user => user.id !== userId));
      
      setTimeout(() => setSuccess(""), 3000);
    } catch (error) {
      console.error("Error deleting user:", error);
      setError("Failed to delete user");
    } finally {
      setProcessingId(null);
    }
  };

  const openOrgModal = (user: User) => {
    setSelectedUser(user);
    
    // Parse current organizations
    const currentOrgs = user.organization;
    if (Array.isArray(currentOrgs)) {
      setUserOrganizations(currentOrgs);
    } else if (typeof currentOrgs === 'string' && currentOrgs) {
      setUserOrganizations([currentOrgs]);
    } else {
      setUserOrganizations([]);
    }
    
    setShowOrgModal(true);
  };

  const handleToggleOrganization = (clubId: string) => {
    setUserOrganizations(prev => 
      prev.includes(clubId) 
        ? prev.filter(id => id !== clubId)
        : [...prev, clubId]
    );
  };

  const handleSaveOrganizations = async () => {
    if (!selectedUser) return;

    setProcessingId(selectedUser.id);
    setError("");
    setSuccess("");

    try {
      await updateDoc(doc(db, "users", selectedUser.id), {
        organization: userOrganizations,
        updatedAt: serverTimestamp()
      });

      setSuccess(`Organizations updated for ${selectedUser.email}`);
      setUsers(prev => prev.map(user => 
        user.id === selectedUser.id 
          ? { ...user, organization: userOrganizations }
          : user
      ));
      
      setShowOrgModal(false);
      setSelectedUser(null);
      setTimeout(() => setSuccess(""), 3000);
    } catch (error) {
      console.error("Error updating organizations:", error);
      setError("Failed to update organizations");
    } finally {
      setProcessingId(null);
    }
  };

  const getOrganizationNames = (orgData: string | string[] | undefined) => {
    if (!orgData) return "None";
    
    const orgIds = Array.isArray(orgData) ? orgData : [orgData];
    const orgNames = orgIds
      .map(id => clubs.find(club => club.id === id)?.name || id)
      .join(", ");
    
    return orgNames || "None";
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        darkMode ? "bg-[#0a0a0a] text-white" : "bg-white text-black"
      }`}>
        <div className="text-xs uppercase tracking-wider font-light">Loading...</div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      darkMode ? "bg-[#0a0a0a] text-white" : "bg-white text-black"
    }`}>
      <PageTitle title="Manage All Users - Courtly" />
      
      <header className={`py-4 sm:py-6 px-4 border-b ${
        darkMode ? "border-[#1a1a1a]" : "border-gray-100"
      }`}>
        <div className="container mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
            <h1 className="text-[10px] sm:text-xs uppercase tracking-wider font-light">Manage All Users</h1>
            <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
              <Link
                href="/dashboard"
                className={`flex-1 sm:flex-initial text-center px-3 sm:px-4 py-2 sm:py-3 text-[10px] sm:text-xs uppercase tracking-wider font-light transition ${
                  darkMode
                    ? "border border-white text-white hover:bg-white hover:text-black"
                    : "border border-black text-black hover:bg-black hover:text-white"
                }`}
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 sm:py-8">
        {/* Success/Error Messages */}
        {success && (
          <div className={`mb-4 sm:mb-6 px-3 sm:px-4 py-2 sm:py-3 text-[10px] sm:text-xs uppercase tracking-wider font-light border ${
            darkMode ? "border-white/20 bg-white/5" : "border-black/20 bg-black/5"
          }`}>
            {success}
          </div>
        )}
        {error && (
          <div className={`mb-4 sm:mb-6 px-3 sm:px-4 py-2 sm:py-3 text-[10px] sm:text-xs uppercase tracking-wider font-light border ${
            darkMode ? "border-white/20 bg-white/5" : "border-black/20 bg-black/5"
          }`}>
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="mb-4 sm:mb-6 flex gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab("users")}
            className={`px-4 sm:px-6 py-2 sm:py-3 text-[10px] sm:text-xs uppercase tracking-wider font-light transition whitespace-nowrap ${
              activeTab === "users"
                ? darkMode
                  ? "border border-white text-white bg-white/5"
                  : "border border-black text-black bg-black/5"
                : darkMode
                  ? "border border-white/30 text-white hover:bg-white/5"
                  : "border border-black/30 text-black hover:bg-black/5"
            }`}
          >
            All Users ({users.length})
          </button>
          <button
            onClick={() => setActiveTab("organizations")}
            className={`px-6 py-3 text-xs uppercase tracking-wider font-light transition ${
              activeTab === "organizations"
                ? darkMode
                  ? "border border-white text-white bg-white/5"
                  : "border border-black text-black bg-black/5"
                : darkMode
                  ? "border border-white/30 text-white hover:bg-white/5"
                  : "border border-black/30 text-black hover:bg-black/5"
            }`}
          >
            User Organizations
          </button>
        </div>

        {/* Users Tab */}
        {activeTab === "users" && (
          <div>
            {/* Filters */}
            <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row gap-3 sm:gap-4">
              <input
                type="text"
                placeholder="Search by email or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`flex-1 px-3 sm:px-4 py-2 sm:py-3 text-[10px] sm:text-xs font-light focus:outline-none ${
                  darkMode
                    ? "bg-[#0a0a0a] border border-[#1a1a1a] text-white placeholder-gray-600"
                    : "bg-white border border-gray-100 text-black placeholder-gray-400"
                }`}
              />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className={`px-3 sm:px-4 py-2 sm:py-3 text-[10px] sm:text-xs font-light focus:outline-none ${
                  darkMode
                    ? "bg-[#0a0a0a] border border-[#1a1a1a] text-white"
                    : "bg-white border border-gray-100 text-black"
                }`}
              >
                <option value="all">All Users</option>
                <option value="member">Members</option>
                <option value="admin">Club Admins</option>
                <option value="courtly">Courtly Admins</option>
              </select>
            </div>

            {/* Users Table */}
            {filteredUsers.length > 0 ? (
              <div className={`border overflow-hidden ${
                darkMode ? "border-[#1a1a1a]" : "border-gray-100"
              }`}>
                <div className="overflow-x-auto">
                  <table className="w-full table-auto">
                    <thead className={`border-b ${darkMode ? "border-[#1a1a1a]" : "border-gray-100"}`}>
                      <tr>
                        <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs uppercase tracking-wider font-light whitespace-nowrap">
                          Email
                        </th>
                        <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs uppercase tracking-wider font-light whitespace-nowrap">
                          Name
                        </th>
                        <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs uppercase tracking-wider font-light whitespace-nowrap">
                          Role
                        </th>
                        <th className="hidden lg:table-cell px-3 sm:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs uppercase tracking-wider font-light whitespace-nowrap">
                          Organizations
                        </th>
                        <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs uppercase tracking-wider font-light whitespace-nowrap">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className={`${darkMode ? "divide-y divide-[#1a1a1a]" : "divide-y divide-gray-100"}`}>
                      {filteredUsers.map((user) => (
                        <tr key={user.id}>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-[10px] sm:text-xs font-light">
                            {user.email}
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-[10px] sm:text-xs font-light">
                            {user.fullName || "-"}
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 border text-[10px] sm:text-xs uppercase tracking-wider font-light ${
                              darkMode ? "border-white/20" : "border-black/20"
                            }`}>
                              {user.userType}
                            </span>
                          </td>
                          <td className="hidden lg:table-cell px-3 sm:px-6 py-3 sm:py-4 text-[10px] sm:text-xs font-light max-w-xs truncate">
                            {getOrganizationNames(user.organization)}
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-[10px] sm:text-xs">
                            <div className="flex flex-col sm:flex-row gap-2">
                              <button
                                onClick={() => openOrgModal(user)}
                                disabled={processingId === user.id}
                                className={`px-2 sm:px-3 py-2 text-[10px] sm:text-xs uppercase tracking-wider font-light transition whitespace-nowrap ${
                                  processingId === user.id
                                    ? darkMode
                                      ? "border border-gray-600 text-gray-600 cursor-not-allowed"
                                      : "border border-gray-400 text-gray-400 cursor-not-allowed"
                                    : darkMode
                                      ? "border border-white text-white hover:bg-white hover:text-black"
                                      : "border border-black text-black hover:bg-black hover:text-white"
                                }`}
                              >
                                Edit Orgs
                              </button>
                              
                              {user.userType !== 'courtly' && (
                                <>
                                  {user.userType === 'member' && (
                                    <button
                                      onClick={() => handleChangeUserType(user.id, 'admin')}
                                      disabled={processingId === user.id}
                                      className={`px-2 sm:px-3 py-2 text-[10px] sm:text-xs uppercase tracking-wider font-light transition whitespace-nowrap ${
                                        processingId === user.id
                                          ? darkMode
                                            ? "border border-gray-600 text-gray-600 cursor-not-allowed"
                                            : "border border-gray-400 text-gray-400 cursor-not-allowed"
                                          : darkMode
                                            ? "border border-white text-white hover:bg-white hover:text-black"
                                            : "border border-black text-black hover:bg-black hover:text-white"
                                      }`}
                                    >
                                      Make Admin
                                    </button>
                                  )}
                                  {user.userType === 'admin' && (
                                    <button
                                      onClick={() => handleChangeUserType(user.id, 'member')}
                                      disabled={processingId === user.id}
                                      className={`px-2 sm:px-3 py-2 text-[10px] sm:text-xs uppercase tracking-wider font-light transition whitespace-nowrap ${
                                        processingId === user.id
                                          ? darkMode
                                            ? "border border-gray-600 text-gray-600 cursor-not-allowed"
                                            : "border border-gray-400 text-gray-400 cursor-not-allowed"
                                          : darkMode
                                            ? "border border-white/50 text-white hover:bg-white hover:text-black"
                                            : "border border-black/50 text-black hover:bg-black hover:text-white"
                                      }`}
                                    >
                                      Demote
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDeleteUser(user.id, user.email)}
                                    disabled={processingId === user.id}
                                    className={`px-2 sm:px-3 py-2 text-[10px] sm:text-xs uppercase tracking-wider font-light transition whitespace-nowrap ${
                                      processingId === user.id
                                        ? darkMode
                                          ? "border border-gray-600 text-gray-600 cursor-not-allowed"
                                          : "border border-gray-400 text-gray-400 cursor-not-allowed"
                                        : darkMode
                                          ? "border border-white/30 text-white hover:bg-white hover:text-black"
                                          : "border border-black/30 text-black hover:bg-black hover:text-white"
                                    } text-white`}
                                  >
                                    Delete
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className={`p-6 sm:p-8 border text-center ${
                darkMode ? "border-[#1a1a1a]" : "border-gray-100"
              }`}>
                <p className={`text-[10px] sm:text-xs uppercase tracking-wider font-light ${darkMode ? "text-gray-500" : "text-gray-500"}`}>
                  No users found.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Organizations Tab */}
        {activeTab === "organizations" && (
          <div>
            <div className="mb-4 sm:mb-6">
              <input
                type="text"
                placeholder="Search by email or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full px-3 sm:px-4 py-2 sm:py-3 text-[10px] sm:text-xs font-light focus:outline-none ${
                  darkMode
                    ? "bg-[#0a0a0a] border border-[#1a1a1a] text-white placeholder-gray-600"
                    : "bg-white border border-gray-100 text-black placeholder-gray-400"
                }`}
              />
            </div>

            {/* Organizations List */}
            {filteredUsers.length > 0 ? (
              <div className={`border overflow-hidden ${
                darkMode ? "border-[#1a1a1a]" : "border-gray-100"
              }`}>
                <div className="overflow-x-auto">
                  <table className="w-full table-auto">
                    <thead className={`border-b ${darkMode ? "border-[#1a1a1a]" : "border-gray-100"}`}>
                      <tr>
                        <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs uppercase tracking-wider font-light whitespace-nowrap">
                          User
                        </th>
                        <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs uppercase tracking-wider font-light whitespace-nowrap">
                          Role
                        </th>
                        <th className="hidden lg:table-cell px-3 sm:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs uppercase tracking-wider font-light whitespace-nowrap">
                          Organizations
                        </th>
                        <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs uppercase tracking-wider font-light whitespace-nowrap">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className={`${darkMode ? "divide-y divide-[#1a1a1a]" : "divide-y divide-gray-100"}`}>
                      {filteredUsers.map((user) => (
                        <tr key={user.id}>
                          <td className="px-3 sm:px-6 py-3 sm:py-4">
                            <div>
                              <div className="text-[10px] sm:text-xs font-light">{user.email}</div>
                              {user.fullName && (
                                <div className={`text-[10px] sm:text-xs font-light ${darkMode ? "text-gray-600" : "text-gray-400"}`}>
                                  {user.fullName}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 border text-[10px] sm:text-xs uppercase tracking-wider font-light ${
                              darkMode ? "border-white/20" : "border-black/20"
                            }`}>
                              {user.userType}
                            </span>
                          </td>
                          <td className="hidden lg:table-cell px-3 sm:px-6 py-3 sm:py-4">
                            <div className="flex flex-wrap gap-1">
                              {(() => {
                                const orgData = user.organization;
                                const orgIds = Array.isArray(orgData) ? orgData : orgData ? [orgData] : [];
                                
                                if (orgIds.length === 0) {
                                  return <span className={`text-[10px] sm:text-xs font-light ${darkMode ? "text-gray-600" : "text-gray-400"}`}>None</span>;
                                }
                                
                                return orgIds.map(orgId => {
                                  const club = clubs.find(c => c.id === orgId);
                                  return (
                                    <span
                                      key={orgId}
                                      className={`px-2 py-1 border text-[10px] sm:text-xs font-light ${
                                        darkMode ? "border-white/20 text-gray-300" : "border-black/20 text-gray-600"
                                      }`}
                                    >
                                      {club?.name || orgId}
                                    </span>
                                  );
                                });
                              })()}
                            </div>
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                            <button
                              onClick={() => openOrgModal(user)}
                              disabled={processingId === user.id}
                              className={`px-3 sm:px-4 py-2 sm:py-3 text-[10px] sm:text-xs uppercase tracking-wider font-light transition whitespace-nowrap ${
                                processingId === user.id
                                  ? darkMode
                                    ? "border border-gray-600 text-gray-600 cursor-not-allowed"
                                    : "border border-gray-400 text-gray-400 cursor-not-allowed"
                                  : darkMode
                                    ? "border border-white text-white hover:bg-white hover:text-black"
                                    : "border border-black text-black hover:bg-black hover:text-white"
                              }`}
                            >
                              Manage Organizations
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className={`p-6 sm:p-8 border text-center ${
                darkMode ? "border-[#1a1a1a]" : "border-gray-100"
              }`}>
                <p className={`text-[10px] sm:text-xs uppercase tracking-wider font-light ${darkMode ? "text-gray-500" : "text-gray-500"}`}>
                  No users found.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Organization Modal */}
      {showOrgModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`border max-w-sm sm:max-w-md md:max-w-2xl w-full max-h-[80vh] overflow-y-auto ${
            darkMode ? "bg-[#0a0a0a] border-[#1a1a1a]" : "bg-white border-gray-100"
          }`}>
            <div className={`sticky top-0 p-4 sm:p-6 border-b ${
              darkMode ? "bg-[#0a0a0a] border-[#1a1a1a]" : "bg-white border-gray-100"
            }`}>
              <h2 className="text-[10px] sm:text-xs uppercase tracking-wider font-light">Manage Organizations</h2>
              <p className={`mt-2 text-[10px] sm:text-xs font-light ${darkMode ? "text-gray-500" : "text-gray-500"}`}>
                {selectedUser.email}
              </p>
            </div>

            <div className="p-4 sm:p-6">
              <div className="space-y-2 sm:space-y-3">
                {clubs.map((club) => (
                  <label
                    key={club.id}
                    className={`flex items-center p-3 sm:p-4 border cursor-pointer transition ${
                      userOrganizations.includes(club.id)
                        ? darkMode
                          ? "border-white"
                          : "border-black"
                        : darkMode
                          ? "border-[#1a1a1a] hover:border-white/50"
                          : "border-gray-100 hover:border-black/50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={userOrganizations.includes(club.id)}
                      onChange={() => handleToggleOrganization(club.id)}
                      className={`mr-3 h-4 w-4 sm:h-5 sm:w-5 border ${
                        darkMode ? "border-white" : "border-black"
                      }`}
                    />
                    <div className="flex-1">
                      <div className="text-[10px] sm:text-xs font-light">{club.name}</div>
                      <div className={`text-[10px] sm:text-xs font-light ${darkMode ? "text-gray-500" : "text-gray-500"}`}>
                        {club.city}, {club.state}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className={`sticky bottom-0 p-4 sm:p-6 border-t flex flex-col sm:flex-row gap-3 sm:gap-4 ${
              darkMode ? "bg-[#0a0a0a] border-[#1a1a1a]" : "bg-white border-gray-100"
            }`}>
              <button
                onClick={handleSaveOrganizations}
                disabled={processingId === selectedUser.id}
                className={`flex-1 px-3 sm:px-4 py-2 sm:py-3 text-[10px] sm:text-xs uppercase tracking-wider font-light border transition ${
                  processingId === selectedUser.id
                    ? darkMode
                      ? "border-gray-600 text-gray-600 cursor-not-allowed"
                      : "border-gray-400 text-gray-400 cursor-not-allowed"
                    : darkMode
                      ? "border-white text-white hover:bg-white hover:text-black"
                      : "border-black text-black hover:bg-black hover:text-white"
                }`}
              >
                {processingId === selectedUser.id ? "Saving..." : "Save Changes"}
              </button>
              <button
                onClick={() => {
                  setShowOrgModal(false);
                  setSelectedUser(null);
                }}
                className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 sm:py-3 text-[10px] sm:text-xs uppercase tracking-wider font-light border transition ${
                  darkMode
                    ? "border-white text-white hover:bg-white hover:text-black"
                    : "border-black text-black hover:bg-black hover:text-white"
                }`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
