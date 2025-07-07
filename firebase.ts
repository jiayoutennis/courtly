import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCP-ePxdafo9vWHIy-grvP4-z00mQXYrW8",
  authDomain: "courtly-by-jiayou-tennis.firebaseapp.com",
  projectId: "courtly-by-jiayou-tennis",
  storageBucket: "courtly-by-jiayou-tennis.firebasestorage.app",
  messagingSenderId: "103287088276",
  appId: "1:103287088276:web:4c5f62d4a77a2f28790081",
  measurementId: "G-J97X6XY6EJ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { db, auth, storage };