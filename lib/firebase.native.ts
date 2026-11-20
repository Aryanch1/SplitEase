import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from '@firebase/app';
import * as firebaseAuth from '@firebase/auth';
import { getFirestore } from '@firebase/firestore';

/**
 * Firebase wiring for SplitEase — native (Android/iOS). Metro picks this
 * file over firebase.ts on native.
 *
 * Native imports the scoped @firebase/* packages on purpose: they ship
 * a real React Native build (the umbrella 'firebase/auth' entry does
 * not — it resolves to the browser build, whose sessions are kept in
 * memory only, so users were signed out every time the app closed).
 *
 * Project "SplitEase" (splitease-76c70), created 2026-11-16 under
 * aryanch99999@gmail.com. Email/Password + Google sign-in enabled
 * (email-link OFF); the app's Vercel domain is added to authorized
 * domains once the deploy exists.
 *
 * The config values below are Firebase's public app identifiers — they
 * are designed to ship in client code. Access is controlled by Firebase
 * Authentication plus the Firestore security rules (each user can only
 * read and write their own /users/<uid> tree). No admin keys or secrets
 * live here; the Gemini key stays server-side in the /api/receipt
 * function.
 */
const firebaseConfig = {
  apiKey: 'AIzaSyD3Urcim27_m-8qiD0a5A-f4wA3Rf9Gsmc',
  authDomain: 'splitease-76c70.firebaseapp.com',
  projectId: 'splitease-76c70',
  storageBucket: 'splitease-76c70.firebasestorage.app',
  messagingSenderId: '1061356725847',
  appId: '1:1061356725847:web:d96f24b38ad1c0d182e512',
};

/** OAuth web client ID for the native Google Sign-In flow (not a secret). */
export const GOOGLE_WEB_CLIENT_ID = '1061356725847-ibpaavoa2es25c7i6c7s7p8snqgpq1gh.apps.googleusercontent.com';

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

function createAuth(): firebaseAuth.Auth {
  // Persist the session in AsyncStorage so the user stays signed in
  // between app launches, like every other app.
  const getPersistence = (
    firebaseAuth as unknown as {
      getReactNativePersistence?: (storage: unknown) => firebaseAuth.Persistence;
    }
  ).getReactNativePersistence;
  if (getPersistence) {
    try {
      return firebaseAuth.initializeAuth(firebaseApp, {
        persistence: getPersistence(AsyncStorage),
      });
    } catch {
      // Already initialized (fast refresh) — fall through to getAuth.
    }
  }
  return firebaseAuth.getAuth(firebaseApp);
}

export const auth = createAuth();
export const db = getFirestore(firebaseApp);

export {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  type User,
} from '@firebase/auth';

export {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from '@firebase/firestore';
