import { db } from '../../../firebase';
import { doc, setDoc, collection } from 'firebase/firestore';

// This is a utility function that would be run once to set up your collections
export async function initializeCollections(adminUserId: string, clubName: string) {
  try {
    // Create a location for the club
    const locationRef = doc(collection(db, 'locations'));
    await setDoc(locationRef, {
      name: `${clubName} Main Location`,
      address: '123 Tennis Court Ave',
      city: 'San Francisco',
      state: 'CA',
      clubId: adminUserId, // Reference to the club admin's user ID
      createdAt: new Date()
    });
    
    // Add some courts to the location
    const courtsRef = collection(db, `locations/${locationRef.id}/courts`);
    
    // Add a few sample courts
    await setDoc(doc(courtsRef), {
      name: 'Court 1',
      surface: 'hard',
      indoor: false,
      createdAt: new Date()
    });
    
    await setDoc(doc(courtsRef), {
      name: 'Court 2',
      surface: 'clay',
      indoor: false,
      createdAt: new Date()
    });
    
    await setDoc(doc(courtsRef), {
      name: 'Indoor Court',
      surface: 'carpet',
      indoor: true,
      createdAt: new Date()
    });
    
    return {
      success: true,
      locationId: locationRef.id
    };
  } catch (error) {
    console.error('Error initializing collections:', error);
    return {
      success: false,
      error
    };
  }
}