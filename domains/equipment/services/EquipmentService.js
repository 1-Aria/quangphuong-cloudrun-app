/**
 * Equipment Service
 * Business logic for equipment management
 */

import { BaseService } from '../../../shared/services/BaseService.js';
import { db } from '../../../config/firebase.js';
import { COLLECTIONS } from '../../../config/constants.js';
import {
  EQUIPMENT_CONFIG,
  EQUIPMENT_STATUS,
  EQUIPMENT_CRITICALITY,
  isValidStatusTransition,
  calculateMTBF,
  calculateMTTR,
  calculateAvailability,
  isMaintenanceDue,
  calculateNextMaintenanceDate
} from '../config.js';
import { ValidationError, NotFoundError } from '../../../shared/errors/AppError.js';
import { logInfo, logError } from '../../../shared/utils/logger.js';

/**
 * Equipment Service
 * Extends BaseService for equipment-specific operations
 */
class EquipmentService extends BaseService {
  constructor() {
    super(EQUIPMENT_CONFIG.collection);
  }

  /**
   * Generate custom equipment ID (EQ-0000001 format)
   * @returns {Promise<string>} Equipment ID
   */
  async generateEquipmentId() {
    try {
      const counterRef = db.collection('counters').doc('equipment');
      const counterDoc = await counterRef.get();

      let nextNumber = 1;
      if (counterDoc.exists) {
        nextNumber = (counterDoc.data().lastNumber || 0) + 1;
      }

      await counterRef.set({ lastNumber: nextNumber });

      // Format: EQ-0000001
      return `EQ-${String(nextNumber).padStart(7, '0')}`;
    } catch (error) {
      logError('Error generating equipment ID', { error: error.message });
      throw error;
    }
  }

  /**
   * Create new equipment
   * @param {Object} data - Equipment data
   * @param {Object} user - User creating the equipment
   * @returns {Promise<Object>} Created equipment
   */
  async createEquipment(data, user) {
    try {
      // Validate required fields
      const missingFields = EQUIPMENT_CONFIG.requiredFields.filter(
        field => !data[field] && field !== 'equipmentId' // equipmentId is auto-generated
      );

      if (missingFields.length > 0) {
        throw new ValidationError(
          `Missing required fields: ${missingFields.join(', ')}`
        );
      }

      // Validate status
      if (!EQUIPMENT_CONFIG.validStatuses.includes(data.status)) {
        throw new ValidationError(`Invalid status: ${data.status}`);
      }

      // Validate criticality
      if (!EQUIPMENT_CONFIG.validCriticalities.includes(data.criticality)) {
        throw new ValidationError(`Invalid criticality: ${data.criticality}`);
      }

      // Validate category
      if (!EQUIPMENT_CONFIG.validCategories.includes(data.category)) {
        throw new ValidationError(`Invalid category: ${data.category}`);
      }

      // Generate equipment ID
      const equipmentId = await this.generateEquipmentId();

      // Prepare equipment data
      const equipmentData = {
        equipmentId,
        name: data.name,
        description: data.description || '',
        category: data.category,
        status: data.status,
        criticality: data.criticality,
        location: data.location || '',
        department: data.department || '',
        manufacturer: data.manufacturer || '',
        model: data.model || '',
        serialNumber: data.serialNumber || '',
        purchaseDate: data.purchaseDate || null,
        purchaseCost: data.purchaseCost || null,
        warrantyExpiryDate: data.warrantyExpiryDate || null,
        specifications: data.specifications || {},
        parentEquipmentId: data.parentEquipmentId || null,
        assignedTo: data.assignedTo || null,
        notes: data.notes || '',

        // Maintenance tracking
        maintenanceInterval: data.maintenanceInterval || null,
        maintenanceIntervalUnit: data.maintenanceIntervalUnit || null,
        lastMaintenanceDate: data.lastMaintenanceDate || null,
        nextMaintenanceDate: data.nextMaintenanceDate || null,

        // Metrics (calculated)
        totalDowntimeHours: 0,
        totalMaintenanceCount: 0,
        mtbf: null,
        mttr: null,
        availabilityPercent: 100,

        // Activity tracking
        activityLog: [
          {
            timestamp: new Date(),
            action: 'created',
            performedBy: user.uid,
            performedByName: user.displayName || user.email,
            details: 'Equipment created'
          }
        ],

        // Status history
        statusHistory: [
          {
            status: data.status,
            timestamp: new Date(),
            changedBy: user.uid,
            changedByName: user.displayName || user.email,
            reason: 'Initial status'
          }
        ],

        // Metadata
        createdBy: user.uid,
        createdByName: user.displayName || user.email
      };

      // Create equipment
      const equipment = await this.create(equipmentData);

      logInfo('Equipment created', {
        equipmentId,
        name: data.name,
        category: data.category
      });

      return equipment;
    } catch (error) {
      logError('Error creating equipment', { error: error.message });
      throw error;
    }
  }

