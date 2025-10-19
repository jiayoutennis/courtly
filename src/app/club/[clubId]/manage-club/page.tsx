"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { db, auth } from "../../../../../firebase";
import { 
  doc, 
  getDoc, 
  updateDoc,
  serverTimestamp
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import PageTitle from "@/app/components/PageTitle";

interface Court {
  id: string;
  name: string;
  courtType: string;
  isIndoor: boolean;
}

interface ClubData {
  name: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  description: string;
  courtCount: number;
  courtType: string;
  openTime: string;
  closeTime: string;
  membershipFee: number;
  isActive: boolean;
  isVerified: boolean;
  amenities: string[];
  courts: Court[];
}

export default function ManageClubPage() {
  const params = useParams();
  const router = useRouter();
  const clubId = params.clubId as string;
  
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  
  // Form state
  const [formData, setFormData] = useState<ClubData>({
    name: "",
    email: "",
    phone: "",
    website: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    description: "",
    courtCount: 0,
    courtType: "Hard",
    openTime: "08:00",
    closeTime: "20:00",
    membershipFee: 0,
    isActive: true,
    isVerified: false,
    amenities: [],
    courts: []
  });

  const [newAmenity, setNewAmenity] = useState("");

  const courtTypes = ["Hard", "Clay", "Grass", "Carpet", "Artificial Grass"];
  const states = ["AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"];

  useEffect(() => {
    const savedMode = localStorage.getItem("darkMode");
    if (savedMode === "true") {
      setDarkMode(true);
    }
  }, []);

  // Check if user is admin of this club
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push(`/club/${clubId}`);
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const organization = userData.organization;
          const userType = userData.userType;
          
          // Check if user is admin or courtly admin
          const isCourtlyAdmin = userType === 'courtly';
          const isClubAdmin = userType === 'admin' && (
            (Array.isArray(organization) && organization.includes(clubId)) ||
            organization === clubId
          );
          
          if (isCourtlyAdmin || isClubAdmin) {
            setIsAdmin(true);
          } else {
            setError("You don't have permission to view this page.");
            setTimeout(() => router.push(`/club/${clubId}`), 2000);
          }
        } else {
          setError("User data not found.");
          setTimeout(() => router.push(`/club/${clubId}`), 2000);
        }
      } catch (error) {
        console.error("Error checking permissions:", error);
        setError("Failed to verify permissions.");
      }
    });

    return () => unsubscribe();
  }, [clubId, router]);

  // Fetch club data
  useEffect(() => {
    if (!isAdmin) return;

    const fetchClubData = async () => {
      try {
        setLoading(true);
        
        const clubDoc = await getDoc(doc(db, "orgs", clubId));
        
        if (clubDoc.exists()) {
          const data = clubDoc.data();
          setFormData({
            name: data.name || "",
            email: data.email || "",
            phone: data.phone || "",
            website: data.website || "",
            address: data.address || "",
            city: data.city || "",
            state: data.state || "",
            zip: data.zip || "",
            description: data.description || "",
            courtCount: data.courtCount || 0,
            courtType: data.courtType || "Hard",
            openTime: data.openTime || "08:00",
            closeTime: data.closeTime || "20:00",
            membershipFee: data.membershipFee || 0,
            isActive: data.isActive !== false,
            isVerified: data.isVerified || false,
            amenities: data.amenities || [],
            courts: data.courts || []
          });
        } else {
          setError("Club not found.");
        }
      } catch (error) {
        console.error("Error fetching club data:", error);
        setError("Failed to load club data.");
      } finally {
        setLoading(false);
      }
    };

    fetchClubData();
  }, [clubId, isAdmin]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === "number" ? parseFloat(value) || 0 : value
    }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: checked
    }));
  };

  const handleAddAmenity = () => {
    if (newAmenity.trim() && !formData.amenities.includes(newAmenity.trim())) {
      setFormData(prev => ({
        ...prev,
        amenities: [...prev.amenities, newAmenity.trim()]
      }));
      setNewAmenity("");
    }
  };

  const handleRemoveAmenity = (amenity: string) => {
    setFormData(prev => ({
      ...prev,
      amenities: prev.amenities.filter(a => a !== amenity)
    }));
  };

  const handleAddCourt = () => {
    const newCourt: Court = {
      id: `court-${Date.now()}`,
      name: `Court ${formData.courts.length + 1}`,
      courtType: "Hard",
      isIndoor: false
    };
    
    setFormData(prev => ({
      ...prev,
      courts: [...prev.courts, newCourt],
      courtCount: prev.courts.length + 1
    }));
  };

  const handleUpdateCourt = (courtId: string, field: keyof Court, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      courts: prev.courts.map(court => 
        court.id === courtId ? { ...court, [field]: value } : court
      )
    }));
  };

  const handleRemoveCourt = (courtId: string) => {
    setFormData(prev => ({
      ...prev,
      courts: prev.courts.filter(c => c.id !== courtId),
      courtCount: prev.courts.length - 1
    }));
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      await updateDoc(doc(db, "orgs", clubId), {
        ...formData,
        updatedAt: serverTimestamp()
      });

      setSuccessMessage("Club settings updated successfully!");
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (error) {
      console.error("Error updating club:", error);
      setError("Failed to update club settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        darkMode ? "bg-gray-900 text-gray-50" : "bg-gray-50 text-gray-900"
      }`}>
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        darkMode ? "bg-gray-900 text-gray-50" : "bg-gray-50 text-gray-900"
      }`}>
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="mb-4">{error || "You don't have permission to view this page."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      darkMode ? "bg-gray-900 text-gray-50" : "bg-gray-50 text-gray-900"
    }`}>
      <PageTitle title={`Manage Club - ${formData.name} - Courtly`} />
      
      <header className={`py-6 px-4 shadow-md ${
        darkMode ? "bg-gray-800" : "bg-white"
      }`}>
        <div className="container mx-auto">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Manage Club Settings</h1>
              <p className={`mt-1 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                {formData.name}
              </p>
            </div>
            <Link
              href={`/club/${clubId}`}
              className={`px-4 py-2 rounded-lg ${
                darkMode
                  ? "bg-gray-700 hover:bg-gray-600 text-gray-200"
                  : "bg-gray-200 hover:bg-gray-300 text-gray-700"
              } transition-colors`}
            >
              Back to Club
            </Link>
          </div>
        </div>
      </header>
      
      <div className="container mx-auto px-4 py-8">
        {/* Success/Error Messages */}
        {successMessage && (
          <div className="mb-6 p-4 rounded-lg bg-green-100 border border-green-400 text-green-700">
            {successMessage}
          </div>
        )}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-100 border border-red-400 text-red-700">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className={`rounded-lg shadow-md p-6 ${
          darkMode ? "bg-gray-800" : "bg-white"
        }`}>
          {/* Basic Information */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Basic Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block mb-2 font-medium">Club Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className={`w-full px-4 py-2 rounded-lg border ${
                    darkMode
                      ? "bg-gray-700 border-gray-600 text-white"
                      : "bg-white border-gray-300 text-gray-900"
                  }`}
                />
              </div>

              <div>
                <label className="block mb-2 font-medium">Email *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className={`w-full px-4 py-2 rounded-lg border ${
                    darkMode
                      ? "bg-gray-700 border-gray-600 text-white"
                      : "bg-white border-gray-300 text-gray-900"
                  }`}
                />
              </div>

              <div>
                <label className="block mb-2 font-medium">Phone</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2 rounded-lg border ${
                    darkMode
                      ? "bg-gray-700 border-gray-600 text-white"
                      : "bg-white border-gray-300 text-gray-900"
                  }`}
                />
              </div>

              <div>
                <label className="block mb-2 font-medium">Website</label>
                <input
                  type="url"
                  name="website"
                  value={formData.website}
                  onChange={handleInputChange}
                  placeholder="https://example.com"
                  className={`w-full px-4 py-2 rounded-lg border ${
                    darkMode
                      ? "bg-gray-700 border-gray-600 text-white"
                      : "bg-white border-gray-300 text-gray-900"
                  }`}
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block mb-2 font-medium">Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={4}
                className={`w-full px-4 py-2 rounded-lg border ${
                  darkMode
                    ? "bg-gray-700 border-gray-600 text-white"
                    : "bg-white border-gray-300 text-gray-900"
                }`}
                placeholder="Tell us about your club..."
              />
            </div>
          </div>

          {/* Location */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Location</h2>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block mb-2 font-medium">Street Address</label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2 rounded-lg border ${
                    darkMode
                      ? "bg-gray-700 border-gray-600 text-white"
                      : "bg-white border-gray-300 text-gray-900"
                  }`}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block mb-2 font-medium">City</label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-2 rounded-lg border ${
                      darkMode
                        ? "bg-gray-700 border-gray-600 text-white"
                        : "bg-white border-gray-300 text-gray-900"
                    }`}
                  />
                </div>

                <div>
                  <label className="block mb-2 font-medium">State</label>
                  <select
                    name="state"
                    value={formData.state}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-2 rounded-lg border ${
                      darkMode
                        ? "bg-gray-700 border-gray-600 text-white"
                        : "bg-white border-gray-300 text-gray-900"
                    }`}
                  >
                    <option value="">Select State</option>
                    {states.map(state => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block mb-2 font-medium">ZIP Code</label>
                  <input
                    type="text"
                    name="zip"
                    value={formData.zip}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-2 rounded-lg border ${
                      darkMode
                        ? "bg-gray-700 border-gray-600 text-white"
                        : "bg-white border-gray-300 text-gray-900"
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Facilities */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Facilities</h2>
            
            {/* Membership Fee */}
            <div className="mb-6">
              <label className="block mb-2 font-medium">Membership Fee ($)</label>
              <input
                type="number"
                name="membershipFee"
                value={formData.membershipFee}
                onChange={handleInputChange}
                min="0"
                step="0.01"
                className={`w-full px-4 py-2 rounded-lg border ${
                  darkMode
                    ? "bg-gray-700 border-gray-600 text-white"
                    : "bg-white border-gray-300 text-gray-900"
                }`}
              />
            </div>

            {/* Courts Management */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Courts ({formData.courts.length})</h3>
                <button
                  type="button"
                  onClick={handleAddCourt}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                  Add Court
                </button>
              </div>

              {formData.courts.length > 0 ? (
                <div className="space-y-4">
                  {formData.courts.map((court) => (
                    <div
                      key={court.id}
                      className={`p-4 rounded-lg border ${
                        darkMode ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-200"
                      }`}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div>
                          <label className="block mb-2 text-sm font-medium">Court Name</label>
                          <input
                            type="text"
                            value={court.name}
                            onChange={(e) => handleUpdateCourt(court.id, 'name', e.target.value)}
                            className={`w-full px-3 py-2 rounded border ${
                              darkMode
                                ? "bg-gray-800 border-gray-600 text-white"
                                : "bg-white border-gray-300 text-gray-900"
                            }`}
                          />
                        </div>

                        <div>
                          <label className="block mb-2 text-sm font-medium">Surface Type</label>
                          <select
                            value={court.courtType}
                            onChange={(e) => handleUpdateCourt(court.id, 'courtType', e.target.value)}
                            className={`w-full px-3 py-2 rounded border ${
                              darkMode
                                ? "bg-gray-800 border-gray-600 text-white"
                                : "bg-white border-gray-300 text-gray-900"
                            }`}
                          >
                            {courtTypes.map(type => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={court.isIndoor}
                              onChange={(e) => handleUpdateCourt(court.id, 'isIndoor', e.target.checked)}
                              className="mr-2 h-4 w-4"
                            />
                            <span className="text-sm font-medium">Indoor Court</span>
                          </label>
                        </div>

                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleRemoveCourt(court.id)}
                            className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition text-sm"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={`p-8 text-center rounded-lg border-2 border-dashed ${
                  darkMode ? "border-gray-600 text-gray-400" : "border-gray-300 text-gray-500"
                }`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <p>No courts added yet. Click "Add Court" to get started.</p>
                </div>
              )}
            </div>
          </div>

          {/* Operating Hours */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Operating Hours</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block mb-2 font-medium">Opening Time</label>
                <input
                  type="time"
                  name="openTime"
                  value={formData.openTime}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2 rounded-lg border ${
                    darkMode
                      ? "bg-gray-700 border-gray-600 text-white"
                      : "bg-white border-gray-300 text-gray-900"
                  }`}
                />
              </div>

              <div>
                <label className="block mb-2 font-medium">Closing Time</label>
                <input
                  type="time"
                  name="closeTime"
                  value={formData.closeTime}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2 rounded-lg border ${
                    darkMode
                      ? "bg-gray-700 border-gray-600 text-white"
                      : "bg-white border-gray-300 text-gray-900"
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Amenities */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Amenities</h2>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newAmenity}
                onChange={(e) => setNewAmenity(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddAmenity())}
                placeholder="Add amenity (e.g., Parking, Locker Rooms)"
                className={`flex-1 px-4 py-2 rounded-lg border ${
                  darkMode
                    ? "bg-gray-700 border-gray-600 text-white"
                    : "bg-white border-gray-300 text-gray-900"
                }`}
              />
              <button
                type="button"
                onClick={handleAddAmenity}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
              >
                Add
              </button>
            </div>
            
            {formData.amenities.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.amenities.map((amenity, index) => (
                  <span
                    key={index}
                    className={`px-3 py-1 rounded-full text-sm flex items-center gap-2 ${
                      darkMode ? "bg-gray-700 text-gray-200" : "bg-gray-200 text-gray-800"
                    }`}
                  >
                    {amenity}
                    <button
                      type="button"
                      onClick={() => handleRemoveAmenity(amenity)}
                      className="text-red-500 hover:text-red-700"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Status */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Status</h2>
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleCheckboxChange}
                  className="mr-3 h-5 w-5"
                />
                <span>Club is active and accepting members</span>
              </label>
              
              <div className={`p-3 rounded-lg ${
                darkMode ? "bg-gray-700" : "bg-gray-100"
              }`}>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="isVerified"
                    checked={formData.isVerified}
                    disabled
                    className="mr-3 h-5 w-5"
                  />
                  <span className={darkMode ? "text-gray-400" : "text-gray-600"}>
                    Verified by Courtly (Contact admin to change)
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={saving}
              className={`flex-1 py-3 rounded-lg font-semibold transition ${
                saving
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            
            <Link
              href={`/club/${clubId}`}
              className={`px-6 py-3 rounded-lg font-semibold text-center ${
                darkMode
                  ? "bg-gray-700 hover:bg-gray-600 text-gray-200"
                  : "bg-gray-200 hover:bg-gray-300 text-gray-700"
              }`}
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
