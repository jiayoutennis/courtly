"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { auth, db } from '../../../firebase';
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, updateProfile, sendEmailVerification } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import PageTitle from '@/app/components/PageTitle';
import DarkModeToggle from '@/app/components/DarkModeToggle';

export default function SignUpPage() {
  const [darkMode, setDarkMode] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const router = useRouter();

  // Initialize dark mode from localStorage
  useEffect(() => {
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode === 'true') {
      setDarkMode(true);
    }
  }, []);

  // Validate form
  const validateForm = () => {
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }
    
    return true;
  };

  // Handle email/password sign up
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    
    try {
      // Create user with Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Create full name from first and last name
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
      
      // Update profile with display name
      await updateProfile(user, {
        displayName: fullName
      });
      
      // Create user document in Firestore with all required fields
      const now = new Date();
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: email,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        fullName: fullName,
        joinedAt: now,
        lastLogin: now,
        userType: 'member', // Default to member
        organizations: [], // Array of { orgId: string, role: string }
        defaultOrgId: null,
        isActive: true,
        photoURL: user.photoURL || null,
        phone: null,
        language: 'en', // Default to English
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Los_Angeles',
        authProvider: 'password',
        notifications: {
          email: true,
          sms: false,
          push: false
        },
        permissions: [],
        stripeCustomerId: null,
        clubMemberships: {}, // Initialize empty map for club memberships (clubId -> tier)
        createdBy: user.uid, // Self-created
        referralCode: null,
        inviteToken: null,
        lastActivityAt: now,
        notificationTokens: [],
        deletedAt: null,
        schemaVersion: 1,
        // Legacy fields for backward compatibility
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        organization: [] // Kept for backward compatibility
      });
      
      // Send email verification
      await sendEmailVerification(user);
      
      setSuccess('Account created successfully! Please check your email to verify your account.');
      
      // Redirect to a verification pending page or sign-in page
      setTimeout(() => {
        router.push('/signin?verification=pending');
      }, 3000);
      
    } catch (err: any) {
      console.error('Sign up error:', err);
      
      // Handle specific error codes
      switch(err.code) {
        case 'auth/email-already-in-use':
          setError('This email is already registered. Try signing in instead.');
          break;
        case 'auth/invalid-email':
          setError('Invalid email address');
          break;
        case 'auth/weak-password':
          setError('Password is too weak. Use at least 6 characters.');
          break;
        default:
          setError(`Failed to create account: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle Google sign up
  const handleGoogleSignUp = async () => {
    setError('');
    setLoading(true);
    
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Check if user exists in database
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (userDoc.exists()) {
        // User already exists, update last login
        const now = new Date();
        await updateDoc(doc(db, 'users', user.uid), {
          lastLogin: now,
          lastActivityAt: now
        });
        
        setSuccess('Welcome back! Redirecting to dashboard...');
        setTimeout(() => {
          router.push('/dashboard');
        }, 1000);
      } else {
        // Split display name into first and last name
        const displayName = user.displayName || 'New Member';
        const nameParts = displayName.trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
        
        // Create a new user document with all required fields
        const now = new Date();
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email || '',
          firstName: firstName,
          lastName: lastName,
          fullName: displayName,
          joinedAt: now,
          lastLogin: now,
          userType: 'member',
          organizations: [],
          defaultOrgId: null,
          isActive: true,
          photoURL: user.photoURL || null,
          phone: null,
          language: 'en',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Los_Angeles',
          authProvider: 'google',
          notifications: {
            email: true,
            sms: false,
            push: false
          },
          permissions: [],
          stripeCustomerId: null,
          clubMemberships: {}, // Initialize empty map for club memberships (clubId -> tier)
          createdBy: user.uid,
          referralCode: null,
          inviteToken: null,
          lastActivityAt: now,
          notificationTokens: [],
          deletedAt: null,
          schemaVersion: 1,
          // Legacy fields for backward compatibility
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          organization: []
        });
        
        setSuccess('Account created successfully! Redirecting to dashboard...');
        setTimeout(() => {
          router.push('/dashboard');
        }, 1500);
      }
    } catch (err: any) {
      console.error('Google sign up error:', err);
      setError(`Failed to sign up with Google: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      darkMode ? 'bg-[#0a0a0a] text-white' : 'bg-white text-gray-900'
    }`}>
      <PageTitle title="Sign Up - Courtly" />
      
      {/* Header */}
      <header className={`border-b transition-colors duration-300 ${
        darkMode ? 'border-[#1a1a1a]' : 'border-gray-100'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-lg font-light">Courtly</span>
          </Link>
          <DarkModeToggle darkMode={darkMode} setDarkMode={setDarkMode} />
        </div>
      </header>

      {/* Main Content */}
      <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] px-4 py-12">
        <div className="w-full max-w-md">
          {/* Title */}
          <div className="text-center mb-12">
            <h1 className="text-4xl sm:text-5xl font-light mb-4">Sign Up</h1>
            <p className={`font-light ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Join the tennis community
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className={`mb-6 p-4 border font-light text-sm ${
              darkMode 
                ? 'border-red-900/50 bg-red-950/20 text-red-400' 
                : 'border-red-200 bg-red-50 text-red-600'
            }`}>
              {error}
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className={`mb-6 p-4 border font-light text-sm ${
              darkMode 
                ? 'border-green-900/50 bg-green-950/20 text-green-400' 
                : 'border-green-200 bg-green-50 text-green-600'
            }`}>
              {success}
            </div>
          )}

          {/* Sign Up Form */}
          <form onSubmit={handleSignUp} className="space-y-6">
            {/* First Name */}
            <div>
              <label 
                htmlFor="firstName" 
                className={`block text-xs font-light uppercase tracking-wider mb-2 ${
                  darkMode ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                First Name
              </label>
              <input
                type="text"
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={`w-full px-4 py-3 border font-light transition-colors duration-200 ${
                  darkMode 
                    ? 'bg-[#0a0a0a] border-[#1a1a1a] text-white placeholder-gray-600 focus:border-gray-600' 
                    : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-gray-400'
                } focus:outline-none`}
                placeholder="John"
                required
              />
            </div>

            {/* Last Name */}
            <div>
              <label 
                htmlFor="lastName" 
                className={`block text-xs font-light uppercase tracking-wider mb-2 ${
                  darkMode ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                Last Name
              </label>
              <input
                type="text"
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={`w-full px-4 py-3 border font-light transition-colors duration-200 ${
                  darkMode 
                    ? 'bg-[#0a0a0a] border-[#1a1a1a] text-white placeholder-gray-600 focus:border-gray-600' 
                    : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-gray-400'
                } focus:outline-none`}
                placeholder="Doe"
                required
              />
            </div>

            {/* Email */}
            <div>
              <label 
                htmlFor="email" 
                className={`block text-xs font-light uppercase tracking-wider mb-2 ${
                  darkMode ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full px-4 py-3 border font-light transition-colors duration-200 ${
                  darkMode 
                    ? 'bg-[#0a0a0a] border-[#1a1a1a] text-white placeholder-gray-600 focus:border-gray-600' 
                    : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-gray-400'
                } focus:outline-none`}
                placeholder="you@example.com"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label 
                htmlFor="password" 
                className={`block text-xs font-light uppercase tracking-wider mb-2 ${
                  darkMode ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full px-4 py-3 border font-light transition-colors duration-200 ${
                  darkMode 
                    ? 'bg-[#0a0a0a] border-[#1a1a1a] text-white placeholder-gray-600 focus:border-gray-600' 
                    : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-gray-400'
                } focus:outline-none`}
                placeholder="••••••••"
                required
                minLength={6}
              />
              <p className={`mt-2 text-xs font-light ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                Must be at least 6 characters
              </p>
            </div>

            {/* Confirm Password */}
            <div>
              <label 
                htmlFor="confirmPassword" 
                className={`block text-xs font-light uppercase tracking-wider mb-2 ${
                  darkMode ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                Confirm Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full px-4 py-3 border font-light transition-colors duration-200 ${
                  darkMode 
                    ? 'bg-[#0a0a0a] border-[#1a1a1a] text-white placeholder-gray-600 focus:border-gray-600' 
                    : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-gray-400'
                } focus:outline-none`}
                placeholder="••••••••"
                required
              />
            </div>

            {/* Sign Up Button */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 px-6 font-light text-sm transition-colors duration-200 ${
                darkMode
                  ? loading ? 'bg-gray-800 text-gray-500' : 'bg-white text-black hover:bg-gray-100'
                  : loading ? 'bg-gray-200 text-gray-400' : 'bg-black text-white hover:bg-gray-900'
              } flex items-center justify-center`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating Account...
                </>
              ) : (
                "Create Account"
              )}
            </button>

            {/* Terms & Privacy */}
            <p className={`text-xs font-light text-center ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
              By creating an account, you agree to our{' '}
              <Link href="/terms" className="underline hover:no-underline">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="underline hover:no-underline">
                Privacy Policy
              </Link>
            </p>

            {/* Divider */}
            <div className="flex items-center my-8">
              <div className={`flex-1 border-t ${darkMode ? 'border-[#1a1a1a]' : 'border-gray-200'}`}></div>
              <span className={`px-4 text-xs font-light ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>OR</span>
              <div className={`flex-1 border-t ${darkMode ? 'border-[#1a1a1a]' : 'border-gray-200'}`}></div>
            </div>

            {/* Google Sign Up */}
            <button
              type="button"
              onClick={handleGoogleSignUp}
              disabled={loading}
              className={`w-full py-3 px-6 border font-light text-sm transition-colors duration-200 flex items-center justify-center ${
                darkMode
                  ? 'border-[#1a1a1a] hover:border-gray-600'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.198 2.698 1.24 6.65l4.026 3.115Z"
                />
                <path
                  fill="#34A853"
                  d="M16.04 18.013c-1.09.703-2.474 1.078-4.04 1.078a7.077 7.077 0 0 1-6.723-4.823l-4.04 3.067A11.965 11.965 0 0 0 12 24c2.933 0 5.735-1.043 7.834-3l-3.793-2.987Z"
                />
                <path
                  fill="#4A90E2"
                  d="M19.834 21c2.195-2.048 3.62-5.096 3.62-9 0-.71-.109-1.473-.272-2.182H12v4.637h6.436c-.317 1.559-1.17 2.766-2.395 3.558L19.834 21Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.277 14.268A7.12 7.12 0 0 1 4.909 12c0-.782.125-1.533.357-2.235L1.24 6.65A11.934 11.934 0 0 0 0 12c0 1.92.445 3.73 1.237 5.335l4.04-3.067Z"
                />
              </svg>
              Sign up with Google
            </button>
          </form>

          {/* Sign In Link */}
          <div className="mt-8 text-center">
            <p className={`font-light text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Already have an account?{' '}
              <Link 
                href="/signin" 
                className="underline hover:no-underline"
              >
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className={`border-t py-6 transition-colors duration-300 ${
        darkMode ? 'border-[#1a1a1a] text-gray-600' : 'border-gray-100 text-gray-400'
      }`}>
        <div className="text-center">
          <p className="text-xs font-light">
            © {new Date().getFullYear()} Courtly by JiaYou Tennis. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}