  /**
   * Update equipment status
   * @param {string} id - Equipment document ID
   * @param {string} newStatus - New status
   * @param {Object} user - User performing the update
   * @param {string} reason - Reason for status change
   * @returns {Promise<Object>} Updated equipment
   */
  async updateEquipmentStatus(id, newStatus, user, reason = '') {
    try {
      const equipment = await this.findById(id);

      if (!equipment) {
        throw new NotFoundError('Equipment not found');
      }

      // Validate status
      if (!EQUIPMENT_CONFIG.validStatuses.includes(newStatus)) {
        throw new ValidationError(`Invalid status: ${newStatus}`);
      }

      // Validate transition
      if (!isValidStatusTransition(equipment.status, newStatus)) {
        throw new ValidationError(
          `Invalid status transition from ${equipment.status} to ${newStatus}`
        );
      }

      const now = new Date();

      // Track downtime if transitioning to/from Down status
      let downtimeUpdate = {};
      if (equipment.status === EQUIPMENT_STATUS.DOWN && newStatus !== EQUIPMENT_STATUS.DOWN) {
        // Equipment coming back up - calculate downtime
        if (equipment.lastDowntimeStart) {
          const downtimeHours = (now - new Date(equipment.lastDowntimeStart)) / (1000 * 60 * 60);
          downtimeUpdate = {
            totalDowntimeHours: (equipment.totalDowntimeHours || 0) + downtimeHours,
            lastDowntimeStart: null
          };
        }
      } else if (equipment.status !== EQUIPMENT_STATUS.DOWN && newStatus === EQUIPMENT_STATUS.DOWN) {
        // Equipment going down - record start time
        downtimeUpdate = {
          lastDowntimeStart: now
        };
      }

      // Update equipment
      const updates = {
        status: newStatus,
        ...downtimeUpdate,
        statusHistory: [
          ...(equipment.statusHistory || []),
          {
            status: newStatus,
            timestamp: now,
            changedBy: user.uid,
            changedByName: user.displayName || user.email,
            reason: reason || 'Status updated'
          }
        ],
        activityLog: [
          ...(equipment.activityLog || []),
          {
            timestamp: now,
            action: 'status_updated',
            performedBy: user.uid,
            performedByName: user.displayName || user.email,
            details: `Status changed from ${equipment.status} to ${newStatus}`,
            reason
          }
        ]
      };

      const updatedEquipment = await this.update(id, updates);

      logInfo('Equipment status updated', {
        equipmentId: equipment.equipmentId,
        oldStatus: equipment.status,
        newStatus
      });

      return updatedEquipment;
    } catch (error) {
      logError('Error updating equipment status', { error: error.message });
      throw error;
    }
  }

  /**
   * Record maintenance event
   * @param {string} id - Equipment document ID
   * @param {Object} maintenanceData - Maintenance data
   * @param {Object} user - User recording the maintenance
   * @returns {Promise<Object>} Updated equipment
   */
  async recordMaintenance(id, maintenanceData, user) {
    try {
      const equipment = await this.findById(id);

      if (!equipment) {
        throw new NotFoundError('Equipment not found');
      }

      const now = new Date();

      // Calculate next maintenance date if interval is set
      let nextMaintenanceDate = equipment.nextMaintenanceDate;
      if (equipment.maintenanceInterval && equipment.maintenanceIntervalUnit) {
        nextMaintenanceDate = calculateNextMaintenanceDate(
          now,
          equipment.maintenanceInterval,
          equipment.maintenanceIntervalUnit
        );
      }

      // Update equipment
      const updates = {
        lastMaintenanceDate: now,
        nextMaintenanceDate,
        totalMaintenanceCount: (equipment.totalMaintenanceCount || 0) + 1,
        activityLog: [
          ...(equipment.activityLog || []),
          {
            timestamp: now,
            action: 'maintenance_recorded',
            performedBy: user.uid,
            performedByName: user.displayName || user.email,
            details: maintenanceData.description || 'Maintenance performed',
            maintenanceType: maintenanceData.type
          }
        ]
      };

      const updatedEquipment = await this.update(id, updates);

      logInfo('Maintenance recorded', {
        equipmentId: equipment.equipmentId,
        type: maintenanceData.type
      });

      return updatedEquipment;
    } catch (error) {
      logError('Error recording maintenance', { error: error.message });
      throw error;
    }
  }

  /**
   * Get equipment maintenance history
   * @param {string} id - Equipment document ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Maintenance history
   */
  async getMaintenanceHistory(id, options = {}) {
    try {
      const equipment = await this.findById(id);

      if (!equipment) {
        throw new NotFoundError('Equipment not found');
      }

      // Query work orders for this equipment
      const { limit = 50, startDate, endDate } = options;

      let query = db
        .collection(COLLECTIONS.WORK_ORDERS)
        .where('equipmentId', '==', equipment.equipmentId)
        .orderBy('createdAt', 'desc')
        .limit(limit);

      if (startDate) {
        query = query.where('createdAt', '>=', startDate);
      }

      if (endDate) {
        query = query.where('createdAt', '<=', endDate);
      }

      const snapshot = await query.get();
      const workOrders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return workOrders;
    } catch (error) {
      logError('Error getting maintenance history', { error: error.message });
      throw error;
    }
  }

