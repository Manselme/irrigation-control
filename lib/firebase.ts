import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getDatabase, Database } from "firebase/database";
import { getStorage, FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Database | undefined;
let storage: FirebaseStorage | undefined;

function initFirebase() {
  if (typeof window === "undefined") return;
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getDatabase(app);
    storage = getStorage(app);
  } else {
    app = getApps()[0] as FirebaseApp;
    auth = getAuth(app);
    db = getDatabase(app);
    storage = getStorage(app);
  }
}

export function getFirebaseAuth(): Auth {
  if (typeof window !== "undefined" && !auth) initFirebase();
  if (!auth) throw new Error("Firebase Auth is only available on the client.");
  return auth;
}

export function getFirebaseDb(): Database {
  if (typeof window !== "undefined" && !db) initFirebase();
  if (!db) throw new Error("Firebase Database is only available on the client.");
  return db;
}

export function getFirebaseStorage(): FirebaseStorage {
  if (typeof window !== "undefined" && !storage) initFirebase();
  if (!storage) throw new Error("Firebase Storage is only available on the client.");
  return storage;
}

export { app, auth, db, storage };
