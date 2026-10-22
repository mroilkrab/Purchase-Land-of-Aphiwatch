import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { LandPlot, PortfolioSettings } from '../types/land';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.setCustomParameters({
  prompt: 'select_account',
});

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Google Auth');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logoutGoogle = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

// Firestore Cloud Backup & Sync
export const syncToFirestore = async (
  userId: string,
  plots: LandPlot[],
  settings: PortfolioSettings
): Promise<{ success: boolean; timestamp: string }> => {
  try {
    const portfolioDocRef = doc(db, 'land_portfolios', userId || 'shared_portfolio');
    const payload = {
      plots,
      settings,
      updatedAt: serverTimestamp(),
      clientTimestamp: new Date().toISOString(),
    };
    await setDoc(portfolioDocRef, payload, { merge: true });
    return { success: true, timestamp: new Date().toLocaleString('th-TH') };
  } catch (error: any) {
    console.error('Firestore sync error:', error);
    throw error;
  }
};

export const loadFromFirestore = async (
  userId: string
): Promise<{ plots: LandPlot[]; settings: PortfolioSettings } | null> => {
  try {
    const portfolioDocRef = doc(db, 'land_portfolios', userId || 'shared_portfolio');
    const docSnap = await getDoc(portfolioDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        plots: data.plots || [],
        settings: data.settings || {},
      };
    }
    return null;
  } catch (error: any) {
    console.error('Firestore load error:', error);
    throw error;
  }
};
