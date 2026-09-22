import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  signOut, 
  onAuthStateChanged,
  User 
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  addDoc, 
  query, 
  orderBy, 
  limit, 
  deleteDoc, 
  getDocFromServer 
} from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

// Initialize Firebase App instance safely
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = firebaseConfig.firestoreDatabaseId 
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId) 
  : getFirestore(app);

// Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

// Upsert user profile to Firestore
export async function syncUserProfile(user: User): Promise<void> {
  try {
    const userRef = doc(db, "users", user.uid);
    await setDoc(userRef, {
      userId: user.uid,
      displayName: user.displayName || "User",
      email: user.email || "",
      photoURL: user.photoURL || "",
      lastLogin: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.warn("Could not sync user profile in Firestore (may be offline or restricted):", err);
  }
}

// Check for redirect result on app initialization
export async function checkRedirectAuthResult(): Promise<User | null> {
  try {
    const result = await getRedirectResult(auth);
    if (result && result.user) {
      await syncUserProfile(result.user);
      return result.user;
    }
  } catch (err: any) {
    console.error("Firebase getRedirectResult error:", err);
  }
  return null;
}

export async function signInWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    if (user) {
      await syncUserProfile(user);
    }
    return user;
  } catch (error: any) {
    console.error("Sign in with Google error:", error);

    // If popup is blocked by browser or iframe constraints, attempt redirect
    if (
      error?.code === "auth/popup-blocked" ||
      error?.code === "auth/cancelled-popup-request" ||
      error?.code === "auth/popup-closed-by-user"
    ) {
      // In standalone deployed sites, popup may be blocked; redirect is alternative
      if (error?.code === "auth/popup-blocked") {
        console.warn("Popup blocked, falling back to signInWithRedirect...");
        await signInWithRedirect(auth, googleProvider);
        return null;
      }
    }

    throw error;
  }
}

export async function logOut(): Promise<void> {
  await signOut(auth);
}

// Test Firestore Connection on boot
export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error: any) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.warn("Firestore client offline check:", error.message);
    }
  }
}

// Save User Chat History
export async function saveUserChatHistory(userId: string, item: {
  query: string;
  reply: string;
  location: string;
  language: string;
}) {
  try {
    const col = collection(db, "users", userId, "history");
    await addDoc(col, {
      ...item,
      userId,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Failed to save chat history to Firestore:", err);
  }
}

// Load User Chat History
export async function getUserChatHistory(userId: string) {
  try {
    const col = collection(db, "users", userId, "history");
    const q = query(col, orderBy("timestamp", "desc"), limit(20));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error("Failed to fetch chat history:", err);
    return [];
  }
}

// Save Favorite Location
export async function saveFavoriteLocation(userId: string, loc: {
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
}) {
  try {
    const docId = `${loc.latitude}_${loc.longitude}`.replace(/\./g, "_");
    const docRef = doc(db, "users", userId, "savedLocations", docId);
    await setDoc(docRef, {
      ...loc,
      userId,
      savedAt: new Date().toISOString(),
    });
    return true;
  } catch (err) {
    console.error("Failed to save favorite location:", err);
    return false;
  }
}

// Fetch Favorite Locations
export async function getFavoriteLocations(userId: string) {
  try {
    const col = collection(db, "users", userId, "savedLocations");
    const snap = await getDocs(col);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error("Failed to fetch favorite locations:", err);
    return [];
  }
}

// Remove Favorite Location
export async function removeFavoriteLocation(userId: string, locId: string) {
  try {
    const docRef = doc(db, "users", userId, "savedLocations", locId);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.error("Failed to remove favorite location:", err);
    return false;
  }
}
