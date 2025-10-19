# Automatic Court Reservation System Initialization

## Overview

When a new club is added to Courtly, the court reservation system is **automatically initialized** with all necessary fields and data structures. This happens during the club creation process without requiring any manual steps.

## What Gets Initialized Automatically

### 1. Operating Hours Fields

Two formats are created for compatibility:

**Standard Hours** (`hours` field):
```javascript
hours: {
  mon: { open: '08:00', close: '20:00' },
  tue: { open: '08:00', close: '20:00' },
  wed: { open: '08:00', close: '20:00' },
  thu: { open: '08:00', close: '20:00' },
  fri: { open: '08:00', close: '20:00' },
  sat: { open: '09:00', close: '18:00' },
  sun: { open: '09:00', close: '18:00' }
}
```

**Extended Operating Hours** (`operatingHours` field - for reservation UI):
```javascript
operatingHours: {
  monday: { open: '08:00', close: '20:00', closed: false },
  tuesday: { open: '08:00', close: '20:00', closed: false },
  wednesday: { open: '08:00', close: '20:00', closed: false },
  thursday: { open: '08:00', close: '20:00', closed: false },
  friday: { open: '08:00', close: '20:00', closed: false },
  saturday: { open: '09:00', close: '18:00', closed: false },
  sunday: { open: '09:00', close: '18:00', closed: false }
}
```

### 2. Booking Settings

```javascript
bookingSettings: {
  maxDaysInAdvance: 14,      // Users can book 2 weeks ahead
  minBookingDuration: 1,      // Minimum 1 hour per booking
  maxBookingDuration: 2,      // Maximum 2 hours per booking
  slotInterval: 30,           // 30-minute time slots
  allowOverlapping: false,    // No overlapping bookings
  requireApproval: false      // Bookings confirmed immediately
}
```

### 3. Courts with Reservation Support

