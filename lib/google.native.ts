import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { auth, GOOGLE_WEB_CLIENT_ID, GoogleAuthProvider, signInWithCredential } from './firebase';


GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });

/**
 * Turn any Google Sign-In failure into a plain Error whose message names
 * what went wrong. The Welcome screen shows the message, so a failed tap
 * is never silent — testers hit a no-op tap with no picker and no message
 * because the library's coded errors were being swallowed upstream.
 */
function googleError(e: unknown): Error {
  const err = e as { code?: string | number; message?: string } | null;
  const code = err?.code != null ? String(err.code) : '';
  const message = err?.message ?? '';
  if (code === statusCodes.SIGN_IN_CANCELLED) {
    return new Error('Sign-in was cancelled.');
  }
  if (code === statusCodes.IN_PROGRESS) {
    return new Error('Sign-in is already in progress.');
  }
  if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
    return new Error('Google Play Services is not available or outdated on this device.');
  }
  if (code === '10' || message.includes('DEVELOPER_ERROR')) {
    return new Error('Google sign-in is not configured for this app build (developer error 10).');
  }
  return new Error(`Google sign-in failed (${code || message || 'unknown error'})`);
}

/**
 * Native (Android/iOS): the Google Sign-In sheet returns an ID token,
 * which is exchanged for a Firebase session — the standard
 * Firebase + GoogleSignin pairing.
 */
export async function signInWithGoogle(): Promise<void> {
  let response: Awaited<ReturnType<typeof GoogleSignin.signIn>>;
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    response = await GoogleSignin.signIn();
  } catch (e) {
    throw googleError(e);
  }
  if (response.type === 'cancelled') {
    throw new Error('Sign-in was cancelled.');
  }
  const idToken =
    response.data?.idToken ??
    (response as unknown as { idToken?: string | null }).idToken ??
    null;
  if (!idToken) {
    throw new Error('Google did not return an ID token.');
  }
  await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
}
