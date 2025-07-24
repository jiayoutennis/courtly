"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '../../../firebase';
import { 
  collection, doc, getDoc, getDocs, setDoc, updateDoc, 
  deleteDoc, query, where, limit, orderBy, addDoc 
} from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import Link from 'next/link';

export default function AdminPage() {
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [user, setUser] = useState<any>(null);
  
  // Database interaction states
  const [collections, setCollections] = useState<string[]>([]);
  const [currentCollection, setCurrentCollection] = useState('');
  const [documents, setDocuments] = useState<any[]>([]);
  const [currentDocument, setCurrentDocument] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [editedData, setEditedData] = useState<any>({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLogs, setActionLogs] = useState<string[]>([]);
  
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

  // Check if user is authorized developer
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setIsLoading(true);
      
      if (!currentUser) {
        // No user is signed in
        setIsAuthorized(false);
        setUser(null);
        router.push('/signin');
        return;
      }
      
      try {
        // Check if user has developer role
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          if (userData.role === 'developer' || userData.role === 'admin' || userData.email?.endsWith('@jiayoutennis.com')) {
            // User is authorized
            setIsAuthorized(true);
            setUser({
              ...currentUser,
              ...userData
            });
            
            // Fetch available collections
            fetchCollections();
          } else {
            // User is not a developer
            setIsAuthorized(false);
            setUser(null);
            setError("You don't have developer permissions to access this page");
            router.push('/dashboard');
          }
        } else {
          // User document doesn't exist
          setIsAuthorized(false);
          setUser(null);
          setError("User profile not found");
          router.push('/signin');
        }
      } catch (err) {
        console.error("Error checking authorization:", err);
        setError("Failed to verify permissions. Please try again.");
        setIsAuthorized(false);
      } finally {
        setIsLoading(false);
      }
    });
    
    return () => unsubscribe();
  }, [router]);

  // Fetch available collections
  const fetchCollections = async () => {
    try {
      // For security reasons, we'll only allow access to specific collections
      const allowedCollections = [
        'users',
        'publicClubs',
        'reservations',
        'locations',
        'events'
      ];
      
      setCollections(allowedCollections);
      logAction("Fetched available collections");
    } catch (err) {
      console.error("Error fetching collections:", err);
      setError("Failed to fetch collections");
    }
  };

  // Fetch documents from a collection
  const fetchDocuments = async (collectionName: string) => {
    setIsLoading(true);
    setError('');
    
    try {
      setCurrentCollection(collectionName);
      
      let q;
      if (searchQuery) {
        // This is a simplified search - for complex searches you may need to adjust this
        q = query(
          collection(db, collectionName),
          where("name", ">=", searchQuery),
          where("name", "<=", searchQuery + '\uf8ff'),
          limit(50)
        );
      } else {
        q = query(
          collection(db, collectionName),
          orderBy("createdAt", "desc"),
          limit(50)
        );
      }
      
      const querySnapshot = await getDocs(q);
      
      const docs: any[] = [];
      querySnapshot.forEach((doc) => {
        docs.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      setDocuments(docs);
      setCurrentDocument(null);
      setEditMode(false);
      logAction(`Fetched ${docs.length} documents from ${collectionName}`);
    } catch (err) {
      console.error(`Error fetching documents from ${collectionName}:`, err);
      setError(`Failed to fetch documents from ${collectionName}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle selecting a document to view/edit
  const selectDocument = (doc: any) => {
    setCurrentDocument(doc);
    setEditedData(JSON.parse(JSON.stringify(doc))); // Deep copy
    setEditMode(false);
  };

  // Handle edit mode toggle
  const toggleEditMode = () => {
    if (editMode) {
      // Cancel edit - reset to original
      setEditedData(JSON.parse(JSON.stringify(currentDocument)));
    }
    setEditMode(!editMode);
  };

  // Handle field changes in edit mode
  const handleFieldChange = (field: string, value: any) => {
    setEditedData((prev: any) => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle JSON edit in advanced mode
  const handleJsonEdit = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    try {
      const parsed = JSON.parse(e.target.value);
      setEditedData(parsed);
      setError('');
    } catch (err) {
      setError("Invalid JSON. Please correct the syntax.");
    }
  };

  // Save document changes
  const saveChanges = async () => {
    setIsLoading(true);
    setError('');
    setSuccess('');
    
    try {
      // Validate that we're not trying to modify the ID field
      if (editedData.id !== currentDocument.id) {
        throw new Error("Document ID cannot be changed");
      }
      
      // Remove the id from the data before saving
      const { id, ...dataToSave } = editedData;
      
      // Update the document
      await updateDoc(doc(db, currentCollection, id), dataToSave);
      
      // Update local state
      setCurrentDocument(editedData);
      setEditMode(false);
      setSuccess("Document updated successfully");
      
      // Refresh the document list
      fetchDocuments(currentCollection);
      logAction(`Updated document ${id} in ${currentCollection}`);
    } catch (err: any) {
      console.error("Error saving changes:", err);
      setError(`Failed to save changes: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Delete document
  const deleteDocument = async () => {
    if (!currentDocument) return;
    
    if (!window.confirm(`Are you sure you want to delete this document (${currentDocument.id})? This action cannot be undone.`)) {
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      await deleteDoc(doc(db, currentCollection, currentDocument.id));
      
      logAction(`Deleted document ${currentDocument.id} from ${currentCollection}`);
      setSuccess(`Document ${currentDocument.id} deleted successfully`);
      setCurrentDocument(null);
      
      // Refresh the document list
      fetchDocuments(currentCollection);
    } catch (err: any) {
      console.error("Error deleting document:", err);
      setError(`Failed to delete document: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Create new document
  const createNewDocument = async () => {
    setCurrentDocument(null);
    setEditedData({
      createdAt: new Date().toISOString(),
    });
    setEditMode(true);
  };

  // Save new document
  const saveNewDocument = async () => {
    setIsLoading(true);
    setError('');
    setSuccess('');
    
    try {
      // Add the document
      const docRef = await addDoc(collection(db, currentCollection), editedData);
      
      logAction(`Created new document ${docRef.id} in ${currentCollection}`);
      setSuccess(`New document created successfully with ID: ${docRef.id}`);
      
      // Refresh the document list
      fetchDocuments(currentCollection);
    } catch (err: any) {
      console.error("Error creating document:", err);
      setError(`Failed to create document: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Log admin actions for audit
  const logAction = (action: string) => {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${action}`;
    setActionLogs(prev => [logEntry, ...prev.slice(0, 49)]); // Keep last 50 actions
  };

  // Handle sign out
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push('/signin');
    } catch (err) {
      console.error("Error signing out:", err);
    }
  };

  // If loading, show loading screen
  if (isLoading && !isAuthorized) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-4 ${
        darkMode ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"
      }`}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-t-2 border-green-500 mb-4"></div>
        <p>Verifying developer access...</p>
      </div>
    );
  }

  // If not authorized, show access denied
  if (!isAuthorized && !isLoading) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-4 ${
        darkMode ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"
      }`}>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-red-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
        <p className="mb-6 text-center">You don't have permission to access the developer administration panel.</p>
        <Link href="/dashboard" className={`py-2 px-4 rounded bg-green-500 text-white hover:bg-green-600 transition-colors`}>
          Return to Dashboard
        </Link>
      </div>
    );
  }

  // Main admin interface
  return (
    <div className={`min-h-screen flex flex-col transition-colors ${
      darkMode ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"
    }`}>
      {/* Header */}
      <header className={`py-4 px-6 flex items-center justify-between border-b ${
        darkMode ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"
      }`}>
        <div className="flex items-center">
          <h1 className="text-xl font-bold mr-4">Courtly Developer Admin</h1>
          <span className={`px-2 py-1 rounded text-xs font-semibold ${
            darkMode ? "bg-teal-900 text-teal-300" : "bg-teal-100 text-teal-800"
          }`}>
            Developer Access
          </span>
        </div>
        
        <div className="flex items-center space-x-4">
          <button
            onClick={toggleDarkMode}
            className={`p-2 rounded-full ${darkMode 
              ? "bg-gray-700 text-teal-400 hover:bg-gray-600" 
              : "bg-gray-200 text-amber-500 hover:bg-gray-300"}`}
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
          
          <div className="relative group">
            <button className="flex items-center space-x-1">
              <span>{user?.email || 'Developer'}</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div className={`absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 z-10 hidden group-hover:block ${
              darkMode ? "bg-gray-800" : "bg-white"
            }`}>
              <button 
                onClick={handleSignOut}
                className={`block w-full text-left px-4 py-2 text-sm hover:bg-opacity-10 hover:bg-black ${
                  darkMode ? "text-gray-200" : "text-gray-700"
                }`}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Collections */}
        <div className={`w-64 flex-shrink-0 border-r overflow-y-auto ${
          darkMode ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"
        }`}>
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-2">Collections</h2>
            <nav>
              <ul className="space-y-1">
                {collections.map(collectionName => (
                  <li key={collectionName}>
                    <button
                      onClick={() => fetchDocuments(collectionName)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        currentCollection === collectionName 
                          ? (darkMode 
                              ? "bg-gray-700 text-white" 
                              : "bg-green-100 text-green-800")
                          : (darkMode 
                              ? "text-gray-300 hover:bg-gray-700 hover:text-white" 
                              : "text-gray-700 hover:bg-gray-100")
                      }`}
                    >
                      {collectionName}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Document list and search */}
          <div className={`p-4 border-b ${
            darkMode ? "border-gray-700" : "border-gray-200"
          }`}>
            {currentCollection && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">{currentCollection}</h2>
                  <div className="flex items-center space-x-2">
                    <div className="relative">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search documents..."
                        className={`px-3 py-2 pl-8 rounded-md text-sm ${
                          darkMode 
                            ? "bg-gray-700 text-white placeholder-gray-400 border-gray-600" 
                            : "bg-white text-gray-900 placeholder-gray-500 border-gray-300"
                        } border focus:outline-none focus:ring-1 ${
                          darkMode ? "focus:ring-teal-500" : "focus:ring-green-500"
                        }`}
                      />
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        className={`h-4 w-4 absolute left-2.5 top-2.5 ${
                          darkMode ? "text-gray-400" : "text-gray-500"
                        }`}
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <button
                      onClick={() => fetchDocuments(currentCollection)}
                      className={`p-2 rounded-md ${
                        darkMode 
                          ? "bg-gray-700 text-gray-300 hover:bg-gray-600" 
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      }`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                    <button
                      onClick={createNewDocument}
                      className={`p-2 rounded-md ${
                        darkMode 
                          ? "bg-teal-600 text-white hover:bg-teal-700" 
                          : "bg-green-500 text-white hover:bg-green-600"
                      }`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Document list */}
                <div className={`overflow-x-auto rounded-md border ${
                  darkMode ? "border-gray-700" : "border-gray-200"
                }`}>
                  <table className="min-w-full divide-y table-fixed">
                    <thead className={darkMode ? "bg-gray-800" : "bg-gray-50"}>
                      <tr>
                        <th scope="col" className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                          darkMode ? "text-gray-300" : "text-gray-500"
                        }`}>
                          ID
                        </th>
                        <th scope="col" className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                          darkMode ? "text-gray-300" : "text-gray-500"
                        }`}>
                          Name/Title
                        </th>
                        <th scope="col" className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                          darkMode ? "text-gray-300" : "text-gray-500"
                        }`}>
                          Created
                        </th>
                        <th scope="col" className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                          darkMode ? "text-gray-300" : "text-gray-500"
                        }`}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${
                      darkMode ? "divide-gray-700" : "divide-gray-200"
                    }`}>
                      {documents.length === 0 ? (
                        <tr>
                          <td colSpan={4} className={`px-4 py-4 text-center text-sm ${
                            darkMode ? "text-gray-400" : "text-gray-500"
                          }`}>
                            {isLoading ? "Loading documents..." : "No documents found"}
                          </td>
                        </tr>
                      ) : (
                        documents.map((doc) => (
                          <tr 
                            key={doc.id} 
                            onClick={() => selectDocument(doc)}
                            className={`cursor-pointer hover:bg-opacity-10 hover:bg-black ${
                              currentDocument?.id === doc.id 
                                ? (darkMode ? "bg-gray-700" : "bg-green-50") 
                                : ""
                            }`}
                          >
                            <td className={`px-4 py-2 text-sm font-mono ${
                              darkMode ? "text-gray-300" : "text-gray-700"
                            }`}>
                              {doc.id.substring(0, 8)}...
                            </td>
                            <td className={`px-4 py-2 text-sm ${
                              darkMode ? "text-white" : "text-gray-900"
                            }`}>
                              {doc.name || doc.title || doc.email || doc.id}
                            </td>
                            <td className={`px-4 py-2 text-sm ${
                              darkMode ? "text-gray-400" : "text-gray-500"
                            }`}>
                              {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : "N/A"}
                            </td>
                            <td className="px-4 py-2 text-sm">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  selectDocument(doc);
                                }}
                                className={`mr-2 p-1 rounded ${
                                  darkMode 
                                    ? "hover:bg-gray-700 text-teal-400" 
                                    : "hover:bg-gray-200 text-green-600"
                                }`}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* Document editor */}
          <div className="flex-1 overflow-y-auto p-4">
            {error && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
                {error}
              </div>
            )}
            
            {success && (
              <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md">
                {success}
              </div>
            )}
            
            {currentDocument || editMode ? (
              <div className={`border rounded-lg overflow-hidden ${
                darkMode ? "border-gray-700" : "border-gray-300"
              }`}>
                <div className={`flex items-center justify-between p-4 border-b ${
                  darkMode ? "border-gray-700 bg-gray-800" : "border-gray-300 bg-gray-50"
                }`}>
                  <h3 className="font-medium">
                    {currentDocument ? (
                      <>Document ID: <span className="font-mono">{currentDocument.id}</span></>
                    ) : (
                      "New Document"
                    )}
                  </h3>
                  <div className="flex space-x-2">
                    {currentDocument && (
                      <button
                        onClick={toggleEditMode}
                        className={`px-3 py-1 rounded text-sm ${
                          editMode 
                            ? (darkMode ? "bg-gray-700 text-white" : "bg-gray-200 text-gray-800") 
                            : (darkMode ? "bg-teal-600 text-white" : "bg-green-500 text-white")
                        }`}
                      >
                        {editMode ? "Cancel" : "Edit"}
                      </button>
                    )}
                    
                    {editMode && (
                      <button
                        onClick={currentDocument ? saveChanges : saveNewDocument}
                        className={`px-3 py-1 rounded text-sm ${
                          darkMode ? "bg-teal-600 text-white hover:bg-teal-700" : "bg-green-500 text-white hover:bg-green-600"
                        }`}
                      >
                        Save
                      </button>
                    )}
                    
                    {currentDocument && (
                      <button
                        onClick={deleteDocument}
                        className="px-3 py-1 rounded text-sm bg-red-500 text-white hover:bg-red-600"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="p-4">
                  {editMode ? (
                    <div className="space-y-4">
                      <div className="flex space-x-2 mb-4">
                        <button
                          className={`px-3 py-1 text-xs rounded ${
                            darkMode 
                              ? "bg-gray-700 text-white" 
                              : "bg-gray-200 text-gray-800"
                          }`}
                        >
                          Form Editor
                        </button>
                        <button
                          className={`px-3 py-1 text-xs rounded ${
                            darkMode 
                              ? "bg-teal-600 text-white" 
                              : "bg-green-500 text-white"
                          }`}
                        >
                          JSON Editor
                        </button>
                      </div>
                      
                      <textarea
                        className={`w-full h-96 font-mono text-sm p-3 rounded-md ${
                          darkMode 
                            ? "bg-gray-800 text-white border-gray-700" 
                            : "bg-white text-gray-900 border-gray-300"
                        } border focus:outline-none focus:ring-1 ${
                          darkMode ? "focus:ring-teal-500" : "focus:ring-green-500"
                        }`}
                        value={JSON.stringify(editedData, null, 2)}
                        onChange={handleJsonEdit}
                      ></textarea>
                    </div>
                  ) : (
                    <pre className={`whitespace-pre-wrap p-3 rounded-md overflow-x-auto ${
                      darkMode 
                        ? "bg-gray-800 text-white" 
                        : "bg-gray-50 text-gray-900"
                    }`}>
                      {JSON.stringify(currentDocument, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            ) : (
              currentCollection && (
                <div className={`rounded-lg border p-8 text-center ${
                  darkMode ? "border-gray-700" : "border-gray-300"
                }`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-12 w-12 mx-auto mb-4 ${
                    darkMode ? "text-gray-600" : "text-gray-400"
                  }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                  </svg>
                  <h3 className={`text-lg font-medium mb-2 ${
                    darkMode ? "text-gray-300" : "text-gray-700"
                  }`}>
                    No Document Selected
                  </h3>
                  <p className={darkMode ? "text-gray-400" : "text-gray-500"}>
                    Select a document from the list or create a new one
                  </p>
                  <button
                    onClick={createNewDocument}
                    className={`mt-4 px-4 py-2 rounded-md text-sm ${
                      darkMode 
                        ? "bg-teal-600 text-white hover:bg-teal-700" 
                        : "bg-green-500 text-white hover:bg-green-600"
                    }`}
                  >
                    Create New Document
                  </button>
                </div>
              )
            )}
          </div>
        </div>
        
        {/* Activity log panel */}
        <div className={`w-64 border-l flex-shrink-0 overflow-y-auto ${
          darkMode ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"
        }`}>
          <div className="p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider mb-2">
              Activity Log
            </h2>
            <div className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
              {actionLogs.length === 0 ? (
                <p>No activity yet</p>
              ) : (
                <ul className="space-y-2">
                  {actionLogs.map((log, index) => (
                    <li key={index} className="border-b pb-2 last:border-0 last:pb-0">
                      {log}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}