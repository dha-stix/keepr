// Client-side Firebase setup. Fill in .env.local (see .env.example) with your Firebase project's web config.
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

/** Env var names Next.js inlines at build time; listed so the setup screen can say exactly what is missing. */
const ENV_NAMES = {
  apiKey: "NEXT_PUBLIC_FIREBASE_API_KEY",
  authDomain: "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  projectId: "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  storageBucket: "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  appId: "NEXT_PUBLIC_FIREBASE_APP_ID",
  measurementId: "NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID",
} as const;

/** The Firebase env vars that are still empty. The app shows a setup screen until this is empty. */
export const missingFirebaseKeys = (Object.keys(ENV_NAMES) as (keyof typeof ENV_NAMES)[])
  .filter(k => !firebaseConfig[k])
  .map(k => ENV_NAMES[k]);

export const isFirebaseConfigured = missingFirebaseKeys.length === 0;

export const app: FirebaseApp | null = isFirebaseConfigured
  ? getApps().length
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

export const auth: Auth | null = app ? getAuth(app) : null;
export const db: Firestore | null = app ? getFirestore(app) : null;
/** Room photos uploaded by managers (rooms/{category}/...) */
export const storage: FirebaseStorage | null = app ? getStorage(app) : null;

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

/** Collection names in one place */
export const COL = {
  users: "users",
  rooms: "rooms",
  bookings: "bookings",
  holds: "holds", // public, minimal copy of each booking's dates so guests can check availability
  payments: "payments",
  activity: "activity",
  categories: "categories", // price and photos per room type, edited by admin managers
} as const;
