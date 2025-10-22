"use client";

import { useState, useEffect } from "react";
import { auth } from "../../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { 
  getAccountBalance, 
  getBalanceTransactions,
  formatBalance 
} from "@/lib/accountBalance";
import type { BalanceTransaction } from "../../shared/types";

interface AccountBalanceWidgetProps {
  clubId: string;
  darkMode?: boolean;
}

export default function AccountBalanceWidget({ clubId, darkMode = false }: AccountBalanceWidgetProps) {
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<BalanceTransaction[]>([]);
  const [showTransactions, setShowTransactions] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [balanceEnabled, setBalanceEnabled] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setUserId(user.uid);

        // Always show account balance (it's enabled by default for all clubs)
        setBalanceEnabled(true);
        
        // Fetch user's balance
        const userBalance = await getAccountBalance(user.uid, clubId);
        setBalance(userBalance);

        // Fetch recent transactions
        const recentTransactions = await getBalanceTransactions(user.uid, clubId, 10);
        setTransactions(recentTransactions);
      } catch (error) {
        console.error("Error loading account balance:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [clubId]);

  const refreshBalance = async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const userBalance = await getAccountBalance(userId, clubId);
      setBalance(userBalance);

      const recentTransactions = await getBalanceTransactions(userId, clubId, 10);
      setTransactions(recentTransactions);
    } catch (error) {
      console.error("Error refreshing balance:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!balanceEnabled) {
    return null; // Don't show widget if balance feature is disabled
  }

  if (loading) {
    return (
      <div className={`border p-6 ${
        darkMode ? "border-[#1a1a1a] bg-[#0a0a0a]" : "border-gray-100 bg-white"
      }`}>
        <div className="animate-pulse">
          <div className={`h-4 w-32 mb-2 ${
            darkMode ? "bg-[#1a1a1a]" : "bg-gray-200"
          }`}></div>
          <div className={`h-8 w-24 ${
            darkMode ? "bg-[#1a1a1a]" : "bg-gray-200"
          }`}></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`border ${
      darkMode ? "border-[#1a1a1a] bg-[#0a0a0a]" : "border-gray-100 bg-white"
    }`}>
      {/* Balance Display */}
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-light uppercase tracking-wider">
            Account Balance
          </h3>
          <button
            onClick={refreshBalance}
            className={`text-xs underline hover:no-underline ${
              darkMode ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-black"
            }`}
          >
            Refresh
          </button>
        </div>

        <div className="mb-4">
          <div className={`text-3xl font-light ${
            darkMode ? "text-white" : "text-black"
          }`}>
            {formatBalance(balance)}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => {/* TODO: Implement add funds */}}
            className={`flex-1 px-4 py-2 border font-light text-sm transition-colors ${
              darkMode
                ? "border-white text-white hover:bg-white hover:text-black"
                : "border-black text-black hover:bg-black hover:text-white"
            }`}
          >
            Add Funds
          </button>
          <button
            onClick={() => setShowTransactions(!showTransactions)}
            className={`flex-1 px-4 py-2 border font-light text-sm transition-colors ${
              darkMode
                ? "border-[#1a1a1a] text-gray-400 hover:border-gray-600 hover:text-white"
                : "border-gray-200 text-gray-600 hover:border-gray-400 hover:text-black"
            }`}
          >
            {showTransactions ? "Hide" : "View"} History
          </button>
        </div>
      </div>

      {/* Transaction History */}
      {showTransactions && (
        <div className={`border-t ${
          darkMode ? "border-[#1a1a1a]" : "border-gray-100"
        }`}>
          <div className="p-6">
            <h4 className="text-xs font-light uppercase tracking-wider mb-4">
              Recent Transactions
            </h4>

            {transactions.length === 0 ? (
              <p className={`text-sm font-light ${
                darkMode ? "text-gray-600" : "text-gray-400"
              }`}>
                No transactions yet
              </p>
            ) : (
              <div className="space-y-3">
                {transactions.map((transaction) => (
                  <div
                    key={transaction.transactionId}
                    className={`flex items-center justify-between pb-3 border-b ${
                      darkMode ? "border-[#1a1a1a]" : "border-gray-100"
                    } last:border-0 last:pb-0`}
                  >
                    <div className="flex-1">
                      <div className="text-sm font-light">
                        {transaction.description}
                      </div>
                      <div className={`text-xs font-light mt-1 ${
                        darkMode ? "text-gray-600" : "text-gray-400"
                      }`}>
                        {transaction.createdAt?.toDate?.()?.toLocaleDateString() || "N/A"}
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <div className={`text-sm font-light ${
                        transaction.amount > 0
                          ? "text-green-500"
                          : "text-red-500"
                      }`}>
                        {transaction.amount > 0 ? "+" : ""}
                        {formatBalance(transaction.amount)}
                      </div>
                      <div className={`text-xs font-light mt-1 ${
                        darkMode ? "text-gray-600" : "text-gray-400"
                      }`}>
                        Balance: {formatBalance(transaction.balanceAfter)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {transactions.length > 0 && (
              <button
                className={`w-full mt-4 text-sm underline hover:no-underline transition-colors ${
                  darkMode ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-black"
                }`}
              >
                View All Transactions
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
