/**
 * Club Initialization Utility
 * 
 * This file provides functions to properly initialize a new club in Firestore
 * with all necessary subcollections and default data according to the /orgs schema.
 */

import { db } from "../../firebase";
import {
  doc,
  setDoc,
  Timestamp
} from "firebase/firestore";
import type { Org, Court } from "../../shared/types";

interface ClubData {
  name: string;
  email: string;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  city: string;
  state: string;
  zip?: string | null;
  description?: string | null;
  courts?: number;
  courtType?: string;
  approved?: boolean;
  submittedBy?: string;
  submitterEmail?: string;
  submitterName?: string;
  createdAt?: any;
  originalRequestId?: string;
  latitude?: number;
  longitude?: number;
}

/**
 * Initialize a new club with the complete /orgs schema
 * 
 * @param clubId - The ID of the club (will be used as orgId)
 * @param clubData - The club's basic information
 * @returns Promise<void>
 */
export async function initializeClubCollections(
  clubId: string,
  clubData: ClubData
): Promise<void> {
  try {
    console.log(`Initializing club: ${clubId} (${clubData.name})`);
    
    // 1. Create the org document with full schema (includes operating hours and booking settings)
    await createOrgDocument(clubId, clubData);
    
    // 2. Initialize Courts subcollection in /orgs (with proper court reservation structure)
    await initializeCourts(clubId, clubData);
    
    // 3. Initialize empty collections (bookings, blocks, audit) in /orgs
    await initializeEmptyCollections(clubId);
    
    console.log(`✅ Successfully initialized club: ${clubId} with court reservation system`);
  } catch (error) {
    console.error(`Error initializing club ${clubId}:`, error);
    throw error;
  }
}

/**
 * Create the org document with complete schema
 */
