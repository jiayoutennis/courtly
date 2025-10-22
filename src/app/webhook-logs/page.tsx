"use client";

import { useEffect, useState } from "react";
import { db } from "../../../firebase";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { useRouter } from "next/navigation";

interface WebhookLog {
  id: string;
  event: string;
  userId?: string;
  clubId?: string;
  tier?: string;
  error?: string;
  errorStack?: string;
  timestamp?: any;
}

export default function WebhookLogsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const logsQuery = query(
          collection(db, "webhookLogs"),
          orderBy("timestamp", "desc"),
          limit(50)
        );

        const snapshot = await getDocs(logsQuery);
        const logsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as WebhookLog[];

        console.log("📋 Webhook logs:", logsData);
        setLogs(logsData);
      } catch (error) {
        console.error("❌ Error fetching webhook logs:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-white mx-auto mb-4"></div>
          <p>Loading webhook logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between p-8 pb-0 mb-8">
          <h1 className="text-4xl font-light border-b border-white pb-4">
            📋 Webhook Logs
          </h1>
          <button
            onClick={() => router.push('/dashboard')}
            className="text-sm font-light text-gray-400 hover:text-white transition-colors border border-white px-4 py-2 hover:bg-white hover:text-black"
          >
            Dashboard
          </button>
        </div>

        <div className="mb-6 p-4 border border-yellow-500 rounded bg-yellow-500/10">
          <p className="text-sm text-gray-300">
            This page shows the last 50 webhook events related to membership sync.
            Check here after purchasing a membership to see if the sync succeeded or failed.
          </p>
        </div>

        {logs.length === 0 ? (
          <div className="p-6 border border-white rounded text-center">
            <p className="text-gray-400">No webhook logs found yet</p>
            <p className="text-sm text-gray-500 mt-2">
              Logs will appear here after purchasing a membership
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {logs.map((log) => (
              <div
                key={log.id}
                className={`p-4 border rounded ${
                  log.event.includes("error")
                    ? "border-red-500 bg-red-500/10"
                    : "border-green-500 bg-green-500/10"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3
                      className={`text-lg font-medium ${
                        log.event.includes("error")
                          ? "text-red-400"
                          : "text-green-400"
                      }`}
                    >
                      {log.event.includes("error") ? "❌" : "✅"}{" "}
                      {log.event.replace(/_/g, " ").toUpperCase()}
                    </h3>
                    {log.timestamp && (
                      <p className="text-xs text-gray-400 mt-1">
                        {log.timestamp.toDate
                          ? log.timestamp.toDate().toLocaleString()
                          : "Unknown time"}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  {log.userId && (
                    <div>
                      <p className="text-gray-400">User ID</p>
                      <p className="font-mono text-xs mt-1">{log.userId}</p>
                    </div>
                  )}
                  {log.clubId && (
                    <div>
                      <p className="text-gray-400">Club ID</p>
                      <p className="font-mono text-xs mt-1">{log.clubId}</p>
                    </div>
                  )}
                  {log.tier && (
                    <div>
                      <p className="text-gray-400">Tier</p>
                      <p className="font-mono text-xs mt-1">{log.tier}</p>
                    </div>
                  )}
                </div>

                {log.error && (
                  <div className="mt-3 pt-3 border-t border-red-500/30">
                    <p className="text-sm font-medium text-red-400 mb-2">
                      Error Message:
                    </p>
                    <p className="text-xs font-mono bg-black/50 p-2 rounded">
                      {log.error}
                    </p>
                  </div>
                )}

                {log.errorStack && (
                  <details className="mt-2">
                    <summary className="text-xs text-gray-400 cursor-pointer hover:text-white">
                      Show stack trace
                    </summary>
                    <pre className="text-xs font-mono bg-black/50 p-2 rounded mt-2 overflow-x-auto">
                      {log.errorStack}
                    </pre>
                  </details>
                )}
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
