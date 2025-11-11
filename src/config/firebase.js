import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    // No credential.cert() — Cloud Run provides credentials automatically
    credential: admin.credential.applicationDefault(),
    storageBucket: "quang-phuong-database.firebasestorage.app",
  });
}

export const db = admin.firestore();
export const bucket = admin.storage().bucket();