async function createOrgDocument(clubId: string, clubData: ClubData): Promise<void> {
  console.log(`Creating org document for club ${clubId}`);
  
  const now = Timestamp.now();
  
  const orgDoc: Org = {
    orgId: clubId,
    name: clubData.name,
    shortName: clubData.name.substring(0, 50), // Truncate if needed
    createdAt: now,
    updatedAt: now,
    createdBy: clubData.submittedBy || 'system',
    
    // Address
    address: clubData.address || '',
    city: clubData.city,
    state: clubData.state,
    country: 'USA', // Default
    postalCode: clubData.zip || '',
    geoLocation: {
      lat: clubData.latitude || 0,
      lng: clubData.longitude || 0
    },
    
    // Settings
    timezone: 'America/Los_Angeles', // Default, should be configured
    currency: 'USD',
    
    // Contact
    email: clubData.email,
    phone: clubData.phone || '',
    website: clubData.website || '',
    
    // Branding
    logoURL: '',
    bannerURL: '',
    description: clubData.description || '',
    
    // Policies (source of truth for booking rules)
    policies: {
      bookingWindowDays: 7, // Default: 7 days in advance
      bufferMinutes: 10, // Default: 10 minute buffer
      maxBookingsPerMemberPerDay: 3,
      cancelPolicy: '24 hours notice required for cancellation',
      allowGuestBookings: true
    },
    
    // Hours of operation (default) - used by court reservation system
    hours: {
      mon: { open: '08:00', close: '20:00' },
      tue: { open: '08:00', close: '20:00' },
      wed: { open: '08:00', close: '20:00' },
      thu: { open: '08:00', close: '20:00' },
      fri: { open: '08:00', close: '20:00' },
      sat: { open: '09:00', close: '18:00' },
      sun: { open: '09:00', close: '18:00' }
    },
    
    // Operating hours for reservation interface (matches hours above)
    operatingHours: {
      monday: { open: '08:00', close: '20:00', closed: false },
      tuesday: { open: '08:00', close: '20:00', closed: false },
      wednesday: { open: '08:00', close: '20:00', closed: false },
      thursday: { open: '08:00', close: '20:00', closed: false },
      friday: { open: '08:00', close: '20:00', closed: false },
      saturday: { open: '09:00', close: '18:00', closed: false },
      sunday: { open: '09:00', close: '18:00', closed: false }
    },
    
    // Booking settings for reservation system
    bookingSettings: {
      maxDaysInAdvance: 14, // How far ahead users can book
      minBookingDuration: 1, // Minimum hours per booking
      maxBookingDuration: 2, // Maximum hours per booking
      slotInterval: 30, // Slot interval in minutes
      allowOverlapping: false,
      requireApproval: false
    },
    
    // Court facilities
    courtCount: clubData.courts || 1,
    courtsWithLights: 0, // Default
    indoorCourts: 0,
    outdoorCourts: clubData.courts || 1,
    hasLights: false,
    sunsetCutoffDefault: '20:30',
    
    // Booking settings
    bookingIntervals: 60, // Default: 1 hour slots
    
    // Pricing
    pricingModel: 'hourly',
    memberPricePerHour: 0, // Free by default
    guestPricePerHour: 0,
    currencySymbol: '$',
    
    // Payment - Updated with Stripe Connect fields per spec
    paymentSettings: {
      stripeAccountId: '',
      payoutEnabled: false
    },
    stripeAccountId: '',
    stripeStatus: 'unlinked',
    stripeOnboardingComplete: false,
    payoutsEnabled: false,
    chargesEnabled: false,
    supportEmail: clubData.email,
    supportPhone: clubData.phone || '',
    statementDescriptor: clubData.name.substring(0, 22), // Stripe limit
    reservationSettings: {
      requirePaymentAtBooking: true,
      hourlyRateCents: 1500, // $15.00 default
    },
    membershipPlans: [],
    
    // Subscription - Default to free plan
    subscription: {
      plan: 'free',
      status: 'active',
      stripeSubscriptionId: '',
      stripeCustomerId: '',
      stripePriceId: '',
      currentPeriodStart: 0,
      currentPeriodEnd: 0,
      cancelAtPeriodEnd: false
    },
    
    // Membership settings - Default to disabled until club configures
    membershipEnabled: false, // Club must enable and configure memberships
    membershipTiers: {}, // Empty object - populated when club creates membership plans
    membershipAutoRenew: true, // Default: auto-renew enabled
    requireMembershipForBooking: false, // Default: non-members can book
    
    // Platform fee settings (Courtly's revenue)
    platformFeePercent: 5, // Default: 5% platform fee on all transactions
    
    // Staff
    staff: clubData.submittedBy ? [{
      userId: clubData.submittedBy,
      role: 'owner'
    }] : [],
    
    // Status
    isActive: true,
    isVerified: clubData.approved || false,
    
    // Metadata
    tags: [],
    socialLinks: {},
    schemaVersion: 1
  };
  
  await setDoc(doc(db, `orgs/${clubId}`), orgDoc);
  console.log(`Created org document for club ${clubId}`);
}

/**
 * Create default court documents based on the number of courts specified
 * Courts are created with proper structure for reservation system
 */
async function initializeCourts(clubId: string, clubData: ClubData): Promise<void> {
  const numberOfCourts = clubData.courts || 1;
  const courtType = clubData.courtType || "hard";
  
  console.log(`Creating ${numberOfCourts} courts for club ${clubId} with reservation system fields`);
  
  const now = Timestamp.now();
  
  for (let i = 1; i <= numberOfCourts; i++) {
    const courtData: Court = {
      courtId: `court-${i}`,
      name: `Court ${i}`,
      number: i,
      surface: courtType,
      indoor: false,
      hasLights: true, // Default: courts have lights
      maintenanceWindows: [],
      features: [],
      notes: `${courtType} court #${i} - Ready for reservations`,
      isActive: true,
      createdAt: now,
      updatedAt: now
    };
    
    await setDoc(doc(db, `orgs/${clubId}/courts/court-${i}`), courtData);
    console.log(`Created court ${i} for org ${clubId} (reservation-ready)`);
  }
  
  console.log(`✅ All ${numberOfCourts} courts created with reservation system support`);
}

/**
 * Mark a club as approved and activate it
 * This updates the /orgs document
 */
export async function approveClub(clubId: string): Promise<void> {
  try {
    const now = Timestamp.now();
    
    // Update org document
    await setDoc(doc(db, 'orgs', clubId), {
      isVerified: true,
      isActive: true,
      updatedAt: now
    }, { merge: true });
    
    console.log(`Club ${clubId} approved and activated`);
  } catch (error) {
    console.error(`Error approving club ${clubId}:`, error);
    throw error;
  }
}

