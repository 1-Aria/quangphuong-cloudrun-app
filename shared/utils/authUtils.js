/**
 * Authentication Utilities
 * Supports multiple authentication methods:
 * - API Key (service-to-service)
 * - Google OAuth (future)
 * - JWT tokens (future)
 * - Firebase Auth (future)
 */

import { auth } from '../../config/firebase.js';
import { UnauthorizedError } from '../errors/AppError.js';

/**
 * Authentication Types
 */
export const AUTH_TYPES = {
  API_KEY: 'api_key',
  GOOGLE_OAUTH: 'google_oauth',
  JWT: 'jwt',
  FIREBASE_AUTH: 'firebase_auth'
};

/**
 * Extract authentication from request
 * Supports multiple auth methods
 * @param {Object} req - Express request object
 * @returns {Object} Auth info { type, token, user }
 */
export function extractAuth(req) {
  // 1. Check for API Key (existing method)
  const apiKey = req.header('x-api-key');
  if (apiKey) {
    return {
      type: AUTH_TYPES.API_KEY,
      token: apiKey,
      user: null // API keys are service-to-service, no user
    };
  }

  // 2. Check for Bearer token (JWT or OAuth)
  const authHeader = req.header('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    return {
      type: AUTH_TYPES.JWT, // Will determine actual type during verification
      token: token,
      user: null // Will be populated after verification
    };
  }

  // 3. Check for Firebase ID token
  const firebaseToken = req.header('x-firebase-token');
  if (firebaseToken) {
    return {
      type: AUTH_TYPES.FIREBASE_AUTH,
      token: firebaseToken,
      user: null // Will be populated after verification
    };
  }

  return null;
}

/**
 * Verify Firebase Auth token
 * @param {string} idToken - Firebase ID token
 * @returns {Promise<Object>} Decoded token with user info
 */
export async function verifyFirebaseToken(idToken) {
  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
      picture: decodedToken.picture,
      emailVerified: decodedToken.email_verified,
      provider: decodedToken.firebase.sign_in_provider
    };
  } catch (error) {
    throw new UnauthorizedError('Invalid or expired token');
  }
}

/**
 * Verify Google OAuth token
 * @param {string} token - Google OAuth token
 * @returns {Promise<Object>} User info from Google
 */
export async function verifyGoogleToken(token) {
  // Placeholder for Google OAuth verification
  // Will be implemented when Google OAuth is added
  throw new Error('Google OAuth not yet implemented');
}

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @returns {Promise<Object>} Decoded token payload
 */
export async function verifyJWT(token) {
  // Placeholder for JWT verification
  // Will be implemented when custom JWT is added
  throw new Error('JWT not yet implemented');
}

/**
 * Get user from Firebase by UID
 * @param {string} uid - Firebase user UID
 * @returns {Promise<Object>} User record
 */
export async function getUserByUid(uid) {
  try {
    const userRecord = await auth.getUser(uid);
    return {
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName,
      photoURL: userRecord.photoURL,
      emailVerified: userRecord.emailVerified,
      disabled: userRecord.disabled,
      metadata: {
        createdAt: userRecord.metadata.creationTime,
        lastSignIn: userRecord.metadata.lastSignInTime
      }
    };
  } catch (error) {
    throw new UnauthorizedError('User not found');
  }
}

/**
 * Get user from Firebase by email
 * @param {string} email - User email
 * @returns {Promise<Object>} User record
 */
export async function getUserByEmail(email) {
  try {
    const userRecord = await auth.getUserByEmail(email);
    return getUserByUid(userRecord.uid);
  } catch (error) {
    throw new UnauthorizedError('User not found');
  }
}

/**
 * Create custom token for user
 * Useful for server-side user creation
 * @param {string} uid - User UID
 * @param {Object} additionalClaims - Custom claims to add to token
 * @returns {Promise<string>} Custom token
 */
export async function createCustomToken(uid, additionalClaims = {}) {
  try {
    return await auth.createCustomToken(uid, additionalClaims);
  } catch (error) {
    throw new Error('Failed to create custom token');
  }
}

/**
 * Set custom claims for user (for role-based access)
 * @param {string} uid - User UID
 * @param {Object} claims - Custom claims (e.g., { role: 'admin' })
 * @returns {Promise<void>}
 */
export async function setUserClaims(uid, claims) {
  try {
    await auth.setCustomUserClaims(uid, claims);
  } catch (error) {
    throw new Error('Failed to set user claims');
  }
}

/**
 * Get user's custom claims
 * @param {string} uid - User UID
 * @returns {Promise<Object>} Custom claims
 */
export async function getUserClaims(uid) {
  try {
    const user = await auth.getUser(uid);
    return user.customClaims || {};
  } catch (error) {
    throw new Error('Failed to get user claims');
  }
}

export default {
  AUTH_TYPES,
  extractAuth,
  verifyFirebaseToken,
  verifyGoogleToken,
  verifyJWT,
  getUserByUid,
  getUserByEmail,
  createCustomToken,
  setUserClaims,
  getUserClaims
};
