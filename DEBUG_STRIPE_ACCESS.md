# 🔧 Debugging Stripe Setup Page Access

## Issue Fixed ✅

The club owner couldn't access `/club/[clubId]/stripe-setup` because the admin check was incorrect.

**Problem:** The code was checking `userData.clubId === clubId` which doesn't exist in the user data structure.

**Solution:** Updated the admin check to properly verify:
1. User type is 'admin' or 'courtly'
2. User's organization array includes the clubId

## How to Test the Fix

### 1. Check User Data Structure
First, let's verify the user's data structure. Add this to the browser console when on the stripe-setup page:

```javascript
// In browser console, check the user data:
console.log('User data:', userData);
console.log('User type:', userData.userType);
console.log('User organizations:', userData.organization);
console.log('Club ID from URL:', clubId);
```

### 2. Verify Admin Status
The page should now correctly identify:
- **Courtly admins:** `userType === 'courtly'` (access to all clubs)
- **Club admins:** `userType === 'admin'` AND `organization.includes(clubId)`

### 3. Test Access Scenarios

#### Scenario A: Club Admin
- User has `userType: 'admin'`
- User has `organization: ['clubId1', 'clubId2']`
- Should access `/club/clubId1/stripe-setup` ✅
- Should access `/club/clubId2/stripe-setup` ✅
- Should NOT access `/club/otherClubId/stripe-setup` ❌

#### Scenario B: Courtly Admin
- User has `userType: 'courtly'`
- Should access ANY `/club/[anyClubId]/stripe-setup` ✅

#### Scenario C: Regular Member
- User has `userType: 'member'`
- Should NOT access `/club/[clubId]/stripe-setup` ❌
- Should see "Access Denied" message

### 4. Debug Steps

If you're still having access issues:

1. **Check the browser console** for any error messages
2. **Verify the user is logged in** and has the correct userType
3. **Check the organization field** contains the clubId
4. **Try refreshing the page** after the fix

### 5. Common Issues

#### Issue: "Access Denied" still showing
**Check:**
- User is logged in
- User has `userType: 'admin'` or `userType: 'courtly'`
- For club admins: `organization` array includes the clubId
- Page has been refreshed after the fix

#### Issue: User data not loading
**Check:**
- Firebase connection is working
- User document exists in Firestore
- No JavaScript errors in console

#### Issue: Organization field is string instead of array
**Fix:** The code handles both cases, but if you see issues, check if the organization field needs to be converted to an array.

### 6. Expected Behavior

After the fix, club owners should be able to:
1. **Access the Stripe setup page** at `/club/[clubId]/stripe-setup`
2. **See the Stripe Connect status** (unlinked, onboarding, active, etc.)
3. **Connect their Stripe account** if not already connected
4. **Create membership plans** and manage Stripe settings
5. **Access the Stripe dashboard** if connected

### 7. Testing Checklist

- [ ] Club admin can access `/club/[clubId]/stripe-setup`
- [ ] Courtly admin can access any club's stripe-setup page
- [ ] Regular members see "Access Denied"
- [ ] Page loads without errors
- [ ] Stripe Connect functionality works
- [ ] Membership plan creation works

## Need More Help?

If you're still having issues:

1. **Check the browser console** for specific error messages
2. **Verify the user data structure** matches the expected format
3. **Test with different user types** (admin, courtly, member)
4. **Check the network tab** for any failed API calls

The fix should resolve the access issue for club owners! 🎉
