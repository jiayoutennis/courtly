"use client";

import { useState, useEffect } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import type { TierPrivileges, MembershipTier, MembershipTiersMap } from "../../shared/types";
import { getDefaultPrivileges } from "../../lib/tierPrivileges";

interface MembershipPrivilegesEditorProps {
  clubId: string;
  darkMode: boolean;
}

export default function MembershipPrivilegesEditor({ 
  clubId, 
  darkMode 
}: MembershipPrivilegesEditorProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [membershipEnabled, setMembershipEnabled] = useState(false);
  const [membershipTiers, setMembershipTiers] = useState<MembershipTiersMap>({});
  const [selectedTier, setSelectedTier] = useState<MembershipTier | null>(null);
  const [editingPrivileges, setEditingPrivileges] = useState<TierPrivileges | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const tierLabels: Record<MembershipTier, string> = {
    day_pass: "Day Pass",
    monthly: "Monthly Membership",
    annual: "Annual Membership"
  };

  useEffect(() => {
    fetchMembershipData();
  }, [clubId]);

  const fetchMembershipData = async () => {
    try {
      setLoading(true);
      const orgDoc = await getDoc(doc(db, "orgs", clubId));
      
      if (orgDoc.exists()) {
        const data = orgDoc.data();
        setMembershipEnabled(data.membershipEnabled || false);
        setMembershipTiers(data.membershipTiers || {});
      }
    } catch (err) {
      console.error("Error fetching membership data:", err);
      setError("Failed to load membership configuration");
    } finally {
      setLoading(false);
    }
  };

  const handleTierSelect = (tier: MembershipTier) => {
    setSelectedTier(tier);
    const tierConfig = membershipTiers[tier];
    
    if (tierConfig?.privileges) {
      setEditingPrivileges({ ...tierConfig.privileges });
    } else {
      // Use default privileges if not set
      setEditingPrivileges(getDefaultPrivileges(tier));
    }
  };

  const handlePrivilegeChange = (field: keyof TierPrivileges, value: any) => {
    if (!editingPrivileges) return;
    
    setEditingPrivileges({
      ...editingPrivileges,
      [field]: value
    });
  };

  const handleSavePrivileges = async () => {
    if (!selectedTier || !editingPrivileges) return;
    
    try {
      setSaving(true);
      setError("");
      
      const updatedTiers = {
        ...membershipTiers,
        [selectedTier]: {
          ...membershipTiers[selectedTier],
          privileges: editingPrivileges
        }
      };
      
      await updateDoc(doc(db, "orgs", clubId), {
        membershipTiers: updatedTiers
      });
      
      setMembershipTiers(updatedTiers);
      setSuccess(`Saved privileges for ${tierLabels[selectedTier]}`);
      
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error("Error saving privileges:", err);
      setError("Failed to save privileges");
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefaults = () => {
    if (!selectedTier) return;
    
    const confirmed = confirm(`Reset ${tierLabels[selectedTier]} to default privileges?`);
    if (confirmed) {
      setEditingPrivileges(getDefaultPrivileges(selectedTier));
    }
  };

  if (loading) {
    return (
      <div className={`p-6 border ${darkMode ? "border-[#1a1a1a]" : "border-gray-100"}`}>
        <p className={darkMode ? "text-gray-400" : "text-gray-600"}>Loading membership configuration...</p>
      </div>
    );
  }

  if (!membershipEnabled) {
    return (
      <div className={`p-6 border ${darkMode ? "border-[#1a1a1a]" : "border-gray-100"}`}>
        <h2 className="text-xl font-light uppercase tracking-wider mb-4">Membership Privileges</h2>
        <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
          Membership is not enabled for this club. Enable memberships in Stripe setup to configure privileges.
        </p>
      </div>
    );
  }

  const activeTiers = Object.entries(membershipTiers)
    .filter(([_, config]) => config.isActive)
    .map(([tier]) => tier as MembershipTier);

  if (activeTiers.length === 0) {
    return (
      <div className={`p-6 border ${darkMode ? "border-[#1a1a1a]" : "border-gray-100"}`}>
        <h2 className="text-xl font-light uppercase tracking-wider mb-4">Membership Privileges</h2>
        <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
          No active membership tiers found. Configure membership tiers in Stripe setup first.
        </p>
      </div>
    );
  }

  return (
    <div className={`p-6 border ${darkMode ? "border-[#1a1a1a]" : "border-gray-100"}`}>
      <h2 className="text-xl font-light uppercase tracking-wider mb-6">Membership Privileges</h2>
      
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
          {error}
        </div>
      )}
      
      {success && (
        <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 text-green-500 text-sm">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Tier Selection Sidebar */}
        <div className="lg:col-span-1">
          <h3 className={`text-xs uppercase tracking-wider mb-3 font-light ${
            darkMode ? "text-gray-400" : "text-gray-600"
          }`}>
            Select Tier
          </h3>
          <div className="space-y-2">
            {activeTiers.map((tier) => (
              <button
                key={tier}
                onClick={() => handleTierSelect(tier)}
                className={`w-full text-left px-4 py-3 text-sm font-light transition-colors ${
                  selectedTier === tier
                    ? darkMode
                      ? "bg-white text-black"
                      : "bg-black text-white"
                    : darkMode
                      ? "bg-[#0a0a0a] border border-[#1a1a1a] text-white hover:bg-[#1a1a1a]"
                      : "bg-white border border-gray-100 text-gray-900 hover:bg-gray-50"
                }`}
              >
                {tierLabels[tier]}
              </button>
            ))}
          </div>
        </div>

        {/* Privileges Configuration */}
        <div className="lg:col-span-3">
          {!selectedTier ? (
            <div className={`p-8 border text-center ${
              darkMode ? "border-[#1a1a1a]" : "border-gray-100"
            }`}>
              <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                Select a membership tier to configure privileges
              </p>
            </div>
          ) : editingPrivileges ? (
            <>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-light">{tierLabels[selectedTier]}</h3>
                <div className="space-x-2">
                  <button
                    onClick={handleResetToDefaults}
                    className={`px-4 py-2 text-xs font-light transition-colors ${
                      darkMode
                        ? "border border-[#1a1a1a] hover:bg-[#1a1a1a] text-white"
                        : "border border-gray-200 hover:bg-gray-50 text-gray-700"
                    }`}
                  >
                    Reset to Defaults
                  </button>
                  <button
                    onClick={handleSavePrivileges}
                    disabled={saving}
                    className={`px-6 py-2 text-xs font-light transition-colors ${
                      darkMode
                        ? "bg-white text-black hover:bg-gray-200"
                        : "bg-black text-white hover:bg-gray-800"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                {/* Booking Privileges */}
                <div className={`p-4 border ${darkMode ? "border-[#1a1a1a]" : "border-gray-100"}`}>
                  <h4 className={`text-sm uppercase tracking-wider mb-4 font-light ${
                    darkMode ? "text-gray-400" : "text-gray-600"
                  }`}>
                    Booking Privileges
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-xs mb-2 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                        Max Days in Advance
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="90"
                        value={editingPrivileges.maxDaysInAdvance}
                        onChange={(e) => handlePrivilegeChange('maxDaysInAdvance', parseInt(e.target.value))}
                        className={`w-full px-3 py-2 border ${
                          darkMode
                            ? "bg-[#0a0a0a] border-[#1a1a1a] text-white"
                            : "bg-white border-gray-200 text-gray-900"
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`block text-xs mb-2 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                        Max Bookings Per Day
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="999"
                        value={editingPrivileges.maxBookingsPerDay}
                        onChange={(e) => handlePrivilegeChange('maxBookingsPerDay', parseInt(e.target.value))}
                        className={`w-full px-3 py-2 border ${
                          darkMode
                            ? "bg-[#0a0a0a] border-[#1a1a1a] text-white"
                            : "bg-white border-gray-200 text-gray-900"
                        }`}
                      />
                      <p className="text-xs mt-1 text-gray-500">Use 999 for unlimited</p>
                    </div>
                    <div>
                      <label className={`block text-xs mb-2 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                        Max Booking Duration (hours)
                      </label>
                      <input
                        type="number"
                        min="0.5"
                        max="8"
                        step="0.5"
                        value={editingPrivileges.maxBookingDuration}
                        onChange={(e) => handlePrivilegeChange('maxBookingDuration', parseFloat(e.target.value))}
                        className={`w-full px-3 py-2 border ${
                          darkMode
                            ? "bg-[#0a0a0a] border-[#1a1a1a] text-white"
                            : "bg-white border-gray-200 text-gray-900"
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`block text-xs mb-2 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                        Min Booking Duration (hours)
                      </label>
                      <input
                        type="number"
                        min="0.5"
                        max="4"
                        step="0.5"
                        value={editingPrivileges.minBookingDuration}
                        onChange={(e) => handlePrivilegeChange('minBookingDuration', parseFloat(e.target.value))}
                        className={`w-full px-3 py-2 border ${
                          darkMode
                            ? "bg-[#0a0a0a] border-[#1a1a1a] text-white"
                            : "bg-white border-gray-200 text-gray-900"
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {/* Court Access */}
                <div className={`p-4 border ${darkMode ? "border-[#1a1a1a]" : "border-gray-100"}`}>
                  <h4 className={`text-sm uppercase tracking-wider mb-4 font-light ${
                    darkMode ? "text-gray-400" : "text-gray-600"
                  }`}>
                    Court Access
                  </h4>
                  <div className="space-y-3">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={editingPrivileges.allowPrimeTimeBooking}
                        onChange={(e) => handlePrivilegeChange('allowPrimeTimeBooking', e.target.checked)}
                        className="mr-3"
                      />
                      <span className={`text-sm ${darkMode ? "text-white" : "text-gray-900"}`}>
                        Allow Prime Time Booking (5-9pm)
                      </span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={editingPrivileges.allowWeekendBooking}
                        onChange={(e) => handlePrivilegeChange('allowWeekendBooking', e.target.checked)}
                        className="mr-3"
                      />
                      <span className={`text-sm ${darkMode ? "text-white" : "text-gray-900"}`}>
                        Allow Weekend Booking
                      </span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={editingPrivileges.priorityBooking}
                        onChange={(e) => handlePrivilegeChange('priorityBooking', e.target.checked)}
                        className="mr-3"
                      />
                      <span className={`text-sm ${darkMode ? "text-white" : "text-gray-900"}`}>
                        Priority Booking (Front of queue)
                      </span>
                    </label>
                  </div>
                </div>

                {/* Cancellation Policy */}
                <div className={`p-4 border ${darkMode ? "border-[#1a1a1a]" : "border-gray-100"}`}>
                  <h4 className={`text-sm uppercase tracking-wider mb-4 font-light ${
                    darkMode ? "text-gray-400" : "text-gray-600"
                  }`}>
                    Cancellation Policy
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-xs mb-2 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                        Cancellation Window (hours)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="72"
                        value={editingPrivileges.cancellationWindowHours}
                        onChange={(e) => handlePrivilegeChange('cancellationWindowHours', parseInt(e.target.value))}
                        className={`w-full px-3 py-2 border ${
                          darkMode
                            ? "bg-[#0a0a0a] border-[#1a1a1a] text-white"
                            : "bg-white border-gray-200 text-gray-900"
                        }`}
                      />
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={editingPrivileges.allowFreeCancellation}
                          onChange={(e) => handlePrivilegeChange('allowFreeCancellation', e.target.checked)}
                          className="mr-3"
                        />
                        <span className={`text-sm ${darkMode ? "text-white" : "text-gray-900"}`}>
                          Allow Free Cancellation
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Guest Privileges */}
                <div className={`p-4 border ${darkMode ? "border-[#1a1a1a]" : "border-gray-100"}`}>
                  <h4 className={`text-sm uppercase tracking-wider mb-4 font-light ${
                    darkMode ? "text-gray-400" : "text-gray-600"
                  }`}>
                    Guest Privileges
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={editingPrivileges.allowGuests}
                          onChange={(e) => handlePrivilegeChange('allowGuests', e.target.checked)}
                          className="mr-3"
                        />
                        <span className={`text-sm ${darkMode ? "text-white" : "text-gray-900"}`}>
                          Allow Guests
                        </span>
                      </label>
                    </div>
                    <div>
                      <label className={`block text-xs mb-2 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                        Max Guests Per Booking
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={editingPrivileges.maxGuestsPerBooking}
                        onChange={(e) => handlePrivilegeChange('maxGuestsPerBooking', parseInt(e.target.value))}
                        disabled={!editingPrivileges.allowGuests}
                        className={`w-full px-3 py-2 border ${
                          darkMode
                            ? "bg-[#0a0a0a] border-[#1a1a1a] text-white"
                            : "bg-white border-gray-200 text-gray-900"
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      />
                    </div>
                  </div>
                </div>

                {/* Discounts & Benefits */}
                <div className={`p-4 border ${darkMode ? "border-[#1a1a1a]" : "border-gray-100"}`}>
                  <h4 className={`text-sm uppercase tracking-wider mb-4 font-light ${
                    darkMode ? "text-gray-400" : "text-gray-600"
                  }`}>
                    Discounts & Benefits
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className={`block text-xs mb-2 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                        Court Booking Discount (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={editingPrivileges.discountPercentage}
                        onChange={(e) => handlePrivilegeChange('discountPercentage', parseInt(e.target.value))}
                        className={`w-full px-3 py-2 border ${
                          darkMode
                            ? "bg-[#0a0a0a] border-[#1a1a1a] text-white"
                            : "bg-white border-gray-200 text-gray-900"
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`block text-xs mb-2 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                        Lesson Discount (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={editingPrivileges.lessonDiscount}
                        onChange={(e) => handlePrivilegeChange('lessonDiscount', parseInt(e.target.value))}
                        className={`w-full px-3 py-2 border ${
                          darkMode
                            ? "bg-[#0a0a0a] border-[#1a1a1a] text-white"
                            : "bg-white border-gray-200 text-gray-900"
                        }`}
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={editingPrivileges.accessToMemberEvents}
                        onChange={(e) => handlePrivilegeChange('accessToMemberEvents', e.target.checked)}
                        className="mr-3"
                      />
                      <span className={`text-sm ${darkMode ? "text-white" : "text-gray-900"}`}>
                        Access to Member Events
                      </span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={editingPrivileges.accessToLessons}
                        onChange={(e) => handlePrivilegeChange('accessToLessons', e.target.checked)}
                        className="mr-3"
                      />
                      <span className={`text-sm ${darkMode ? "text-white" : "text-gray-900"}`}>
                        Access to Lessons
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