/**
 * Initialize empty subcollections for bookings, blocks, audit logs, and coaches
 * These will be populated as operations occur
 */
async function initializeEmptyCollections(clubId: string): Promise<void> {
  console.log(`Initializing empty subcollections for org ${clubId}`);
  
  const now = Timestamp.now();
  
  // Create a placeholder document in bookings collection (will be deleted when first real booking is made)
  const bookingsRef = doc(db, `orgs/${clubId}/bookings/_placeholder`);
  await setDoc(bookingsRef, {
    note: "This is a placeholder document. Real bookings will be created by Cloud Functions.",
    createdAt: now
  });
  
  // Create a placeholder document in blocks collection
  const blocksRef = doc(db, `orgs/${clubId}/blocks/_placeholder`);
  await setDoc(blocksRef, {
    note: "This is a placeholder document for maintenance blocks.",
    createdAt: now
  });
  
  // Create a placeholder document in audit collection
  const auditRef = doc(db, `orgs/${clubId}/audit/_placeholder`);
  await setDoc(auditRef, {
    note: "This is a placeholder document. Audit logs will be created automatically.",
    createdAt: now
  });
  
  // Create a placeholder document in coaches collection
  const coachesRef = doc(db, `orgs/${clubId}/coaches/_placeholder`);
  await setDoc(coachesRef, {
    note: "This is a placeholder document. Coaches will be added by club admins.",
    createdAt: now
  });
  
  // Create a placeholder document in groupLessons collection
  const groupLessonsRef = doc(db, `orgs/${clubId}/groupLessons/_placeholder`);
  await setDoc(groupLessonsRef, {
    note: "This is a placeholder document. Group lessons will be created by club admins.",
    createdAt: now
  });
  
  console.log(`Empty subcollections initialized for org ${clubId}`);
}

/**
 * Retroactively initialize an existing club that was created before the new schema
 * This reads the existing club data and creates the full structure in /orgs
 */
export async function retroactivelyInitializeClub(clubId: string): Promise<void> {
  try {
    console.log(`Retroactively initializing club: ${clubId}`);
    
    // Import getDoc to read existing club data
    const { getDoc } = await import('firebase/firestore');
    
    // Read existing club data from orgs
    const clubRef = doc(db, 'orgs', clubId);
    const clubSnap = await getDoc(clubRef);
    
    if (!clubSnap.exists()) {
      throw new Error(`Club ${clubId} not found in orgs`);
    }
    
    const existingData = clubSnap.data();
    
    // Convert existing data to ClubData format
    const clubData: ClubData = {
      name: existingData.name || 'Unknown Club',
      email: existingData.email || '',
      phone: existingData.phone || '',
      website: existingData.website || '',
      address: existingData.address || '',
      city: existingData.city || '',
      state: existingData.state || '',
      zip: existingData.postalCode || '',
      description: existingData.description || '',
      courts: existingData.courtCount || 1,
      courtType: 'hard', // Default
      approved: existingData.isVerified || false,
      submittedBy: existingData.createdBy || 'system',
      submitterEmail: existingData.email || '',
      submitterName: '',
      latitude: existingData.geoLocation?.lat || 0,
      longitude: existingData.geoLocation?.lng || 0
    };
    
    console.log(`Initializing /orgs structure for existing club: ${clubData.name}`);
    
    // Initialize courts in /orgs if they don't exist
    await initializeCourts(clubId, clubData);
    
    // Initialize empty collections in /orgs if they don't exist
    await initializeEmptyCollections(clubId);
    
    console.log(`Successfully initialized existing club: ${clubId}`);
    console.log(`You can now find the complete structure in:`);
    console.log(`  - /orgs/${clubId}`);
    console.log(`  - /orgs/${clubId}/courts`);
    console.log(`  - /orgs/${clubId}/bookings`);
    console.log(`  - /orgs/${clubId}/blocks`);
    
  } catch (error) {
    console.error(`Error retroactively initializing club ${clubId}:`, error);
    throw error;
  }
}
