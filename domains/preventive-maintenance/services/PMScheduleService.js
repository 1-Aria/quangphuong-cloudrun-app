/**
 * Preventive Maintenance Schedule Service
 * Manages PM schedules and generates work orders
 */

import { BaseService } from '../../../shared/services/BaseService.js';
import { db } from '../../../config/firebase.js';
import {
  PM_CONFIG,
  SCHEDULE_FREQUENCY,
  SCHEDULE_STATUS,
  PM_PRIORITY_MAPPING,
  calculateNextDueDate,
  calculateNextDueReading,
  isScheduleDue,
  isScheduleOverdue,
  isMeterScheduleDue,
  validateSchedule
} from '../config.js';
import { checklistTemplateService } from './ChecklistTemplateService.js';
import { equipmentService } from '../../equipment/services/EquipmentService.js';
import { ValidationError, NotFoundError } from '../../../shared/errors/AppError.js';
import { logInfo, logError } from '../../../shared/utils/logger.js';

/**
 * PM Schedule Service
 * Manages preventive maintenance schedules and work order generation
 */
class PMScheduleService extends BaseService {
  constructor() {
    super(PM_CONFIG.collection);
  }

  /**
   * Generate custom schedule ID (PM-0000001 format)
   * @returns {Promise<string>} Schedule ID
   */
  async generateScheduleId() {
    try {
      const counterRef = db.collection('counters').doc('pm_schedules');
      const counterDoc = await counterRef.get();

      let nextNumber = 1;
      if (counterDoc.exists) {
        nextNumber = (counterDoc.data().lastNumber || 0) + 1;
      }

      await counterRef.set({ lastNumber: nextNumber });

      return `PM-${String(nextNumber).padStart(7, '0')}`;
    } catch (error) {
      logError('Error generating PM schedule ID', { error: error.message });
      throw error;
    }
  }

  /**
   * Create PM schedule
   * @param {Object} data - Schedule data
   * @param {Object} user - User creating schedule
   * @returns {Promise<Object>} Created schedule
   */
  async createSchedule(data, user) {
    try {
      // Validate schedule data
      validateSchedule(data);

      // Verify equipment exists
      const equipment = await equipmentService.findById(data.equipmentId);
      if (!equipment) {
        throw new NotFoundError('Equipment not found');
      }

      // Generate schedule ID
      const scheduleId = await this.generateScheduleId();

      // Calculate initial next due date
      const startDate = data.startDate ? new Date(data.startDate) : new Date();
      let nextDueDate = null;
      let nextDueReading = null;

      if (data.frequency === SCHEDULE_FREQUENCY.METER_BASED) {
        // Meter-based schedule
        const currentReading = equipment.currentMeterReading || 0;
        nextDueReading = calculateNextDueReading(
          currentReading,
          data.meterInterval
        );
      } else {
        // Time-based schedule
        nextDueDate = calculateNextDueDate(
          startDate,
          data.frequency,
          data.customIntervalDays
        );
      }

      // Load checklist from template if provided
      let checklist = data.checklist || [];
      if (data.checklistTemplateId) {
        const template = await checklistTemplateService.findById(
          data.checklistTemplateId
        );
        if (template) {
          checklist = template.items;
          // Increment template usage count
          await checklistTemplateService.incrementUsageCount(
            data.checklistTemplateId
          );
        }
      }

      // Prepare schedule data
      const scheduleData = {
        scheduleId,
        title: data.title.trim(),
        description: data.description || '',
        frequency: data.frequency,
        customIntervalDays: data.customIntervalDays || null,
        meterInterval: data.meterInterval || null,

        // Equipment
        equipmentId: data.equipmentId,
        equipmentName: equipment.name,
        equipmentType: equipment.equipmentType,

        // Assignment
        assignedToId: data.assignedToId,
        assignedToName: data.assignedToName || '',

        // Checklist
        checklistTemplateId: data.checklistTemplateId || null,
        checklist,

        // Scheduling
        startDate,
        nextDueDate,
        nextDueReading,
        lastCompletedDate: null,
        lastCompletedWorkOrderId: null,

        // Settings
        estimatedDurationHours: data.estimatedDurationHours,
        leadTimeDays: data.leadTimeDays || PM_CONFIG.defaultLeadTimeDays,
        autoGenerateWorkOrder: data.autoGenerateWorkOrder !== false, // Default true
        priority: data.priority || PM_PRIORITY_MAPPING[data.frequency],

        // Parts
        requiredParts: data.requiredParts || [],

        // Status
        status: SCHEDULE_STATUS.ACTIVE,
        isActive: true,

        // Metrics
        totalScheduled: 0,
        totalCompleted: 0,
        totalSkipped: 0,
        totalOverdue: 0,
        totalOnTime: 0,
        averageCompletionDays: 0,
        complianceRate: 0,

        // Metadata
        createdBy: user.uid,
        createdByName: user.displayName || user.email
      };

      const schedule = await this.create(scheduleData);

      logInfo('PM schedule created', {
        scheduleId,
        title: data.title,
        equipmentId: data.equipmentId,
        frequency: data.frequency
      });

      return schedule;
    } catch (error) {
      logError('Error creating PM schedule', { error: error.message });
      throw error;
    }
  }

