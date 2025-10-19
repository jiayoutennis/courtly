/**
 * Utility functions for Courtly
 * Time handling, sunset calculation, conflict detection
 */

import { DateTime } from 'luxon';
import { Booking, Block, Court } from './types';
import { Timestamp } from 'firebase/firestore';

// ===== Time & Timezone Utilities =====

/**
 * Convert Firestore Timestamp to Luxon DateTime in org's timezone
 */
export function timestampToDateTime(timestamp: Timestamp, timezone: string): DateTime {
  return DateTime.fromMillis(timestamp.toMillis(), { zone: timezone });
}

/**
 * Convert Date to Luxon DateTime in org's timezone
 */
export function dateToDateTime(date: Date, timezone: string): DateTime {
  return DateTime.fromJSDate(date, { zone: timezone });
}

/**
 * Convert Luxon DateTime to Firestore Timestamp
 */
export function dateTimeToTimestamp(dateTime: DateTime): Timestamp {
  return Timestamp.fromMillis(dateTime.toMillis());
}

/**
 * Parse HH:mm time string and combine with date in timezone
 */
export function parseTimeString(
  date: DateTime,
  timeString: string,
  timezone: string
): DateTime {
  const [hours, minutes] = timeString.split(':').map(Number);
  return DateTime.fromObject(
    {
      year: date.year,
      month: date.month,
      day: date.day,
      hour: hours,
      minute: minutes,
      second: 0,
      millisecond: 0,
    },
    { zone: timezone }
  );
}

/**
 * Format DateTime to HH:mm string
 */
export function formatTimeString(dateTime: DateTime): string {
  return dateTime.toFormat('HH:mm');
}

/**
 * Check if a time is within open hours for a given day of week
 */
export function isWithinOpenHours(
  dateTime: DateTime,
  court: Court,
  timezone: string
): boolean {
  const dayOfWeek = dateTime.weekday; // 1-7 (Monday-Sunday) in Luxon
  
  // Map Luxon weekday to our format (mon, tue, wed, etc.)
  const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const dayName = dayNames[dayOfWeek % 7] as 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
  
  const openHour = court.openHours?.[dayName];
  
  if (!openHour) {
    return false; // Court not open on this day
  }
  
  const openTime = parseTimeString(dateTime, openHour.open, timezone);
  const closeTime = parseTimeString(dateTime, openHour.close, timezone);
  
  return dateTime >= openTime && dateTime <= closeTime;
}

// ===== Sunset Calculation =====

/**
 * Calculate sunset time for a given date and location
 * Uses a simplified algorithm (accurate to ~10 minutes)
 */
export function calculateSunset(
  date: DateTime,
  latitude: number,
  longitude: number,
  timezone: string
): DateTime {
  const dayOfYear = date.ordinal;
  const latRad = (latitude * Math.PI) / 180;
  
  // Solar declination
  const declination = 0.409 * Math.sin((2 * Math.PI * dayOfYear) / 365 - 1.39);
  
  // Hour angle at sunset
  const cosHourAngle = -Math.tan(latRad) * Math.tan(declination);
  
  // Check for polar day/night
  if (cosHourAngle > 1) {
    // Polar night - no sunset, return end of day
    return date.endOf('day');
  }
  if (cosHourAngle < -1) {
    // Polar day - no sunset, return end of day
    return date.endOf('day');
  }
  
  const hourAngle = Math.acos(cosHourAngle);
  const sunsetHour = 12 + (hourAngle * 12) / Math.PI;
  
  // Adjust for longitude
  const longitudeCorrection = longitude / 15;
  const localSunset = sunsetHour - longitudeCorrection;
  
  const hours = Math.floor(localSunset);
  const minutes = Math.round((localSunset - hours) * 60);
  
  return DateTime.fromObject(
    {
      year: date.year,
      month: date.month,
      day: date.day,
      hour: hours,
      minute: minutes,
    },
    { zone: timezone }
  );
}

/**
 * Get effective cutoff time for bookings (sunset or override)
 */
