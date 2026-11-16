import { auth, GoogleAuthProvider, signInWithPopup } from './firebase';
/**
 * Fallback module for tooling/type resolution. At runtime Metro picks
 * google.web.ts on web and google.native.ts on Android/iOS.
 */
export async function signInWithGoogle(): Promise<void> {
  await signInWithPopup(auth, new GoogleAuthProvider());
}
