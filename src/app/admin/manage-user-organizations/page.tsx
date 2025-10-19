"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth, db } from "../../../../firebase";
import {
  collection,
  query,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  orderBy
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import DarkModeToggle from "@/app/components/DarkModeToggle";
import PageTitle from "@/app/components/PageTitle";

interface User {
  id: string;
  email: string;
  name?: string;
  userType: string;
  organization?: string | string[];
}

interface Club {
  id: string;
  name: string;
  city: string;
  state: string;
}

export default function ManageUserOrganizationsPage() {
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userOrganizations, setUserOrganizations] = useState<string[]>([]);
  const [availableClubs, setAvailableClubs] = useState<Club[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [processing, setProcessing] = useState(false);

  // Initialize dark mode
  useEffect(() => {
    const savedMode = localStorage.getItem("darkMode");
    if (savedMode === "true") {
      setDarkMode(true);
    }
  }, []);

  // Check authorization
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/signin");
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));

        if (userDoc.exists()) {
          const userData = userDoc.data();

          if (userData.userType === "courtly") {
            setIsAuthorized(true);
            await fetchData();
          } else {
            setIsAuthorized(false);
            setError("You don't have permission to access this page");
            router.push("/dashboard");
          }
        } else {
          setIsAuthorized(false);
          router.push("/signin");
        }
      } catch (err) {
        console.error("Error checking authorization:", err);
        setError("Failed to verify permissions");
        setIsAuthorized(false);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Fetch users and clubs
  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch all users
      const usersQuery = query(collection(db, "users"), orderBy("email"));
      const usersSnapshot = await getDocs(usersQuery);
      const usersData: User[] = [];

      usersSnapshot.forEach((doc) => {
        const data = doc.data();
        usersData.push({
          id: doc.id,
          email: data.email || "No email",
          name: data.name || data.displayName,
          userType: data.userType || "member",
          organization: data.organization
        });
      });

      setUsers(usersData);
      setFilteredUsers(usersData);

      // Fetch all clubs
      const clubsQuery = query(
        collection(db, "orgs"),
        orderBy("name")
      );
      const clubsSnapshot = await getDocs(clubsQuery);
      const clubsData: Club[] = [];

      clubsSnapshot.forEach((doc) => {
        const data = doc.data();
        clubsData.push({
          id: doc.id,
          name: data.name,
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

  // Search users
  useEffect(() => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const filtered = users.filter(
        (user) =>
          user.email.toLowerCase().includes(term) ||
          user.name?.toLowerCase().includes(term)
      );
      setFilteredUsers(filtered);
    } else {
      setFilteredUsers(users);
    }
  }, [searchTerm, users]);

  // Select user to manage
  const selectUser = (user: User) => {
    setSelectedUser(user);
    setError("");
    setSuccess("");

    // Convert organization to array
    let orgs: string[] = [];
    if (user.organization) {
      if (Array.isArray(user.organization)) {
        orgs = user.organization;
      } else if (typeof user.organization === "string") {
        orgs = [user.organization];
      }
    }
    setUserOrganizations(orgs);

    // Set available clubs (not already in user's organizations)
    const available = clubs.filter((club) => !orgs.includes(club.id));
    setAvailableClubs(available);
  };

  // Add organization to user
  const addOrganization = async (clubId: string) => {
    if (!selectedUser) return;

    setProcessing(true);
    setError("");
    setSuccess("");

    try {
      const newOrgs = [...userOrganizations, clubId];

      await updateDoc(doc(db, "users", selectedUser.id), {
        organization: newOrgs
      });

      setSuccess(`Added organization successfully!`);
      
      // Update local state
      setUserOrganizations(newOrgs);
      const available = clubs.filter((club) => !newOrgs.includes(club.id));
      setAvailableClubs(available);

      // Refresh users list
      await fetchData();
      
      // Re-select user to update the view
      const updatedUser = users.find(u => u.id === selectedUser.id);
      if (updatedUser) {
        selectUser({ ...updatedUser, organization: newOrgs });
      }
    } catch (error) {
      console.error("Error adding organization:", error);
      setError("Failed to add organization");
    } finally {
      setProcessing(false);
    }
  };

  // Remove organization from user
  const removeOrganization = async (clubId: string) => {
    if (!selectedUser) return;

    if (!confirm("Are you sure you want to remove this organization from the user?")) {
      return;
    }

    setProcessing(true);
    setError("");
    setSuccess("");

    try {
      const newOrgs = userOrganizations.filter((id) => id !== clubId);

      // Update user document
      await updateDoc(doc(db, "users", selectedUser.id), {
        organization: newOrgs.length > 0 ? newOrgs : null
      });

      setSuccess(`Removed organization successfully!`);
      
      // Update local state
      setUserOrganizations(newOrgs);
      const available = clubs.filter((club) => !newOrgs.includes(club.id));
      setAvailableClubs(available);

      // Refresh users list
      await fetchData();
      
      // Re-select user to update the view
      const updatedUser = users.find(u => u.id === selectedUser.id);
      if (updatedUser) {
        selectUser({ ...updatedUser, organization: newOrgs.length > 0 ? newOrgs : undefined });
      }
    } catch (error) {
      console.error("Error removing organization:", error);
      setError("Failed to remove organization");
    } finally {
      setProcessing(false);
    }
  };

  // Get club name by ID
  const getClubName = (clubId: string) => {
    const club = clubs.find((c) => c.id === clubId);
    return club ? `${club.name} (${club.city}, ${club.state})` : clubId;
  };

  // Back to user list
  const backToList = () => {
    setSelectedUser(null);
    setUserOrganizations([]);
    setAvailableClubs([]);
    setError("");
    setSuccess("");
  };

  if (loading) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${
          darkMode ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"
        }`}
      >
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${
          darkMode ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"
        }`}
      >
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="mb-4">{error || "You don't have permission to access this page"}</p>
          <Link
            href="/dashboard"
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        darkMode ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"
      }`}
    >
      <PageTitle title="Manage User Organizations - Courtly Admin" />

      {/* Header */}
      <header
        className={`py-4 px-4 shadow-md ${
          darkMode ? "bg-gray-800" : "bg-white"
        }`}
      >
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className={`px-4 py-2 rounded-lg transition ${
                darkMode
                  ? "bg-gray-700 hover:bg-gray-600"
                  : "bg-gray-200 hover:bg-gray-300"
              }`}
            >
              ← Back
            </Link>
            <h1 className="text-2xl font-bold">Manage User Organizations</h1>
          </div>
          <DarkModeToggle darkMode={darkMode} setDarkMode={setDarkMode} />
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Error/Success Messages */}
        {error && (
          <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-100 text-green-700 rounded-lg">
            {success}
          </div>
        )}

        {!selectedUser ? (
          // User List View
          <div
            className={`p-6 rounded-lg shadow-md ${
              darkMode ? "bg-gray-800" : "bg-white"
            }`}
          >
            <div className="mb-6">
              <h2 className="text-xl font-bold mb-4">Select a User</h2>
              <input
                type="text"
                placeholder="Search by email or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full px-4 py-2 rounded-lg border ${
                  darkMode
                    ? "bg-gray-700 border-gray-600 text-white"
                    : "bg-white border-gray-300"
                }`}
              />
            </div>

            <div className="space-y-2">
              {filteredUsers.map((user) => {
                const orgCount = user.organization
                  ? Array.isArray(user.organization)
                    ? user.organization.length
                    : 1
                  : 0;

                return (
                  <div
                    key={user.id}
                    onClick={() => selectUser(user)}
                    className={`p-4 rounded-lg cursor-pointer transition ${
                      darkMode
                        ? "bg-gray-700 hover:bg-gray-600"
                        : "bg-gray-100 hover:bg-gray-200"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-semibold">{user.email}</p>
                        {user.name && (
                          <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                            {user.name}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                            user.userType === "courtly"
                              ? "bg-purple-100 text-purple-800"
                              : user.userType === "admin"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {user.userType}
                        </span>
                        <p className={`text-sm mt-1 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                          {orgCount} {orgCount === 1 ? "organization" : "organizations"}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredUsers.length === 0 && (
                <p className={`text-center py-8 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                  No users found
                </p>
              )}
            </div>
          </div>
        ) : (
          // User Detail View
          <div>
            <button
              onClick={backToList}
              className={`mb-4 px-4 py-2 rounded-lg transition ${
                darkMode
                  ? "bg-gray-700 hover:bg-gray-600"
                  : "bg-gray-200 hover:bg-gray-300"
              }`}
            >
              ← Back to Users
            </button>

            {/* User Info */}
            <div
              className={`p-6 rounded-lg shadow-md mb-6 ${
                darkMode ? "bg-gray-800" : "bg-white"
              }`}
            >
              <h2 className="text-xl font-bold mb-4">User Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                    Email
                  </p>
                  <p className="font-semibold">{selectedUser.email}</p>
                </div>
                {selectedUser.name && (
                  <div>
                    <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                      Name
                    </p>
                    <p className="font-semibold">{selectedUser.name}</p>
                  </div>
                )}
                <div>
                  <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                    User Type
                  </p>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                      selectedUser.userType === "courtly"
                        ? "bg-purple-100 text-purple-800"
                        : selectedUser.userType === "admin"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {selectedUser.userType}
                  </span>
                </div>
              </div>
            </div>

            {/* Current Organizations */}
            <div
              className={`p-6 rounded-lg shadow-md mb-6 ${
                darkMode ? "bg-gray-800" : "bg-white"
              }`}
            >
              <h2 className="text-xl font-bold mb-4">Current Organizations</h2>
              
              {userOrganizations.length > 0 ? (
                <div className="space-y-2">
                  {userOrganizations.map((clubId) => (
                    <div
                      key={clubId}
                      className={`p-4 rounded-lg flex justify-between items-center ${
                        darkMode ? "bg-gray-700" : "bg-gray-100"
                      }`}
                    >
                      <span className="font-semibold">{getClubName(clubId)}</span>
                      <button
                        onClick={() => removeOrganization(clubId)}
                        disabled={processing}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={darkMode ? "text-gray-400" : "text-gray-600"}>
                  This user is not associated with any organizations
                </p>
              )}
            </div>

            {/* Add Organization */}
            <div
              className={`p-6 rounded-lg shadow-md ${
                darkMode ? "bg-gray-800" : "bg-white"
              }`}
            >
              <h2 className="text-xl font-bold mb-4">Add Organization</h2>
              
              {availableClubs.length > 0 ? (
                <div className="space-y-2">
                  {availableClubs.map((club) => (
                    <div
                      key={club.id}
                      className={`p-4 rounded-lg flex justify-between items-center ${
                        darkMode ? "bg-gray-700" : "bg-gray-100"
                      }`}
                    >
                      <div>
                        <p className="font-semibold">{club.name}</p>
                        <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                          {club.city}, {club.state}
                        </p>
                      </div>
                      <button
                        onClick={() => addOrganization(club.id)}
                        disabled={processing}
                        className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={darkMode ? "text-gray-400" : "text-gray-600"}>
                  This user is already associated with all available organizations
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
