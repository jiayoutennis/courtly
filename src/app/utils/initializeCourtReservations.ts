import { db } from '../../../firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  getDoc,
  query,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';

/**
 * Initialize court reservation data structure for all clubs
 * This script:
 * 1. Fetches all clubs from the orgs collection
 * 2. For each club, ensures courts subcollection exists with proper structure
 * 3. Sets up default operating hours if not present
 * 4. Sets up booking settings if not present
 */

export interface CourtData {
  id: string;
  name: string;
  courtNumber: number;
  surface: string; // 'Hard', 'Clay', 'Grass', 'Carpet'
  isIndoor: boolean;
  hasLights: boolean;
  isActive: boolean;
  openTime?: string; // e.g., "08:00"
  closeTime?: string; // e.g., "20:00"
  createdAt: any;
  updatedAt: any;
}

export interface OperatingHours {
  monday?: { open: string; close: string; closed?: boolean };
  tuesday?: { open: string; close: string; closed?: boolean };
  wednesday?: { open: string; close: string; closed?: boolean };
  thursday?: { open: string; close: string; closed?: boolean };
  friday?: { open: string; close: string; closed?: boolean };
  saturday?: { open: string; close: string; closed?: boolean };
  sunday?: { open: string; close: string; closed?: boolean };
}

export interface BookingSettings {
  maxDaysInAdvance: number; // e.g., 14 days
  minBookingDuration: number; // e.g., 1 hour
  maxBookingDuration: number; // e.g., 2 hours
  slotInterval: number; // e.g., 30 minutes
  allowOverlapping: boolean;
  requireApproval: boolean;
}

export interface ClubReservationConfig {
  orgId: string;
  name: string;
  courts: CourtData[];
  operatingHours: OperatingHours;
  bookingSettings: BookingSettings;
}

/**
 * Default operating hours - 8am to 8pm every day
 */
const DEFAULT_OPERATING_HOURS: OperatingHours = {
  monday: { open: "08:00", close: "20:00", closed: false },
  tuesday: { open: "08:00", close: "20:00", closed: false },
  wednesday: { open: "08:00", close: "20:00", closed: false },
  thursday: { open: "08:00", close: "20:00", closed: false },
  friday: { open: "08:00", close: "20:00", closed: false },
  saturday: { open: "08:00", close: "20:00", closed: false },
  sunday: { open: "08:00", close: "20:00", closed: false },
};

/**
 * Default booking settings
 */
const DEFAULT_BOOKING_SETTINGS: BookingSettings = {
  maxDaysInAdvance: 14, // 2 weeks ahead
  minBookingDuration: 1, // 1 hour minimum
  maxBookingDuration: 2, // 2 hours maximum
  slotInterval: 30, // 30-minute slots
  allowOverlapping: false,
  requireApproval: false,
};

/**
 * Get all clubs from the orgs collection
 */
