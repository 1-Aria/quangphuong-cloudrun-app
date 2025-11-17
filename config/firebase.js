import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './environment.js';
import { info as logInfo, error as logError } from '../shared/utils/logger.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Initialize Firebase Admin SDK
 * Uses Application Default Credentials on Cloud Run
 * Uses service account file for local development
 */
if (!admin.apps.length) {
  try {
    let credential;

    if (config.cloudRun.isCloudRun) {
      // Running on Cloud Run — use Application Default Credentials
      logInfo('Initializing Firebase with Application Default Credentials (Cloud Run)');
      credential = admin.credential.applicationDefault();
    } else {
      // Running locally — use service account file
      const serviceAccountPath = path.resolve(__dirname, '..', config.firebase.serviceAccountPath);

      if (!fs.existsSync(serviceAccountPath)) {
        throw new Error(`Service account file not found at: ${serviceAccountPath}`);
      }

      logInfo(`Initializing Firebase with service account file: ${serviceAccountPath}`);
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      credential = admin.credential.cert(serviceAccount);
    }

    // Initialize Firebase Admin
    admin.initializeApp({
      credential,
      storageBucket: config.firebase.storageBucket,
      ...(config.firebase.projectId && { projectId: config.firebase.projectId })
    });

    // Configure Firestore settings
    const firestore = admin.firestore();
    firestore.settings({
      ignoreUndefinedProperties: true,
      timestampsInSnapshots: true
    });

    logInfo('Firebase Admin SDK initialized successfully');
  } catch (error) {
    logError('Failed to initialize Firebase Admin SDK', { error: error.message });
    throw error;
  }
}

// Export Firestore and Storage instances
export const db = admin.firestore();
export const bucket = admin.storage().bucket();
export const auth = admin.auth();

export default admin;
