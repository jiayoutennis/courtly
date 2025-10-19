"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth, db } from "../../../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import DarkModeToggle from "@/app/components/DarkModeToggle";
import PageTitle from "@/app/components/PageTitle";

export default function DiagnosticPage() {
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [clubs, setClubs] = useState<any[]>([]);
  const [coachClubs, setCoachClubs] = useState<string[]>([]);
  const [diagnosticInfo, setDiagnosticInfo] = useState<string>("");

  useEffect(() => {
    const savedDarkMode = localStorage.getItem("darkMode") === "true";
    setDarkMode(savedDarkMode);

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        await fetchUserData(currentUser.uid);
      } else {
        router.push('/signin');
      }
    });

    return () => unsubscribe();
  }, [router]);

  const fetchUserData = async (uid: string) => {
    try {
      setLoading(true);
      let info = "=== USER DIAGNOSTIC INFORMATION ===\n\n";
      
      // Get user document
      const userDoc = await getDoc(doc(db, "users", uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUserData(data);
        
        info += "USER DOCUMENT:\n";
        info += `  UID: ${uid}\n`;
        info += `  Email: ${data.email}\n`;
        info += `  Full Name: ${data.fullName || "Not set"}\n`;
        info += `  User Type: ${data.userType}\n`;
        info += `  Organization (legacy): ${JSON.stringify(data.organization)}\n`;
        info += `  Organizations (new): ${JSON.stringify(data.organizations)}\n`;
        info += `  Default Org: ${data.defaultOrgId || "Not set"}\n\n`;

        // Check memberships
        const orgIds: string[] = [];
        if (Array.isArray(data.organization)) {
          orgIds.push(...data.organization);
        } else if (typeof data.organization === 'string') {
          orgIds.push(data.organization);
        }

        if (Array.isArray(data.organizations)) {
          data.organizations.forEach((org: any) => {
            if (org.orgId && !orgIds.includes(org.orgId)) {
              orgIds.push(org.orgId);
            }
          });
        }

        info += "CLUB MEMBERSHIPS:\n";
        if (orgIds.length === 0) {
          info += "  ❌ No club memberships found\n";
        }

        for (const orgId of orgIds) {
          const orgDoc = await getDoc(doc(db, "orgs", orgId));
          if (orgDoc.exists()) {
            const orgData = orgDoc.data();
            info += `  ✓ ${orgData.name} (${orgId})\n`;
            clubs.push({ id: orgId, name: orgData.name });
          } else {
            info += `  ⚠️  Org ${orgId} - Document not found\n`;
          }
        }
        setClubs([...clubs]);
        
        info += "\nCOACH ASSIGNMENTS:\n";
        // Check if user is a coach in any clubs
        const orgsSnapshot = await getDocs(collection(db, "orgs"));
        let foundCoachRole = false;
        
        for (const orgDoc of orgsSnapshot.docs) {
          const coachDoc = await getDoc(doc(db, `orgs/${orgDoc.id}/coaches/${uid}`));
          if (coachDoc.exists()) {
            foundCoachRole = true;
            const orgData = orgDoc.data();
            info += `  ✓ Coach at ${orgData.name} (${orgDoc.id})\n`;
            coachClubs.push(orgDoc.id);
          }
        }
        
        if (!foundCoachRole) {
          info += "  ❌ No coach assignments found\n";
        }
        setCoachClubs([...coachClubs]);

        info += "\nPERMISSION ANALYSIS:\n";
        info += `  Is Member: ${orgIds.length > 0 ? "✓ Yes" : "❌ No"}\n`;
        info += `  Is Staff/Admin: ${data.userType === 'admin' ? "✓ Yes" : "❌ No"}\n`;
        info += `  Is Coach: ${foundCoachRole ? "✓ Yes" : "❌ No"}\n`;
        info += `  Is Courtly Admin: ${data.userType === 'courtly' ? "✓ Yes" : "❌ No"}\n`;
        
        const canBook = orgIds.length > 0 || foundCoachRole || data.userType === 'admin' || data.userType === 'courtly';
        info += `\n  CAN BOOK COURTS: ${canBook ? "✓ YES" : "❌ NO"}\n`;
        
        if (!canBook) {
          info += "\n⚠️  ISSUE DETECTED:\n";
          info += "  You cannot book courts because you are not:\n";
          info += "  - A member of any club\n";
          info += "  - A coach at any club\n";
          info += "  - A club admin\n";
          info += "  - A Courtly system admin\n\n";
          info += "SOLUTION:\n";
          info += "  1. Join a club at /browse-clubs\n";
          info += "  2. OR contact your club admin to add you as a member\n";
        }

      } else {
        info += "❌ USER DOCUMENT NOT FOUND\n";
        info += "This is a critical error. Please contact support.\n";
      }

      setDiagnosticInfo(info);
      console.log(info);
      
    } catch (error: any) {
      console.error("Error fetching diagnostic data:", error);
      setDiagnosticInfo("Error loading diagnostic information: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${darkMode ? "bg-gray-900 text-white" : "bg-gray-50"}`}>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-t-transparent border-teal-500 rounded-full animate-spin mx-auto mb-4"></div>
            <p>Loading diagnostic information...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${darkMode ? "bg-gray-900 text-white" : "bg-gray-50"}`}>
      {/* Navigation */}
      <nav className={`${darkMode ? "bg-gray-800" : "bg-white"} shadow-md`}>
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="text-xl font-bold text-teal-500">
            Courtly
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className={`${
                darkMode ? "text-gray-300 hover:text-white" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Dashboard
            </Link>
            <DarkModeToggle darkMode={darkMode} setDarkMode={setDarkMode} />
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <PageTitle title="Court Booking Diagnostic" />

        <div className={`p-6 mb-8 rounded-lg shadow-md ${
          darkMode ? "bg-gray-800" : "bg-white"
        }`}>
          <h2 className="text-xl font-bold mb-4">User Permissions Diagnostic</h2>
          
          <p className={`mb-4 ${darkMode ? "text-gray-300" : "text-gray-600"}`}>
            This page shows your current permissions and why you may or may not be able to book courts.
          </p>

          <div className={`p-4 rounded-lg ${darkMode ? "bg-gray-900" : "bg-gray-50"}`}>
            <pre className="whitespace-pre-wrap font-mono text-sm overflow-auto">
              {diagnosticInfo}
            </pre>
          </div>

          {userData && clubs.length === 0 && userData.userType !== 'courtly' && (
            <div className="mt-6 p-4 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
              <h3 className="font-bold text-yellow-800 dark:text-yellow-200 mb-2">
                ⚠️ No Club Membership Detected
              </h3>
              <p className="text-yellow-700 dark:text-yellow-300 mb-4">
                You need to be a member of a club to book courts. Here are your options:
              </p>
              <div className="space-y-2">
                <Link
                  href="/browse-clubs"
                  className="block px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-center"
                >
                  Browse & Join Clubs
                </Link>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Or contact your club administrator to add you as a member.
                </p>
              </div>
            </div>
          )}

          {clubs.length > 0 && (
            <div className="mt-6">
              <h3 className="font-bold mb-2">Your Clubs:</h3>
              <div className="space-y-2">
                {clubs.map((club) => (
                  <Link
                    key={club.id}
                    href={`/club/${club.id}/reserve-court`}
                    className={`block p-3 rounded-lg ${
                      darkMode ? "bg-gray-700 hover:bg-gray-600" : "bg-gray-100 hover:bg-gray-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{club.name}</span>
                      <span className="text-teal-500">Book Court →</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-gray-300 dark:border-gray-700">
            <button
              onClick={() => fetchUserData(user.uid)}
              className={`px-4 py-2 rounded-lg ${
                darkMode
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-blue-500 hover:bg-blue-600 text-white"
              }`}
            >
              Refresh Diagnostic
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