  /**
   * Calculate equipment metrics (MTBF, MTTR, Availability)
   * @param {string} id - Equipment document ID
   * @param {Date} startDate - Start date for calculation
   * @param {Date} endDate - End date for calculation
   * @returns {Promise<Object>} Equipment metrics
   */
  async calculateMetrics(id, startDate, endDate) {
    try {
      const equipment = await this.findById(id);

      if (!equipment) {
        throw new NotFoundError('Equipment not found');
      }

      // Get maintenance history for period
      const maintenanceHistory = await this.getMaintenanceHistory(id, {
        startDate,
        endDate,
        limit: 1000
      });

      // Calculate MTBF
      const mtbf = calculateMTBF(maintenanceHistory, startDate, endDate);

      // Calculate MTTR
      const mttr = calculateMTTR(maintenanceHistory, startDate, endDate);

      // Calculate availability
      const totalTimeHours = (endDate - startDate) / (1000 * 60 * 60);
      const availability = calculateAvailability(
        totalTimeHours,
        equipment.totalDowntimeHours || 0
      );

      const metrics = {
        mtbf,
        mttr,
        availability,
        totalDowntimeHours: equipment.totalDowntimeHours || 0,
        totalMaintenanceCount: equipment.totalMaintenanceCount || 0,
        period: {
          startDate,
          endDate
        }
      };

      // Update equipment with calculated metrics
      await this.update(id, {
        mtbf,
        mttr,
        availabilityPercent: availability,
        lastMetricsCalculation: new Date()
      });

      return metrics;
    } catch (error) {
      logError('Error calculating equipment metrics', { error: error.message });
      throw error;
    }
  }

  /**
   * Get equipment by custom ID
   * @param {string} equipmentId - Custom equipment ID (e.g., EQ-0000001)
   * @returns {Promise<Object|null>} Equipment or null
   */
  async getByEquipmentId(equipmentId) {
    try {
      const snapshot = await db
        .collection(this.collectionName)
        .where('equipmentId', '==', equipmentId)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      logError('Error getting equipment by ID', { error: error.message });
      throw error;
    }
  }

  /**
   * Get equipment due for maintenance
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Equipment due for maintenance
   */
  async getEquipmentDueForMaintenance(options = {}) {
    try {
      const { department, criticality, limit = 100 } = options;
      const now = new Date();

      let query = db
        .collection(this.collectionName)
        .where('nextMaintenanceDate', '<=', now)
        .where('status', '!=', EQUIPMENT_STATUS.RETIRED)
        .orderBy('nextMaintenanceDate', 'asc')
        .limit(limit);

      if (department) {
        query = query.where('department', '==', department);
      }

      if (criticality) {
        query = query.where('criticality', '==', criticality);
      }

      const snapshot = await query.get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      logError('Error getting equipment due for maintenance', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get equipment hierarchy (parent-child relationships)
   * @param {string} parentId - Parent equipment ID
   * @returns {Promise<Array>} Child equipment
   */
  async getEquipmentHierarchy(parentId) {
    try {
      const snapshot = await db
        .collection(this.collectionName)
        .where('parentEquipmentId', '==', parentId)
        .get();

      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      logError('Error getting equipment hierarchy', { error: error.message });
      throw error;
    }
  }

  /**
   * Search equipment
   * @param {Object} filters - Search filters
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Search results with pagination
   */
  async searchEquipment(filters = {}, options = {}) {
    try {
      const {
        status,
        category,
        criticality,
        department,
        location,
        assignedTo,
        manufacturer,
        searchTerm
      } = filters;

      const { limit = 100, offset = 0 } = options;

      let query = db.collection(this.collectionName);

      // Apply filters
      if (status) {
        query = query.where('status', '==', status);
      }

      if (category) {
        query = query.where('category', '==', category);
      }

      if (criticality) {
        query = query.where('criticality', '==', criticality);
      }

      if (department) {
        query = query.where('department', '==', department);
      }

      if (location) {
        query = query.where('location', '==', location);
      }

      if (assignedTo) {
        query = query.where('assignedTo', '==', assignedTo);
      }

      if (manufacturer) {
        query = query.where('manufacturer', '==', manufacturer);
      }

      // Get results
      query = query.orderBy('createdAt', 'desc').limit(limit).offset(offset);

      const snapshot = await query.get();
      let equipment = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Filter by search term (client-side for now)
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        equipment = equipment.filter(eq =>
          eq.name.toLowerCase().includes(term) ||
          eq.equipmentId.toLowerCase().includes(term) ||
          eq.description?.toLowerCase().includes(term) ||
          eq.serialNumber?.toLowerCase().includes(term)
        );
      }

      return {
        equipment,
        total: equipment.length,
        limit,
        offset
      };
    } catch (error) {
      logError('Error searching equipment', { error: error.message });
      throw error;
    }
  }
}

// Export singleton instance
export const equipmentService = new EquipmentService();

export default EquipmentService;