export async function getAllClubs() {
  try {
    const orgsQuery = query(collection(db, "orgs"));
    const querySnapshot = await getDocs(orgsQuery);
    
    const clubs: any[] = [];
    querySnapshot.forEach((doc) => {
      clubs.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return { success: true, clubs };
  } catch (error: any) {
    console.error("Error fetching clubs:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Initialize default courts for a club if they don't exist
 */
export async function initializeDefaultCourts(orgId: string, courtCount: number = 4) {
  try {
    const courtsRef = collection(db, `orgs/${orgId}/courts`);
    const courtsSnapshot = await getDocs(courtsRef);
    
    // Check if courts already exist
    if (!courtsSnapshot.empty) {
      console.log(`Club ${orgId} already has ${courtsSnapshot.size} courts`);
      return { success: true, message: "Courts already exist", count: courtsSnapshot.size };
    }
    
    // Create default courts
    const batch = writeBatch(db);
    const createdCourts: string[] = [];
    
    for (let i = 1; i <= courtCount; i++) {
      const courtRef = doc(courtsRef);
      const courtData: Omit<CourtData, 'id'> = {
        name: `Court ${i}`,
        courtNumber: i,
        surface: "Hard",
        isIndoor: false,
        hasLights: true,
        isActive: true,
        openTime: "08:00",
        closeTime: "20:00",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      batch.set(courtRef, courtData);
      createdCourts.push(`Court ${i}`);
    }
    
    await batch.commit();
    console.log(`Created ${courtCount} default courts for club ${orgId}`);
    
    return { 
      success: true, 
      message: `Created ${courtCount} courts`, 
      courts: createdCourts 
    };
  } catch (error: any) {
    console.error(`Error initializing courts for club ${orgId}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Set operating hours for a club
 */
export async function setOperatingHours(orgId: string, hours?: OperatingHours) {
  try {
    const orgRef = doc(db, "orgs", orgId);
    const orgDoc = await getDoc(orgRef);
    
    if (!orgDoc.exists()) {
      return { success: false, error: "Club not found" };
    }
    
    const existingData = orgDoc.data();
    
    // Only update if operating hours don't exist
    if (existingData.operatingHours) {
      console.log(`Club ${orgId} already has operating hours`);
      return { success: true, message: "Operating hours already exist" };
    }
    
    const hoursToSet = hours || DEFAULT_OPERATING_HOURS;
    
    await setDoc(orgRef, {
      operatingHours: hoursToSet,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    
    console.log(`Set operating hours for club ${orgId}`);
    return { success: true, message: "Operating hours set" };
  } catch (error: any) {
    console.error(`Error setting operating hours for club ${orgId}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Set booking settings for a club
 */
export async function setBookingSettings(orgId: string, settings?: BookingSettings) {
  try {
    const orgRef = doc(db, "orgs", orgId);
    const orgDoc = await getDoc(orgRef);
    
    if (!orgDoc.exists()) {
      return { success: false, error: "Club not found" };
    }
    
    const existingData = orgDoc.data();
    
    // Only update if booking settings don't exist
    if (existingData.bookingSettings) {
      console.log(`Club ${orgId} already has booking settings`);
      return { success: true, message: "Booking settings already exist" };
    }
    
    const settingsToSet = settings || DEFAULT_BOOKING_SETTINGS;
    
    await setDoc(orgRef, {
      bookingSettings: settingsToSet,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    
    console.log(`Set booking settings for club ${orgId}`);
    return { success: true, message: "Booking settings set" };
  } catch (error: any) {
    console.error(`Error setting booking settings for club ${orgId}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Initialize complete reservation system for a single club
 */
export async function initializeClubReservationSystem(
  orgId: string, 
  clubName: string,
  courtCount?: number
) {
  console.log(`\n=== Initializing reservation system for ${clubName} (${orgId}) ===`);
  
  const results = {
    clubName,
    orgId,
    courts: null as any,
    operatingHours: null as any,
    bookingSettings: null as any,
  };
  
  // 1. Initialize courts
  const courtsResult = await initializeDefaultCourts(
    orgId, 
    courtCount || 4
  );
  results.courts = courtsResult;
  
  // 2. Set operating hours
  const hoursResult = await setOperatingHours(orgId);
  results.operatingHours = hoursResult;
  
  // 3. Set booking settings
  const settingsResult = await setBookingSettings(orgId);
  results.bookingSettings = settingsResult;
  
  console.log(`✅ Completed initialization for ${clubName}`);
  return results;
}

/**
 * Initialize reservation system for ALL clubs
 */
export async function initializeAllClubReservations() {
  console.log("🚀 Starting initialization of court reservation systems for all clubs...\n");
  
  // Get all clubs
  const clubsResult = await getAllClubs();
  
  if (!clubsResult.success || !clubsResult.clubs) {
    console.error("❌ Failed to fetch clubs:", clubsResult.error);
    return { success: false, error: clubsResult.error };
  }
  
  const clubs = clubsResult.clubs;
  console.log(`Found ${clubs.length} clubs to process\n`);
  
  const results = [];
  
  // Process each club
  for (const club of clubs) {
    try {
      const courtCount = club.courtCount || club.courts || 4; // Use existing count or default to 4
      const result = await initializeClubReservationSystem(
        club.id,
        club.name || "Unnamed Club",
        courtCount
      );
      results.push(result);
    } catch (error: any) {
      console.error(`❌ Error processing club ${club.name}:`, error.message);
      results.push({
        clubName: club.name,
        orgId: club.id,
        error: error.message,
      });
    }
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("📊 INITIALIZATION SUMMARY");
  console.log("=".repeat(60));
  console.log(`Total clubs processed: ${clubs.length}`);
  console.log(`Successful: ${results.filter((r: any) => !r.error).length}`);
  console.log(`Failed: ${results.filter((r: any) => r.error).length}`);
  console.log("=".repeat(60) + "\n");
  
  return {
    success: true,
    totalClubs: clubs.length,
    results,
  };
}

/**
 * Utility to check reservation system status for a club
 */
export async function checkClubReservationStatus(orgId: string) {
  try {
    // Check org document
    const orgRef = doc(db, "orgs", orgId);
    const orgDoc = await getDoc(orgRef);
    
    if (!orgDoc.exists()) {
      return { success: false, error: "Club not found" };
    }
    
    const orgData = orgDoc.data();
    
    // Check courts
    const courtsRef = collection(db, `orgs/${orgId}/courts`);
    const courtsSnapshot = await getDocs(courtsRef);
    const courts: any[] = [];
    courtsSnapshot.forEach(doc => {
      courts.push({ id: doc.id, ...doc.data() });
    });
    
    return {
      success: true,
      clubName: orgData.name,
      hasOperatingHours: !!orgData.operatingHours,
      hasBookingSettings: !!orgData.bookingSettings,
      courtCount: courts.length,
      courts: courts.map(c => ({
        id: c.id,
        name: c.name,
        number: c.courtNumber,
        surface: c.surface,
        isActive: c.isActive,
      })),
      operatingHours: orgData.operatingHours || null,
      bookingSettings: orgData.bookingSettings || null,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
