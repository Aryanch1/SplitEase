/**
 * SplitEase runtime config.
 *
 * The receipt reader is a Python serverless function that lives at
 * /api/receipt on the same origin as the deployed web app (Vercel).
 * EXPO_PUBLIC_API_URL overrides the origin for native builds or local
 * development (e.g. the deployed Vercel URL). When no endpoint answers,
 * the app falls back to its on-device receipt parser (demo mode) and
 * says so honestly — the split itself always works offline.
 *
 * No Gemini key ever lives in this file or in app code; the key is
 * server-side only in the /api/receipt function.
 */
export const API_BASE = (process.env.EXPO_PUBLIC_API_URL ?? '').trim().replace(/\/$/, '');

/**
 * Set to true once the Firebase project for SplitEase exists and the
 * values in lib/firebase.ts / lib/firebase.native.ts are the real web
 * config. Until then the app runs fully in local/guest mode.
 */
export const firebaseConfigured = false;
