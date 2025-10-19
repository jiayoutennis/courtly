# Troubleshooting Court Booking Issues

## Quick Diagnostic

If you cannot book a court, visit the diagnostic page first:
**URL:** `/booking-diagnostic`

This page will show you:
- Your user permissions
- Club memberships
- Coach assignments
- Why you can/cannot book courts
- Direct links to fix the issue

## Common Issues & Solutions

### Issue 1: "Permission Denied" Error

**Cause:** You are not a member of the club, not a coach, not a club admin, and not a Courtly admin.

**Symptoms:**
- Error message: "Permission denied. Please make sure you are a member of this club."
- Browser console shows: `permission-denied` error

**Solution:**
1. Go to `/booking-diagnostic` to confirm the issue
2. Join a club at `/browse-clubs`
3. OR ask your club administrator to add you as a member

**How to Join a Club:**
1. Navigate to Browse Clubs (`/browse-clubs`)
2. Find your club
3. Click "Request to Join"
4. Wait for club admin to approve your request

### Issue 2: Not a Member of Any Club

**Symptoms:**
- Diagnostic page shows "No club memberships found"
- You see "❌ No" for "Is Member"

**Solution:**
You must be added to a club. There are two ways:

**Option A: Self-Service (Recommended)**
1. Visit `/browse-clubs`
2. Find clubs in your area
3. Submit a join request
4. Wait for admin approval

**Option B: Admin Addition**
1. Contact your club's administrator
2. They can add you directly via `/club/[clubId]/manage-members`
3. No approval needed when added by admin

### Issue 3: Request Pending

**Symptoms:**
- You submitted a join request
- Still can't book courts
- Button shows "Request Pending"

**Reason:**
Your request hasn't been approved yet.

**Solution:**
1. Wait for club admin to approve
2. OR contact club admin to expedite
3. Club admins can approve at `/club/[clubId]/manage-members` → Pending Requests tab

### Issue 4: Coach Role Not Working

**Symptoms:**
- You are a coach at the club
- Still get permission denied

**Check:**
1. Go to `/booking-diagnostic`
2. Look for "COACH ASSIGNMENTS" section
3. Verify your club is listed

**If Not Listed:**
Ask club admin to add you as a coach via `/club/[clubId]/manage-members`

### Issue 5: Club Not Initialized

**Symptoms:**
- No courts appear in dropdown
- No time slots available
- Page shows "No courts found"

**Cause:**
The club's reservation system wasn't initialized.

**Solution (Admin Only):**
1. Go to `/admin/initialize-reservations`
2. Select the club
3. Click "Initialize This Club"
4. Verify status shows all green checkmarks

### Issue 6: Wrong Organization Field

**Symptoms:**
- You're definitely a member
- Still can't book
- Diagnostic shows org ID doesn't match

**Technical Issue:**
User document has wrong/old organization data.

**Solution (Admin):**
Update user's organization field in Firestore:
```javascript
// In Firestore console or via code
await updateDoc(doc(db, "users", userId), {
  organization: ["correctClubId"],
  organizations: [{
    orgId: "correctClubId",
    role: "member"
  }]
});
```

## Permission Requirements

To book a court, you must be **at least one** of:

✅ **Member** - User document has club in `organization` or `organizations` field
✅ **Coach** - User document exists in `/orgs/{clubId}/coaches/{userId}`
✅ **Club Admin** - `userType: 'admin'` AND club in organization
✅ **Courtly Admin** - `userType: 'courtly'` (system-wide access)

## How Permissions Are Checked

When you try to book a court, Firestore rules run this check:

```javascript
function canBookCourts(orgId) {
  return isAuthenticated() && (
    isMember(orgId) ||      // Regular member
    isStaff(orgId) ||       // Club admin
    isCoach(orgId) ||       // Club coach
    isCourtlyAdminAny()     // System admin
  );
}
```

**Each function checks:**

- `isMember()` - organization array contains club ID
- `isStaff()` - userType='admin' AND organization matches
- `isCoach()` - Document exists in `/orgs/{clubId}/coaches/{userId}`
- `isCourtlyAdminAny()` - userType='courtly'

## Debugging Steps

### Step 1: Check Your Status
1. Visit `/booking-diagnostic`
2. Read the diagnostic output
3. Identify which permission you're missing

