"use client";

import { useEffect, useState } from "react";
import { db, auth } from "../../../firebase";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function DebugMembershipPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [memberships, setMemberships] = useState<any[]>([]);
  const [userClubMemberships, setUserClubMemberships] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user) {
        router.push("/signin");
      }
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!currentUser) return;

    const fetchMembershipData = async () => {
      try {
        console.log("🔍 Fetching membership data for user:", currentUser.uid);

        // 1. Check user document for clubMemberships map
        const userDocRef = doc(db, "users", currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          console.log("📄 User Document:", userData);
          setUserClubMemberships(userData.clubMemberships || {});
        }

        // 2. Find all memberships for this user across all orgs
        const orgsSnapshot = await getDocs(collection(db, "orgs"));
        const allMemberships: any[] = [];

        for (const orgDoc of orgsSnapshot.docs) {
          const membershipRef = doc(db, "orgs", orgDoc.id, "memberships", currentUser.uid);
          const membershipDoc = await getDoc(membershipRef);

          if (membershipDoc.exists()) {
            const membershipData = membershipDoc.data();
            allMemberships.push({
              clubId: orgDoc.id,
              clubName: orgDoc.data().name || orgDoc.id,
              ...membershipData,
            });
          }
        }

        console.log("💳 Found memberships:", allMemberships);
        setMemberships(allMemberships);
      } catch (error) {
        console.error("❌ Error fetching memberships:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMembershipData();
  }, [currentUser]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-white mx-auto mb-4"></div>
          <p>Loading membership data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-light mb-8 border-b border-white pb-4">
          🔍 Membership Debug Page
        </h1>

        <div className="mb-8 p-6 border border-white rounded">
          <h2 className="text-2xl font-light mb-4">User Info</h2>
          <p className="mb-2">
            <span className="font-medium">User ID:</span> {currentUser?.uid}
          </p>
          <p className="mb-2">
            <span className="font-medium">Email:</span> {currentUser?.email}
          </p>
        </div>

        {/* User's clubMemberships map */}
        <div className="mb-8 p-6 border border-white rounded">
          <h2 className="text-2xl font-light mb-4">
            clubMemberships Map (from /users/{currentUser?.uid})
          </h2>
          {userClubMemberships && Object.keys(userClubMemberships).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(userClubMemberships).map(([clubId, tier]) => (
                <div key={clubId} className="p-3 bg-white/5 rounded">
                  <p className="text-sm">
                    <span className="font-medium">Club ID:</span> {clubId}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Tier:</span> {tier as string}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400">No clubMemberships found in user document</p>
          )}
        </div>

        {/* Actual membership documents */}
        <div className="mb-8 p-6 border border-white rounded">
          <h2 className="text-2xl font-light mb-4">
            Membership Documents (from /orgs/&#123;clubId&#125;/memberships/&#123;userId&#125;)
          </h2>
          {memberships.length > 0 ? (
            <div className="space-y-4">
              {memberships.map((membership, index) => (
                <div key={index} className="p-4 bg-white/5 rounded border border-white/20">
                  <h3 className="text-xl font-medium mb-3">{membership.clubName}</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <p>
                      <span className="font-medium">Club ID:</span> {membership.clubId}
                    </p>
                    <p>
                      <span className="font-medium">Tier:</span> {membership.tier}
                    </p>
                    <p>
                      <span className="font-medium">Status:</span>{" "}
                      <span
                        className={`px-2 py-0.5 rounded ${
                          membership.status === "active"
                            ? "bg-green-600 text-white"
                            : "bg-red-600 text-white"
                        }`}
                      >
                        {membership.status}
                      </span>
                    </p>
                    <p>
                      <span className="font-medium">Price:</span> ${membership.amount}
                    </p>
                    <p>
                      <span className="font-medium">Start Date:</span>{" "}
                      {membership.startDate?.toDate
                        ? membership.startDate.toDate().toLocaleDateString()
                        : "N/A"}
                    </p>
                    <p>
                      <span className="font-medium">End Date:</span>{" "}
                      {membership.endDate?.toDate
                        ? membership.endDate.toDate().toLocaleDateString()
                        : "N/A"}
                    </p>
                    <p>
                      <span className="font-medium">Auto-renew:</span>{" "}
                      {membership.autoRenew ? "Yes" : "No"}
                    </p>
                    {membership.stripeSubscriptionId && (
                      <p>
                        <span className="font-medium">Stripe Sub ID:</span>{" "}
                        {membership.stripeSubscriptionId}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400">No membership documents found</p>
          )}
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => router.back()}
            className="px-6 py-3 border border-white hover:bg-white hover:text-black transition"
          >
            ← Back
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 border border-white hover:bg-white hover:text-black transition"
          >
            🔄 Refresh
          </button>
        </div>
      </div>
    </div>
  );
}
