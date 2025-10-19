# Court Reservation System - Database Migration Guide

## Issues Fixed

### 1. **Booking Path Corrected** ✅
**Problem**: The reservation page was writing bookings to the wrong database location.
- ❌ **Was writing to**: `/bookings/{bookingId}` (top-level collection)
- ✅ **Now writes to**: `/orgs/{clubId}/bookings/{bookingId}` (correct subcollection)

**Files changed**:
- `/src/app/club/[clubId]/reserve-court/page.tsx`
  - Line ~222: Fixed `fetchBookings()` to read from correct path
  - Line ~299: Fixed booking creation to write to correct path
  - Removed redundant `clubId` field from booking document (not needed in subcollection)

### 2. **Club Creation Fixed** ✅
**Problem**: When manually adding clubs through the admin panel, the document was created TWICE, causing potential data loss.

**What was happening**:
1. `/admin/manage-clubs/page.tsx` created a basic club document with `addDoc()`
2. Then called `initializeClubCollections()` which used `setDoc()` to overwrite it
3. Result: The second write might not complete, or might overwrite important fields

**Fix Applied**:
- `/src/app/admin/manage-clubs/page.tsx`
  - Now generates club ID first without creating the document
  - Lets `initializeClubCollections()` handle ALL document creation
  - Ensures `operatingHours`, `bookingSettings`, courts, and all subcollections are created properly

### 3. **Migration Tool Created** ✅
**Problem**: Existing clubs in your database don't have `operatingHours` or `bookingSettings` fields.

**Solution**: New admin page at `/admin/migrate-clubs`
- Shows which clubs need migration
- Can migrate all clubs at once or one at a time
- Adds default `operatingHours` (8am-8pm weekdays, 9am-6pm weekends)
- Adds default `bookingSettings` (14 days advance, 30-min slots, 1-2 hour bookings)

## What Gets Initialized Now

When a club is approved or manually added, `initializeClubCollections()` creates:

### Org Document Fields
```typescript
{
  // ... basic info (name, email, address, etc.) ...
  
  // Operating hours for reservation system
  operatingHours: {
    monday: { open: '08:00', close: '20:00', closed: false },
    tuesday: { open: '08:00', close: '20:00', closed: false },
    // ... etc for all days
  },
  
  // Booking rules
  bookingSettings: {
    maxDaysInAdvance: 14,        // How far ahead users can book
    minBookingDuration: 1,        // Minimum hours
    maxBookingDuration: 2,        // Maximum hours
    slotInterval: 30,             // 30-minute time slots
    allowOverlapping: false,
    requireApproval: false
  },
  
  // Legacy hours field (for backward compatibility)
  hours: {
    mon: { open: '08:00', close: '20:00' },
    // ... etc
  },
  
  // Booking policies
  policies: {
    bookingWindowDays: 7,
    bufferMinutes: 10,
    maxBookingsPerMemberPerDay: 3,
    cancelPolicy: '24 hours notice required',
    allowGuestBookings: true
  }
}
```

### Subcollections Created
1. **`/orgs/{clubId}/courts`** - Court documents with reservation-ready fields
2. **`/orgs/{clubId}/bookings`** - Where bookings are stored (placeholder created)
3. **`/orgs/{clubId}/blocks`** - For maintenance/blocked time slots
4. **`/orgs/{clubId}/audit`** - For audit logs

## Action Required: Migrate Existing Clubs

### Step 1: Navigate to Migration Page
Go to: `/admin/migrate-clubs`

### Step 2: Review Clubs
You'll see:
- **Total Clubs**: All clubs in your system
- **Need Migration**: Clubs missing reservation fields
- **Already Migrated**: Clubs that already have the fields

### Step 3: Run Migration
Click **"Migrate All X Clubs"** to update all clubs at once, or migrate them individually.

### Step 4: Verify
After migration, check a few clubs in Firebase Console:
- Go to `/orgs/{clubId}` and verify these fields exist:
  - `operatingHours`
  - `bookingSettings`
- Check that subcollections exist:
  - `/orgs/{clubId}/courts`
  - `/orgs/{clubId}/bookings`

## Testing the Reservation System

After migration:

1. **Go to a club page**: `/club/{clubId}`
2. **Click "Reserve Court"**
3. **Select date, court, and time**
4. **Submit booking**
5. **Verify in Firebase**: Check `/orgs/{clubId}/bookings` for the booking document

## Database Structure

```
orgs/
  {clubId}/
    - [document with operatingHours, bookingSettings]
    courts/
      court-1/
      court-2/
      ...
    bookings/
      {bookingId}/
        - courtId
        - date
        - startTime
        - endTime
        - userId
        - userName
        - userEmail
        - createdAt
        - status
    blocks/
      {blockId}/
        - (for maintenance windows)
    audit/
      {auditId}/
        - (for audit logs)
```

## Firestore Security Rules

Your rules are already correct! They protect `/orgs/{orgId}/bookings` with the `canBookCourts()` function:

```javascript
match /orgs/{orgId}/bookings/{bookingId} {
  allow read: if canBookCourts(orgId);
  allow create: if canBookCourts(orgId) && isValidBooking();
  allow update, delete: if canBookCourts(orgId);
}
```

## Future Club Creation

Going forward, when:
- **Courtly admin approves a club request** → Automatically initialized
- **Courtly admin manually adds a club** → Automatically initialized

No manual initialization needed! ✨

## Summary

| Issue | Status | Action Needed |
|-------|--------|---------------|
| Booking writes to wrong path | ✅ Fixed | None - code updated |
| Booking reads from wrong path | ✅ Fixed | None - code updated |
| Club creation duplicates document | ✅ Fixed | None - code updated |
| Existing clubs lack reservation fields | ⚠️ **ACTION REQUIRED** | **Run migration at `/admin/migrate-clubs`** |
| Future clubs lack reservation fields | ✅ Fixed | None - auto-initialized |

## Next Steps

1. ✅ Code changes are complete and deployed
2. ⚠️ **YOU NEED TO**: Visit `/admin/migrate-clubs` and click "Migrate All Clubs"
3. ✅ Test booking on a migrated club
4. ✅ Verify bookings appear in `/orgs/{clubId}/bookings`