### Step 2: Verify Club Membership
1. Go to `/dashboard`
2. Check "Club Membership" section
3. Verify your club is listed

### Step 3: Check Browser Console
1. Open browser DevTools (F12)
2. Go to Console tab
3. Try to book a court
4. Look for error messages
5. Error code `permission-denied` means you need membership

### Step 4: Verify Firestore Data
**For Admins:**
1. Open Firebase Console
2. Go to Firestore Database
3. Navigate to `users/{yourUserId}`
4. Check `organization` field
5. Should contain your club's ID

### Step 5: Check Firestore Rules
**For Developers:**
1. Open `firestore.rules` file
2. Find `match /bookings/{bookingId}`
3. Verify `canBookCourts()` function exists
4. Check all helper functions (isMember, isStaff, isCoach)

## For Club Admins

### How to Add Members

**Approve Join Requests:**
1. Go to `/club/{clubId}/manage-members`
2. Click "Pending Requests" tab
3. Click "Approve" for the user
4. User can now book courts immediately

**Directly Add Members:**
1. Go to `/club/{clubId}/manage-members`
2. Click "Add Member" button
3. Enter user's email
4. They're added instantly (no approval needed)

### How to Add Coaches

1. Go to `/club/{clubId}/manage-members`
2. Find the user in Members tab
3. Click "Promote to Coach" (if that option exists)
4. OR manually add to `/orgs/{clubId}/coaches` subcollection

## For Courtly Admins

### Initialize Reservation System
If a club doesn't have courts/hours/settings:

1. Go to `/admin/initialize-reservations`
2. Click "Initialize All Clubs" (bulk)
3. OR select individual club and click "Initialize This Club"
4. Verify status shows all configured

### Grant Emergency Access
To give someone immediate booking access:

**Option 1: Make Them Courtly Admin**
```javascript
await updateDoc(doc(db, "users", userId), {
  userType: "courtly"
});
```

**Option 2: Add to Club**
```javascript
await updateDoc(doc(db, "users", userId), {
  organization: [clubId],
  organizations: [{
    orgId: clubId,
    role: "member"
  }]
});
```

## Testing Your Fix

After making changes:

1. **Refresh Diagnostic:**
   - Go to `/booking-diagnostic`
   - Click "Refresh Diagnostic"
   - Verify permissions show green checkmarks

2. **Try Booking:**
   - Go to `/club/{clubId}/reserve-court`
   - Select a court and time
   - Click "Reserve"
   - Should succeed without errors

3. **Check Booking Appears:**
   - Refresh the page
   - Verify your booking shows in the schedule
   - Should be highlighted in blue (your booking)

## Error Messages Explained

| Error Message | Meaning | Fix |
|--------------|---------|-----|
| "Permission denied" | Not authorized | Join club or get admin to add you |
| "Please select a court and time" | Missing data | Select court from dropdown + time slot |
| "This time slot is already booked" | Conflict | Choose different time |
| "Failed to create booking" | Generic error | Check browser console for details |
| "Booking validation failed" | Missing required fields | Check clubId, courtId, etc. |

## Still Having Issues?

1. **Check Firestore Rules Deployed:**
   ```bash
   firebase deploy --only firestore:rules
   ```

2. **Verify User Authentication:**
   - Make sure you're logged in
   - Check `auth.currentUser` in console

3. **Check Network Tab:**
   - Open DevTools → Network tab
   - Try booking
   - Look for failed requests
   - Check response for error details

4. **Clear Browser Cache:**
   - Sometimes old data causes issues
   - Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

5. **Contact Support:**
   - Provide your user ID
   - Include diagnostic output
   - Share browser console errors
   - Mention which club you're trying to book

## Related Documentation

- `AUTO_RESERVATION_INIT.md` - How reservation system is initialized
- `FIRESTORE_RULES_FIX.md` - Permission system explanation
- `firestore.rules` - Actual security rules
- `/booking-diagnostic` - Live diagnostic tool

---

**Quick Links:**
- Diagnostic Page: `/booking-diagnostic`
- Browse Clubs: `/browse-clubs`
- Your Dashboard: `/dashboard`
- Reserve Court: `/club/{clubId}/reserve-court`
