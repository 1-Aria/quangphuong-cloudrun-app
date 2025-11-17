/**
 * Permission Checking Utilities
 * Provides functions to check user permissions and roles
 */

import { ROLES, PERMISSIONS, roleHasPermission, isRoleHigherThan } from '../../config/roles.js';
import { ForbiddenError } from '../errors/AppError.js';

/**
 * Check if user has a specific permission
 * @param {Object} user - User object with roles/permissions
 * @param {string} permission - Permission to check
 * @returns {boolean} True if user has permission
 */
export function hasPermission(user, permission) {
  if (!user) return false;

  // Super admin always has all permissions
  if (user.role === ROLES.SUPER_ADMIN) return true;

  // Check direct permissions (if stored on user)
  if (user.permissions && Array.isArray(user.permissions)) {
    if (user.permissions.includes(permission)) return true;
  }

  // Check role-based permissions
  if (user.role) {
    return roleHasPermission(user.role, permission);
  }

  // Check if user has multiple roles
  if (user.roles && Array.isArray(user.roles)) {
    return user.roles.some(role => roleHasPermission(role, permission));
  }

  return false;
}

/**
 * Check if user has all specified permissions
 * @param {Object} user - User object
 * @param {Array<string>} permissions - Array of permissions to check
 * @returns {boolean} True if user has all permissions
 */
export function hasAllPermissions(user, permissions) {
  return permissions.every(permission => hasPermission(user, permission));
}

/**
 * Check if user has any of the specified permissions
 * @param {Object} user - User object
 * @param {Array<string>} permissions - Array of permissions to check
 * @returns {boolean} True if user has at least one permission
 */
export function hasAnyPermission(user, permissions) {
  return permissions.some(permission => hasPermission(user, permission));
}

/**
 * Check if user has a specific role
 * @param {Object} user - User object
 * @param {string} role - Role to check
 * @returns {boolean} True if user has role
 */
export function hasRole(user, role) {
  if (!user) return false;

  if (user.role === role) return true;

  if (user.roles && Array.isArray(user.roles)) {
    return user.roles.includes(role);
  }

  return false;
}

/**
 * Check if user has any of the specified roles
 * @param {Object} user - User object
 * @param {Array<string>} roles - Array of roles to check
 * @returns {boolean} True if user has at least one role
 */
export function hasAnyRole(user, roles) {
  return roles.some(role => hasRole(user, role));
}

/**
 * Check if user's role is at least the specified minimum level
 * @param {Object} user - User object
 * @param {string} minimumRole - Minimum required role
 * @returns {boolean} True if user's role is equal or higher
 */
export function hasMinimumRole(user, minimumRole) {
  if (!user || !user.role) return false;

  return isRoleHigherThan(user.role, minimumRole) || user.role === minimumRole;
}

/**
 * Require permission - throws error if user doesn't have it
 * @param {Object} user - User object
 * @param {string} permission - Required permission
 * @throws {ForbiddenError} If user lacks permission
 */
export function requirePermission(user, permission) {
  if (!hasPermission(user, permission)) {
    throw new ForbiddenError(`Permission required: ${permission}`);
  }
}

/**
 * Require all permissions - throws error if user doesn't have all
 * @param {Object} user - User object
 * @param {Array<string>} permissions - Required permissions
 * @throws {ForbiddenError} If user lacks any permission
 */
export function requireAllPermissions(user, permissions) {
  if (!hasAllPermissions(user, permissions)) {
    throw new ForbiddenError(`Permissions required: ${permissions.join(', ')}`);
  }
}

/**
 * Require any permission - throws error if user has none
 * @param {Object} user - User object
 * @param {Array<string>} permissions - Accepted permissions
 * @throws {ForbiddenError} If user has no accepted permissions
 */
export function requireAnyPermission(user, permissions) {
  if (!hasAnyPermission(user, permissions)) {
    throw new ForbiddenError(`One of these permissions required: ${permissions.join(', ')}`);
  }
}

/**
 * Require role - throws error if user doesn't have it
 * @param {Object} user - User object
 * @param {string} role - Required role
 * @throws {ForbiddenError} If user lacks role
 */
export function requireRole(user, role) {
  if (!hasRole(user, role)) {
    throw new ForbiddenError(`Role required: ${role}`);
  }
}

/**
 * Require any role - throws error if user has none
 * @param {Object} user - User object
 * @param {Array<string>} roles - Accepted roles
 * @throws {ForbiddenError} If user has no accepted roles
 */
export function requireAnyRole(user, roles) {
  if (!hasAnyRole(user, roles)) {
    throw new ForbiddenError(`One of these roles required: ${roles.join(', ')}`);
  }
}

/**
 * Check if user owns a resource
 * @param {Object} user - User object
 * @param {Object} resource - Resource object with owner info
 * @param {string} ownerField - Field name containing owner ID (default: 'userId')
 * @returns {boolean} True if user owns resource
 */
export function isOwner(user, resource, ownerField = 'userId') {
  if (!user || !resource) return false;

  const ownerId = resource[ownerField];
  return user.uid === ownerId || user.id === ownerId;
}

/**
 * Require ownership - throws error if user doesn't own resource
 * @param {Object} user - User object
 * @param {Object} resource - Resource object
 * @param {string} ownerField - Field name containing owner ID
 * @throws {ForbiddenError} If user doesn't own resource
 */
export function requireOwnership(user, resource, ownerField = 'userId') {
  if (!isOwner(user, resource, ownerField)) {
    throw new ForbiddenError('You do not have permission to access this resource');
  }
}

/**
 * Check if user can access resource
 * User can access if they own it OR have the specified permission
 * @param {Object} user - User object
 * @param {Object} resource - Resource object
 * @param {string} permission - Required permission if not owner
 * @param {string} ownerField - Field name containing owner ID
 * @returns {boolean} True if user can access
 */
export function canAccess(user, resource, permission, ownerField = 'userId') {
  return isOwner(user, resource, ownerField) || hasPermission(user, permission);
}

/**
 * Require access - throws error if user can't access resource
 * @param {Object} user - User object
 * @param {Object} resource - Resource object
 * @param {string} permission - Required permission if not owner
 * @param {string} ownerField - Field name containing owner ID
 * @throws {ForbiddenError} If user can't access resource
 */
export function requireAccess(user, resource, permission, ownerField = 'userId') {
  if (!canAccess(user, resource, permission, ownerField)) {
    throw new ForbiddenError('You do not have permission to access this resource');
  }
}

export default {
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  hasRole,
  hasAnyRole,
  hasMinimumRole,
  requirePermission,
  requireAllPermissions,
  requireAnyPermission,
  requireRole,
  requireAnyRole,
  isOwner,
  requireOwnership,
  canAccess,
  requireAccess
};
