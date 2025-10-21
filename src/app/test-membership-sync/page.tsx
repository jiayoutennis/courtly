"use client";

import { useState, useEffect } from "react";
import { auth } from "../../../firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function TestSyncPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [clubId, setClubId] = useState("");
  const [tier, setTier] = useState<"monthly" | "annual" | "day_pass">("monthly");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  const handleSync = async () => {
    if (!currentUser) {
      setError("You must be signed in");
      return;
    }

    if (!clubId) {
      setError("Please enter a Club ID");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/test-membership-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.uid,
          clubId,
          tier,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data);
        console.log("✅ Sync successful:", data);
      } else {
        setError(data.message || data.error || "Sync failed");
        console.error("❌ Sync failed:", data);
      }
    } catch (err: any) {
      setError(err.message);
      console.error("❌ Error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl mb-4">Please sign in to test membership sync</p>
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

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-light mb-8 border-b border-white pb-4">
          🔧 Test Membership Sync
        </h1>

        <div className="mb-8 p-6 border border-yellow-500 rounded bg-yellow-500/10">
          <h2 className="text-xl font-medium mb-2 text-yellow-400">⚠️ Manual Sync Tool</h2>
          <p className="text-sm text-gray-300">
            Use this tool to manually trigger the membership sync if the webhook didn't update the
            plan's members array after purchase.
          </p>
        </div>

        <div className="space-y-6">
          {/* User Info */}
          <div className="p-4 border border-white rounded">
            <h3 className="text-lg font-medium mb-2">Your User ID</h3>
            <p className="font-mono text-sm text-green-400 bg-black/50 p-2 rounded">
              {currentUser.uid}
            </p>
            <p className="text-xs text-gray-400 mt-1">{currentUser.email}</p>
          </div>

          {/* Club ID Input */}
          <div>
            <label className="block text-sm font-medium mb-2">Club ID</label>
            <input
              type="text"
              value={clubId}
              onChange={(e) => setClubId(e.target.value)}
              placeholder="Enter club ID (e.g., dIHqw0yKON4oEw8g4hcN)"
              className="w-full px-4 py-3 bg-white/5 border border-white rounded text-white placeholder-gray-500 focus:outline-none focus:border-white/50"
            />
            <p className="text-xs text-gray-400 mt-1">
              Find this in the URL: /club/<span className="text-green-400">[clubId]</span>
            </p>
          </div>

          {/* Tier Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Membership Tier</label>
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value as any)}
              className="w-full px-4 py-3 bg-white/5 border border-white rounded text-white focus:outline-none focus:border-white/50"
            >
              <option value="monthly">Monthly</option>
              <option value="annual">Annual</option>
              <option value="day_pass">Day Pass</option>
            </select>
          </div>

          {/* Sync Button */}
          <button
            onClick={handleSync}
            disabled={loading || !clubId}
            className={`w-full px-6 py-4 border border-white transition font-medium ${
              loading || !clubId
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-white hover:text-black"
            }`}
          >
            {loading ? "Syncing..." : "🔄 Trigger Sync"}
          </button>

          {/* Error Display */}
          {error && (
            <div className="p-4 border border-red-500 rounded bg-red-500/10">
              <h3 className="text-red-400 font-medium mb-2">❌ Error</h3>
              <p className="text-sm text-gray-300">{error}</p>
            </div>
          )}

          {/* Success Display */}
          {result && (
            <div className="p-4 border border-green-500 rounded bg-green-500/10">
              <h3 className="text-green-400 font-medium mb-2">✅ Success</h3>
              <p className="text-sm text-gray-300 mb-3">{result.message}</p>
              <div className="space-y-1 text-xs font-mono">
                <p>
                  <span className="text-gray-400">User:</span>{" "}
                  <span className="text-green-400">{result.data.userId}</span>
                </p>
                <p>
                  <span className="text-gray-400">Club:</span>{" "}
                  <span className="text-green-400">{result.data.clubId}</span>
                </p>
                <p>
                  <span className="text-gray-400">Tier:</span>{" "}
                  <span className="text-green-400">{result.data.tier}</span>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-8 p-6 border border-white/30 rounded">
          <h3 className="text-lg font-medium mb-3">📋 Instructions</h3>
          <ol className="space-y-2 text-sm text-gray-300 list-decimal list-inside">
            <li>Copy your Club ID from the URL (when you're viewing a club page)</li>
            <li>Select the membership tier you purchased</li>
            <li>Click "Trigger Sync"</li>
            <li>Check the console (F12) for detailed logs</li>
            <li>
              Visit{" "}
              <a
                href="/debug-membership-plans"
                className="text-blue-400 hover:underline"
              >
                /debug-membership-plans
              </a>{" "}
              to verify the members array was updated
            </li>
          </ol>
        </div>

        <div className="flex gap-4 mt-8">
          <button
            onClick={() => router.push("/debug-membership-plans")}
            className="flex-1 px-6 py-3 border border-white hover:bg-white hover:text-black transition"
          >
            View Membership Plans
          </button>
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