export function getEffectiveCutoff(
  date: DateTime,
  court: Court,
  sunsetCutoffOverride: string | undefined,
  orgLatitude: number,
  orgLongitude: number,
  timezone: string
): DateTime | null {
  // If court has lights, no cutoff
  if (court.hasLights) {
    return null;
  }
  
  // If override is set, use it
  if (sunsetCutoffOverride) {
    return parseTimeString(date, sunsetCutoffOverride, timezone);
  }
  
  // Calculate sunset
  return calculateSunset(date, orgLatitude, orgLongitude, timezone);
}

// ===== Conflict Detection =====

/**
 * Check if two time ranges overlap
 */
export function doTimesOverlap(
  start1: DateTime,
  end1: DateTime,
  start2: DateTime,
  end2: DateTime
): boolean {
  return start1 < end2 && end1 > start2;
}

/**
 * Check if booking conflicts with existing bookings
 */
export function hasBookingConflict(
  courtId: string,
  start: DateTime,
  end: DateTime,
  existingBookings: Booking[],
  timezone: string,
  excludeBookingId?: string
): boolean {
  return existingBookings.some((booking) => {
    // Skip if it's the same booking (for updates)
    if (excludeBookingId && booking.bookingId === excludeBookingId) {
      return false;
    }
    
    // Only check confirmed or pending bookings on the same court
    if (
      booking.courtId !== courtId ||
      !['confirmed', 'pending_payment'].includes(booking.status)
    ) {
      return false;
    }
    
    const bookingStart = timestampToDateTime(booking.start, timezone);
    const bookingEnd = timestampToDateTime(booking.end, timezone);
    
    return doTimesOverlap(start, end, bookingStart, bookingEnd);
  });
}

/**
 * Check if booking conflicts with blocks
 */
export function hasBlockConflict(
  courtId: string,
  start: DateTime,
  end: DateTime,
  blocks: Block[],
  timezone: string
): boolean {
  return blocks.some((block) => {
    // Check if this court is blocked
    if (!block.courtIds.includes(courtId)) {
      return false;
    }
    
    const blockStart = timestampToDateTime(block.start, timezone);
    const blockEnd = timestampToDateTime(block.end, timezone);
    
    return doTimesOverlap(start, end, blockStart, blockEnd);
  });
}

/**
 * Check if coach is double-booked
 */
export function hasCoachConflict(
  coachId: string | undefined,
  start: DateTime,
  end: DateTime,
  existingBookings: Booking[],
  timezone: string,
  excludeBookingId?: string
): boolean {
  if (!coachId) {
    return false; // No coach assigned
  }
  
  return existingBookings.some((booking) => {
    // Skip if it's the same booking (for updates)
    if (excludeBookingId && booking.bookingId === excludeBookingId) {
      return false;
    }
    
    // Only check bookings with this coach
    if (
      booking.coachId !== coachId ||
      !['confirmed', 'pending_payment'].includes(booking.status)
    ) {
      return false;
    }
    
    const bookingStart = timestampToDateTime(booking.start, timezone);
    const bookingEnd = timestampToDateTime(booking.end, timezone);
    
    return doTimesOverlap(start, end, bookingStart, bookingEnd);
  });
}

/**
 * Check buffer minutes between bookings
 */
export function respectsBufferMinutes(
  courtId: string,
  start: DateTime,
  end: DateTime,
  bufferMinutes: number,
  existingBookings: Booking[],
  timezone: string,
  excludeBookingId?: string
): boolean {
  if (bufferMinutes === 0) {
    return true;
  }
  
  return !existingBookings.some((booking) => {
    // Skip if it's the same booking
    if (excludeBookingId && booking.bookingId === excludeBookingId) {
      return false;
    }
    
    // Only check confirmed bookings on the same court
    if (
      booking.courtId !== courtId ||
      !['confirmed'].includes(booking.status)
    ) {
      return false;
    }
    
    const bookingStart = timestampToDateTime(booking.start, timezone);
    const bookingEnd = timestampToDateTime(booking.end, timezone);
    
    // Check if new booking starts within buffer of existing booking ending
    const bufferAfter = bookingEnd.plus({ minutes: bufferMinutes });
    if (start >= bookingEnd && start < bufferAfter) {
      return true; // Violates buffer
    }
    
    // Check if new booking ends within buffer of existing booking starting
    const bufferBefore = bookingStart.minus({ minutes: bufferMinutes });
    if (end > bufferBefore && end <= bookingStart) {
      return true; // Violates buffer
    }
    
    return false;
  });
}

