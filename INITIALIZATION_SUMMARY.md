# Court Reservation Data Structure Initialization - Summary

## What Was Created

### 1. Core Initialization Utility
**File:** `/src/app/utils/initializeCourtReservations.ts`

A comprehensive TypeScript utility that:
- Fetches all clubs from the `orgs` collection
- Creates default courts for each club (4 courts per club)
- Sets up operating hours (8am-8pm, 7 days/week)
- Configures booking settings (2 weeks advance, 1-2 hour slots)
- Provides status checking for individual clubs
- Supports both bulk and individual club initialization

**Key Functions:**
- `initializeAllClubReservations()` - Initialize all clubs at once
- `initializeClubReservationSystem(orgId, name, courtCount)` - Initialize single club
- `checkClubReservationStatus(orgId)` - Check what's configured for a club
- `getAllClubs()` - Get list of all clubs
- `initializeDefaultCourts(orgId, count)` - Create courts
- `setOperatingHours(orgId, hours)` - Set hours
- `setBookingSettings(orgId, settings)` - Set booking rules

### 2. Admin Interface
**File:** `/src/app/admin/initialize-reservations/page.tsx`

A user-friendly admin page that allows Courtly administrators to:
- Initialize all clubs with one click
- Select and initialize individual clubs
- Check the status of any club's reservation system
- View detailed results and configuration

**Features:**
- Only accessible to Courtly admins (userType: 'courtly')
- Real-time status checking
- Detailed feedback for each operation
- Shows what's configured and what's missing
- Lists all courts, hours, and settings

**URL:** `/admin/initialize-reservations`

### 3. Documentation
**File:** `COURT_RESERVATION_INITIALIZATION.md`

Complete documentation covering:
- Data structure explained in detail
- Default values for courts, hours, and settings
- Usage instructions (admin UI and programmatic)
- Safety features and guarantees
- Troubleshooting guide
- Customization options

## Data Structure Created

### For Each Club in `/orgs/{orgId}`

**1. Courts Subcollection** (`/orgs/{orgId}/courts/{courtId}`)
```javascript
{
  name: "Court 1",
  courtNumber: 1,
  surface: "Hard",
  isIndoor: false,
  hasLights: true,
  isActive: true,
  openTime: "08:00",
  closeTime: "20:00",
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

**2. Operating Hours** (field in org document)
```javascript
{
  operatingHours: {
    monday: { open: "08:00", close: "20:00", closed: false },
    tuesday: { open: "08:00", close: "20:00", closed: false },
    // ... etc for all days
  }
}
```

**3. Booking Settings** (field in org document)
```javascript
{
  bookingSettings: {
    maxDaysInAdvance: 14,
    minBookingDuration: 1,
    maxBookingDuration: 2,
    slotInterval: 30,
    allowOverlapping: false,
    requireApproval: false
  }
}
```

## How to Use

### Quick Start (Admin UI)
1. Sign in as a Courtly admin
2. Navigate to `/admin/initialize-reservations`
3. Click "Initialize All Clubs"
4. Wait for completion
5. Verify by checking any club's reserve-court page

### Command Line Usage
```typescript
import { initializeAllClubReservations } from '@/app/utils/initializeCourtReservations';

// Run initialization
const result = await initializeAllClubReservations();
console.log(result);
```

## Safety Features

✅ **Non-Destructive** - Never overwrites existing data
✅ **Idempotent** - Safe to run multiple times
✅ **Selective** - Only creates what's missing
✅ **Error-Resistant** - One club's failure doesn't stop others
✅ **Logged** - Detailed console output for debugging

## Integration with Existing System

The initialization system works seamlessly with:
- **Reserve Court Page** (`/club/[clubId]/reserve-court`)
  - Fetches courts from subcollection
  - Uses operating hours for time slots
  - Enforces booking settings constraints

- **Firestore Rules** (`firestore.rules`)
  - `canBookCourts()` function checks permissions
  - Bookings collection rules updated
  - Courts subcollection properly secured

- **Club Management** (`/club/[clubId]/manage-club`)
  - Can view and edit courts
  - Can modify operating hours
  - Can adjust booking settings

## Default Configuration

**Courts:**
- Quantity: 4 per club
- Names: "Court 1", "Court 2", "Court 3", "Court 4"
- Surface: Hard
- Location: Outdoor with lights
- Hours: 8am - 8pm

**Operating Schedule:**
- Open: 8:00 AM
- Close: 8:00 PM
- Days: 7 days/week (no closed days)

**Booking Rules:**
- Advance booking: 14 days
- Min duration: 1 hour
- Max duration: 2 hours
- Time slots: 30 minutes
- No overlapping bookings
- No approval required

## Testing Checklist

After running initialization:

- [ ] Navigate to a club's reserve-court page
- [ ] Verify courts appear in dropdown
- [ ] Check time slots match operating hours
- [ ] Confirm booking constraints work (max days ahead)
- [ ] Try creating a test booking
- [ ] Verify booking appears in schedule
- [ ] Check admin can see all bookings

## Next Steps

1. **Run the initialization**
   - Use admin interface to initialize all clubs
   - Monitor console for any errors

2. **Verify a sample club**
   - Pick one club
   - Check its status in admin interface
   - Test the reservation flow

3. **Customize if needed**
   - Edit default values in utility file
   - Re-run for clubs that need updates

4. **Document club-specific settings**
   - Note any clubs with special requirements
   - Use manage-club page to adjust individual settings

## Files Modified/Created

**New Files:**
- `/src/app/utils/initializeCourtReservations.ts`
- `/src/app/admin/initialize-reservations/page.tsx`
- `/COURT_RESERVATION_INITIALIZATION.md`

**No Existing Files Modified** - This is a completely new feature that integrates with existing code without breaking changes.

## Support

If you encounter issues:
1. Check the detailed documentation in `COURT_RESERVATION_INITIALIZATION.md`
2. Use the admin interface to check club status
3. Look at console logs for detailed error messages
4. Verify Firestore rules are deployed correctly
