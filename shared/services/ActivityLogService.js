/**
 * Activity Log Service
 * Provides immutable audit trail for all system activities
 */

import { BaseService } from './BaseService.js';
import { COLLECTIONS } from '../../config/constants.js';
import { generateActivityLogId } from '../utils/idGenerator.js';
import { ValidationError } from '../errors/AppError.js';

/**
 * Activity Types
 */
export const ACTIVITY_TYPES = {
  // Work Order activities
  WO_CREATED: 'work_order_created',
  WO_UPDATED: 'work_order_updated',
  WO_SUBMITTED: 'work_order_submitted',
  WO_APPROVED: 'work_order_approved',
  WO_REJECTED: 'work_order_rejected',
  WO_ASSIGNED: 'work_order_assigned',
  WO_REASSIGNED: 'work_order_reassigned',
  WO_STARTED: 'work_order_started',
  WO_COMPLETED: 'work_order_completed',
  WO_CLOSED: 'work_order_closed',
  WO_CANCELLED: 'work_order_cancelled',
  WO_ON_HOLD: 'work_order_on_hold',
  WO_RESUMED: 'work_order_resumed',
  WO_COMMENT_ADDED: 'work_order_comment_added',
  WO_FILE_ATTACHED: 'work_order_file_attached',
  WO_PARTS_REQUESTED: 'work_order_parts_requested',
  WO_PARTS_RECEIVED: 'work_order_parts_received',

  // Equipment activities
  EQUIPMENT_CREATED: 'equipment_created',
  EQUIPMENT_UPDATED: 'equipment_updated',
  EQUIPMENT_DELETED: 'equipment_deleted',
  EQUIPMENT_STATUS_CHANGED: 'equipment_status_changed',

  // Inventory activities
  INVENTORY_CREATED: 'inventory_created',
  INVENTORY_UPDATED: 'inventory_updated',
  INVENTORY_DELETED: 'inventory_deleted',
  INVENTORY_ISSUED: 'inventory_issued',
  INVENTORY_RECEIVED: 'inventory_received',
  INVENTORY_ADJUSTED: 'inventory_adjusted',
  INVENTORY_TRANSFERRED: 'inventory_transferred',

  // User activities
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
  USER_CREATED: 'user_created',
  USER_UPDATED: 'user_updated',
  USER_ROLE_CHANGED: 'user_role_changed',

  // System activities
  SYSTEM_CONFIG_CHANGED: 'system_config_changed',
  BACKUP_CREATED: 'backup_created',
  SYSTEM_ERROR: 'system_error'
};

/**
 * Activity Severity Levels
 */
export const SEVERITY_LEVELS = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical'
};

/**
 * Activity Log Service
 * Extends BaseService for CRUD operations
 */
class ActivityLogService extends BaseService {
  constructor() {
    super(COLLECTIONS.ACTIVITY_LOGS || 'activity_logs');
  }

