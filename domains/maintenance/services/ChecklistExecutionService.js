/**
 * Checklist Execution Service
 * Manages checklist execution on work orders
 */

import { db } from '../../../config/firebase.js';
import { COLLECTIONS } from '../../../config/constants.js';
import {
  CHECKLIST_ITEM_TYPE,
  CHECKLIST_ITEM_STATUS
} from '../../preventive-maintenance/config.js';
import { checklistTemplateService } from '../../preventive-maintenance/services/ChecklistTemplateService.js';
import { ValidationError, NotFoundError } from '../../../shared/errors/AppError.js';
import { logInfo, logError, logWarning } from '../../../shared/utils/logger.js';
import { activityLogService } from '../../../shared/services/ActivityLogService.js';

/**
 * Checklist Execution Service
 * Handles checklist attachment, execution, and validation on work orders
 */
class ChecklistExecutionService {
  /**
   * Attach checklist to work order
   * @param {string} workOrderId - Work order ID
   * @param {string} templateId - Checklist template ID
   * @param {Object} user - User attaching checklist
   * @returns {Promise<Object>} Work order with checklist
   */
  async attachChecklist(workOrderId, templateId, user) {
    try {
      const workOrderRef = db.collection(COLLECTIONS.WORK_ORDERS).doc(workOrderId);
      const workOrderDoc = await workOrderRef.get();

      if (!workOrderDoc.exists) {
        throw new NotFoundError('Work order not found');
      }

      const workOrder = workOrderDoc.data();

      // Check if checklist already exists
      if (workOrder.checklist) {
        throw new ValidationError('Work order already has a checklist attached');
      }

      // Get template
      const template = await checklistTemplateService.findById(templateId);

      if (!template) {
        throw new NotFoundError('Checklist template not found');
      }

      if (!template.isActive) {
        throw new ValidationError('Cannot attach inactive checklist template');
      }

      // Create checklist instance from template
      const checklist = {
        templateId: template.id,
        templateName: template.name,
        templateVersion: template.version,
        category: template.category,
        estimatedDurationMinutes: template.estimatedDurationMinutes || 0,
        items: template.items.map(item => ({
          order: item.order,
          description: item.description,
          type: item.type,
          requiresMeasurement: item.requiresMeasurement || false,
          measurementUnit: item.measurementUnit || null,
          expectedRange: item.expectedRange || null,
          instructions: item.instructions || '',
          safetyNotes: item.safetyNotes || '',
          isRequired: item.isRequired !== false,
          failureCritical: item.failureCritical || false,

          // Execution fields
          status: CHECKLIST_ITEM_STATUS.PENDING,
          completedAt: null,
          completedBy: null,
          completedByName: null,
          measurementValue: null,
          measurementWithinRange: null,
          notes: '',
          photos: []
        })),
        attachedAt: new Date(),
        attachedBy: user.uid || user.id,
        attachedByName: user.displayName || user.name || user.email,
        startedAt: null,
        completedAt: null,
        totalItems: template.items.length,
        completedItems: 0,
        progress: 0
      };

      // Update work order
      await workOrderRef.update({
        checklist,
        updatedAt: new Date()
      });

      // Increment template usage count
      await checklistTemplateService.incrementUsageCount(templateId);

      // Log activity
      await activityLogService.logWorkOrderActivity(
        workOrderId,
        'CHECKLIST_ATTACHED',
        user,
        {
          description: `Checklist "${template.name}" attached to work order`,
          metadata: { templateId, templateName: template.name, itemCount: template.items.length }
        }
      );

      logInfo('Checklist attached to work order', {
        workOrderId: workOrder.workOrderId,
        templateId,
        itemCount: template.items.length
      });

      return { ...workOrder, checklist };
    } catch (error) {
      logError('Error attaching checklist', { error: error.message });
      throw error;
    }
  }

