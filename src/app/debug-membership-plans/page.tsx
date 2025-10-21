"use client";

import { useEffect, useState } from "react";
import { db, auth } from "../../../firebase";
import { collection, getDocs } from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function DebugMembershipPlansPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [clubs, setClubs] = useState<any[]>([]);
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

    const fetchMembershipPlans = async () => {
      try {
        console.log("🔍 Fetching all membership plans...");

        // Get all orgs
        const orgsSnapshot = await getDocs(collection(db, "orgs"));
        const clubsData: any[] = [];

        for (const orgDoc of orgsSnapshot.docs) {
          const orgData = orgDoc.data();
          console.log(`\n📋 Checking club: ${orgData.name || orgDoc.id}`);

          // Get membership plans for this org
          const plansSnapshot = await getDocs(
            collection(db, "orgs", orgDoc.id, "membershipPlans")
          );

          const plans: any[] = [];
          for (const planDoc of plansSnapshot.docs) {
            const planData = planDoc.data();
            console.log(`  - Plan ${planDoc.id}:`, {
              tier: planData.tier,
              members: planData.members || [],
              memberCount: planData.members?.length || 0,
            });

            plans.push({
              id: planDoc.id,
              ...planData,
            });
          }

          if (plans.length > 0) {
            clubsData.push({
              id: orgDoc.id,
              name: orgData.name || orgDoc.id,
              plans,
            });
          }
        }

        setClubs(clubsData);
      } catch (error) {
        console.error("❌ Error fetching membership plans:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMembershipPlans();
  }, [currentUser]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-white mx-auto mb-4"></div>
          <p>Loading membership plans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-light mb-8 border-b border-white pb-4">
          🔍 Membership Plans Debug
        </h1>

        <div className="mb-8 p-6 border border-white rounded">
          <h2 className="text-2xl font-light mb-4">Path Structure</h2>
          <div className="space-y-2 text-sm font-mono">
            <p className="text-gray-400">Membership Plans Location:</p>
            <p className="text-green-400">✓ /orgs/&#123;clubId&#125;/membershipPlans/&#123;tier&#125;</p>
            <p className="text-green-400 ml-4">├── tier: "monthly" | "annual" | "day_pass"</p>
            <p className="text-green-400 ml-4">├── price: number</p>
            <p className="text-green-400 ml-4">└── members: string[] ← Array of user IDs</p>
            
            <p className="text-gray-400 mt-4">User Memberships Location:</p>
            <p className="text-green-400">✓ /orgs/&#123;clubId&#125;/memberships/&#123;userId&#125;</p>
            <p className="text-green-400 ml-4">├── userId: string</p>
            <p className="text-green-400 ml-4">├── tier: "monthly" | "annual" | "day_pass"</p>
            <p className="text-green-400 ml-4">└── status: "active" | "expired"</p>
          </div>
        </div>

        {clubs.length === 0 ? (
          <div className="p-6 border border-white rounded">
            <p className="text-gray-400">No clubs with membership plans found</p>
          </div>
        ) : (
          <div className="space-y-8">
            {clubs.map((club) => (
              <div key={club.id} className="border border-white rounded p-6">
                <h2 className="text-3xl font-light mb-6">{club.name}</h2>
                <p className="text-sm text-gray-400 mb-6">Club ID: {club.id}</p>

                <div className="space-y-4">
                  {club.plans.map((plan: any) => (
                    <div
                      key={plan.id}
                      className="p-4 bg-white/5 rounded border border-white/20"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-xl font-medium mb-2">
                            {plan.tier?.toUpperCase() || plan.id.toUpperCase()}
                          </h3>
                          <p className="text-sm text-gray-400">
                            Document ID: {plan.id}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-light">
                            ${plan.price || plan.amount || "N/A"}
                          </p>
                          {plan.interval && (
                            <p className="text-sm text-gray-400">
                              per {plan.interval}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="border-t border-white/20 pt-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium uppercase tracking-wider">
                            Members Array
                          </h4>
                          <span
                            className={`px-3 py-1 rounded text-sm ${
                              plan.members && plan.members.length > 0
                                ? "bg-green-600 text-white"
                                : "bg-gray-600 text-white"
                            }`}
                          >
                            {plan.members?.length || 0} members
                          </span>
                        </div>

                        {plan.members && plan.members.length > 0 ? (
                          <div className="space-y-2 mt-3">
                            {plan.members.map((userId: string, idx: number) => (
                              <div
                                key={idx}
                                className="p-2 bg-black/30 rounded text-xs font-mono"
                              >
                                <span className="text-gray-400">User {idx + 1}:</span>{" "}
                                <span className="text-green-400">{userId}</span>
                                {userId === currentUser?.uid && (
                                  <span className="ml-2 px-2 py-0.5 bg-blue-600 text-white rounded">
                                    YOU
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-3 p-3 bg-red-900/20 border border-red-500/30 rounded">
                            <p className="text-sm text-red-400">
                              ⚠️ No members in this plan's members array
                            </p>
                            <p className="text-xs text-red-300 mt-1">
                              This means the sync is not working properly
                            </p>
                          </div>
                        )}
                      </div>

                      {plan.stripePriceId && (
                        <div className="mt-3 pt-3 border-t border-white/20">
                          <p className="text-xs text-gray-400">
                            Stripe Price ID: {plan.stripePriceId}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-4 mt-8">
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
