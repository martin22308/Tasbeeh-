import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

/**
 * Safely retrieve environment variables in Vite (import.meta.env)
 * with backward-compatible fallback to REACT_APP_* if present.
 */
const getEnv = (viteKey, craKey) => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    if (import.meta.env[viteKey]) return import.meta.env[viteKey];
    if (import.meta.env[craKey]) return import.meta.env[craKey];
  }
  if (typeof process !== 'undefined' && process.env) {
    if (process.env[viteKey]) return process.env[viteKey];
    if (process.env[craKey]) return process.env[craKey];
  }
  return undefined;
};

const firebaseConfig = {
  apiKey:
    getEnv('VITE_FIREBASE_API_KEY', 'REACT_APP_FIREBASE_API_KEY') ||
    'AIzaSyDtdl-dWxjELjzeFHovUebgwWvI4v2PHGY',
  authDomain:
    getEnv('VITE_FIREBASE_AUTH_DOMAIN', 'REACT_APP_FIREBASE_AUTH_DOMAIN') ||
    'tasbeeh-committee-management.firebaseapp.com',
  projectId:
    getEnv('VITE_FIREBASE_PROJECT_ID', 'REACT_APP_FIREBASE_PROJECT_ID') ||
    'tasbeeh-committee-management',
  storageBucket:
    getEnv('VITE_FIREBASE_STORAGE_BUCKET', 'REACT_APP_FIREBASE_STORAGE_BUCKET') ||
    'tasbeeh-committee-management.firebasestorage.app',
  messagingSenderId:
    getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', 'REACT_APP_FIREBASE_MESSAGING_SENDER_ID') ||
    '169420537514',
  appId:
    getEnv('VITE_FIREBASE_APP_ID', 'REACT_APP_FIREBASE_APP_ID') ||
    '1:169420537514:web:660d34008a5b4fbf62dad3',
  measurementId:
    getEnv('VITE_FIREBASE_MEASUREMENT_ID', 'REACT_APP_FIREBASE_MEASUREMENT_ID') ||
    'G-QBKT04P3LS',
};

// Check if credentials have been properly set (not undefined and not placeholder)
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.apiKey !== 'your_api_key_here' &&
  !firebaseConfig.apiKey.includes('placeholder')
);

let app = null;
let auth = null;
let db = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (error) {
    console.error('Firebase initialization error:', error);
  }
} else {
  console.warn(
    '⚠️ لم يتم ضبط متغيرات بيئة فايربيس (Firebase Environment Variables) بعد.\n' +
    'يرجى إنشاء ملف .env.local ووضع بيانات مشروعك من Firebase Console.'
  );
}

export { app, auth, db };
export default app;
