"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { auth, db } from '../../../../firebase';
import { 
  collection, getDocs, doc, updateDoc, Timestamp
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import PageTitle from '@/app/components/PageTitle';
import type { Org } from '../../../../shared/types';

export default function MigrateClubs() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [clubs, setClubs] = useState<any[]>([]);
  const [migrationResults, setMigrationResults] = useState<any[]>([]);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push('/signin');
        return;
      }

      // Check if user is a Courtly Admin
      const userDoc = await getDocs(collection(db, 'users'));
      const userData = userDoc.docs.find(d => d.id === currentUser.uid)?.data();
      
      if (userData?.userType !== 'courtlyAdmin') {
        router.push('/dashboard');
        return;
      }

      await fetchClubs();
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const fetchClubs = async () => {
    try {
      const clubsSnapshot = await getDocs(collection(db, "orgs"));
      const clubsData = clubsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setClubs(clubsData);
    } catch (error) {
      console.error("Error fetching clubs:", error);
      setError("Failed to fetch clubs");
    }
  };

  const checkClubNeedsMigration = (club: any) => {
    return !club.operatingHours || !club.bookingSettings;
  };

  const migrateAllClubs = async () => {
    if (!window.confirm('This will add operatingHours and bookingSettings to ALL clubs that don\'t have them. Continue?')) {
      return;
    }

    setProcessing(true);
    setError("");
    setSuccess("");
    setMigrationResults([]);

    const results: any[] = [];

    try {
      for (const club of clubs) {
        try {
          if (checkClubNeedsMigration(club)) {
            await migrateClub(club);
            results.push({
              clubId: club.id,
              clubName: club.name,
              status: 'success',
              message: 'Successfully migrated'
            });
          } else {
            results.push({
              clubId: club.id,
              clubName: club.name,
              status: 'skipped',
              message: 'Already has reservation fields'
            });
          }
        } catch (error: any) {
          results.push({
            clubId: club.id,
            clubName: club.name,
            status: 'error',
            message: error.message
          });
        }
      }

      setMigrationResults(results);
      const successCount = results.filter(r => r.status === 'success').length;
      const skippedCount = results.filter(r => r.status === 'skipped').length;
      const errorCount = results.filter(r => r.status === 'error').length;
      
      setSuccess(`Migration complete! Success: ${successCount}, Skipped: ${skippedCount}, Errors: ${errorCount}`);
      await fetchClubs(); // Refresh the list
    } catch (error: any) {
      console.error("Migration error:", error);
      setError(error.message || "Migration failed");
    } finally {
      setProcessing(false);
    }
  };

  const migrateClub = async (club: any) => {
    const clubRef = doc(db, "orgs", club.id);
    
    const updateData: Partial<Org> = {
      updatedAt: Timestamp.now()
    };

    // Add operatingHours if missing
    if (!club.operatingHours) {
      updateData.operatingHours = {
        monday: { open: '08:00', close: '20:00', closed: false },
        tuesday: { open: '08:00', close: '20:00', closed: false },
        wednesday: { open: '08:00', close: '20:00', closed: false },
        thursday: { open: '08:00', close: '20:00', closed: false },
        friday: { open: '08:00', close: '20:00', closed: false },
        saturday: { open: '09:00', close: '18:00', closed: false },
        sunday: { open: '09:00', close: '18:00', closed: false }
      };
    }

    // Add bookingSettings if missing
    if (!club.bookingSettings) {
      updateData.bookingSettings = {
        maxDaysInAdvance: 14,
        minBookingDuration: 1,
        maxBookingDuration: 2,
        slotInterval: 30,
        allowOverlapping: false,
        requireApproval: false
      };
    }

    await updateDoc(clubRef, updateData);
    console.log(`Migrated club ${club.id} (${club.name})`);
  };

  const migrateSingleClub = async (club: any) => {
    if (!window.confirm(`Migrate club "${club.name}"? This will add operatingHours and bookingSettings.`)) {
      return;
    }

    setProcessing(true);
    setError("");
    setSuccess("");

    try {
      await migrateClub(club);
      setSuccess(`Successfully migrated club "${club.name}"!`);
      await fetchClubs();
    } catch (error: any) {
      console.error("Error migrating club:", error);
      setError(error.message || "Failed to migrate club");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-green-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 dark:border-green-400"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  const clubsNeedingMigration = clubs.filter(checkClubNeedsMigration);

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-green-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/dashboard" className="text-green-600 dark:text-green-400 hover:underline mb-4 inline-block">
            ← Back to Dashboard
          </Link>
          <PageTitle title="Migrate Clubs to Reservation System" />
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Add court reservation fields (operatingHours, bookingSettings) to existing clubs
          </p>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-400 rounded-lg">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-100 dark:bg-green-900/30 border border-green-400 dark:border-green-700 text-green-700 dark:text-green-400 rounded-lg">
            {success}
          </div>
        )}

        {/* Summary */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Migration Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Clubs</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{clubs.length}</p>
            </div>
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">Need Migration</p>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{clubsNeedingMigration.length}</p>
            </div>
            <div className="p-4 bg-green-50 dark:bg-green-900/30 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">Already Migrated</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{clubs.length - clubsNeedingMigration.length}</p>
            </div>
          </div>

          {clubsNeedingMigration.length > 0 && (
            <button
              onClick={migrateAllClubs}
              disabled={processing}
              className="mt-6 w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {processing ? 'Migrating...' : `Migrate All ${clubsNeedingMigration.length} Clubs`}
            </button>
          )}
        </div>

        {/* Migration Results */}
        {migrationResults.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Migration Results</h2>
            <div className="space-y-2">
              {migrationResults.map((result, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg ${
                    result.status === 'success' ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800' :
                    result.status === 'skipped' ? 'bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600' :
                    'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-800 dark:text-white">{result.clubName}</span>
                    <span className={`text-sm ${
                      result.status === 'success' ? 'text-green-600 dark:text-green-400' :
                      result.status === 'skipped' ? 'text-gray-600 dark:text-gray-400' :
                      'text-red-600 dark:text-red-400'
                    }`}>
                      {result.message}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Clubs List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">All Clubs</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Club Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {clubs.map((club) => {
                  const needsMigration = checkClubNeedsMigration(club);
                  return (
                    <tr key={club.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {club.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {club.city}, {club.state}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {needsMigration ? (
                          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400">
                            Needs Migration
                          </span>
                        ) : (
                          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">
                            ✓ Ready
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {needsMigration && (
                          <button
                            onClick={() => migrateSingleClub(club)}
                            disabled={processing}
                            className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300 disabled:opacity-50"
                          >
                            Migrate
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
