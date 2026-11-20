import { getApp, getApps, initializeApp } from 'firebase/app';
import * as firebaseAuth from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

/**
 * Firebase wiring for SplitEase — web.
 *
 * Project "SplitEase" (splitease-76c70), created 2026-11-16 under
 * aryanch99999@gmail.com. Email/Password + Google sign-in enabled
 * (email-link OFF); the app's Vercel domain is added to authorized
 * domains once the deploy exists. Flip `firebaseConfigured` to true in
 * lib/config.ts once this config is in place (done) — the app then runs
 * in full accounts mode.
 *
 * The config values below are Firebase's public app identifiers — they
 * are designed to ship in client code. Access is controlled by Firebase
 * Authentication plus the Firestore security rules (each user can only
 * read and write their own /users/<uid> tree). No admin keys or secrets
 * live here; the Gemini key stays server-side in the /api/receipt
 * function.
 *
 * Platform note: this file serves web (and tooling). Native builds use
 * firebase.native.ts instead, which imports the scoped @firebase/*
 * packages — the umbrella 'firebase/auth' entry has no React Native
 * build, so on Android/iOS it silently resolves to the browser build
 * whose sessions live in memory only and are lost when the app closes.
 * Every module imports its Auth/Firestore helpers from './firebase' so
 * each platform always gets one consistent set of Firebase modules.
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

export const auth = firebaseAuth.getAuth(firebaseApp);
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
} from 'firebase/auth';

export {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
