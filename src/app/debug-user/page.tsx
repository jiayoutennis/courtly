"use client";

import { useState, useEffect } from "react";
import { auth, db } from "../../../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import Link from "next/link";

export default function DebugUserPage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setError("You must be signed in to view this page");
        setLoading(false);
        return;
      }

      setUser({
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: currentUser.displayName,
      });

      try {
        const userDocRef = doc(db, "users", currentUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          setUserData(userDoc.data());
        } else {
          setError("User document not found in Firestore");
        }
      } catch (err: any) {
        console.error("Error fetching user data:", err);
        setError("Failed to fetch user data: " + err.message);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const makeCourtlyAdmin = async () => {
    if (!user?.uid) {
      setError("No user logged in");
      return;
    }

    setUpdating(true);
    setError("");
    setSuccess("");

    try {
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        userType: "courtly",
      });

      setSuccess("✅ Successfully updated to Courtly Admin! Refresh the page.");
      
      // Refetch user data
      const updatedDoc = await getDoc(userDocRef);
      if (updatedDoc.exists()) {
        setUserData(updatedDoc.data());
      }
    } catch (err: any) {
      console.error("Error updating user:", err);
      setError("Failed to update user: " + err.message);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-t-transparent border-green-500 rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading user data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">User Debug Page</h1>
            <Link
              href="/dashboard"
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition"
            >
              Back to Dashboard
            </Link>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-100 text-green-700 rounded-lg">
              {success}
            </div>
          )}

          {/* Firebase Auth User */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-3 text-gray-900">
              Firebase Auth User
            </h2>
            <div className="bg-gray-50 p-4 rounded-lg">
              <pre className="text-sm overflow-x-auto text-gray-800">
                {JSON.stringify(user, null, 2)}
              </pre>
            </div>
          </div>

          {/* Firestore User Data */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-3 text-gray-900">
              Firestore User Document
            </h2>
            <div className="bg-gray-50 p-4 rounded-lg">
              <pre className="text-sm overflow-x-auto text-gray-800">
                {userData ? JSON.stringify(userData, null, 2) : "No data"}
              </pre>
            </div>
          </div>

          {/* Current User Type */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-3 text-gray-900">
              Current User Type
            </h2>
            <div className="flex items-center space-x-4">
              <span className="text-lg">
                <strong>userType:</strong>{" "}
                <span
                  className={`px-3 py-1 rounded-full font-medium ${
                    userData?.userType === "courtly"
                      ? "bg-green-100 text-green-800"
                      : userData?.userType === "admin"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {userData?.userType || "undefined"}
                </span>
              </span>
            </div>
          </div>

          {/* Make Courtly Admin Button */}
          {userData?.userType !== "courtly" && (
            <div className="border-t pt-6">
              <h2 className="text-xl font-semibold mb-3 text-gray-900">
                Update User Type
              </h2>
              <p className="mb-4 text-gray-600">
                Click the button below to make yourself a Courtly Admin. This will
                give you full access to all admin features including club requests,
                user management, and more.
              </p>
              <button
                onClick={makeCourtlyAdmin}
                disabled={updating}
                className={`px-6 py-3 rounded-lg font-medium transition ${
                  updating
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-green-500 hover:bg-green-600 text-white"
                }`}
              >
                {updating ? "Updating..." : "Make Me Courtly Admin"}
              </button>
            </div>
          )}

          {userData?.userType === "courtly" && (
            <div className="border-t pt-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center">
                  <svg
                    className="w-6 h-6 text-green-600 mr-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div>
                    <h3 className="font-semibold text-green-900">
                      You are a Courtly Admin!
                    </h3>
                    <p className="text-sm text-green-700">
                      You have full access to all admin features.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Permissions Info */}
          <div className="border-t mt-6 pt-6">
            <h2 className="text-xl font-semibold mb-3 text-gray-900">
              Permission Levels
            </h2>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-start">
                <span className="font-semibold w-24">member:</span>
                <span>Regular club member with basic access</span>
              </div>
              <div className="flex items-start">
                <span className="font-semibold w-24">admin:</span>
                <span>Club administrator with club management permissions</span>
              </div>
              <div className="flex items-start">
                <span className="font-semibold w-24">courtly:</span>
                <span>
                  Platform super admin with full access to all clubs, users, and
                  settings
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