Each court is created with these fields:
```javascript
{
  courtId: "court-1",
  name: "Court 1",
  number: 1,
  surface: "hard",           // Or clay, grass, carpet
  indoor: false,
  hasLights: true,           // Ready for evening bookings
  isActive: true,
  notes: "hard court #1 - Ready for reservations",
  maintenanceWindows: [],
  features: [],
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

## When Initialization Happens

Automatic initialization occurs in these scenarios:

### 1. Club Request Approval
**Location:** `/src/app/admin/club-requests/page.tsx`

When a Courtly admin approves a club registration request:
```typescript
// Step 3 in approval process
await initializeClubCollections(newClubId, clubData);
```

The club is created with:
- Full org document including operating hours and booking settings
- Courts subcollection (number specified in registration)
- All reservation system fields pre-configured

### 2. Manual Club Creation by Admin
**Location:** `/src/app/admin/manage-clubs/page.tsx`

When a Courtly admin manually creates a club:
```typescript
const newClubRef = await addDoc(collection(db, "orgs"), newClubData);
await initializeClubCollections(newClubRef.id, newClubData);
```

Benefits:
- Immediate reservation capability
- No setup delay
- Consistent configuration across all clubs

## Default Configuration Values

### Weekday Hours
- Monday - Friday: 8:00 AM - 8:00 PM
- Ideal for after-work bookings

### Weekend Hours
- Saturday - Sunday: 9:00 AM - 6:00 PM
- Shorter hours for maintenance

### Booking Rules
- **Advance booking window:** 14 days
  - Prevents over-booking far in advance
  - Gives members reasonable planning window

- **Duration limits:** 1-2 hours
  - Minimum: 1 hour (fair court access)
  - Maximum: 2 hours (prevent monopolization)

- **Time slots:** 30 minutes
  - Flexible scheduling
  - Common tennis match duration alignment

- **Overlapping:** Not allowed
  - Prevents double-booking conflicts
  - Ensures exclusive court access

- **Approval:** Not required
  - Instant confirmation
  - Better user experience

### Court Defaults
- **Lights:** Enabled by default
  - Assumes evening play capability
  - Can be adjusted per court

- **Location:** Outdoor
  - Most common setup
  - Can be changed in court settings

- **Status:** Active
  - Ready for immediate use
  - No manual activation needed

## Technical Implementation

### Core Function
**File:** `/src/lib/initializeClub.ts`

```typescript
export async function initializeClubCollections(
  clubId: string,
  clubData: ClubData
): Promise<void>
```

This function orchestrates three initialization steps:

1. **`createOrgDocument()`** - Creates org with hours and settings
2. **`initializeCourts()`** - Creates courts with reservation fields
3. **`initializeEmptyCollections()`** - Sets up bookings/blocks/audit

### Type Definitions
**File:** `/shared/types.ts`

New types added:
- `OperatingHoursExtended` - For reservation UI format
- `BookingSettings` - For reservation constraints

Updated:
- `Org` interface - Now includes `operatingHours?` and `bookingSettings?`

## Customization After Creation

While clubs are initialized with sensible defaults, admins can customize:

### Via Club Settings Page
**Location:** `/club/[clubId]/manage-club`

Admins can modify:
- Operating hours per day
- Court details (name, surface, lights)
- Court active/inactive status

### Via Database Direct Edit

Power users can adjust:
```typescript
await updateDoc(doc(db, "orgs", clubId), {
  bookingSettings: {
    maxDaysInAdvance: 30,  // Extend to 30 days
    slotInterval: 60        // Change to 1-hour slots
  }
});
```

## Verification

After club creation, verify initialization:

### Method 1: Check Reservation Page
1. Navigate to `/club/[clubId]/reserve-court`
2. Verify courts appear in dropdown
3. Check time slots match operating hours
4. Confirm booking date range is 14 days

### Method 2: Check Firestore Console
1. Open Firestore in Firebase Console
2. Navigate to `orgs/[clubId]`
3. Verify fields exist:
   - `operatingHours` ✓
   - `bookingSettings` ✓
4. Check `orgs/[clubId]/courts` subcollection
5. Verify all courts are present

### Method 3: Use Admin Tool
1. Go to `/admin/initialize-reservations`
2. Select the club
3. Click "Check Status"
4. Review the detailed report

## Benefits of Automatic Initialization

✅ **Zero Manual Setup**
- No admin intervention required
- New clubs are immediately functional

✅ **Consistency**
- All clubs start with same configuration
- Predictable user experience

✅ **Time Savings**
- No need to manually configure each club
- Scales to hundreds of clubs

✅ **Error Prevention**
- No forgotten fields
- No misconfiguration

✅ **Future-Proof**
- Easy to update defaults for all new clubs
- Existing clubs can be retroactively updated

## Troubleshooting

### Problem: New club doesn't have reservation fields

**Cause:** Club was created before automatic initialization

**Solution:** Use the initialization tool
1. Go to `/admin/initialize-reservations`
2. Select the club
3. Click "Initialize This Club"

### Problem: Courts aren't showing up

**Check:**
- Firestore path: `orgs/[clubId]/courts`
- Court documents have required fields
- Courts have `isActive: true`

**Fix:**
```typescript
await initializeCourts(clubId, {
  name: "Club Name",
  courts: 4,
  courtType: "hard"
  // ... other required fields
});
```

### Problem: Time slots don't appear

**Check:**
- `operatingHours` field exists in org document
- Hours are in "HH:mm" format
- Day names are lowercase (monday, not Monday)

**Fix:**
```typescript
await updateDoc(doc(db, "orgs", clubId), {
  operatingHours: {
    monday: { open: "08:00", close: "20:00", closed: false }
    // ... other days
  }
});
```

### Problem: Can't book far enough in advance

**Check:**
- `bookingSettings.maxDaysInAdvance` value
- Current date vs booking date calculation

**Fix:**
```typescript
await updateDoc(doc(db, "orgs", clubId), {
  "bookingSettings.maxDaysInAdvance": 30
});
```

## Migration for Existing Clubs

If you have clubs created before this feature:

### Option 1: Bulk Initialize (Recommended)
Use the admin tool:
1. Navigate to `/admin/initialize-reservations`
2. Click "Initialize All Clubs"
3. Existing data will be preserved
4. Missing fields will be added

### Option 2: Manual SQL/Script
```typescript
import { initializeClubCollections } from '@/lib/initializeClub';

// For each existing club
const clubs = await getAllClubs();
for (const club of clubs) {
  await initializeClubCollections(club.id, {
    name: club.name,
    email: club.email,
    city: club.city,
    state: club.state,
    courts: club.courtCount || 4,
    // ... other fields
  });
}
```

## Related Documentation

- `COURT_RESERVATION_INITIALIZATION.md` - Manual initialization guide
- `INITIALIZATION_SUMMARY.md` - Quick reference
- `README.md` - Main project documentation

## Summary

The court reservation system is now **automatically initialized** for every new club added to Courtly. This ensures:

1. **Immediate Functionality** - Courts can be reserved right away
2. **Consistent Experience** - All clubs have the same baseline setup
3. **No Manual Work** - Admins don't need to configure anything
4. **Scalable** - Works for 1 club or 1000 clubs
5. **Customizable** - Defaults can be changed per club as needed

New clubs get a complete, working reservation system from day one! 🎾
