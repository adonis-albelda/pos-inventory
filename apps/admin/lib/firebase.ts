"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getMessaging, type Messaging } from "firebase/messaging";

/**
 * All NEXT_PUBLIC_FIREBASE_* — public client config by Firebase's own
 * design (the project is scoped server-side by Firestore/Messaging security
 * rules and the Admin SDK's service account, not by hiding these values).
 * Required in the environment for push notifications to work at all:
 *
 *   NEXT_PUBLIC_FIREBASE_API_KEY
 *   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
 *   NEXT_PUBLIC_FIREBASE_PROJECT_ID
 *   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
 *   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
 *   NEXT_PUBLIC_FIREBASE_APP_ID
 *   NEXT_PUBLIC_FIREBASE_VAPID_KEY (web push certificate key, from Firebase
 *     Console → Project settings → Cloud Messaging → Web configuration)
 *
 * Same Firebase project the Laravel API's FIREBASE_CREDENTIALS points at.
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
}

function firebaseApp(): FirebaseApp {
  const existing = getApps();
  return existing.length > 0 ? existing[0]! : initializeApp(firebaseConfig);
}

/** Only ever called after isFirebaseConfigured() and a browser messaging-support check — see lib/push.ts. */
export function firebaseMessaging(): Messaging {
  return getMessaging(firebaseApp());
}