  /**
   * Get schedules by equipment
   * @param {string} equipmentId - Equipment ID
   * @returns {Promise<Array>} Schedules
   */
  async getByEquipment(equipmentId) {
    try {
      const snapshot = await db
        .collection(this.collectionName)
        .where('equipmentId', '==', equipmentId)
        .where('isActive', '==', true)
        .orderBy('nextDueDate')
        .get();

      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      logError('Error getting schedules by equipment', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get schedules by assignee
   * @param {string} assignedToId - User ID
   * @returns {Promise<Array>} Schedules
   */
  async getByAssignee(assignedToId) {
    try {
      const snapshot = await db
        .collection(this.collectionName)
        .where('assignedToId', '==', assignedToId)
        .where('isActive', '==', true)
        .orderBy('nextDueDate')
        .get();

      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      logError('Error getting schedules by assignee', { error: error.message });
      throw error;
    }
  }

  /**
   * Get due schedules (ready to generate work orders)
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Due schedules
   */
  async getDueSchedules(options = {}) {
    try {
      const { limit = 100, includeOverdue = true } = options;

      const snapshot = await db
        .collection(this.collectionName)
        .where('status', '==', SCHEDULE_STATUS.ACTIVE)
        .where('autoGenerateWorkOrder', '==', true)
        .limit(limit * 2) // Get extra for client-side filtering
        .get();

      let schedules = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Client-side filtering for due schedules
      schedules = schedules.filter(schedule => {
        if (schedule.frequency === SCHEDULE_FREQUENCY.METER_BASED) {
          // Check meter-based due status
          // Would need current meter reading from equipment
          return false; // Skip for now - requires real-time equipment data
        } else {
          // Check time-based due status
          const isDue = isScheduleDue(
            schedule.nextDueDate,
            schedule.leadTimeDays || 0
          );
          const overdue = isScheduleOverdue(schedule.nextDueDate, 0);

          if (includeOverdue) {
            return isDue || overdue;
          }
          return isDue && !overdue;
        }
      });

      return schedules.slice(0, limit);
    } catch (error) {
      logError('Error getting due schedules', { error: error.message });
      throw error;
    }
  }

  /**
   * Get overdue schedules
   * @param {number} limit - Result limit
   * @returns {Promise<Array>} Overdue schedules
   */
  async getOverdueSchedules(limit = 100) {
    try {
      const snapshot = await db
        .collection(this.collectionName)
        .where('status', '==', SCHEDULE_STATUS.ACTIVE)
        .limit(limit * 2)
        .get();

      let schedules = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Client-side filtering for overdue
      schedules = schedules.filter(schedule => {
        if (schedule.frequency === SCHEDULE_FREQUENCY.METER_BASED) {
          return false; // Skip meter-based for now
        }
        return isScheduleOverdue(
          schedule.nextDueDate,
          PM_CONFIG.overdueGracePeriodDays
        );
      });

      return schedules.slice(0, limit);
    } catch (error) {
      logError('Error getting overdue schedules', { error: error.message });
      throw error;
    }
  }

  /**
   * Update schedule after work order completion
   * @param {string} scheduleId - Schedule ID
   * @param {Object} workOrder - Completed work order
   * @returns {Promise<Object>} Updated schedule
   */
  async recordCompletion(scheduleId, workOrder) {
    try {
      const schedule = await this.findById(scheduleId);

      if (!schedule) {
        throw new NotFoundError('PM schedule not found');
      }

      const completionDate = new Date(workOrder.completedAt || new Date());

      // Calculate if completed on time
      const onTime = schedule.nextDueDate
        ? completionDate <= new Date(schedule.nextDueDate)
        : true;

      // Calculate next due date/reading
      let nextDueDate = null;
      let nextDueReading = null;

      if (schedule.frequency === SCHEDULE_FREQUENCY.METER_BASED) {
        // Meter-based
        nextDueReading = calculateNextDueReading(
          workOrder.completionMeterReading || schedule.nextDueReading,
          schedule.meterInterval
        );
      } else {
        // Time-based
        nextDueDate = calculateNextDueDate(
          completionDate,
          schedule.frequency,
          schedule.customIntervalDays
        );
      }

      // Calculate completion days
      const scheduledDate = schedule.nextDueDate
        ? new Date(schedule.nextDueDate)
        : completionDate;
      const completionDays = Math.ceil(
        (completionDate - scheduledDate) / (1000 * 60 * 60 * 24)
      );

      // Update metrics
      const totalCompleted = (schedule.totalCompleted || 0) + 1;
      const totalOnTime = onTime
        ? (schedule.totalOnTime || 0) + 1
        : schedule.totalOnTime || 0;
      const totalOverdue = !onTime
        ? (schedule.totalOverdue || 0) + 1
        : schedule.totalOverdue || 0;

      // Calculate average completion days
      const previousAvg = schedule.averageCompletionDays || 0;
      const averageCompletionDays =
        (previousAvg * (totalCompleted - 1) + completionDays) / totalCompleted;

      // Calculate compliance rate
      const complianceRate = Math.round((totalOnTime / totalCompleted) * 100);

      const updates = {
        lastCompletedDate: completionDate,
        lastCompletedWorkOrderId: workOrder.workOrderId || workOrder.id,
        nextDueDate,
        nextDueReading,
        totalCompleted,
        totalOnTime,
        totalOverdue,
        averageCompletionDays: Math.round(averageCompletionDays),
        complianceRate
      };

      const updatedSchedule = await this.update(scheduleId, updates);

      logInfo('PM schedule completion recorded', {
        scheduleId: schedule.scheduleId,
        workOrderId: workOrder.workOrderId,
        onTime,
        nextDueDate
      });

      return updatedSchedule;
    } catch (error) {
      logError('Error recording PM completion', { error: error.message });
      throw error;
    }
  }

  /**
   * Skip scheduled execution
   * @param {string} scheduleId - Schedule ID
   * @param {string} reason - Skip reason
   * @param {Object} user - User skipping
   * @returns {Promise<Object>} Updated schedule
   */
  async skipExecution(scheduleId, reason, user) {
    try {
      const schedule = await this.findById(scheduleId);

      if (!schedule) {
        throw new NotFoundError('PM schedule not found');
      }

      // Calculate next due date/reading
      let nextDueDate = null;
      let nextDueReading = null;

      if (schedule.frequency === SCHEDULE_FREQUENCY.METER_BASED) {
        nextDueReading = calculateNextDueReading(
          schedule.nextDueReading,
          schedule.meterInterval
        );
      } else {
        nextDueDate = calculateNextDueDate(
          schedule.nextDueDate || new Date(),
          schedule.frequency,
          schedule.customIntervalDays
        );
      }

      const updates = {
        nextDueDate,
        nextDueReading,
        totalSkipped: (schedule.totalSkipped || 0) + 1,
        lastSkippedDate: new Date(),
        lastSkippedReason: reason,
        lastSkippedBy: user.uid
      };

      const updatedSchedule = await this.update(scheduleId, updates);

      logInfo('PM schedule execution skipped', {
        scheduleId: schedule.scheduleId,
        reason
      });

      return updatedSchedule;
    } catch (error) {
      logError('Error skipping PM execution', { error: error.message });
      throw error;
    }
  }

  /**
   * Update schedule status
   * @param {string} id - Schedule ID
   * @param {string} newStatus - New status
   * @param {Object} user - User performing update
   * @returns {Promise<Object>} Updated schedule
   */
  async updateStatus(id, newStatus, user) {
    try {
      if (!PM_CONFIG.validStatuses.includes(newStatus)) {
        throw new ValidationError(`Invalid status: ${newStatus}`);
      }

      const updates = {
        status: newStatus,
        isActive: newStatus === SCHEDULE_STATUS.ACTIVE,
        statusUpdatedAt: new Date(),
        statusUpdatedBy: user.uid
      };

      const updatedSchedule = await this.update(id, updates);

      logInfo('PM schedule status updated', {
        scheduleId: updatedSchedule.scheduleId,
        newStatus
      });

      return updatedSchedule;
    } catch (error) {
      logError('Error updating PM schedule status', { error: error.message });
      throw error;
    }
  }

  /**
   * Search PM schedules
   * @param {Object} filters - Search filters
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Search results
   */
  async searchSchedules(filters = {}, options = {}) {
    try {
      const {
        status,
        frequency,
        equipmentType,
        assignedToId,
        searchTerm
      } = filters;

      const { limit = 100, offset = 0 } = options;

      let query = db.collection(this.collectionName);

      if (status) {
        query = query.where('status', '==', status);
      }

      if (frequency) {
        query = query.where('frequency', '==', frequency);
      }

      if (equipmentType) {
        query = query.where('equipmentType', '==', equipmentType);
      }

      if (assignedToId) {
        query = query.where('assignedToId', '==', assignedToId);
      }

      query = query.orderBy('nextDueDate').limit(limit).offset(offset);

      const snapshot = await query.get();
      let schedules = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Client-side search term filtering
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        schedules = schedules.filter(
          schedule =>
            schedule.title.toLowerCase().includes(term) ||
            schedule.scheduleId.toLowerCase().includes(term) ||
            schedule.equipmentName?.toLowerCase().includes(term)
        );
      }

      return {
        schedules,
        total: schedules.length,
        limit,
        offset
      };
    } catch (error) {
      logError('Error searching PM schedules', { error: error.message });
      throw error;
    }
  }

  /**
   * Get schedule statistics
   * @returns {Promise<Object>} Statistics
   */
  async getStatistics() {
    try {
      const snapshot = await db.collection(this.collectionName).get();

      const stats = {
        total: snapshot.size,
        active: 0,
        inactive: 0,
        byFrequency: {},
        totalCompleted: 0,
        totalOverdue: 0,
        averageComplianceRate: 0
      };

      let complianceRateSum = 0;
      let complianceRateCount = 0;

      snapshot.docs.forEach(doc => {
        const data = doc.data();

        // Count by status
        if (data.status === SCHEDULE_STATUS.ACTIVE) {
          stats.active++;
        } else {
          stats.inactive++;
        }

        // Count by frequency
        if (!stats.byFrequency[data.frequency]) {
          stats.byFrequency[data.frequency] = 0;
        }
        stats.byFrequency[data.frequency]++;

        // Sum metrics
        stats.totalCompleted += data.totalCompleted || 0;
        stats.totalOverdue += data.totalOverdue || 0;

        if (data.complianceRate !== undefined && data.totalCompleted > 0) {
          complianceRateSum += data.complianceRate;
          complianceRateCount++;
        }
      });

      // Calculate average compliance rate
      if (complianceRateCount > 0) {
        stats.averageComplianceRate = Math.round(
          complianceRateSum / complianceRateCount
        );
      }

      return stats;
    } catch (error) {
      logError('Error getting PM statistics', { error: error.message });
      throw error;
    }
  }
}

// Export singleton instance
export const pmScheduleService = new PMScheduleService();

export default PMScheduleService;
