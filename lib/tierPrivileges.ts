/**
 * Tier-Based Privileges Helper Functions
 * 
 * This module provides utilities for managing and enforcing
 * membership tier privileges (booking limits, discounts, access rules)
 */

import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import type { TierPrivileges, MembershipTier } from '../shared/types';

// ===== Default Privileges by Tier =====

export function getDefaultPrivileges(tier: MembershipTier): TierPrivileges {
  const defaults: Record<MembershipTier, TierPrivileges> = {
    day_pass: {
      maxDaysInAdvance: 3,
      maxBookingsPerDay: 1,
      maxBookingDuration: 1,
      minBookingDuration: 1,
      freeBookingsPerMonth: 0, // No free bookings - pay per use
      bookingPricePerHour: 3000, // $30/hour (in cents)
      useAccountBalance: true,
      requireImmediatePayment: false,
      allowPrimeTimeBooking: false,
      allowWeekendBooking: true,
      priorityBooking: false,
      cancellationWindowHours: 24,
      allowFreeCancellation: false,
      allowGuests: false,
      maxGuestsPerBooking: 0,
      discountPercentage: 0,
      accessToMemberEvents: false,
      accessToLessons: false,
      lessonDiscount: 0
    },
    monthly: {
      maxDaysInAdvance: 14,
      maxBookingsPerDay: 3,
      maxBookingDuration: 2,
      minBookingDuration: 1,
      freeBookingsPerMonth: 0, // No free bookings - pay per use
      bookingPricePerHour: 2500, // $25/hour (in cents) - 10% discount from day pass
      useAccountBalance: true,
      requireImmediatePayment: false,
      allowPrimeTimeBooking: true,
      allowWeekendBooking: true,
      priorityBooking: false,
      cancellationWindowHours: 12,
      allowFreeCancellation: true,
      allowGuests: true,
      maxGuestsPerBooking: 2,
      discountPercentage: 10,
      accessToMemberEvents: true,
      accessToLessons: true,
      lessonDiscount: 10
    },
    annual: {
      maxDaysInAdvance: 30,
      maxBookingsPerDay: 999,
      maxBookingDuration: 3,
      minBookingDuration: 1,
      freeBookingsPerMonth: 0, // No free bookings - pay per use
      bookingPricePerHour: 2000, // $20/hour (in cents) - 20% discount from day pass
      useAccountBalance: true,
      requireImmediatePayment: false,
      allowPrimeTimeBooking: true,
      allowWeekendBooking: true,
      priorityBooking: true,
      cancellationWindowHours: 2,
      allowFreeCancellation: true,
      allowGuests: true,
      maxGuestsPerBooking: 4,
      discountPercentage: 20,
      accessToMemberEvents: true,
      accessToLessons: true,
      lessonDiscount: 20
    }
  };
  
  return defaults[tier];
}

// ===== Get User's Tier Privileges =====

export async function getUserTierPrivileges(
  userId: string,
  orgId: string
): Promise<TierPrivileges | null> {
  try {
    // 1. Get user's active membership
    // Memberships are stored as /orgs/{orgId}/memberships/{userId}
    const membershipRef = doc(db, `orgs/${orgId}/memberships/${userId}`);
    const membershipDoc = await getDoc(membershipRef);
    
    if (!membershipDoc.exists()) {
      return null; // No membership
    }
    
    const membership = membershipDoc.data();
    
    // Validate membership data structure
    if (!membership) {
      console.error('Membership document exists but has no data');
      return null;
    }
    
    // Check if membership is active
    if (membership.status !== 'active') {
      console.log(`Membership status is ${membership.status}, not active`);
      return null; // Inactive membership
    }
    
    // Get tier - support both old (plan.tier) and new (tier) structure
    let userTier: MembershipTier;
    if (membership.tier) {
      // New structure: tier is stored directly
      userTier = membership.tier as MembershipTier;
    } else if (membership.plan?.tier) {
      // Old structure: tier is in plan object
      userTier = membership.plan.tier as MembershipTier;
    } else {
      console.error('Membership missing tier field:', membership);
      return null;
    }
    
    // 2. Get org's tier configuration
    const orgDoc = await getDoc(doc(db, 'orgs', orgId));
    const orgData = orgDoc.data();
    
    if (!orgData?.membershipTiers?.[userTier]) {
      return null; // Tier not configured
    }
    
    const tierConfig = orgData.membershipTiers[userTier];
    
    // 3. Return privileges (or default if not set)
    return tierConfig.privileges || getDefaultPrivileges(userTier);
    
  } catch (error) {
    console.error('Error getting tier privileges:', error);
    return null;
  }
}