  /**
   * Log an activity (immutable - no updates allowed)
   * @param {Object} data - Activity data
   * @returns {Promise<Object>} Created activity log
   */
  async logActivity(data) {
    // Validate required fields
    const requiredFields = ['activityType', 'entityType', 'entityId', 'userId'];
    const missingFields = requiredFields.filter(field => !data[field]);

    if (missingFields.length > 0) {
      throw new ValidationError(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Validate activity type
    const validTypes = Object.values(ACTIVITY_TYPES);
    if (!validTypes.includes(data.activityType)) {
      throw new ValidationError(`Invalid activity type: ${data.activityType}`);
    }

    // Generate custom ID
    const activityId = await generateActivityLogId();

    // Prepare activity log entry
    const activityLog = {
      activityId,
      activityType: data.activityType,
      entityType: data.entityType,
      entityId: data.entityId,
      userId: data.userId,
      userName: data.userName || 'Unknown User',
      userRole: data.userRole || null,
      description: data.description || '',
      changes: data.changes || null, // Before/after values
      metadata: data.metadata || {},
      severity: data.severity || SEVERITY_LEVELS.INFO,
      ipAddress: data.ipAddress || null,
      userAgent: data.userAgent || null,
      timestamp: new Date(),
      createdAt: new Date()
    };

    // Create the activity log (immutable)
    const docRef = await this.collection.add(activityLog);

    return {
      id: docRef.id,
      ...activityLog
    };
  }

  /**
   * Log work order activity
   * @param {string} workOrderId - Work order ID
   * @param {string} activityType - Activity type
   * @param {Object} user - User performing action
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Created activity log
   */
  async logWorkOrderActivity(workOrderId, activityType, user, options = {}) {
    return await this.logActivity({
      activityType,
      entityType: 'work_order',
      entityId: workOrderId,
      userId: user.uid || user.id,
      userName: user.displayName || user.name || user.email,
      userRole: user.role,
      description: options.description || '',
      changes: options.changes || null,
      metadata: options.metadata || {},
      severity: options.severity || SEVERITY_LEVELS.INFO,
      ipAddress: options.ipAddress || null,
      userAgent: options.userAgent || null
    });
  }

  /**
   * Log equipment activity
   * @param {string} equipmentId - Equipment ID
   * @param {string} activityType - Activity type
   * @param {Object} user - User performing action
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Created activity log
   */
  async logEquipmentActivity(equipmentId, activityType, user, options = {}) {
    return await this.logActivity({
      activityType,
      entityType: 'equipment',
      entityId: equipmentId,
      userId: user.uid || user.id,
      userName: user.displayName || user.name || user.email,
      userRole: user.role,
      description: options.description || '',
      changes: options.changes || null,
      metadata: options.metadata || {},
      severity: options.severity || SEVERITY_LEVELS.INFO,
      ipAddress: options.ipAddress || null,
      userAgent: options.userAgent || null
    });
  }

  /**
   * Log inventory activity
   * @param {string} inventoryId - Inventory item ID
   * @param {string} activityType - Activity type
   * @param {Object} user - User performing action
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Created activity log
   */
  async logInventoryActivity(inventoryId, activityType, user, options = {}) {
    return await this.logActivity({
      activityType,
      entityType: 'inventory',
      entityId: inventoryId,
      userId: user.uid || user.id,
      userName: user.displayName || user.name || user.email,
      userRole: user.role,
      description: options.description || '',
      changes: options.changes || null,
      metadata: options.metadata || {},
      severity: options.severity || SEVERITY_LEVELS.INFO,
      ipAddress: options.ipAddress || null,
      userAgent: options.userAgent || null
    });
  }

  /**
   * Get activity logs for an entity
   * @param {string} entityType - Entity type
   * @param {string} entityId - Entity ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Activity logs
   */
  async getEntityActivityLogs(entityType, entityId, options = {}) {
    const { limit = 100, orderBy = 'timestamp', orderDirection = 'desc' } = options;

    let query = this.collection
      .where('entityType', '==', entityType)
      .where('entityId', '==', entityId)
      .orderBy(orderBy, orderDirection)
      .limit(limit);

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  /**
   * Get activity logs by user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Activity logs
   */
  async getUserActivityLogs(userId, options = {}) {
    const { limit = 100, orderBy = 'timestamp', orderDirection = 'desc' } = options;

    let query = this.collection
      .where('userId', '==', userId)
      .orderBy(orderBy, orderDirection)
      .limit(limit);

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  /**
   * Get activity logs by type
   * @param {string} activityType - Activity type
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Activity logs
   */
  async getActivityLogsByType(activityType, options = {}) {
    const { limit = 100, orderBy = 'timestamp', orderDirection = 'desc' } = options;

    let query = this.collection
      .where('activityType', '==', activityType)
      .orderBy(orderBy, orderDirection)
      .limit(limit);

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  /**
   * Get activity logs within date range
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Activity logs
   */
  async getActivityLogsByDateRange(startDate, endDate, options = {}) {
    const { limit = 1000, entityType = null } = options;

    let query = this.collection
      .where('timestamp', '>=', startDate)
      .where('timestamp', '<=', endDate)
      .orderBy('timestamp', 'desc');

    if (entityType) {
      query = query.where('entityType', '==', entityType);
    }

    query = query.limit(limit);

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  /**
   * Get activity logs by severity
   * @param {string} severity - Severity level
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Activity logs
   */
  async getActivityLogsBySeverity(severity, options = {}) {
    const { limit = 100, orderBy = 'timestamp', orderDirection = 'desc' } = options;

    let query = this.collection
      .where('severity', '==', severity)
      .orderBy(orderBy, orderDirection)
      .limit(limit);

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  /**
   * Search activity logs
   * @param {Object} filters - Search filters
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Activity logs
   */
  async searchActivityLogs(filters = {}, options = {}) {
    const { limit = 100, orderBy = 'timestamp', orderDirection = 'desc' } = options;

    let query = this.collection;

    // Apply filters
    if (filters.entityType) {
      query = query.where('entityType', '==', filters.entityType);
    }
    if (filters.entityId) {
      query = query.where('entityId', '==', filters.entityId);
    }
    if (filters.userId) {
      query = query.where('userId', '==', filters.userId);
    }
    if (filters.activityType) {
      query = query.where('activityType', '==', filters.activityType);
    }
    if (filters.severity) {
      query = query.where('severity', '==', filters.severity);
    }
    if (filters.startDate && filters.endDate) {
      query = query
        .where('timestamp', '>=', filters.startDate)
        .where('timestamp', '<=', filters.endDate);
    }

    query = query.orderBy(orderBy, orderDirection).limit(limit);

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  /**
   * Get activity statistics
   * @param {Object} filters - Filters
   * @returns {Promise<Object>} Activity statistics
   */
  async getActivityStatistics(filters = {}) {
    const logs = await this.searchActivityLogs(filters, { limit: 10000 });

    const stats = {
      total: logs.length,
      byType: {},
      bySeverity: {},
      byUser: {},
      byEntityType: {}
    };

    logs.forEach(log => {
      // By activity type
      stats.byType[log.activityType] = (stats.byType[log.activityType] || 0) + 1;

      // By severity
      stats.bySeverity[log.severity] = (stats.bySeverity[log.severity] || 0) + 1;

      // By user
      stats.byUser[log.userId] = (stats.byUser[log.userId] || 0) + 1;

      // By entity type
      stats.byEntityType[log.entityType] = (stats.byEntityType[log.entityType] || 0) + 1;
    });

    return stats;
  }

  /**
   * Override update method - activity logs are immutable
   */
  async update() {
    throw new Error('Activity logs are immutable and cannot be updated');
  }

  /**
   * Override delete method - activity logs should not be deleted
   * Only super admin can delete activity logs
   */
  async delete(id, userRole) {
    if (userRole !== 'super_admin') {
      throw new Error('Only super admins can delete activity logs');
    }
    return await super.delete(id);
  }
}

// Export singleton instance
export const activityLogService = new ActivityLogService();

export default ActivityLogService;
