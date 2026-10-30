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

// Support both firebase-applet-config.json and Vite environment variables (Vercel deploy)
const rawConfig = (firebaseConfig as any) || {};
export const activeFirebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || rawConfig.projectId || 'gen-lang-client-0888631165',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || rawConfig.appId || '',
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || rawConfig.apiKey || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || rawConfig.authDomain || 'gen-lang-client-0888631165.firebaseapp.com',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || rawConfig.storageBucket || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || rawConfig.messagingSenderId || '',
  oAuthClientId: import.meta.env.VITE_FIREBASE_OAUTH_CLIENT_ID || rawConfig.oAuthClientId || '',
};

const app = !getApps().length ? initializeApp(activeFirebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.setCustomParameters({
  prompt: 'select_account',
});

const TOKEN_STORAGE_KEY = 'google_oauth_access_token_v1';

let isSigningIn = false;
let cachedAccessToken: string | null = (() => {
  try {
    return sessionStorage.getItem(TOKEN_STORAGE_KEY) || localStorage.getItem(TOKEN_STORAGE_KEY) || null;
  } catch (e) {
    return null;
  }
})();

export interface GoogleAuthErrorInfo {
  code: string;
  originalMessage: string;
  currentHostname: string;
  currentOrigin: string;
  projectId: string;
  authDomain: string;
  isUnauthorizedDomain: boolean;
  isPopupBlocked: boolean;
  isCancelled: boolean;
  title: string;
  descriptionThai: string;
  stepsToFix: string[];
  firebaseConsoleUrl: string;
  googleCloudConsoleUrl: string;
}

export const getDomainDiagnosticInfo = () => {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
  const isVercel = hostname.includes('vercel.app');
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  const projectId = activeFirebaseConfig.projectId;
  return {
    hostname,
    origin,
    isVercel,
    isLocalhost,
    projectId,
    authDomain: activeFirebaseConfig.authDomain,
    firebaseConsoleSettingsUrl: `https://console.firebase.google.com/project/${projectId}/authentication/settings`,
    googleCloudConsoleCredentialsUrl: `https://console.cloud.google.com/apis/credentials?project=${projectId}`,
  };
};

export const parseGoogleAuthError = (error: any): GoogleAuthErrorInfo => {
  const code = error?.code || 'auth/unknown-error';
  const originalMessage = error?.message || String(error);
  const diag = getDomainDiagnosticInfo();

  const isUnauthorizedDomain = code === 'auth/unauthorized-domain';
  const isPopupBlocked = code === 'auth/popup-blocked';
  const isCancelled = code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request';

  let title = 'ไม่สามารถเชื่อมต่อบัญชี Google ได้';
  let descriptionThai = originalMessage;
  let stepsToFix: string[] = [];

  if (isUnauthorizedDomain) {
    title = 'โดเมน Vercel ยังไม่ได้รับอนุญาตใน Firebase Console';
    descriptionThai = `ระบบ Firebase ไม่อนุญาตให้ล็อกอินจากโดเมน "${diag.hostname}" เนื่องจากยังไม่ได้เพิ่มชื่อโดเมนนี้ในรายการ Authorized Domains ของ Firebase`;
    stepsToFix = [
      `1. กดปุ่ม "คัดลอกโดเมน" เพื่อคัดลอก: ${diag.hostname}`,
      `2. เปิด Firebase Console ไปที่แท็บ "การตั้งค่า (Settings)" -> หัวข้อ "โดเมนที่ได้รับอนุญาต (Authorized domains)"`,
      `3. กดปุ่ม "เพิ่มโดเมน (Add domain)" แล้ววาง "${diag.hostname}" จากนั้นกดบันทึก`,
      `4. กลับมาที่หน้านี้แล้วกดปุ่ม "ลองเข้าสู่ระบบ Google อีกครั้ง" ได้ทันที`,
    ];
  } else if (isPopupBlocked) {
    title = 'เบราว์เซอร์บล็อกหน้าต่างป๊อปอัป (Pop-up Blocked)';
    descriptionThai = 'เบราว์เซอร์ของคุณป้องกันการเปิดหน้าต่างเข้าสู่ระบบ Google แบบป๊อปอัป';
    stepsToFix = [
      '1. สังเกตไอคอนแจ้งเตือนป๊อปอัปที่แถบ URL ของเบราว์เซอร์ (ด้านบนขวา)',
      '2. เลือก "อนุญาตป๊อปอัปเสมอสำหรับเว็บไซต์นี้ (Always allow pop-ups)"',
      '3. กดปุ่มเข้าสู่ระบบ Google ใหม่อีกครั้ง',
    ];
  } else if (code === 'auth/operation-not-allowed') {
    title = 'ยังไม่ได้เปิดใช้งาน Google Sign-in ใน Firebase';
    descriptionThai = 'ใน Firebase Console ยังไม่ได้เปิดใช้งานตัวเลือก Google เป็น Sign-in method';
    stepsToFix = [
      '1. เปิด Firebase Console -> Authentication -> แท็บ "Sign-in method"',
      '2. เลือก "Google" และกดเปิดใช้งาน (Enable)',
      '3. กรอกอีเมลสนับสนุนโครงการแล้วกดบันทึก',
    ];
  } else if (isCancelled) {
    title = 'ยกเลิกการเข้าสู่ระบบ';
    descriptionThai = 'หน้าต่างเข้าสู่ระบบ Google ถูกปิดก่อนทำรายการเสร็จสมบูรณ์';
    stepsToFix = ['กดปุ่มเข้าสู่ระบบ Google อีกครั้ง และเลือกบัญชี Google จนเสร็จสิ้นขั้นตอน'];
  }

  return {
    code,
    originalMessage,
    currentHostname: diag.hostname,
    currentOrigin: diag.origin,
    projectId: diag.projectId,
    authDomain: diag.authDomain,
    isUnauthorizedDomain,
    isPopupBlocked,
    isCancelled,
    title,
    descriptionThai,
    stepsToFix,
    firebaseConsoleUrl: diag.firebaseConsoleSettingsUrl,
    googleCloudConsoleUrl: diag.googleCloudConsoleCredentialsUrl,
  };
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
    try {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, credential.accessToken);
      localStorage.setItem(TOKEN_STORAGE_KEY, credential.accessToken);
    } catch (e) {}
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    const errorInfo = parseGoogleAuthError(error);
    error.authErrorInfo = errorInfo;
    console.error('Google Sign in error:', errorInfo);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const initAuth = (
  onLogin: (user: User) => void,
  onLogout: () => void
): (() => void) => {
  return onAuthStateChanged(auth, (currentUser) => {
    if (currentUser) {
      onLogin(currentUser);
    } else {
      onLogout();
    }
  });
};

export const getAccessToken = async (): Promise<string | null> => {
  if (cachedAccessToken) return cachedAccessToken;
  try {
    const stored = sessionStorage.getItem(TOKEN_STORAGE_KEY) || localStorage.getItem(TOKEN_STORAGE_KEY);
    if (stored) {
      cachedAccessToken = stored;
      return stored;
    }
  } catch (e) {}
  return null;
};

export const logoutGoogle = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  try {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch (e) {}
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
