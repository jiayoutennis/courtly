"use client";

import { useState, useEffect } from 'react';
import { db } from '../../../firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';

export default function TestReservationPage() {
  // Location state
  const [locations, setLocations] = useState<any[]>([]);
  const [newLocation, setNewLocation] = useState({ name: '', address: '', city: '', state: '' });
  
  // Court state
  const [selectedLocation, setSelectedLocation] = useState('');
  const [courts, setCourts] = useState<any[]>([]);
  const [newCourt, setNewCourt] = useState({ name: '', surface: '', indoor: false });
  
  // Reservation state
  const [selectedCourt, setSelectedCourt] = useState('');
  const [reservations, setReservations] = useState<any[]>([]);
  const [newReservation, setNewReservation] = useState({
    startTime: '',
    endTime: '',
    userName: '',
    userEmail: '',
  });
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fetch locations on component mount
  useEffect(() => {
    fetchLocations();
  }, []);

  // Fetch courts when a location is selected
  useEffect(() => {
    if (selectedLocation) {
      fetchCourts();
    } else {
      setCourts([]);
    }
  }, [selectedLocation]);

  // Fetch reservations when a court is selected
  useEffect(() => {
    if (selectedCourt) {
      fetchReservations();
    } else {
      setReservations([]);
    }
  }, [selectedCourt]);

  // LOCATION FUNCTIONS
  const fetchLocations = async () => {
    setLoading(true);
    try {
      const locationsRef = collection(db, 'locations');
      const snapshot = await getDocs(locationsRef);
      const locationsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setLocations(locationsList);
    } catch (error: any) {
      setError(`Error fetching locations: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const addLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const locationData = {
        ...newLocation,
        createdAt: serverTimestamp(),
      };
      
      const docRef = await addDoc(collection(db, 'locations'), locationData);
      
      setSuccess(`Location added with ID: ${docRef.id}`);
      setNewLocation({ name: '', address: '', city: '', state: '' });
      fetchLocations();
    } catch (error: any) {
      setError(`Error adding location: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // COURT FUNCTIONS
  const fetchCourts = async () => {
    setLoading(true);
    try {
      const courtsRef = collection(db, `locations/${selectedLocation}/courts`);
      const snapshot = await getDocs(courtsRef);
      const courtsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCourts(courtsList);
    } catch (error: any) {
      setError(`Error fetching courts: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const addCourt = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      if (!selectedLocation) {
        throw new Error('No location selected');
      }
      
      const courtData = {
        ...newCourt,
        createdAt: serverTimestamp(),
      };
      
      const docRef = await addDoc(
        collection(db, `locations/${selectedLocation}/courts`), 
        courtData
      );
      
      setSuccess(`Court added with ID: ${docRef.id}`);
      setNewCourt({ name: '', surface: '', indoor: false });
      fetchCourts();
    } catch (error: any) {
      setError(`Error adding court: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // RESERVATION FUNCTIONS
  const fetchReservations = async () => {
    setLoading(true);
    try {
      const reservationsRef = collection(db, 'reservations');
      const q = query(
        reservationsRef, 
        where('locationId', '==', selectedLocation),
        where('courtId', '==', selectedCourt)
      );
      
      const snapshot = await getDocs(q);
      const reservationsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startTime: doc.data().startTime?.toDate().toLocaleString() || '',
        endTime: doc.data().endTime?.toDate().toLocaleString() || '',
      }));
      
      setReservations(reservationsList);
    } catch (error: any) {
      setError(`Error fetching reservations: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const addReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      if (!selectedLocation || !selectedCourt) {
        throw new Error('Please select both a location and court');
      }
      
      // Check if the start and end times are valid dates
      const startDate = new Date(newReservation.startTime);
      const endDate = new Date(newReservation.endTime);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new Error('Invalid date format');
      }
      
      if (startDate >= endDate) {
        throw new Error('End time must be after start time');
      }
      
      // Check if there are any overlapping reservations
      const reservationsRef = collection(db, 'reservations');
      const q = query(
        reservationsRef, 
        where('locationId', '==', selectedLocation),
        where('courtId', '==', selectedCourt)
      );
      
      const snapshot = await getDocs(q);
      
      const hasOverlap = snapshot.docs.some(doc => {
        const reservation = doc.data();
        const resStart = reservation.startTime.toDate();
        const resEnd = reservation.endTime.toDate();
        
        // Check if the new reservation overlaps with this one
        return (
          (startDate < resEnd && endDate > resStart) ||
          (resStart < endDate && resEnd > startDate)
        );
      });
      
      if (hasOverlap) {
        throw new Error('This time slot overlaps with an existing reservation');
      }
      
      const reservationData = {
        locationId: selectedLocation,
        courtId: selectedCourt,
        startTime: Timestamp.fromDate(startDate),
        endTime: Timestamp.fromDate(endDate),
        userName: newReservation.userName,
        userEmail: newReservation.userEmail,
        createdAt: serverTimestamp(),
      };
      
      const docRef = await addDoc(collection(db, 'reservations'), reservationData);
      
      setSuccess(`Reservation added with ID: ${docRef.id}`);
      setNewReservation({
        startTime: '',
        endTime: '',
        userName: '',
        userEmail: '',
      });
      fetchReservations();
    } catch (error: any) {
      setError(`Error adding reservation: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteReservation = async (id: string) => {
    if (!confirm('Are you sure you want to delete this reservation?')) return;
    
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'reservations', id));
      setSuccess('Reservation deleted successfully');
      fetchReservations();
    } catch (error: any) {
      setError(`Error deleting reservation: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6">Test Court Reservation System</h1>
      
      {/* Status Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}
      
      {success && (
        <div className="mb-4 p-3 bg-green-100 text-green-700 rounded">
          {success}
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LOCATIONS SECTION */}
        <div className="border rounded-lg p-4 bg-white shadow">
          <h2 className="text-xl font-semibold mb-4">Locations</h2>
          
          {/* Add Location Form */}
          <form onSubmit={addLocation} className="mb-6">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  className="w-full border rounded p-2"
                  value={newLocation.name}
                  onChange={(e) => setNewLocation({...newLocation, name: e.target.value})}
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Address</label>
                <input
                  type="text"
                  className="w-full border rounded p-2"
                  value={newLocation.address}
                  onChange={(e) => setNewLocation({...newLocation, address: e.target.value})}
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium mb-1">City</label>
                  <input
                    type="text"
                    className="w-full border rounded p-2"
                    value={newLocation.city}
                    onChange={(e) => setNewLocation({...newLocation, city: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">State</label>
                  <input
                    type="text"
                    className="w-full border rounded p-2"
                    value={newLocation.state}
                    onChange={(e) => setNewLocation({...newLocation, state: e.target.value})}
                    required
                  />
                </div>
              </div>
              
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-500 text-white p-2 rounded hover:bg-green-600 disabled:opacity-50"
              >
                {loading ? 'Adding...' : 'Add Location'}
              </button>
            </div>
          </form>
          
          {/* Location List */}
          <div className="space-y-2">
            <h3 className="font-medium">Existing Locations</h3>
            {locations.length > 0 ? (
              <div className="space-y-2">
                {locations.map(location => (
                  <div key={location.id} className="border p-2 rounded bg-gray-50">
                    <div className="flex justify-between">
                      <button
                        className="font-medium text-blue-600 hover:text-blue-800"
                        onClick={() => setSelectedLocation(location.id)}
                      >
                        {location.name}
                      </button>
                      {selectedLocation === location.id && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Selected</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      {location.address}, {location.city}, {location.state}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No locations found</p>
            )}
          </div>
        </div>
        
        {/* COURTS SECTION */}
        <div className="border rounded-lg p-4 bg-white shadow">
          <h2 className="text-xl font-semibold mb-4">Courts</h2>
          
          {selectedLocation ? (
            <>
              {/* Add Court Form */}
              <form onSubmit={addCourt} className="mb-6">
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Court Name</label>
                    <input
                      type="text"
                      className="w-full border rounded p-2"
                      value={newCourt.name}
                      onChange={(e) => setNewCourt({...newCourt, name: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Surface Type</label>
                    <select
                      className="w-full border rounded p-2"
                      value={newCourt.surface}
                      onChange={(e) => setNewCourt({...newCourt, surface: e.target.value})}
                      required
                    >
                      <option value="">Select surface</option>
                      <option value="hard">Hard</option>
                      <option value="clay">Clay</option>
                      <option value="grass">Grass</option>
                      <option value="carpet">Carpet</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="indoor"
                      checked={newCourt.indoor}
                      onChange={(e) => setNewCourt({...newCourt, indoor: e.target.checked})}
                      className="mr-2"
                    />
                    <label htmlFor="indoor" className="text-sm font-medium">Indoor Court</label>
                  </div>
                  
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-green-500 text-white p-2 rounded hover:bg-green-600 disabled:opacity-50"
                  >
                    {loading ? 'Adding...' : 'Add Court'}
                  </button>
                </div>
              </form>
              
              {/* Court List */}
              <div className="space-y-2">
                <h3 className="font-medium">Courts at Selected Location</h3>
                {courts.length > 0 ? (
                  <div className="space-y-2">
                    {courts.map(court => (
                      <div key={court.id} className="border p-2 rounded bg-gray-50">
                        <div className="flex justify-between">
                          <button
                            className="font-medium text-blue-600 hover:text-blue-800"
                            onClick={() => setSelectedCourt(court.id)}
                          >
                            {court.name}
                          </button>
                          {selectedCourt === court.id && (
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Selected</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          {court.surface} | {court.indoor ? 'Indoor' : 'Outdoor'}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No courts found for this location</p>
                )}
              </div>
            </>
          ) : (
            <div className="text-center p-4 bg-gray-50 rounded">
              <p>Please select a location first</p>
            </div>
          )}
        </div>
        
        {/* RESERVATIONS SECTION */}
        <div className="border rounded-lg p-4 bg-white shadow">
          <h2 className="text-xl font-semibold mb-4">Reservations</h2>
          
          {selectedCourt && selectedLocation ? (
            <>
              {/* Add Reservation Form */}
              <form onSubmit={addReservation} className="mb-6">
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">User Name</label>
                    <input
                      type="text"
                      className="w-full border rounded p-2"
                      value={newReservation.userName}
                      onChange={(e) => setNewReservation({...newReservation, userName: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">User Email</label>
                    <input
                      type="email"
                      className="w-full border rounded p-2"
                      value={newReservation.userEmail}
                      onChange={(e) => setNewReservation({...newReservation, userEmail: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Start Time</label>
                    <input
                      type="datetime-local"
                      className="w-full border rounded p-2"
                      value={newReservation.startTime}
                      onChange={(e) => setNewReservation({...newReservation, startTime: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">End Time</label>
                    <input
                      type="datetime-local"
                      className="w-full border rounded p-2"
                      value={newReservation.endTime}
                      onChange={(e) => setNewReservation({...newReservation, endTime: e.target.value})}
                      required
                    />
                  </div>
                  
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-green-500 text-white p-2 rounded hover:bg-green-600 disabled:opacity-50"
                  >
                    {loading ? 'Booking...' : 'Book Court'}
                  </button>
                </div>
              </form>
              
              {/* Reservations List */}
              <div className="space-y-2">
                <h3 className="font-medium">Existing Reservations</h3>
                {reservations.length > 0 ? (
                  <div className="space-y-2">
                    {reservations.map(reservation => (
                      <div key={reservation.id} className="border p-2 rounded bg-gray-50">
                        <div className="font-medium">{reservation.userName}</div>
                        <div className="text-sm">{reservation.userEmail}</div>
                        <div className="text-sm text-gray-500">
                          <div>Start: {reservation.startTime}</div>
                          <div>End: {reservation.endTime}</div>
                        </div>
                        <button
                          onClick={() => deleteReservation(reservation.id)}
                          className="mt-2 text-xs text-red-600 hover:text-red-800"
                        >
                          Cancel Reservation
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No reservations found for this court</p>
                )}
              </div>
            </>
          ) : (
            <div className="text-center p-4 bg-gray-50 rounded">
              <p>Please select a location and court first</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}