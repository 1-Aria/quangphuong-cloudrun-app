/**
 * User Service
 * Manages user profiles, roles, and permissions in Firestore
 */

import { BaseService } from './BaseService.js';
import { NotFoundError, ConflictError, ValidationError } from '../errors/AppError.js';
import { ROLES, ROLE_PERMISSIONS } from '../../config/roles.js';
import { setUserClaims } from '../utils/authUtils.js';
import { logEvent } from '../utils/logger.js';

class UserService extends BaseService {
  constructor() {
    super('users');
  }

  /**
   * Create a new user profile
   * @param {Object} data - User data
   * @param {string} data.uid - Firebase Auth UID
   * @param {string} data.email - User email
   * @param {string} data.role - User role (default: 'user')
   * @param {Object} data.metadata - Additional user metadata
   * @returns {Promise<Object>} Created user profile
   */
  async createUser(data) {
    const { uid, email, role = ROLES.USER, ...metadata } = data;

    // Validate required fields
    if (!uid) {
      throw new ValidationError('User UID is required');
    }

    if (!email) {
      throw new ValidationError('User email is required');
    }

    // Check if user already exists
    const existing = await this.findById(uid);
    if (existing) {
      throw new ConflictError('User profile already exists');
    }

    // Validate role
    if (!Object.values(ROLES).includes(role)) {
      throw new ValidationError(`Invalid role: ${role}`);
    }

    // Create user profile
    const userProfile = {
      uid,
      email,
      role,
      permissions: ROLE_PERMISSIONS[role] || [],
      isActive: true,
      ...metadata,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Store in Firestore with UID as document ID
    await this.collection.doc(uid).set(userProfile);

    // Set custom claims in Firebase Auth for role-based access
    await setUserClaims(uid, { role });

    logEvent('user_created', { uid, email, role });

    return { id: uid, ...userProfile };
  }

  /**
   * Get user by UID
   * @param {string} uid - User UID
   * @returns {Promise<Object>} User profile
   */
  async getUserByUid(uid) {
    const user = await this.findById(uid);

    if (!user) {
      throw new NotFoundError('User');
    }

    return user;
  }

  /**
   * Get user by email
   * @param {string} email - User email
   * @returns {Promise<Object>} User profile
   */
  async getUserByEmail(email) {
    const users = await this.query({ email }, 1);

    if (users.length === 0) {
      throw new NotFoundError('User');
    }

    return users[0];
  }

  /**
   * Update user role
   * @param {string} uid - User UID
   * @param {string} newRole - New role
   * @returns {Promise<Object>} Updated user
   */
  async updateUserRole(uid, newRole) {
    // Validate role
    if (!Object.values(ROLES).includes(newRole)) {
      throw new ValidationError(`Invalid role: ${newRole}`);
    }

    // Get current user
    const user = await this.getUserByUid(uid);
    const oldRole = user.role;

    // Update user profile
    const updatedUser = await this.update(uid, {
      role: newRole,
      permissions: ROLE_PERMISSIONS[newRole] || []
    });

    // Update custom claims in Firebase Auth
    await setUserClaims(uid, { role: newRole });

    logEvent('user_role_updated', {
      uid,
      email: user.email,
      oldRole,
      newRole
    });

    return updatedUser;
  }

  /**
   * Add custom permission to user
   * @param {string} uid - User UID
   * @param {string} permission - Permission to add
   * @returns {Promise<Object>} Updated user
   */
  async addPermission(uid, permission) {
    const user = await this.getUserByUid(uid);

    const permissions = user.permissions || [];

    if (permissions.includes(permission)) {
      return user; // Already has permission
    }

    permissions.push(permission);

    return await this.update(uid, { permissions });
  }

  /**
   * Remove custom permission from user
   * @param {string} uid - User UID
   * @param {string} permission - Permission to remove
   * @returns {Promise<Object>} Updated user
   */
  async removePermission(uid, permission) {
    const user = await this.getUserByUid(uid);

    const permissions = (user.permissions || []).filter(p => p !== permission);

    return await this.update(uid, { permissions });
  }

  /**
   * Deactivate user
   * @param {string} uid - User UID
   * @returns {Promise<Object>} Updated user
   */
  async deactivateUser(uid) {
    const user = await this.update(uid, {
      isActive: false,
      deactivatedAt: new Date()
    });

    logEvent('user_deactivated', { uid });

    return user;
  }

  /**
   * Reactivate user
   * @param {string} uid - User UID
   * @returns {Promise<Object>} Updated user
   */
  async reactivateUser(uid) {
    const user = await this.update(uid, {
      isActive: true,
      reactivatedAt: new Date()
    });

    logEvent('user_reactivated', { uid });

    return user;
  }

  /**
   * Get all users with a specific role
   * @param {string} role - Role to filter by
   * @param {number} limit - Max results
   * @returns {Promise<Array>} Users with the role
   */
  async getUsersByRole(role, limit = 100) {
    return await this.query({ role }, limit);
  }

  /**
   * Get active users
   * @param {number} limit - Max results
   * @returns {Promise<Array>} Active users
   */
  async getActiveUsers(limit = 100) {
    return await this.query({ isActive: true }, limit);
  }

  /**
   * Update user profile metadata
   * @param {string} uid - User UID
   * @param {Object} metadata - Metadata to update
   * @returns {Promise<Object>} Updated user
   */
  async updateProfile(uid, metadata) {
    // Don't allow updating critical fields through this method
    const { uid: _, email: __, role: ___, permissions: ____, ...safeMetadata } = metadata;

    return await this.update(uid, safeMetadata);
  }

  /**
   * Delete user profile
   * Note: This only deletes the Firestore profile, not the Firebase Auth user
   * @param {string} uid - User UID
   * @returns {Promise<Object>} Deleted user reference
   */
  async deleteUserProfile(uid) {
    const user = await this.getUserByUid(uid);

    await this.delete(uid);

    logEvent('user_profile_deleted', { uid, email: user.email });

    return { id: uid };
  }
}

export default new UserService();