/**
 * Comprehensive booking validation
 */
export interface BookingValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateBooking(
  courtId: string,
  start: DateTime,
  end: DateTime,
  court: Court,
  bookingWindowDays: number,
  bufferMinutes: number,
  sunsetCutoffOverride: string | undefined,
  existingBookings: Booking[],
  blocks: Block[],
  orgLatitude: number,
  orgLongitude: number,
  timezone: string,
  coachId?: string,
  excludeBookingId?: string
): BookingValidationResult {
  const errors: string[] = [];
  
  // Check if end is after start
  if (end <= start) {
    errors.push('End time must be after start time');
  }
  
  // Check if within booking window
  const now = DateTime.now().setZone(timezone);
  const maxAdvanceDate = now.plus({ days: bookingWindowDays });
  if (start > maxAdvanceDate) {
    errors.push(`Cannot book more than ${bookingWindowDays} days in advance`);
  }
  
  // Check if within open hours
  if (!isWithinOpenHours(start, court, timezone) || !isWithinOpenHours(end, court, timezone)) {
    errors.push('Booking time is outside court operating hours');
  }
  
  // Check lights cutoff
  const cutoff = getEffectiveCutoff(start, court, sunsetCutoffOverride, orgLatitude, orgLongitude, timezone);
  if (cutoff && end > cutoff) {
    errors.push(`Court without lights cannot be booked past ${formatTimeString(cutoff)}`);
  }
  
  // Check booking conflicts
  if (hasBookingConflict(courtId, start, end, existingBookings, timezone, excludeBookingId)) {
    errors.push('Time slot conflicts with an existing booking');
  }
  
  // Check block conflicts
  if (hasBlockConflict(courtId, start, end, blocks, timezone)) {
    errors.push('Time slot conflicts with a blocked period');
  }
  
  // Check buffer minutes
  if (!respectsBufferMinutes(courtId, start, end, bufferMinutes, existingBookings, timezone, excludeBookingId)) {
    errors.push(`Booking must respect ${bufferMinutes}-minute buffer between slots`);
  }
  
  // Check coach conflicts
  if (hasCoachConflict(coachId, start, end, existingBookings, timezone, excludeBookingId)) {
    errors.push('Coach is not available during this time');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// ===== Utility Functions =====

/**
 * Generate time slots for a given day
 */
export function generateTimeSlots(
  date: DateTime,
  intervalMinutes: number,
  court: Court,
  timezone: string
): { start: DateTime; end: DateTime }[] {
  const dayOfWeek = date.weekday; // 1-7 (Monday-Sunday) in Luxon
  
  // Map Luxon weekday to our format (mon, tue, wed, etc.)
  const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const dayName = dayNames[dayOfWeek % 7] as 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
  
  const openHour = court.openHours?.[dayName];
  
  if (!openHour) {
    return [];
  }
  
  const slots: { start: DateTime; end: DateTime }[] = [];
  let current = parseTimeString(date, openHour.open, timezone);
  const closeTime = parseTimeString(date, openHour.close, timezone);
  
  while (current.plus({ minutes: intervalMinutes }) <= closeTime) {
    slots.push({
      start: current,
      end: current.plus({ minutes: intervalMinutes }),
    });
    current = current.plus({ minutes: intervalMinutes });
  }
  
  return slots;
}

/**
 * Calculate duration in minutes
 */
export function calculateDurationMinutes(start: DateTime, end: DateTime): number {
  return end.diff(start, 'minutes').minutes;
}

/**
 * Format duration for display
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours === 0) {
    return `${mins}m`;
  }
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}m`;
}