  /**
   * Start checklist execution
   * @param {string} workOrderId - Work order ID
   * @param {Object} user - User starting checklist
   * @returns {Promise<Object>} Updated work order
   */
  async startChecklistExecution(workOrderId, user) {
    try {
      const workOrderRef = db.collection(COLLECTIONS.WORK_ORDERS).doc(workOrderId);
      const workOrderDoc = await workOrderRef.get();

      if (!workOrderDoc.exists) {
        throw new NotFoundError('Work order not found');
      }

      const workOrder = workOrderDoc.data();

      if (!workOrder.checklist) {
        throw new ValidationError('No checklist attached to work order');
      }

      if (workOrder.checklist.startedAt) {
        throw new ValidationError('Checklist execution already started');
      }

      await workOrderRef.update({
        'checklist.startedAt': new Date(),
        updatedAt: new Date()
      });

      logInfo('Checklist execution started', {
        workOrderId: workOrder.workOrderId
      });

      return { ...workOrder, checklist: { ...workOrder.checklist, startedAt: new Date() } };
    } catch (error) {
      logError('Error starting checklist execution', { error: error.message });
      throw error;
    }
  }

  /**
   * Complete checklist item
   * @param {string} workOrderId - Work order ID
   * @param {number} itemOrder - Item order number
   * @param {Object} itemData - Item completion data
   * @param {Object} user - User completing item
   * @returns {Promise<Object>} Updated work order
   */
  async completeChecklistItem(workOrderId, itemOrder, itemData, user) {
    try {
      const workOrderRef = db.collection(COLLECTIONS.WORK_ORDERS).doc(workOrderId);
      const workOrderDoc = await workOrderRef.get();

      if (!workOrderDoc.exists) {
        throw new NotFoundError('Work order not found');
      }

      const workOrder = workOrderDoc.data();

      if (!workOrder.checklist) {
        throw new ValidationError('No checklist attached to work order');
      }

      // Find item by order
      const itemIndex = workOrder.checklist.items.findIndex(
        item => item.order === itemOrder
      );

      if (itemIndex === -1) {
        throw new NotFoundError(`Checklist item ${itemOrder} not found`);
      }

      const item = workOrder.checklist.items[itemIndex];

      // Validate item status
      const validStatuses = [
        CHECKLIST_ITEM_STATUS.COMPLETED,
        CHECKLIST_ITEM_STATUS.SKIPPED,
        CHECKLIST_ITEM_STATUS.FAILED,
        CHECKLIST_ITEM_STATUS.NOT_APPLICABLE
      ];

      if (!validStatuses.includes(itemData.status)) {
        throw new ValidationError(
          `Invalid item status. Must be one of: ${validStatuses.join(', ')}`
        );
      }

      // Validate measurement if required
      if (
        item.requiresMeasurement &&
        itemData.status === CHECKLIST_ITEM_STATUS.COMPLETED
      ) {
        if (
          itemData.measurementValue === null ||
          itemData.measurementValue === undefined
        ) {
          throw new ValidationError('Measurement value is required for this item');
        }

        // Check if measurement is within expected range
        if (item.expectedRange) {
          const { min, max } = item.expectedRange;
          const value = parseFloat(itemData.measurementValue);

          const withinRange = value >= min && value <= max;

          itemData.measurementWithinRange = withinRange;

          // If measurement is out of range and item is critical, mark as failed
          if (!withinRange && item.failureCritical) {
            itemData.status = CHECKLIST_ITEM_STATUS.FAILED;
            logWarning('Critical measurement out of range', {
              workOrderId: workOrder.workOrderId,
              itemOrder,
              value,
              expectedRange: item.expectedRange
            });
          }
        }
      }

      // Validate required items
      if (
        item.isRequired &&
        (itemData.status === CHECKLIST_ITEM_STATUS.SKIPPED ||
          itemData.status === CHECKLIST_ITEM_STATUS.NOT_APPLICABLE)
      ) {
        throw new ValidationError('Required items cannot be skipped or marked N/A');
      }

      // Safety check items must be completed
      if (
        item.type === CHECKLIST_ITEM_TYPE.SAFETY_CHECK &&
        itemData.status !== CHECKLIST_ITEM_STATUS.COMPLETED
      ) {
        throw new ValidationError('Safety check items must be completed');
      }

      // Update item
      const now = new Date();
      const updatedItems = [...workOrder.checklist.items];
      updatedItems[itemIndex] = {
        ...item,
        status: itemData.status,
        completedAt: now,
        completedBy: user.uid || user.id,
        completedByName: user.displayName || user.name || user.email,
        measurementValue: itemData.measurementValue || null,
        measurementWithinRange: itemData.measurementWithinRange || null,
        notes: itemData.notes || '',
        photos: itemData.photos || []
      };

      // Calculate progress
      const completedItems = updatedItems.filter(
        i => i.status !== CHECKLIST_ITEM_STATUS.PENDING
      ).length;
      const progress = Math.round((completedItems / updatedItems.length) * 100);

      // Update work order
      await workOrderRef.update({
        'checklist.items': updatedItems,
        'checklist.completedItems': completedItems,
        'checklist.progress': progress,
        updatedAt: now
      });

      logInfo('Checklist item completed', {
        workOrderId: workOrder.workOrderId,
        itemOrder,
        status: itemData.status,
        progress
      });

      return {
        ...workOrder,
        checklist: {
          ...workOrder.checklist,
          items: updatedItems,
          completedItems,
          progress
        }
      };
    } catch (error) {
      logError('Error completing checklist item', { error: error.message });
      throw error;
    }
  }

