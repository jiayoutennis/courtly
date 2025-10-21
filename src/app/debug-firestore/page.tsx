/**
 * Debug Firestore Page
 * View your user document data to diagnose issues
 */

'use client';

import { useState, useEffect } from 'react';
import { auth, db } from '../../../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

export default function DebugFirestorePage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [userDoc, setUserDoc] = useState<any>(null);
  const [orgs, setOrgs] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push('/signin');
        return;
      }

      setUser({
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: currentUser.displayName,
      });

      try {
        // Get user document
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const data = userDocSnap.data();
          setUserDoc({
            exists: true,
            id: userDocSnap.id,
            path: userDocSnap.ref.path,
            data: data,
            keys: Object.keys(data),
          });

          // Try to get organizations
          try {
            const orgField = data.organization || data.organizations;
            console.log('Organization field:', orgField, 'Type:', typeof orgField);
            
            if (orgField) {
              let orgId: string | null = null;
              
              // Handle different formats
              if (typeof orgField === 'string') {
                orgId = orgField;
              } else if (Array.isArray(orgField) && orgField.length > 0) {
                orgId = typeof orgField[0] === 'string' ? orgField[0] : orgField[0]?.id;
              } else if (typeof orgField === 'object' && orgField.id) {
                orgId = orgField.id;
              }
              
              if (orgId && typeof orgId === 'string') {
                const orgDocRef = doc(db, 'orgs', orgId);
                const orgDocSnap = await getDoc(orgDocRef);
                
                if (orgDocSnap.exists()) {
                  setOrgs([{
                    id: orgDocSnap.id,
                    data: orgDocSnap.data(),
                  }]);
                }
              }
            }
          } catch (orgError) {
            console.error('Error fetching org:', orgError);
          }
        } else {
          setUserDoc({
            exists: false,
          });
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setUserDoc({
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-t-transparent border-black rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-light mb-8">Firestore Debug</h1>

        {/* Auth User */}
        <div className="mb-8 p-6 bg-gray-50 rounded">
          <h2 className="text-xl font-light mb-4">Firebase Auth User</h2>
          <pre className="text-xs font-mono overflow-auto">
            {JSON.stringify(user, null, 2)}
          </pre>
        </div>

        {/* User Document */}
        <div className="mb-8 p-6 bg-gray-50 rounded">
          <h2 className="text-xl font-light mb-4">Firestore User Document</h2>
          {userDoc?.exists === false ? (
            <p className="text-red-600">❌ User document does not exist</p>
          ) : userDoc?.error ? (
            <p className="text-red-600">❌ Error: {userDoc.error}</p>
          ) : (
            <>
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-1">Document Path:</p>
                <p className="text-sm font-mono">{userDoc?.path}</p>
              </div>
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-1">Field Names:</p>
                <p className="text-sm font-mono">{userDoc?.keys?.join(', ') || 'None'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Full Data:</p>
                <pre className="text-xs font-mono overflow-auto bg-white p-4 rounded border">
                  {JSON.stringify(userDoc?.data, null, 2)}
                </pre>
              </div>
            </>
          )}
        </div>

        {/* Organizations */}
        {orgs.length > 0 && (
          <div className="mb-8 p-6 bg-gray-50 rounded">
            <h2 className="text-xl font-light mb-4">Organizations</h2>
            {orgs.map((org, index) => (
              <div key={index} className="mb-4">
                <p className="text-sm text-gray-600 mb-1">Org ID: {org.id}</p>
                <pre className="text-xs font-mono overflow-auto bg-white p-4 rounded border">
                  {JSON.stringify(org.data, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8">
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
