import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCP-ePxdafo9vWHIy-grvP4-z00mQXYrW8",
  authDomain: "courtly-by-jiayou-tennis.firebaseapp.com",
  projectId: "courtly-by-jiayou-tennis",
  storageBucket: "courtly-by-jiayou-tennis.appspot.com",
  messagingSenderId: "103287088276",
  appId: "1:103287088276:web:4c5f62d4a77a2f28790081",
  measurementId: "G-J97X6XY6EJ"
};

// Initialize Firebase if it hasn't been initialized
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app!);
const auth = getAuth(app);
const storage = getStorage(app);

// Collection references for type safety
const publicClubsCollection = collection(db, 'publicClubs');
const reservationsCollection = collection(db, 'reservations');
const courtsCollection = collection(db, 'courts');
const eventsCollection = collection(db, 'events');
const locationsCollection = collection(db, 'locations');

// ===== User Management Functions =====
export const createUser = async (email: string, password: string, userData: any) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Store user data in Firestore
    await setDoc(doc(db, 'users', user.uid), {
      ...userData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    return { user, success: true };
  } catch (error: any) {
    return { error: error.message, success: false };
  }
};

export const updateUser = async (userId: string, userData: any) => {
  try {
    await updateDoc(doc(db, 'users', userId), {
      ...userData,
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error: any) {
    return { error: error.message, success: false };
  }
};

export const getUserById = async (userId: string) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      return { user: { id: userDoc.id, ...userDoc.data() }, success: true };
    } else {
      return { error: 'User not found', success: false };
    }
  } catch (error: any) {
    return { error: error.message, success: false };
  }
};

