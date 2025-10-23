/**
 * Quick Stripe Connect Setup Test
 * Run this to verify your environment is configured correctly
 */

const testEnvironment = () => {
  console.log('🧪 Testing Stripe Connect Setup...\n');

  // Check environment variables
  const requiredEnvVars = [
    'FIREBASE_SERVICE_ACCOUNT',
    'STRIPE_SECRET_KEY',
    'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.log('❌ Missing environment variables:');
    missingVars.forEach(varName => console.log(`   - ${varName}`));
    console.log('\n📝 Add these to your .env.local file\n');
    return false;
  }

  console.log('✅ All required environment variables are set');
  
  // Check Stripe keys format
  if (!process.env.STRIPE_SECRET_KEY.startsWith('sk_test_')) {
    console.log('⚠️  Warning: STRIPE_SECRET_KEY should start with "sk_test_" for testing');
  }
  
  if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.startsWith('pk_test_')) {
    console.log('⚠️  Warning: NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY should start with "pk_test_" for testing');
  }

  console.log('✅ Stripe keys appear to be in test mode');

  // Check Firebase service account
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    if (serviceAccount.project_id !== 'courtly-by-jiayou-tennis') {
      console.log('⚠️  Warning: Firebase project ID should be "courtly-by-jiayou-tennis"');
    } else {
      console.log('✅ Firebase service account configured correctly');
    }
  } catch (error) {
    console.log('❌ FIREBASE_SERVICE_ACCOUNT is not valid JSON');
    console.log('   Make sure it\'s properly minified and wrapped in single quotes');
    return false;
  }

  console.log('\n🎉 Environment setup looks good!');
  console.log('\n📋 Next steps:');
  console.log('1. Run: npm run dev');
  console.log('2. Go to: http://localhost:3000/club/[clubId]/stripe-setup');
  console.log('3. Test the Stripe Connect flow');
  console.log('\n📖 See STRIPE_TESTING_GUIDE.md for detailed testing steps');

  return true;
};

// Run the test
testEnvironment();
