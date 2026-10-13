import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  type Firestore,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const useEmulators = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";

let emulatorsConnected = false;

export function getFirebaseApp(): FirebaseApp {
  return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
}

export function getFirebaseAuth(): Auth {
  const auth = getAuth(getFirebaseApp());
  if (useEmulators && !emulatorsConnected && typeof window !== "undefined") {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", {
      disableWarnings: true,
    });
    // El flag se marca recién cuando el Auth también quedó conectado
    emulatorsConnected = true;
  }
  return auth;
}

let firestoreEmulatorConnected = false;

export function getFirebaseDb(): Firestore {
  const db = getFirestore(getFirebaseApp());
  if (useEmulators && !firestoreEmulatorConnected && typeof window !== "undefined") {
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
    firestoreEmulatorConnected = true;
  }
  return db;
}