  /**
   * Complete entire checklist
   * @param {string} workOrderId - Work order ID
   * @param {Object} user - User completing checklist
   * @returns {Promise<Object>} Updated work order
   */
  async completeChecklist(workOrderId, user) {
    try {
      const workOrderRef = db.collection(COLLECTIONS.WORK_ORDERS).doc(workOrderId);
      const workOrderDoc = await workOrderRef.get();

      if (!workOrderDoc.exists) {
        throw new NotFoundError('Work order not found');
      }

      const workOrder = workOrderDoc.data();

      if (!workOrder.checklist) {
        throw new ValidationError('No checklist attached to work order');
      }

      // Validate all required items are completed
      const incompletedRequiredItems = workOrder.checklist.items.filter(
        item =>
          item.isRequired && item.status === CHECKLIST_ITEM_STATUS.PENDING
      );

      if (incompletedRequiredItems.length > 0) {
        throw new ValidationError(
          `${incompletedRequiredItems.length} required checklist items are not completed`
        );
      }

      // Validate all safety checks are completed
      const incompletedSafetyChecks = workOrder.checklist.items.filter(
        item =>
          item.type === CHECKLIST_ITEM_TYPE.SAFETY_CHECK &&
          item.status !== CHECKLIST_ITEM_STATUS.COMPLETED
      );

      if (incompletedSafetyChecks.length > 0) {
        throw new ValidationError(
          `${incompletedSafetyChecks.length} safety check items must be completed`
        );
      }

      const now = new Date();

      await workOrderRef.update({
        'checklist.completedAt': now,
        updatedAt: now
      });

      // Log activity
      await activityLogService.logWorkOrderActivity(
        workOrderId,
        'CHECKLIST_COMPLETED',
        user,
        {
          description: `Checklist "${workOrder.checklist.templateName}" completed`,
          metadata: {
            templateId: workOrder.checklist.templateId,
            totalItems: workOrder.checklist.totalItems,
            completedItems: workOrder.checklist.completedItems
          }
        }
      );

      logInfo('Checklist completed', {
        workOrderId: workOrder.workOrderId,
        templateName: workOrder.checklist.templateName,
        completedItems: workOrder.checklist.completedItems
      });

      return {
        ...workOrder,
        checklist: {
          ...workOrder.checklist,
          completedAt: now
        }
      };
    } catch (error) {
      logError('Error completing checklist', { error: error.message });
      throw error;
    }
  }

  /**
   * Validate work order can be completed
   * Ensures mandatory checklists are completed
   * @param {string} workOrderId - Work order ID
   * @returns {Promise<Object>} Validation result
   */
  async validateWorkOrderCompletion(workOrderId) {
    try {
      const workOrderRef = db.collection(COLLECTIONS.WORK_ORDERS).doc(workOrderId);
      const workOrderDoc = await workOrderRef.get();

      if (!workOrderDoc.exists) {
        throw new NotFoundError('Work order not found');
      }

      const workOrder = workOrderDoc.data();

      // If no checklist, validation passes
      if (!workOrder.checklist) {
        return { valid: true, errors: [] };
      }

      const errors = [];

      // Check if checklist is completed
      if (!workOrder.checklist.completedAt) {
        errors.push('Checklist must be completed before closing work order');
      }

      // Check for failed critical items
      const failedCriticalItems = workOrder.checklist.items.filter(
        item => item.failureCritical && item.status === CHECKLIST_ITEM_STATUS.FAILED
      );

      if (failedCriticalItems.length > 0) {
        errors.push(
          `${failedCriticalItems.length} critical checklist items failed. Work order cannot be completed.`
        );
      }

      // Check for incomplete required items
      const incompleteRequiredItems = workOrder.checklist.items.filter(
        item =>
          item.isRequired && item.status === CHECKLIST_ITEM_STATUS.PENDING
      );

      if (incompleteRequiredItems.length > 0) {
        errors.push(
          `${incompleteRequiredItems.length} required checklist items are incomplete`
        );
      }

      // Check for incomplete safety checks
      const incompleteSafetyChecks = workOrder.checklist.items.filter(
        item =>
          item.type === CHECKLIST_ITEM_TYPE.SAFETY_CHECK &&
          item.status !== CHECKLIST_ITEM_STATUS.COMPLETED
      );

      if (incompleteSafetyChecks.length > 0) {
        errors.push(
          `${incompleteSafetyChecks.length} safety check items must be completed`
        );
      }

      return {
        valid: errors.length === 0,
        errors
      };
    } catch (error) {
      logError('Error validating work order completion', { error: error.message });
      throw error;
    }
  }

