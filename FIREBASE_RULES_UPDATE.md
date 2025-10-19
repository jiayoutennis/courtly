# Firebase Rules Update - October 18, 2025

## Issue
The Firebase Security Rules were preventing the Manage Users page from working because:
1. Rules relied on custom claims (`orgId`, `role`) that haven't been implemented yet
2. Regular users couldn't read other users' documents
3. Only Courtly admins should have access to all users

## Solution

### Added New Helper Functions
```javascript
// Check if user is Courtly admin (from user document)
function isCourtlyAdmin() {
  return isAuthenticated() && 
    exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.userType == 'courtly';
}

// Check if user is club admin (from user document)
function isClubAdmin() {
  return isAuthenticated() && 
    exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.userType == 'admin';
}
```

### Updated Users Collection Rules
- **Read**: Users can read their own data OR Courtly admins can read all users
- **Create**: Users can create their own document on signup (only requires email and createdAt)
- **Update**: Users can update their own data OR Courtly admins can update any user
- **Delete**: Only Courtly admins can delete users

### Updated Orgs Collection Rules
- **Read**: Members can read their org's data OR Courtly admins can read all orgs
- **Create**: Authenticated users can create orgs OR Courtly admins
- **Update**: Org owners can update OR Courtly admins
- **Delete**: Org owners can delete OR Courtly admins

## How It Works Now

1. **Courtly Admins** (userType: 'courtly'):
   - Can view ALL users in the system
   - Can update ANY user (including changing userType)
   - Can delete ANY user
   - Can manage ALL organizations

2. **Club Admins** (userType: 'admin'):
   - Can only read/update their own user document
   - Future: Will be able to manage their club's data

3. **Members** (userType: 'member'):
   - Can only read/update their own user document

## Deployment Status
✅ Rules deployed to: `courtly-by-jiayou-tennis`
✅ Console: https://console.firebase.google.com/project/courtly-by-jiayou-tennis/overview

## Next Steps

### Immediate
1. Make sure your user document has `userType: 'courtly'` set in Firestore
2. Test the Manage Users page at `/admin/manage-users`

### Future (Custom Claims Migration)
When you implement Firebase Auth custom claims:
- The helper functions can be updated to use `request.auth.token.userType`
- This will be more efficient (no extra Firestore read)
- Current implementation works as a bridge until then

## Files Modified
- `firestore.rules` - Added Courtly admin helpers and updated Users/Orgs rules
- `firebase.json` - Created Firebase config file
- `.firebaserc` - Created project configuration
- `firestore.indexes.json` - Created indexes file

## Security Notes
- Still maintains multi-tenancy for collections that use `orgId`
- Still enforces role-based access via custom claims (when available)
- Courtly admin privilege is read from Firestore (cached by Firebase)
- All changes are auditable (can add audit logs later)

---

## UPDATE: Full Courtly Admin Permissions (October 18, 2025)

### What Changed
Granted **Courtly admins FULL permissions** across ALL collections:

### Complete Permissions List for Courtly Admins:

1. **Users** - Read, create, update, delete ALL users ✅
2. **UserOrgRoles** - Read, create, update, delete ALL role assignments ✅
3. **Orgs** - Read, create, update, delete ALL organizations ✅
4. **Courts** - Read, create, update, delete ALL courts ✅
5. **Coaches** - Read, create, update, delete ALL coaches ✅
6. **Members** - Read, create, update, delete ALL members ✅
7. **RuleSets** - Read, create, update, delete ALL rule sets ✅
8. **Programs** - Read, create, update, delete ALL programs ✅
9. **Blocks** - Read, create, update, delete ALL schedule blocks ✅
10. **Bookings** - Read, create, update, delete ALL bookings (bypasses Cloud Functions) ✅
11. **Payments** - Read, create, update, delete ALL payments (bypasses webhooks) ✅
12. **Waitlist** - Read, create, update, delete ALL waitlist entries ✅
13. **AuditLogs** - Read, create, update, delete ALL audit logs ✅
14. **UtilizationMetrics** - Read, create, update, delete ALL metrics ✅
15. **PublicClubs** - Read, create, update, delete ALL public clubs + subcollections ✅
16. **ANY OTHER COLLECTION** - Full read/write via catch-all rule ✅

### Catch-All Rule
Added at the end of firestore.rules:
```javascript
match /{document=**} {
  // Courtly admins have full read/write access to any collection
  allow read, write: if isCourtlyAdmin();
}
```

This means Courtly admins can:
- Access ANY collection (even ones not explicitly defined)
- Read, create, update, and delete ANY document
- Bypass ALL normal restrictions (Cloud Functions requirements, field validations, etc.)

### Security Implications
⚠️ **Important**: Courtly admin role (`userType: 'courtly'`) is extremely powerful and should only be assigned to trusted platform administrators.

### Regular Users
All other user types (admin, member) still have restricted access according to their roles and org memberships.
