"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { auth, db } from '../../../firebase';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import Image from 'next/image';
import PageTitle from '@/app/components/PageTitle';

export default function SignInPage() {
  const [darkMode, setDarkMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('darkMode', newMode ? 'true' : 'false');
  };

  // Handle email/password sign in
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Check if user exists in database
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      
      if (userDoc.exists()) {
        setSuccess('Sign in successful! Redirecting...');
        
        // Redirect based on user type
        const userData = userDoc.data();
        
        setTimeout(() => {
          router.push('/dashboard');
        }, 1000);
      } else {
        // Create a basic profile
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          fullName: email.split('@')[0], // Uses part of email as name
          email: email,
          userType: 'member', // Default to member
          createdAt: new Date().toISOString()
        });
        
        setSuccess('Welcome! Profile created successfully.');
        setTimeout(() => {
          router.push('/dashboard');
        }, 1000);
      }
    } catch (err: any) {
      console.error('Sign in error:', err);
      
      // Handle specific error codes
      switch(err.code) {
        case 'auth/user-not-found':
          setError('No account found with this email');
          break;
        case 'auth/wrong-password':
          setError('Incorrect password');
          break;
        case 'auth/invalid-email':
          setError('Invalid email address');
          break;
        case 'auth/too-many-requests':
          setError('Too many failed login attempts. Try again later or reset your password');
          break;
        default:
          setError(`Failed to sign in: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle Google sign in
  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      // Check if user exists in database
      const userDoc = await getDoc(doc(db, 'users', result.user.uid));
      
      if (userDoc.exists()) {
        setSuccess('Sign in successful! Redirecting...');
        setTimeout(() => {
          router.push('/dashboard');
        }, 1000);
      } else {
        // Redirect to complete profile if first time signing in with Google
        setSuccess('Welcome! Setting up your account...');
        setTimeout(() => {
          router.push('/complete-profile');
        }, 1000);
      }
    } catch (err: any) {
      console.error('Google sign in error:', err);
      setError(`Failed to sign in with Google: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-300 ${
      darkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'
    }`}>
      <PageTitle title="Sign In - Courtly" />
      
      {/* Dark Mode Toggle */}
      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={toggleDarkMode}
          className={`p-2 rounded-full ${darkMode 
            ? "bg-gray-800 text-teal-400 hover:bg-gray-700" 
            : "bg-gray-100 text-amber-500 hover:bg-gray-200"} transition-colors`}
          aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
        >
          {darkMode ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
            </svg>
          )}
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className={`w-full max-w-md p-8 rounded-xl shadow-lg ${
          darkMode ? 'bg-gray-800' : 'bg-white'
        } transition-colors`}>
          {/* Logo and Title */}
          <div className="flex flex-col items-center mb-8">
            <div className={`p-3 rounded-full mb-4 ${
              darkMode ? 'bg-teal-600' : 'bg-green-400'
            }`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold">Sign In to Courtly</h1>
            <p className={`mt-2 text-center ${
              darkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Enter your credentials to access your account
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-3 rounded-lg bg-red-100 text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mb-6 p-3 rounded-lg bg-green-100 text-green-700 text-sm">
              {success}
            </div>
          )}

          {/* Sign In Form */}
          <form onSubmit={handleSignIn} className="space-y-6">
            {/* Email */}
            <div>
              <label htmlFor="email" className={`block mb-2 text-sm font-medium ${
                darkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full px-4 py-3 rounded-lg ${
                  darkMode 
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                    : 'bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-500'
                } focus:outline-none focus:ring-2 ${
                  darkMode ? 'focus:ring-teal-500' : 'focus:ring-green-400'
                }`}
                placeholder="you@example.com"
                required
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="password" className={`block text-sm font-medium ${
                  darkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Password
                </label>
                <Link 
                  href="/forgot-password" 
                  className={`text-xs font-medium hover:underline ${
                    darkMode ? 'text-teal-400' : 'text-green-500'
                  }`}
                >
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full px-4 py-3 rounded-lg ${
                  darkMode 
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                    : 'bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-500'
                } focus:outline-none focus:ring-2 ${
                  darkMode ? 'focus:ring-teal-500' : 'focus:ring-green-400'
                }`}
                placeholder="••••••••"
                required
              />
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 px-4 rounded-lg font-medium text-white transition-colors ${
                darkMode
                  ? loading ? 'bg-teal-800' : 'bg-teal-600 hover:bg-teal-700'
                  : loading ? 'bg-green-500' : 'bg-green-400 hover:bg-green-500'
              } focus:outline-none focus:ring-2 ${
                darkMode ? 'focus:ring-teal-500' : 'focus:ring-green-400'
              } flex items-center justify-center`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </button>

            {/* Divider */}
            <div className="flex items-center my-6">
              <div className={`flex-1 border-t ${darkMode ? 'border-gray-700' : 'border-gray-300'}`}></div>
              <span className={`px-3 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>OR</span>
              <div className={`flex-1 border-t ${darkMode ? 'border-gray-700' : 'border-gray-300'}`}></div>
            </div>

            {/* Google Sign In */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                darkMode
                  ? 'bg-gray-700 hover:bg-gray-600 text-white'
                  : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300'
              } focus:outline-none focus:ring-2 focus:ring-gray-500 flex items-center justify-center`}
            >
              <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
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
              Continue with Google
            </button>
          </form>

          {/* Sign Up Link */}
          <div className="mt-8 text-center">
            <p className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
              Don't have an account?{' '}
              <Link 
                href="/signup" 
                className={`font-medium hover:underline ${
                  darkMode ? 'text-teal-400' : 'text-green-500'
                }`}
              >
                Sign Up
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className={`py-4 text-center ${
        darkMode ? 'text-gray-400' : 'text-gray-600'
      }`}>
        <p className="text-sm">
          © {new Date().getFullYear()} Courtly by JiaYou Tennis. All rights reserved.
        </p>
      </footer>
    </div>
  );
}