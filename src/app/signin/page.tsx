"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { auth, db } from '../../../firebase';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
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
      darkMode ? 'bg-[#0a0a0a] text-white' : 'bg-white text-gray-900'
    }`}>
      <PageTitle title="Sign In - Courtly" />
      
      {/* Header */}
      <header className={`px-6 md:px-12 py-6 flex justify-between items-center ${
        darkMode ? 'border-b border-[#1a1a1a]' : 'border-b border-gray-100'
      }`}>
        <Link href="/" className="flex items-center gap-3">
          <div className={`text-2xl font-light tracking-tight ${
            darkMode ? 'text-white' : 'text-black'
          }`}>
            Courtly
          </div>
        </Link>
        
        <button
          onClick={toggleDarkMode}
          className={`p-2 rounded-full transition-colors ${
            darkMode 
              ? "hover:bg-[#1a1a1a]" 
              : "hover:bg-gray-100"
          }`}
          aria-label="Toggle dark mode"
        >
          {darkMode ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Title */}
          <div className="mb-12">
            <h1 className={`text-4xl md:text-5xl font-light mb-3 ${
              darkMode ? 'text-white' : 'text-black'
            }`}>
              Sign In
            </h1>
            <p className={`text-lg font-light ${
              darkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Welcome back to Courtly
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className={`mb-6 px-4 py-3 rounded font-light text-sm ${
              darkMode ? 'bg-red-900/20 text-red-400' : 'bg-red-50 text-red-600'
            }`}>
              {error}
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className={`mb-6 px-4 py-3 rounded font-light text-sm ${
              darkMode ? 'bg-green-900/20 text-green-400' : 'bg-green-50 text-green-600'
            }`}>
              {success}
            </div>
          )}

          {/* Sign In Form */}
          <form onSubmit={handleSignIn} className="space-y-6">
            {/* Email */}
            <div>
              <label htmlFor="email" className={`block mb-2 text-sm font-light ${
                darkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full px-4 py-3 rounded font-light ${
                  darkMode 
                    ? 'bg-[#0a0a0a] border border-[#1a1a1a] text-white placeholder-gray-600 focus:border-white' 
                    : 'bg-white border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-black'
                } focus:outline-none transition-colors`}
                placeholder="you@example.com"
                required
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="password" className={`block text-sm font-light ${
                  darkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Password
                </label>
                <Link 
                  href="/forgot-password" 
                  className={`text-xs font-light transition-colors ${
                    darkMode ? 'text-gray-500 hover:text-white' : 'text-gray-400 hover:text-black'
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
                className={`w-full px-4 py-3 rounded font-light ${
                  darkMode 
                    ? 'bg-[#0a0a0a] border border-[#1a1a1a] text-white placeholder-gray-600 focus:border-white' 
                    : 'bg-white border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-black'
                } focus:outline-none transition-colors`}
                placeholder="••••••••"
                required
              />
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 px-4 rounded font-light text-sm transition-colors ${
                darkMode
                  ? 'bg-white text-black hover:bg-gray-100'
                  : 'bg-black text-white hover:bg-gray-800'
              } disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
              <div className={`flex-1 border-t ${darkMode ? 'border-[#1a1a1a]' : 'border-gray-100'}`}></div>
              <span className={`px-4 text-xs font-light ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>OR</span>
              <div className={`flex-1 border-t ${darkMode ? 'border-[#1a1a1a]' : 'border-gray-100'}`}></div>
            </div>

            {/* Google Sign In */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className={`w-full py-3 px-4 rounded font-light text-sm transition-colors ${
                darkMode
                  ? 'bg-[#1a1a1a] text-white hover:bg-[#2a2a2a]'
                  : 'bg-gray-100 text-black hover:bg-gray-200'
              } disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
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
            <p className={`font-light ${darkMode ? 'text-gray-500' : 'text-gray-600'}`}>
              Don't have an account?{' '}
              <Link 
                href="/signup" 
                className={`font-light transition-colors ${
                  darkMode ? 'text-white hover:text-gray-300' : 'text-black hover:text-gray-600'
                }`}
              >
                Sign Up
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className={`py-8 px-6 text-center border-t ${
        darkMode ? 'border-[#1a1a1a]' : 'border-gray-100'
      }`}>
        <p className={`text-sm font-light ${
          darkMode ? 'text-gray-600' : 'text-gray-400'
        }`}>
          © {new Date().getFullYear()} Courtly by JiaYou Tennis
        </p>
      </footer>
    </div>
  );
}