// ===== Validate Booking Request =====

export interface BookingValidationRequest {
  courtId: string;
  date: Date;
  startTime: string;
  endTime: string;
  duration: number;
  guestCount?: number;
}

export interface BookingValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

export async function validateBookingRequest(
  userId: string,
  orgId: string,
  bookingData: BookingValidationRequest
): Promise<BookingValidationResult> {
  
  // Get user's tier privileges
  const privileges = await getUserTierPrivileges(userId, orgId);
  
  if (!privileges) {
    return { 
      valid: false, 
      error: 'Active membership required to book courts' 
    };
  }
  
  const warnings: string[] = [];
  
  // Check 1: Advance booking limit
  const daysDiff = Math.ceil(
    (bookingData.date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );
  
  if (daysDiff > privileges.maxDaysInAdvance) {
    return {
      valid: false,
      error: `Your ${getTierName(privileges)} membership can only book ${privileges.maxDaysInAdvance} days in advance. Upgrade to book further ahead.`
    };
  }
  
  // Check 2: Booking duration
  if (bookingData.duration > privileges.maxBookingDuration) {
    return {
      valid: false,
      error: `Your membership allows max ${privileges.maxBookingDuration} hour bookings. Upgrade for longer sessions.`
    };
  }
  
  if (bookingData.duration < privileges.minBookingDuration) {
    return {
      valid: false,
      error: `Minimum booking duration is ${privileges.minBookingDuration} hour`
    };
  }
  
  // Check 3: Prime time restriction
  const startTimeParts = bookingData.startTime?.split(':') || ['0'];
  const startHour = parseInt(startTimeParts[0] || '0');
  const isPrimeTime = startHour >= 17 && startHour <= 21; // 5pm-9pm
  
  if (isPrimeTime && !privileges.allowPrimeTimeBooking) {
    return {
      valid: false,
      error: 'Prime time hours (5-9pm) require an upgraded membership. View plans to access peak hours.'
    };
  }
  
  // Check 4: Weekend restriction
  const isWeekend = bookingData.date.getDay() === 0 || bookingData.date.getDay() === 6;
  
  if (isWeekend && !privileges.allowWeekendBooking) {
    return {
      valid: false,
      error: 'Weekend bookings require an upgraded membership.'
    };
  }
  
  // Check 5: Daily booking limit
  const todaysBookings = await getUserBookingsForDate(userId, orgId, bookingData.date);
  
  if (todaysBookings.length >= privileges.maxBookingsPerDay) {
    return {
      valid: false,
      error: `You've reached your daily limit of ${privileges.maxBookingsPerDay} bookings. Upgrade for unlimited bookings.`
    };
  }
  
  // Check 6: Guest restrictions
  if (bookingData.guestCount && bookingData.guestCount > 0) {
    if (!privileges.allowGuests) {
      return {
        valid: false,
        error: 'Your membership does not allow guests. Upgrade to bring guests.'
      };
    }
    
    if (bookingData.guestCount > privileges.maxGuestsPerBooking) {
      return {
        valid: false,
        error: `Your membership allows max ${privileges.maxGuestsPerBooking} guests per booking.`
      };
    }
  }
  
  // Warning: Approaching booking limit
  if (todaysBookings.length === privileges.maxBookingsPerDay - 1) {
    warnings.push(`This will be your last booking today (${privileges.maxBookingsPerDay} max)`);
  }
  
  return { 
    valid: true,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

// ===== Helper: Get User's Bookings for a Date =====

async function getUserBookingsForDate(
  userId: string,
  orgId: string,
  date: Date
): Promise<any[]> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  const bookingsRef = collection(db, `orgs/${orgId}/bookings`);
  const q = query(
    bookingsRef,
    where('memberId', '==', userId),
    where('start', '>=', Timestamp.fromDate(startOfDay)),
    where('start', '<=', Timestamp.fromDate(endOfDay)),
    where('status', '==', 'confirmed')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data());
}

// ===== Calculate Price with Tier Discount =====

export function calculateBookingPrice(
  basePrice: number,
  duration: number,
  privileges: TierPrivileges | null
): { 
  originalPrice: number; 
  finalPrice: number; 
  discount: number;
  discountPercentage: number;
} {
  const originalPrice = basePrice * duration;
  
  if (!privileges || privileges.discountPercentage === 0) {
    return {
      originalPrice,
      finalPrice: originalPrice,
      discount: 0,
      discountPercentage: 0
    };
  }
  
  const discount = (originalPrice * privileges.discountPercentage) / 100;
  const finalPrice = originalPrice - discount;
  
  return {
    originalPrice,
    finalPrice,
    discount,
    discountPercentage: privileges.discountPercentage
  };
}

// ===== Check if Date is Selectable =====

export function isDateSelectable(
  date: Date,
  privileges: TierPrivileges | null
): boolean {
  if (!privileges) return false;
  
  // Check weekend restriction
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  if (isWeekend && !privileges.allowWeekendBooking) {
    return false;
  }
  
  // Check advance booking limit
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const daysDiff = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  return daysDiff >= 0 && daysDiff <= privileges.maxDaysInAdvance;
}

// ===== Check if Time Slot is Available =====

export function isTimeSlotAvailable(
  hour: number,
  privileges: TierPrivileges | null
): boolean {
  if (!privileges) return false;
  
  // Check prime time restriction
  const isPrimeTime = hour >= 17 && hour <= 21;
  if (isPrimeTime && !privileges.allowPrimeTimeBooking) {
    return false;
  }
  
  return true;
}

// ===== Validate Cancellation =====

export interface CancellationValidationResult {
  allowed: boolean;
  error?: string;
  refundEligible: boolean;
  cancellationFee?: number;
}

export async function validateCancellation(
  userId: string,
  orgId: string,
  bookingStartTime: Date
): Promise<CancellationValidationResult> {
  
  const privileges = await getUserTierPrivileges(userId, orgId);
  
  if (!privileges) {
    return {
      allowed: false,
      error: 'Unable to verify membership',
      refundEligible: false
    };
  }
  
  const now = new Date();
  const hoursUntilBooking = (bookingStartTime.getTime() - now.getTime()) / (1000 * 60 * 60);
  
  // Check if within cancellation window
  if (hoursUntilBooking < privileges.cancellationWindowHours) {
    return {
      allowed: true, // Can still cancel, but with fee
      refundEligible: false,
      cancellationFee: privileges.allowFreeCancellation ? 0 : 10, // $10 late cancellation fee
      error: `Cancellations require ${privileges.cancellationWindowHours}h notice. Late cancellation fee may apply.`
    };
  }
  
  // Within window - free cancellation
  return {
    allowed: true,
    refundEligible: true,
    cancellationFee: 0
  };
}

// ===== Helper: Get Tier Name for Display =====

function getTierName(privileges: TierPrivileges): string {
  // Infer tier from privilege values
  if (privileges.maxDaysInAdvance <= 3) return 'Day Pass';
  if (privileges.maxDaysInAdvance <= 14) return 'Monthly';
  return 'Annual';
}

// ===== Export All =====

export const TierHelpers = {
  getDefaultPrivileges,
  getUserTierPrivileges,
  validateBookingRequest,
  calculateBookingPrice,
  isDateSelectable,
  isTimeSlotAvailable,
  validateCancellation
};

export default TierHelpers;
