"use client";

import { useEffect, useState } from "react";
import { db, auth } from "../../../firebase";
import { collection, query, orderBy, limit, getDocs, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function MembershipDebugDashboard() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [webhookLogs, setWebhookLogs] = useState<any[]>([]);
  const [memberships, setMemberships] = useState<any[]>([]);
  const [membershipPlans, setMembershipPlans] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const fetchAllData = async () => {
      try {
        // 1. Fetch webhook logs
        const logsQuery = query(
          collection(db, "webhookLogs"),
          orderBy("timestamp", "desc"),
          limit(10)
        );
        const logsSnapshot = await getDocs(logsQuery);
        const logs = logsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setWebhookLogs(logs);

        // 2. Fetch user's memberships
        const orgsSnapshot = await getDocs(collection(db, "orgs"));
        const userMemberships: any[] = [];
        const allPlans: any[] = [];

        for (const orgDoc of orgsSnapshot.docs) {
          // Get user's membership
          const membershipRef = doc(db, "orgs", orgDoc.id, "memberships", currentUser.uid);
          const membershipDoc = await getDoc(membershipRef);

          if (membershipDoc.exists()) {
            userMemberships.push({
              clubId: orgDoc.id,
              clubName: orgDoc.data().name || orgDoc.id,
              ...membershipDoc.data(),
            });
          }

          // Get membership plans
          const plansSnapshot = await getDocs(
            collection(db, "orgs", orgDoc.id, "membershipPlans")
          );

          plansSnapshot.docs.forEach((planDoc) => {
            const planData = planDoc.data();
            allPlans.push({
              clubId: orgDoc.id,
              clubName: orgDoc.data().name || orgDoc.id,
              planId: planDoc.id,
              ...planData,
            });
          });
        }

        setMemberships(userMemberships);
        setMembershipPlans(allPlans);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [currentUser]);

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl mb-4">Please sign in to view debug dashboard</p>
          <button
            onClick={() => router.push("/signin")}
            className="px-6 py-3 border border-white hover:bg-white hover:text-black transition"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-white mx-auto mb-4"></div>
          <p>Loading debug data...</p>
        </div>
      </div>
    );
  }

  const userIsInMembersArray = (plan: any) => {
    return plan.members && plan.members.includes(currentUser.uid);
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8 border-b border-white pb-4">
          <h1 className="text-4xl font-light">🔍 Membership Debug Dashboard</h1>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 border border-white hover:bg-white hover:text-black transition text-sm"
          >
            🔄 Refresh
          </button>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <Link
            href="/webhook-logs"
            className="p-4 border border-white hover:bg-white hover:text-black transition text-center"
          >
            <div className="text-2xl mb-2">📋</div>
            <div className="text-sm">Webhook Logs</div>
          </Link>
          <Link
            href="/debug-membership"
            className="p-4 border border-white hover:bg-white hover:text-black transition text-center"
          >
            <div className="text-2xl mb-2">💳</div>
            <div className="text-sm">My Memberships</div>
          </Link>
          <Link
            href="/debug-membership-plans"
            className="p-4 border border-white hover:bg-white hover:text-black transition text-center"
          >
            <div className="text-2xl mb-2">📊</div>
            <div className="text-sm">All Plans</div>
          </Link>
          <Link
            href="/test-membership-sync"
            className="p-4 border border-white hover:bg-white hover:text-black transition text-center"
          >
            <div className="text-2xl mb-2">🔧</div>
            <div className="text-sm">Manual Sync</div>
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-8">
          {/* Left Column */}
          <div className="space-y-8">
            {/* User Info */}
            <div className="border border-white rounded p-6">
              <h2 className="text-2xl font-light mb-4">👤 Your Info</h2>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="text-gray-400">Email:</span> {currentUser.email}
                </p>
                <p className="font-mono text-xs">
                  <span className="text-gray-400">User ID:</span> {currentUser.uid}
                </p>
              </div>
            </div>

            {/* Your Memberships */}
            <div className="border border-white rounded p-6">
              <h2 className="text-2xl font-light mb-4">💳 Your Memberships</h2>
              {memberships.length === 0 ? (
                <p className="text-gray-400 text-sm">No active memberships</p>
              ) : (
                <div className="space-y-4">
                  {memberships.map((membership, idx) => (
                    <div key={idx} className="p-4 bg-white/5 rounded">
                      <h3 className="font-medium mb-2">{membership.clubName}</h3>
                      <div className="space-y-1 text-sm">
                        <p>
                          <span className="text-gray-400">Tier:</span> {membership.tier}
                        </p>
                        <p>
                          <span className="text-gray-400">Status:</span>{" "}
                          <span
                            className={`px-2 py-0.5 rounded text-xs ${
                              membership.status === "active"
                                ? "bg-green-600"
                                : "bg-red-600"
                            }`}
                          >
                            {membership.status}
                          </span>
                        </p>
                        {membership.endDate?.toDate && (
                          <p>
                            <span className="text-gray-400">Expires:</span>{" "}
                            {membership.endDate.toDate().toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Webhook Logs */}
            <div className="border border-white rounded p-6">
              <h2 className="text-2xl font-light mb-4">📋 Recent Webhook Logs</h2>
              {webhookLogs.length === 0 ? (
                <p className="text-gray-400 text-sm">No webhook logs yet</p>
              ) : (
                <div className="space-y-3">
                  {webhookLogs.slice(0, 5).map((log) => (
                    <div
                      key={log.id}
                      className={`p-3 rounded border ${
                        log.event.includes("error")
                          ? "border-red-500 bg-red-500/10"
                          : "border-green-500 bg-green-500/10"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span
                          className={`text-sm font-medium ${
                            log.event.includes("error")
                              ? "text-red-400"
                              : "text-green-400"
                          }`}
                        >
                          {log.event.includes("error") ? "❌" : "✅"}{" "}
                          {log.event.replace(/_/g, " ")}
                        </span>
                        {log.timestamp?.toDate && (
                          <span className="text-xs text-gray-400">
                            {log.timestamp.toDate().toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                      {log.error && (
                        <p className="text-xs text-red-300 font-mono">{log.error}</p>
                      )}
                    </div>
                  ))}
                  <Link
                    href="/webhook-logs"
                    className="block text-center text-sm text-gray-400 hover:text-white pt-2"
                  >
                    View all logs →
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-8">
            {/* Sync Status */}
            <div className="border border-white rounded p-6">
              <h2 className="text-2xl font-light mb-4">🔄 Sync Status</h2>
              <div className="space-y-4">
                {membershipPlans.map((plan, idx) => {
                  const isInArray = userIsInMembersArray(plan);
                  const hasMembership = memberships.some(
                    (m) => m.clubId === plan.clubId && m.tier === plan.tier
                  );

                  // Only show plans where user has membership
                  if (!hasMembership) return null;

                  return (
                    <div key={idx} className="p-4 bg-white/5 rounded">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-medium">{plan.clubName}</h3>
                          <p className="text-sm text-gray-400">
                            {plan.tier.toUpperCase()} Plan
                          </p>
                        </div>
                        {isInArray ? (
                          <span className="px-3 py-1 bg-green-600 text-white text-xs rounded">
                            ✅ SYNCED
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-red-600 text-white text-xs rounded">
                            ❌ NOT SYNCED
                          </span>
                        )}
                      </div>

                      {!isInArray && (
                        <div className="mt-3 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded">
                          <p className="text-xs text-yellow-400 mb-2">
                            ⚠️ You have a membership but are not in the plan's members
                            array
                          </p>
                          <Link
                            href="/test-membership-sync"
                            className="text-xs text-blue-400 hover:underline"
                          >
                            Click here to manually sync →
                          </Link>
                        </div>
                      )}
                    </div>
                  );
                })}

                {memberships.length === 0 && (
                  <p className="text-gray-400 text-sm text-center">
                    Purchase a membership to see sync status
                  </p>
                )}
              </div>
            </div>

            {/* Instructions */}
            <div className="border border-white rounded p-6">
              <h2 className="text-2xl font-light mb-4">📖 How It Works</h2>
              <div className="space-y-3 text-sm text-gray-300">
                <div>
                  <h3 className="font-medium text-white mb-1">1. Purchase Membership</h3>
                  <p>Go to a club's membership page and complete checkout</p>
                </div>
                <div>
                  <h3 className="font-medium text-white mb-1">2. Webhook Processes Payment</h3>
                  <p>
                    Stripe sends webhook → Creates membership document → Syncs to plan's
                    members array
                  </p>
                </div>
                <div>
                  <h3 className="font-medium text-white mb-1">3. Check Sync Status</h3>
                  <p>
                    Webhook logs show if sync succeeded or failed. If failed, use manual
                    sync tool.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-white/20">
          <button
            onClick={() => router.back()}
            className="px-6 py-3 border border-white hover:bg-white hover:text-black transition"
          >
            ← Back
          </button>
        </div>
      </div>
    </div>
  );
}
