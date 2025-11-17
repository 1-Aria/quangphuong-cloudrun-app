/**
 * PM Work Order Generator
 * Automatically generates work orders from PM schedules
 */

import { workOrderService } from '../../work-orders/services/WorkOrderService.js';
import { pmScheduleService } from './PMScheduleService.js';
import { WORK_ORDER_TYPE } from '../../work-orders/config.js';
import { logInfo, logError, logWarning } from '../../../shared/utils/logger.js';

/**
 * PM Work Order Generator
 * Handles automatic generation of work orders from PM schedules
 */
class PMWorkOrderGenerator {
  /**
   * Generate work order from PM schedule
   * @param {Object} schedule - PM schedule
   * @param {Object} systemUser - System user for automated actions
   * @returns {Promise<Object>} Generated work order
   */
  async generateWorkOrder(schedule, systemUser) {
    try {
      // Prepare work order data from schedule
      const workOrderData = {
        title: schedule.title,
        description: this.generateDescription(schedule),
        type: WORK_ORDER_TYPE.PREVENTIVE,
        priority: schedule.priority,

        // Equipment
        equipmentId: schedule.equipmentId,

        // Assignment
        assignedToId: schedule.assignedToId,
        assignedToName: schedule.assignedToName,

        // Scheduling
        dueDate: schedule.nextDueDate,
        estimatedDurationHours: schedule.estimatedDurationHours,

        // Checklist
        checklist: this.prepareChecklist(schedule.checklist),

        // Parts
        partsRequested: schedule.requiredParts || [],

        // PM Reference
        pmScheduleId: schedule.id,
        pmScheduleRef: schedule.scheduleId,

        // Source
        source: 'PM Schedule - Auto Generated'
      };

      // Create work order
      const workOrder = await workOrderService.createWorkOrder(
        workOrderData,
        systemUser
      );

      // Update schedule metrics
      await pmScheduleService.update(schedule.id, {
        totalScheduled: (schedule.totalScheduled || 0) + 1,
        lastGeneratedWorkOrderId: workOrder.workOrderId,
        lastGeneratedDate: new Date()
      });

      logInfo('PM work order generated', {
        scheduleId: schedule.scheduleId,
        workOrderId: workOrder.workOrderId,
        equipmentId: schedule.equipmentId
      });

      return workOrder;
    } catch (error) {
      logError('Error generating PM work order', {
        scheduleId: schedule.scheduleId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate description from schedule
   * @param {Object} schedule - PM schedule
   * @returns {string} Description
   */
  generateDescription(schedule) {
    let description = schedule.description || '';

    description += `\n\n--- Preventive Maintenance ---`;
    description += `\nSchedule: ${schedule.scheduleId}`;
    description += `\nFrequency: ${schedule.frequency}`;
    description += `\nEquipment: ${schedule.equipmentName}`;

    if (schedule.lastCompletedDate) {
      description += `\nLast Completed: ${new Date(
        schedule.lastCompletedDate
      ).toLocaleDateString()}`;
    }

    return description.trim();
  }

  /**
   * Prepare checklist for work order
   * @param {Array} checklistItems - Checklist items from schedule
   * @returns {Array} Prepared checklist
   */
  prepareChecklist(checklistItems = []) {
    return checklistItems.map(item => ({
      description: item.description,
      type: item.type,
      status: 'Pending',
      requiresMeasurement: item.requiresMeasurement,
      measurementUnit: item.measurementUnit,
      expectedRange: item.expectedRange,
      instructions: item.instructions,
      safetyNotes: item.safetyNotes,
      isRequired: item.isRequired,
      completedAt: null,
      completedBy: null,
      actualValue: null,
      notes: null
    }));
  }

  /**
   * Process due schedules and generate work orders
   * @param {Object} systemUser - System user for automated actions
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Processing results
   */
  async processDueSchedules(systemUser, options = {}) {
    try {
      const { limit = 50, dryRun = false } = options;

      // Get due schedules
      const dueSchedules = await pmScheduleService.getDueSchedules({ limit });

      const results = {
        processed: 0,
        generated: 0,
        skipped: 0,
        errors: 0,
        workOrders: [],
        errors_detail: []
      };

      logInfo('Processing due PM schedules', {
        count: dueSchedules.length,
        dryRun
      });

      for (const schedule of dueSchedules) {
        results.processed++;

        try {
          // Check if schedule is still valid
          if (!schedule.isActive || !schedule.autoGenerateWorkOrder) {
            results.skipped++;
            logWarning('Skipping inactive schedule', {
              scheduleId: schedule.scheduleId
            });
            continue;
          }

          // Check if work order already generated for this due date
          if (
            schedule.lastGeneratedDate &&
            schedule.nextDueDate &&
            new Date(schedule.lastGeneratedDate) >=
              new Date(schedule.nextDueDate)
          ) {
            results.skipped++;
            logWarning('Work order already generated for this due date', {
              scheduleId: schedule.scheduleId
            });
            continue;
          }

          if (!dryRun) {
            // Generate work order
            const workOrder = await this.generateWorkOrder(schedule, systemUser);
            results.generated++;
            results.workOrders.push(workOrder);
          } else {
            // Dry run - just count
            results.generated++;
            results.workOrders.push({
              scheduleId: schedule.scheduleId,
              title: schedule.title,
              dryRun: true
            });
          }
        } catch (error) {
          results.errors++;
          results.errors_detail.push({
            scheduleId: schedule.scheduleId,
            error: error.message
          });
          logError('Error processing PM schedule', {
            scheduleId: schedule.scheduleId,
            error: error.message
          });
        }
      }

      logInfo('PM schedule processing complete', results);

      return results;
    } catch (error) {
      logError('Error processing due schedules', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate work orders for specific schedule
   * @param {string} scheduleId - Schedule ID
   * @param {Object} systemUser - System user
   * @returns {Promise<Object>} Generated work order
   */
  async generateForSchedule(scheduleId, systemUser) {
    try {
      const schedule = await pmScheduleService.findById(scheduleId);

      if (!schedule) {
        throw new Error('PM schedule not found');
      }

      if (!schedule.isActive) {
        throw new Error('Schedule is not active');
      }

      return await this.generateWorkOrder(schedule, systemUser);
    } catch (error) {
      logError('Error generating work order for schedule', {
        scheduleId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Batch generate work orders for multiple schedules
   * @param {Array<string>} scheduleIds - Schedule IDs
   * @param {Object} systemUser - System user
   * @returns {Promise<Object>} Batch results
   */
  async batchGenerate(scheduleIds, systemUser) {
    try {
      const results = {
        processed: scheduleIds.length,
        generated: 0,
        errors: 0,
        workOrders: [],
        errors_detail: []
      };

      for (const scheduleId of scheduleIds) {
        try {
          const workOrder = await this.generateForSchedule(
            scheduleId,
            systemUser
          );
          results.generated++;
          results.workOrders.push(workOrder);
        } catch (error) {
          results.errors++;
          results.errors_detail.push({
            scheduleId,
            error: error.message
          });
        }
      }

      logInfo('Batch PM generation complete', results);

      return results;
    } catch (error) {
      logError('Error in batch generation', { error: error.message });
      throw error;
    }
  }
}

// Export singleton instance
export const pmWorkOrderGenerator = new PMWorkOrderGenerator();

export default PMWorkOrderGenerator;