  /**
   * Get checklist statistics for work order
   * @param {string} workOrderId - Work order ID
   * @returns {Promise<Object>} Checklist statistics
   */
  async getChecklistStatistics(workOrderId) {
    try {
      const workOrderRef = db.collection(COLLECTIONS.WORK_ORDERS).doc(workOrderId);
      const workOrderDoc = await workOrderRef.get();

      if (!workOrderDoc.exists) {
        throw new NotFoundError('Work order not found');
      }

      const workOrder = workOrderDoc.data();

      if (!workOrder.checklist) {
        return null;
      }

      const { items } = workOrder.checklist;

      const stats = {
        total: items.length,
        completed: items.filter(i => i.status === CHECKLIST_ITEM_STATUS.COMPLETED)
          .length,
        failed: items.filter(i => i.status === CHECKLIST_ITEM_STATUS.FAILED).length,
        skipped: items.filter(i => i.status === CHECKLIST_ITEM_STATUS.SKIPPED).length,
        notApplicable: items.filter(
          i => i.status === CHECKLIST_ITEM_STATUS.NOT_APPLICABLE
        ).length,
        pending: items.filter(i => i.status === CHECKLIST_ITEM_STATUS.PENDING).length,
        required: items.filter(i => i.isRequired).length,
        safetyChecks: items.filter(i => i.type === CHECKLIST_ITEM_TYPE.SAFETY_CHECK)
          .length,
        measurementsOutOfRange: items.filter(
          i => i.measurementWithinRange === false
        ).length,
        progress: workOrder.checklist.progress,
        isComplete: workOrder.checklist.completedAt !== null
      };

      return stats;
    } catch (error) {
      logError('Error getting checklist statistics', { error: error.message });
      throw error;
    }
  }

  /**
   * Remove checklist from work order
   * @param {string} workOrderId - Work order ID
   * @param {Object} user - User removing checklist
   * @returns {Promise<Object>} Updated work order
   */
  async removeChecklist(workOrderId, user) {
    try {
      const workOrderRef = db.collection(COLLECTIONS.WORK_ORDERS).doc(workOrderId);
      const workOrderDoc = await workOrderRef.get();

      if (!workOrderDoc.exists) {
        throw new NotFoundError('Work order not found');
      }

      const workOrder = workOrderDoc.data();

      if (!workOrder.checklist) {
        throw new ValidationError('No checklist attached to work order');
      }

      // Don't allow removal if checklist has started
      if (workOrder.checklist.startedAt) {
        throw new ValidationError('Cannot remove checklist after execution has started');
      }

      await workOrderRef.update({
        checklist: null,
        updatedAt: new Date()
      });

      // Log activity
      await activityLogService.logWorkOrderActivity(
        workOrderId,
        'CHECKLIST_REMOVED',
        user,
        {
          description: `Checklist "${workOrder.checklist.templateName}" removed from work order`,
          metadata: { templateId: workOrder.checklist.templateId }
        }
      );

      logInfo('Checklist removed from work order', {
        workOrderId: workOrder.workOrderId
      });

      return { ...workOrder, checklist: null };
    } catch (error) {
      logError('Error removing checklist', { error: error.message });
      throw error;
    }
  }
}

// Export singleton instance
export const checklistExecutionService = new ChecklistExecutionService();

export default ChecklistExecutionService;
