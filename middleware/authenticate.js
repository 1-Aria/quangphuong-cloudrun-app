/**
 * Flexible Authentication Middleware
 * Supports multiple authentication methods and optional/required auth
 */

import crypto from 'crypto';
import { UnauthorizedError, ForbiddenError } from '../shared/errors/AppError.js';
import { error as logError, info as logInfo } from '../shared/utils/logger.js';
import { extractAuth, verifyFirebaseToken, AUTH_TYPES } from '../shared/utils/authUtils.js';
import { hasPermission, hasAnyPermission, hasRole, hasAnyRole } from '../shared/utils/permissions.js';
import { ROLES } from '../config/roles.js';
import { db } from '../config/firebase.js';

/**
 * Verify API Key authentication
 * @param {string} clientKey - API key from request
 * @returns {Object|null} Auth info if valid, null otherwise
 */
function verifyApiKey(clientKey) {
  const serverKey = process.env.API_KEY;

  if (!serverKey) {
    logError('API_KEY environment variable is not set');
    return null;
  }

  if (!clientKey) {
    return null;
  }

  // Timing-safe comparison
  const clientKeyBuffer = Buffer.from(clientKey);
  const serverKeyBuffer = Buffer.from(serverKey);

  if (clientKeyBuffer.length !== serverKeyBuffer.length) {
    return null;
  }

  const isValid = crypto.timingSafeEqual(clientKeyBuffer, serverKeyBuffer);

  if (isValid) {
    return {
      type: AUTH_TYPES.API_KEY,
      isService: true,
      role: ROLES.SUPER_ADMIN // API keys have full access (service-to-service)
    };
  }

  return null;
}

/**
 * Get user profile from Firestore
 * @param {string} uid - User UID
 * @returns {Promise<Object>} User profile with role
 */
async function getUserProfile(uid) {
  try {
    const userDoc = await db.collection('users').doc(uid).get();

    if (!userDoc.exists) {
      // User authenticated but no profile yet - create default profile
      const defaultProfile = {
        uid,
        role: ROLES.USER,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await db.collection('users').doc(uid).set(defaultProfile);

      return defaultProfile;
    }

    return {
      id: userDoc.id,
      ...userDoc.data()
    };
  } catch (error) {
    logError('Failed to get user profile', { uid, error: error.message });
    throw new Error('Failed to load user profile');
  }
}

/**
 * Authenticate middleware - verifies authentication and attaches user to request
 * Supports multiple authentication methods
 *
 * @param {Object} options - Authentication options
 * @param {boolean} options.required - If true, throws error when not authenticated (default: true)
 * @param {Array<string>} options.allowApiKey - If true, allows API key authentication (default: true)
 * @returns {Function} Express middleware
 */
export function authenticate(options = {}) {
  const {
    required = true,
    allowApiKey = true
  } = options;

  return async (req, res, next) => {
    try {
      // Extract authentication from request
      const authInfo = extractAuth(req);

      // No authentication provided
      if (!authInfo) {
        if (required) {
          throw new UnauthorizedError('Authentication required');
        }
        // Optional auth - continue without user
        req.user = null;
        req.isAuthenticated = false;
        return next();
      }

      let user = null;

      // Handle different authentication types
      switch (authInfo.type) {
        case AUTH_TYPES.API_KEY:
          if (!allowApiKey) {
            throw new UnauthorizedError('API key authentication not allowed for this endpoint');
          }

          const apiKeyResult = verifyApiKey(authInfo.token);
          if (!apiKeyResult) {
            logError('API key authentication failed', {
              ip: req.ip,
              path: req.path
            });
            throw new UnauthorizedError('Invalid API key');
          }

          user = apiKeyResult;
          break;

        case AUTH_TYPES.FIREBASE_AUTH:
        case AUTH_TYPES.JWT:
          // Verify Firebase token
          const firebaseUser = await verifyFirebaseToken(authInfo.token);

          // Get user profile from Firestore (includes role)
          const userProfile = await getUserProfile(firebaseUser.uid);

          user = {
            ...firebaseUser,
            ...userProfile,
            type: AUTH_TYPES.FIREBASE_AUTH,
            isService: false
          };

          logInfo('User authenticated', {
            uid: user.uid,
            email: user.email,
            role: user.role
          });
          break;

        default:
          throw new UnauthorizedError('Unsupported authentication type');
      }

      // Attach user to request
      req.user = user;
      req.isAuthenticated = true;
      req.authType = user.type;

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Require specific permission(s)
 * Must be used after authenticate middleware
 *
 * @param {string|Array<string>} permissions - Required permission(s)
 * @param {Object} options - Options
 * @param {boolean} options.requireAll - If true, requires all permissions; if false, requires any (default: true)
 * @returns {Function} Express middleware
 */
export function requirePermission(permissions, options = {}) {
  const { requireAll = true } = options;
  const permArray = Array.isArray(permissions) ? permissions : [permissions];

  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const hasRequiredPermission = requireAll
        ? permArray.every(perm => hasPermission(req.user, perm))
        : hasAnyPermission(req.user, permArray);

      if (!hasRequiredPermission) {
        logError('Permission denied', {
          uid: req.user.uid || req.user.id,
          role: req.user.role,
          requiredPermissions: permArray,
          path: req.path
        });

        throw new ForbiddenError(
          requireAll
            ? `Permissions required: ${permArray.join(', ')}`
            : `One of these permissions required: ${permArray.join(', ')}`
        );
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Require specific role(s)
 * Must be used after authenticate middleware
 *
 * @param {string|Array<string>} roles - Required role(s)
 * @param {Object} options - Options
 * @param {boolean} options.requireAll - If true, requires all roles; if false, requires any (default: false)
 * @returns {Function} Express middleware
 */
export function requireRole(roles, options = {}) {
  const { requireAll = false } = options;
  const roleArray = Array.isArray(roles) ? roles : [roles];

  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const hasRequiredRole = requireAll
        ? roleArray.every(role => hasRole(req.user, role))
        : hasAnyRole(req.user, roleArray);

      if (!hasRequiredRole) {
        logError('Role check failed', {
          uid: req.user.uid || req.user.id,
          userRole: req.user.role,
          requiredRoles: roleArray,
          path: req.path
        });

        throw new ForbiddenError(
          requireAll
            ? `Roles required: ${roleArray.join(', ')}`
            : `One of these roles required: ${roleArray.join(', ')}`
        );
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Optional authentication - doesn't fail if not authenticated
 * Use this for endpoints that work for both authenticated and public users
 */
export const optionalAuth = authenticate({ required: false });

/**
 * Required authentication - fails if not authenticated
 * This is the default behavior
 */
export const requiredAuth = authenticate({ required: true });

/**
 * User authentication only - no API keys allowed
 * Use for endpoints that require a real user (not service-to-service)
 */
export const userAuthOnly = authenticate({ required: true, allowApiKey: false });

export default {
  authenticate,
  requirePermission,
  requireRole,
  optionalAuth,
  requiredAuth,
  userAuthOnly
};
