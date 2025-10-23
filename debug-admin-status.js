#!/usr/bin/env node

/**
 * Debug Admin Status Helper
 * This script helps debug why a user might not be recognized as a club admin
 */

console.log('🔍 Admin Status Debug Helper\n');

console.log('To debug your admin status, add this code to your browser console when on the stripe-setup page:\n');

console.log(`
// Debug code - paste this in browser console:
console.log('=== ADMIN STATUS DEBUG ===');
console.log('User:', user);
console.log('Club ID:', clubId);
console.log('User Data:', userData);
console.log('User Type:', userData?.userType);
console.log('Organization:', userData?.organization);
console.log('Is Array:', Array.isArray(userData?.organization));
console.log('Includes Club ID:', userData?.organization?.includes(clubId));
console.log('Is Courtly Admin:', userData?.userType === 'courtly');
console.log('Is Club Admin:', userData?.userType === 'admin' && userData?.organization && Array.isArray(userData?.organization) && userData?.organization.includes(clubId));
console.log('Final Admin Status:', isAdmin);
console.log('========================');
`);

console.log('\n📋 Common Issues and Solutions:\n');

console.log('1. **User Type Issue:**');
console.log('   - Check if userData.userType === "admin"');
console.log('   - Should be "admin", "member", or "courtly"');
console.log('');

console.log('2. **Organization Field Issue:**');
console.log('   - Check if userData.organization exists');
console.log('   - Check if it\'s an array: Array.isArray(userData.organization)');
console.log('   - Check if it includes the clubId');
console.log('');

console.log('3. **Club ID Mismatch:**');
console.log('   - Check if the clubId from URL matches the one in userData.organization');
console.log('   - Make sure you\'re accessing the correct club page');
console.log('');

console.log('4. **Database Structure:**');
console.log('   - Check if the user document exists in Firestore');
console.log('   - Check if the organization field is properly set');
console.log('');

console.log('🧪 Steps to Debug:');
console.log('1. Go to the stripe-setup page');
console.log('2. Open browser console (F12)');
console.log('3. Paste the debug code above');
console.log('4. Check the output and compare with expected values');
console.log('5. Look for any mismatches or missing data');
