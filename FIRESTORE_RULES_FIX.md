# Firestore Rules Fix - Court Reservation Permissions

## Issue
Users were getting permission denied errors when trying to create court reservations.

## Root Cause
The Firestore security rules for the top-level `bookings` collection had two problems:

1. **Undefined function**: Referenced `isClubMember(clubId)` which didn't exist
2. **Wrong variable**: Used `createdBy` instead of `userId` for ownership checks
3. **Missing scope**: The `clubId` variable wasn't available in the rule context

## Solution
Updated the `bookings` collection rules in `firestore.rules`:

### Before:
```javascript
match /bookings/{bookingId} {
  allow read: if isAuthenticated();
  allow create: if isAuthenticated() && isClubMember(clubId);
  allow update, delete: if isAuthenticated() && 
                           (isCourtlyAdmin() || 
                            resource.data.createdBy == request.auth.uid);
}
```

### After:
```javascript
match /bookings/{bookingId} {
  allow read: if isAuthenticated();
  allow create: if isAuthenticated() && 
                   request.resource.data.clubId is string &&
                   isMember(request.resource.data.clubId);
  allow update, delete: if isAuthenticated() && 
                           (isCourtlyAdmin() || 
                            resource.data.userId == request.auth.uid);
}
```

## Changes Made:

1. **Fixed club membership check**: 
   - Changed from undefined `isClubMember(clubId)` to existing `isMember(request.resource.data.clubId)`
   - Added validation that `clubId` exists in the request data

2. **Fixed ownership check**:
   - Changed from `resource.data.createdBy` to `resource.data.userId`
   - This matches the field name actually used in the booking documents

3. **Applied same fix to lessonRequests**:
   - Made identical changes to the `lessonRequests` collection rules

## Permissions Now Allow:

✅ **Create**: Any authenticated user who is a member of the club can create bookings
✅ **Read**: Any authenticated user can read bookings (needed for conflict checking)
✅ **Update/Delete**: Users can modify/delete their own bookings, Courtly admins can modify any

## Testing:
After deploying these rules, members can now:
1. Navigate to `/club/{clubId}/reserve-court`
2. Click on an available time slot
3. Fill out the booking form
4. Successfully create a reservation

## Deployed:
```bash
firebase deploy --only firestore:rules
```

Status: ✅ Successfully deployed to `courtly-by-jiayou-tennis`