// ===== Club Management Functions =====
export const createClub = async (clubData: any) => {
  try {
    const docRef = await addDoc(publicClubsCollection, {
      ...clubData,
      approved: false, // New clubs require approval
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    return { clubId: docRef.id, success: true };
  } catch (error: any) {
    return { error: error.message, success: false };
  }
};

export const updateClub = async (clubId: string, clubData: any) => {
  try {
    await updateDoc(doc(db, 'publicClubs', clubId), {
      ...clubData,
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error: any) {
    return { error: error.message, success: false };
  }
};

export const approveClub = async (clubId: string) => {
  try {
    await updateDoc(doc(db, 'publicClubs', clubId), {
      approved: true,
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error: any) {
    return { error: error.message, success: false };
  }
};

export const getClubById = async (clubId: string) => {
  try {
    const clubDoc = await getDoc(doc(db, 'publicClubs', clubId));
    if (clubDoc.exists()) {
      return { club: { id: clubDoc.id, ...clubDoc.data() }, success: true };
    } else {
      return { error: 'Club not found', success: false };
    }
  } catch (error: any) {
    return { error: error.message, success: false };
  }
};

export const getAllClubs = async (limitCount: number = 100) => {
  try {
    const q = query(publicClubsCollection, 
      where('approved', '==', true),
      orderBy('createdAt', 'desc'),
      limit(limitCount));
    
    const querySnapshot = await getDocs(q);
    const clubs: any[] = [];
    querySnapshot.forEach((doc) => {
      clubs.push({ id: doc.id, ...doc.data() });
    });
    
    return { clubs, success: true };
  } catch (error: any) {
    return { error: error.message, success: false };
  }
};

export const getPendingClubs = async () => {
  try {
    const q = query(publicClubsCollection, 
      where('approved', '==', false),
      orderBy('createdAt', 'desc'));
    
    const querySnapshot = await getDocs(q);
    const clubs: any[] = [];
    querySnapshot.forEach((doc) => {
      clubs.push({ id: doc.id, ...doc.data() });
    });
    
    return { clubs, success: true };
  } catch (error: any) {
    return { error: error.message, success: false };
  }
};

// ===== Court Management Functions =====
export const createCourt = async (courtData: any) => {
  try {
    const docRef = await addDoc(courtsCollection, {
      ...courtData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    return { courtId: docRef.id, success: true };
  } catch (error: any) {
    return { error: error.message, success: false };
  }
};

export const updateCourt = async (courtId: string, courtData: any) => {
  try {
    await updateDoc(doc(db, 'courts', courtId), {
      ...courtData,
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error: any) {
    return { error: error.message, success: false };
  }
};

export const deleteCourt = async (courtId: string) => {
  try {
    await deleteDoc(doc(db, 'courts', courtId));
    return { success: true };
  } catch (error: any) {
    return { error: error.message, success: false };
  }
};

export const getCourtById = async (courtId: string) => {
  try {
    const courtDoc = await getDoc(doc(db, 'courts', courtId));
    if (courtDoc.exists()) {
      return { court: { id: courtDoc.id, ...courtDoc.data() }, success: true };
    } else {
      return { error: 'Court not found', success: false };
    }
  } catch (error: any) {
    return { error: error.message, success: false };
  }
};

export const getCourtsByClub = async (clubId: string) => {
  try {
    const q = query(courtsCollection, 
      where('clubId', '==', clubId),
      orderBy('courtNumber', 'asc'));
    
    const querySnapshot = await getDocs(q);
    const courts: any[] = [];
    querySnapshot.forEach((doc) => {
      courts.push({ id: doc.id, ...doc.data() });
    });
    
    return { courts, success: true };
  } catch (error: any) {
    return { error: error.message, success: false };
  }
};

// ===== Reservation Management Functions =====
export const createReservation = async (reservationData: any) => {
  try {
    // Check for overlapping reservations
    const startTime = reservationData.startTime;
    const endTime = reservationData.endTime;
    const courtId = reservationData.courtId;
    
    const overlapQuery = query(reservationsCollection,
      where('courtId', '==', courtId),
      where('status', '==', 'confirmed'),
      where('startTime', '<', endTime),
      where('endTime', '>', startTime));
    
    const overlappingReservations = await getDocs(overlapQuery);
    
    if (!overlappingReservations.empty) {
      return { error: 'This time slot is already booked', success: false };
    }
    
    const docRef = await addDoc(reservationsCollection, {
      ...reservationData,
      status: 'confirmed',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    return { reservationId: docRef.id, success: true };
  } catch (error: any) {
    return { error: error.message, success: false };
  }
};

export const updateReservation = async (reservationId: string, reservationData: any) => {
  try {
    await updateDoc(doc(db, 'reservations', reservationId), {
      ...reservationData,
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error: any) {
    return { error: error.message, success: false };
  }
};

export const cancelReservation = async (reservationId: string) => {
  try {
    await updateDoc(doc(db, 'reservations', reservationId), {
      status: 'cancelled',
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error: any) {
    return { error: error.message, success: false };
  }
};

export const getUserReservations = async (userId: string) => {
  try {
    const q = query(reservationsCollection, 
      where('userId', '==', userId),
      orderBy('startTime', 'desc'));
    
    const querySnapshot = await getDocs(q);
    const reservations: any[] = [];
    querySnapshot.forEach((doc) => {
      reservations.push({ id: doc.id, ...doc.data() });
    });
    
    return { reservations, success: true };
  } catch (error: any) {
    return { error: error.message, success: false };
  }
};

export const getClubReservations = async (clubId: string, startDate: Date, endDate: Date) => {
  try {
    const q = query(reservationsCollection, 
      where('clubId', '==', clubId),
      where('startTime', '>=', startDate),
      where('startTime', '<=', endDate),
      orderBy('startTime', 'asc'));
    
    const querySnapshot = await getDocs(q);
    const reservations: any[] = [];
    querySnapshot.forEach((doc) => {
      reservations.push({ id: doc.id, ...doc.data() });
    });
    
    return { reservations, success: true };
  } catch (error: any) {
    return { error: error.message, success: false };
  }
};

// ===== Location Management Functions =====
export const createLocation = async (locationData: any) => {
  try {
    const docRef = await addDoc(locationsCollection, {
      ...locationData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    return { locationId: docRef.id, success: true };
  } catch (error: any) {
    return { error: error.message, success: false };
  }
};

export const updateLocation = async (locationId: string, locationData: any) => {
  try {
    await updateDoc(doc(db, 'locations', locationId), {
      ...locationData,
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error: any) {
    return { error: error.message, success: false };
  }
};

export const getLocationsByClub = async (clubId: string) => {
  try {
    const q = query(locationsCollection, 
      where('clubId', '==', clubId),
      orderBy('name', 'asc'));
    
    const querySnapshot = await getDocs(q);
    const locations: any[] = [];
    querySnapshot.forEach((doc) => {
      locations.push({ id: doc.id, ...doc.data() });
    });
    
    return { locations, success: true };
  } catch (error: any) {
    return { error: error.message, success: false };
  }
};

// ===== Event Management Functions =====
export const createEvent = async (eventData: any) => {
  try {
    const docRef = await addDoc(eventsCollection, {
      ...eventData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    return { eventId: docRef.id, success: true };
  } catch (error: any) {
    return { error: error.message, success: false };
  }
};

export const updateEvent = async (eventId: string, eventData: any) => {
  try {
    await updateDoc(doc(db, 'events', eventId), {
      ...eventData,
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error: any) {
    return { error: error.message, success: false };
  }
};

export const getEventsByClub = async (clubId: string) => {
  try {
    const q = query(eventsCollection, 
      where('clubId', '==', clubId),
      where('startDate', '>=', new Date()),
      orderBy('startDate', 'asc'));
    
    const querySnapshot = await getDocs(q);
    const events: any[] = [];
    querySnapshot.forEach((doc) => {
      events.push({ id: doc.id, ...doc.data() });
    });
    
    return { events, success: true };
  } catch (error: any) {
    return { error: error.message, success: false };
  }
};

// ===== File Storage Functions =====
export const uploadFile = async (file: File, path: string) => {
  try {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    
    return { downloadURL, success: true };
  } catch (error: any) {
    return { error: error.message, success: false };
  }
};

export const deleteFile = async (path: string) => {
  try {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
    
    return { success: true };
  } catch (error: any) {
    return { error: error.message, success: false };
  }
};

// Export Firebase instances
export { db, auth, storage };