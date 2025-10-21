"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth, db } from "../../../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import DarkModeToggle from "@/app/components/DarkModeToggle";
import PageTitle from "@/app/components/PageTitle";

interface ClubData {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  description?: string;
  membershipEnabled?: boolean;
}

interface UserMembership {
  tier: string;
  status: string;
  endDate?: any;
}

export default function YourClubsPage() {
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [clubs, setClubs] = useState<ClubData[]>([]);
  const [memberships, setMemberships] = useState<Record<string, UserMembership>>({});
  const router = useRouter();

  // Initialize dark mode from localStorage
  useEffect(() => {
    const savedMode = localStorage.getItem("darkMode");
    if (savedMode === "true") {
      setDarkMode(true);
    }
  }, []);

  // Check if user is authenticated and fetch their clubs
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // Fetch user document to get organization array
          const userDocRef = doc(db, "users", user.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const userData = userDoc.data();
            const orgIds = userData.organization;

            if (orgIds && orgIds.length > 0) {
              const orgArray = Array.isArray(orgIds) ? orgIds : [orgIds];
              await fetchUserClubs(orgArray, user.uid);
            }
          }
        } catch (error) {
          console.error("Error fetching user clubs:", error);
        } finally {
          setLoading(false);
        }
      } else {
        // User is not signed in, redirect to login
        router.push("/signin");
      }
    });

    return () => unsubscribe();
  }, [router]);

  const fetchUserClubs = async (orgIds: string[], userId: string) => {
    try {
      const clubsData: ClubData[] = [];
      const membershipData: Record<string, UserMembership> = {};

      for (const orgId of orgIds) {
        // Fetch club/org document
        const orgRef = doc(db, "orgs", orgId);
        const orgDoc = await getDoc(orgRef);

        if (orgDoc.exists()) {
          const orgData = orgDoc.data();
          clubsData.push({
            id: orgId,
            name: orgData.name || "Unnamed Club",
            address: orgData.address,
            city: orgData.city,
            state: orgData.state,
            description: orgData.description,
            membershipEnabled: orgData.membershipEnabled,
          });

          // Fetch user's membership for this club if any
          const membershipRef = doc(db, "orgs", orgId, "memberships", userId);
          const membershipDoc = await getDoc(membershipRef);

          if (membershipDoc.exists()) {
            membershipData[orgId] = membershipDoc.data() as UserMembership;
          }
        }
      }

      setClubs(clubsData);
      setMemberships(membershipData);
    } catch (error) {
      console.error("Error fetching clubs:", error);
    }
  };

  const getMembershipBadge = (clubId: string) => {
    const membership = memberships[clubId];
    if (!membership) return null;

    const isActive = membership.status === "active";

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          isActive
            ? darkMode
              ? "bg-green-900/30 text-green-400"
              : "bg-green-100 text-green-800"
            : darkMode
            ? "bg-gray-700 text-gray-300"
            : "bg-gray-100 text-gray-600"
        }`}
      >
        {isActive ? "Active Member" : "Expired"}
        {membership.tier && ` • ${membership.tier}`}
      </span>
    );
  };

  if (loading) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${
          darkMode ? "bg-[#0a0a0a] text-white" : "bg-white text-gray-900"
        }`}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-current mx-auto mb-4"></div>
          <p className="font-light">Loading your clubs...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen ${
        darkMode ? "bg-[#0a0a0a] text-white" : "bg-white text-gray-900"
      }`}
    >
      {/* Header */}
      <header
        className={`sticky top-0 z-10 border-b ${
          darkMode ? "border-[#1a1a1a] bg-[#0a0a0a]" : "border-gray-200 bg-white"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link
            href="/"
            className={`text-xl font-light tracking-wider ${
              darkMode ? "text-white" : "text-black"
            }`}
          >
            COURTLY
          </Link>
          <DarkModeToggle darkMode={darkMode} setDarkMode={setDarkMode} />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back button */}
        <Link
          href="/dashboard"
          className={`inline-flex items-center mb-6 text-sm transition-colors ${
            darkMode
              ? "text-gray-400 hover:text-white"
              : "text-gray-600 hover:text-black"
          }`}
        >
          <svg
            className="w-4 h-4 mr-2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M15 19l-7-7 7-7"></path>
          </svg>
          Back to Dashboard
        </Link>

        {/* Title */}
        <PageTitle title="Your Clubs" />

        {/* Empty State */}
        {clubs.length === 0 ? (
          <div
            className={`text-center py-16 border rounded-lg ${
              darkMode ? "border-[#1a1a1a]" : "border-gray-200"
            }`}
          >
            <svg
              className={`w-16 h-16 mx-auto mb-4 ${
                darkMode ? "text-gray-700" : "text-gray-300"
              }`}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <h3
              className={`text-xl font-light mb-2 ${
                darkMode ? "text-gray-400" : "text-gray-600"
              }`}
            >
              No Clubs Yet
            </h3>
            <p
              className={`text-sm mb-6 ${
                darkMode ? "text-gray-500" : "text-gray-500"
              }`}
            >
              You haven't joined any clubs yet. Browse available clubs or register your own.
            </p>
            <div className="flex gap-4 justify-center">
              <Link
                href="/browse-clubs"
                className={`px-6 py-3 text-sm uppercase tracking-wider font-light transition ${
                  darkMode
                    ? "border border-white text-white hover:bg-white hover:text-black"
                    : "border border-black text-black hover:bg-black hover:text-white"
                }`}
              >
                Browse Clubs
              </Link>
              <Link
                href="/register-club"
                className={`px-6 py-3 text-sm uppercase tracking-wider font-light transition ${
                  darkMode
                    ? "bg-white text-black hover:bg-gray-200"
                    : "bg-black text-white hover:bg-gray-800"
                }`}
              >
                Register Club
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Clubs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {clubs.map((club) => (
                <Link
                  key={club.id}
                  href={`/club/${club.id}`}
                  className={`group border rounded-lg p-6 transition-all hover:shadow-lg ${
                    darkMode
                      ? "border-[#1a1a1a] hover:border-white/30 bg-[#0a0a0a]"
                      : "border-gray-200 hover:border-gray-400 bg-white"
                  }`}
                >
                  {/* Club Icon */}
                  <div
                    className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${
                      darkMode ? "bg-[#1a1a1a]" : "bg-gray-100"
                    }`}
                  >
                    <svg
                      className={`w-6 h-6 ${
                        darkMode ? "text-gray-400" : "text-gray-600"
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                      />
                    </svg>
                  </div>

                  {/* Club Name */}
                  <h3
                    className={`text-xl font-light mb-2 group-hover:${
                      darkMode ? "text-white" : "text-black"
                    }`}
                  >
                    {club.name}
                  </h3>

                  {/* Location */}
                  {(club.city || club.state) && (
                    <p
                      className={`text-sm mb-3 flex items-center gap-1 ${
                        darkMode ? "text-gray-400" : "text-gray-600"
                      }`}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      {club.city}
                      {club.city && club.state && ", "}
                      {club.state}
                    </p>
                  )}

                  {/* Description */}
                  {club.description && (
                    <p
                      className={`text-sm mb-4 line-clamp-2 ${
                        darkMode ? "text-gray-500" : "text-gray-500"
                      }`}
                    >
                      {club.description}
                    </p>
                  )}

                  {/* Membership Badge */}
                  <div className="mt-4">{getMembershipBadge(club.id)}</div>

                  {/* Arrow Icon */}
                  <div className="mt-4 flex items-center text-sm font-medium">
                    <span
                      className={`${
                        darkMode ? "text-gray-400" : "text-gray-600"
                      } group-hover:${darkMode ? "text-white" : "text-black"}`}
                    >
                      View Club
                    </span>
                    <svg
                      className={`w-4 h-4 ml-2 transition-transform group-hover:translate-x-1 ${
                        darkMode ? "text-gray-400" : "text-gray-600"
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/browse-clubs"
                className={`px-6 py-3 text-sm uppercase tracking-wider font-light text-center transition ${
                  darkMode
                    ? "border border-white text-white hover:bg-white hover:text-black"
                    : "border border-black text-black hover:bg-black hover:text-white"
                }`}
              >
                Browse More Clubs
              </Link>
              <Link
                href="/register-club"
                className={`px-6 py-3 text-sm uppercase tracking-wider font-light text-center transition ${
                  darkMode
                    ? "border border-white text-white hover:bg-white hover:text-black"
                    : "border border-black text-black hover:bg-black hover:text-white"
                }`}
              >
                Register New Club
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
