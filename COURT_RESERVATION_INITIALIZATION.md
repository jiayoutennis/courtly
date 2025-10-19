# Court Reservation System Initialization

This document explains how to initialize the court reservation data structure for all clubs in the Courtly platform.

## Overview

The court reservation system requires each club to have:
1. **Courts** - A subcollection of court documents with details about each court
2. **Operating Hours** - Weekly schedule defining when courts are available
3. **Booking Settings** - Rules for how far in advance users can book, duration limits, etc.

## Data Structure

### Courts Subcollection
Location: `/orgs/{orgId}/courts/{courtId}`

Each court document contains:
```typescript
{
  id: string;
  name: string;              // e.g., "Court 1"
  courtNumber: number;       // e.g., 1, 2, 3
  surface: string;           // "Hard", "Clay", "Grass", "Carpet"
  isIndoor: boolean;         // true/false
  hasLights: boolean;        // true/false
  isActive: boolean;         // true/false
  openTime: string;          // e.g., "08:00"
  closeTime: string;         // e.g., "20:00"
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Operating Hours
Location: `/orgs/{orgId}` document field

```typescript
{
  operatingHours: {
    monday: { open: "08:00", close: "20:00", closed: false },
    tuesday: { open: "08:00", close: "20:00", closed: false },
    wednesday: { open: "08:00", close: "20:00", closed: false },
    thursday: { open: "08:00", close: "20:00", closed: false },
    friday: { open: "08:00", close: "20:00", closed: false },
    saturday: { open: "08:00", close: "20:00", closed: false },
    sunday: { open: "08:00", close: "20:00", closed: false }
  }
}
```

### Booking Settings
Location: `/orgs/{orgId}` document field

```typescript
{
  bookingSettings: {
    maxDaysInAdvance: 14,      // How many days ahead users can book
    minBookingDuration: 1,      // Minimum hours per booking
    maxBookingDuration: 2,      // Maximum hours per booking
    slotInterval: 30,           // Slot interval in minutes (30, 60)
    allowOverlapping: false,    // Allow overlapping bookings
    requireApproval: false      // Require admin approval for bookings
  }
}
```

### Bookings Collection
Location: `/bookings/{bookingId}` (top-level collection)

```typescript
{
  clubId: string;           // Reference to org
  courtId: string;          // Reference to court
  date: string;             // "YYYY-MM-DD"
  startTime: string;        // "HH:mm"
  endTime: string;          // "HH:mm"
  userId: string;           // User who made the booking
  userName: string;
  userEmail: string;
  status: string;           // "confirmed", "cancelled", etc.
  createdAt: Timestamp;
}
```

## Default Values

When initializing a club's reservation system, these defaults are used:

**Courts:**
- 4 courts created per club
- Names: "Court 1", "Court 2", "Court 3", "Court 4"
- Surface: "Hard"
- Indoor: false
- Lights: true
- Active: true
- Hours: 8:00 AM - 8:00 PM

**Operating Hours:**
- Monday - Sunday: 8:00 AM - 8:00 PM
- No closed days

**Booking Settings:**
- Max days in advance: 14 days
- Min booking duration: 1 hour
- Max booking duration: 2 hours
- Slot interval: 30 minutes
- No overlapping allowed
- No approval required

## Usage

### Method 1: Admin Interface (Recommended)

1. **Access the Admin Page**
   - Navigate to: `/admin/initialize-reservations`
   - Only Courtly administrators can access this page

2. **Bulk Initialize All Clubs**
   - Click "Initialize All Clubs" button
   - This will process all clubs in the system
   - Existing data will NOT be overwritten
   - Results will show success/failure for each club

3. **Initialize Individual Club**
   - Select a club from the dropdown
   - Click "Check Status" to see current configuration
   - Click "Initialize This Club" to set up the reservation system
   - View the detailed status after initialization

### Method 2: Programmatic Usage

You can also use the utility functions directly in your code:

```typescript
import { 
  initializeAllClubReservations,
  initializeClubReservationSystem,
  checkClubReservationStatus
} from '@/app/utils/initializeCourtReservations';

// Initialize all clubs
const result = await initializeAllClubReservations();

// Initialize a single club
await initializeClubReservationSystem(
  "clubId", 
  "Club Name", 
  4 // number of courts
);

// Check club status
const status = await checkClubReservationStatus("clubId");
```

## Safety Features

The initialization system is designed to be **safe** and **idempotent**:

✅ **Non-Destructive**: Existing data is never overwritten
✅ **Skip Existing**: If courts already exist, no new courts are created
✅ **Merge Mode**: Settings are added using Firestore merge, preserving existing fields
✅ **Error Handling**: Errors for individual clubs don't stop the batch process
✅ **Detailed Logging**: Console logs show exactly what happened for each club

## When to Use

**Initialize all clubs when:**
- First setting up the Courtly platform
- Adding reservation functionality to an existing system
- Ensuring all clubs have the required data structure

**Initialize individual clubs when:**
- A new club is approved
- A club reports missing court reservation features
- Troubleshooting booking issues

**Don't initialize when:**
- A club has custom court configurations you want to preserve
- You need different default values (customize the defaults first)

## Verification

After initialization, verify the setup worked:

1. Navigate to a club's page
2. Click "Reserve a Court"
3. You should see:
   - List of courts in the dropdown
   - Available time slots based on operating hours
   - Booking constraints enforced (max days, duration limits)

## Troubleshooting

**Problem: Courts don't appear in reservation page**
- Check: `/orgs/{orgId}/courts` subcollection exists
- Solution: Run initialization for that specific club

**Problem: Can't book more than X days ahead**
- Check: `bookingSettings.maxDaysInAdvance` in org document
- Solution: Update the booking settings directly or re-run initialization

**Problem: Time slots don't match club hours**
- Check: `operatingHours` field in org document
- Solution: Update operating hours in club settings page

**Problem: Permission denied when creating bookings**
- Check: Firestore rules allow authenticated users to create bookings
- Solution: See `firestore.rules` - ensure `canBookCourts()` function is working

## Customization

To customize default values, edit:
- `/src/app/utils/initializeCourtReservations.ts`
- Modify `DEFAULT_OPERATING_HOURS` constant
- Modify `DEFAULT_BOOKING_SETTINGS` constant
- Adjust court generation logic in `initializeDefaultCourts()`

## Related Files

- `/src/app/utils/initializeCourtReservations.ts` - Core initialization logic
- `/src/app/admin/initialize-reservations/page.tsx` - Admin UI
- `/src/app/club/[clubId]/reserve-court/page.tsx` - Reservation interface
- `/firestore.rules` - Security rules for bookings
- `/shared/types.ts` - TypeScript type definitions

## Future Enhancements

Potential improvements to the initialization system:
- Import courts from CSV file
- Customize defaults per club during initialization
- Bulk update operating hours across multiple clubs
- Template system for different club types (tennis, pickleball, etc.)
- Validation checks before initialization
- Rollback functionality
