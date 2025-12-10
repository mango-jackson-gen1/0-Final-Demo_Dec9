import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getDatabase, ref, push, set, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

// --- 0. FIREBASE SETUP ---
const firebaseConfig = {
  apiKey: "AIzaSyAmKBb_Q0yUJVQv_z2E_Yz-tCf_Cn6SvaA",
  authDomain: "final1-sharedminds.firebaseapp.com",
  databaseURL: "https://final1-sharedminds-default-rtdb.firebaseio.com",
  projectId: "final1-sharedminds",
  storageBucket: "final1-sharedminds.firebasestorage.app",
  messagingSenderId: "940182257966",
  appId: "1:940182257966:web:5d466662192996a862babf",
  measurementId: "G-RFLRTTXS3P"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// You can name this whatever you want; it creates the folder name in your database
const appId = "harmony-self-local";
let currentUser = null;

// Auth Flow
const initAuth = async () => {
    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
    } else {
        await signInAnonymously(auth);
    }
    console.log("Auth init called");
};

initAuth();

onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        console.log("User authenticated:", user.uid);
    }
});

// Data Saving Function (Realtime Database Version)
export const saveToBackend = async (collectionName, data) => {
    if (!currentUser) {
        console.error("No user logged in, cannot save.");
        // Attempt re-auth or wait? For now just log.
        return;
    }
    try {
        // Path: artifacts/{appId}/users/{userId}/journal_entries
        // In Realtime DB, we construct a reference to this path
        const basePath = `artifacts/${appId}/users/${currentUser.uid}/journal_entries`;
        const listRef = ref(db, basePath);
        
        // push() creates a new child with a unique key (like "addDoc" in Firestore)
        const newPostRef = push(listRef);
        
        await set(newPostRef, {
            ...data,
            type: collectionName, // 'congruence' or 'bodily_self'
            timestamp: serverTimestamp()
        });
        
        console.log(`Saved ${collectionName} successfully to Realtime DB.`);
    } catch (e) {
        console.error("Error adding document: ", e);
    }
};

// --- NEW: MEMORY / SUMMARY FUNCTIONS ---

// 1. Get the persistent "Patient File" Summary
export const getSummary = async () => {
    if (!currentUser) return null;
    const { get, child } = await import("firebase/database");
    
    try {
        const dbRef = ref(db);
        const snapshot = await get(child(dbRef, `artifacts/${appId}/users/${currentUser.uid}/summary`));
        if (snapshot.exists()) {
            return snapshot.val();
        } else {
            return null; 
        }
    } catch (error) {
        console.error("Error fetching summary:", error);
        return null;
    }
};

// 2. Save/Overwrite the Summary
export const saveSummary = async (summaryText) => {
    if (!currentUser) return;
    try {
        const summaryRef = ref(db, `artifacts/${appId}/users/${currentUser.uid}/summary`);
        await set(summaryRef, summaryText); 
        console.log("Memory Summary Updated.");
    } catch (error) {
        console.error("Error saving summary:", error);
    }
};
