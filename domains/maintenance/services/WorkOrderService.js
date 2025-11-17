/**
 * Work Order Service
 * Business logic for CMMS work order management
 */

import { BaseService } from '../../../shared/services/BaseService.js';
import { MAINTENANCE_CONFIG, MAINTENANCE_STATUS, MAINTENANCE_ACTIONS } from '../config.js';
import { validateTransition, getNextStatus } from '../../../shared/utils/statusValidator.js';
import { generateWorkOrderId } from '../../../shared/utils/idGenerator.js';
import { calculateResponseDeadline, calculateCompletionDeadline } from '../../../shared/utils/slaCalculator.js';
import { activityLogService, ACTIVITY_TYPES } from '../../../shared/services/ActivityLogService.js';
import { slaService } from '../../sla/services/SLAService.js';
import { checklistExecutionService } from './ChecklistExecutionService.js';
import { ValidationError, NotFoundError } from '../../../shared/errors/AppError.js';
import { logInfo, logError } from '../../../shared/utils/logger.js';

/**
 * Work Order Service
 * Handles all work order business logic with state machine enforcement
 */
class WorkOrderService extends BaseService {
  constructor() {
    super(MAINTENANCE_CONFIG.collection);
    this.config = MAINTENANCE_CONFIG;
  }

  /**
   * Create a new work order in Draft status
   * @param {Object} data - Work order data
   * @param {Object} user - User creating the work order
   * @returns {Promise<Object>} Created work order
   */
  async createDraft(data, user) {
    // Validate required fields for draft
    const requiredFields = this.config.requiredFields.draft;
    const missingFields = requiredFields.filter(field => !data[field]);

    if (missingFields.length > 0) {
      throw new ValidationError(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Generate custom work order ID
    const workOrderId = await generateWorkOrderId();

    // Prepare work order document
    const workOrder = {
      workOrderId,
      ...data,
      status: this.config.initialStatus,
      requestedBy: user.uid || user.id,
      requestedByName: user.displayName || user.name || user.email,
      statusHistory: [{
        from: null,
        to: this.config.initialStatus,
        changedBy: user.uid || user.id,
        changedAt: new Date(),
        reason: 'Work order created'
      }],
      comments: [],
      attachments: [],
      partsRequired: [],
      checklistItems: [],

      // Labor and downtime tracking
      actualStartAt: null,
      actualEndAt: null,
      laborHours: 0,
      estimatedDowntimeMinutes: data.estimatedDowntimeMinutes || 0,
      downtimeMinutes: 0,

      // Impact and root cause
      impact: data.impact || null,
      rootCause: null,
      resolutionSummary: null,

      // Related tickets
      relatedTickets: [],
      reopenCount: 0
    };

    // Initialize SLA
    const sla = slaService.initializeSLA(workOrder);
    workOrder.sla = sla;

    // Create the work order
    const created = await this.create(workOrder);

    // Log activity
    await activityLogService.logWorkOrderActivity(
      created.id,
      ACTIVITY_TYPES.WO_CREATED,
      user,
      { description: `Work order ${workOrderId} created in draft status` }
    );

    logInfo('Work order created', { workOrderId, status: this.config.initialStatus });

    return created;
  }

  /**
   * Submit work order for approval
   * @param {string} id - Work order ID
   * @param {Object} user - User submitting
   * @returns {Promise<Object>} Updated work order
   */
  async submitWorkOrder(id, user) {
    const workOrder = await this.findById(id);
    if (!workOrder) throw new NotFoundError('Work Order');

    // Validate required fields for submitted status
    const requiredFields = this.config.requiredFields.submitted;
    const missingFields = requiredFields.filter(field => !workOrder[field]);

    if (missingFields.length > 0) {
      throw new ValidationError(`Cannot submit. Missing required fields: ${missingFields.join(', ')}`);
    }

    // Validate state transition
    validateTransition(MAINTENANCE_ACTIONS.SUBMIT_WO, workOrder.status, this.config);

    const nextStatus = getNextStatus(MAINTENANCE_ACTIONS.SUBMIT_WO, workOrder.status, this.config);
    const now = new Date();

    // Calculate SLA response deadline
    const slaResponseDeadline = calculateResponseDeadline(
      now,
      workOrder.priority,
      workOrder.type
    );

    // Update work order
    const updated = await this.update(id, {
      status: nextStatus,
      submittedAt: now,
      slaResponseDeadline,
      statusHistory: [
        ...workOrder.statusHistory,
        {
          from: workOrder.status,
          to: nextStatus,
          changedBy: user.uid || user.id,
          changedAt: now,
          reason: 'Submitted for approval'
        }
      ]
    });

    // Log activity
    await activityLogService.logWorkOrderActivity(
      id,
      ACTIVITY_TYPES.WO_SUBMITTED,
      user,
      {
        description: `Work order ${workOrder.workOrderId} submitted for approval`,
        changes: { before: { status: workOrder.status }, after: { status: nextStatus } }
      }
    );

    return updated;
  }

  /**
   * Approve work order
   * @param {string} id - Work order ID
   * @param {Object} user - User approving
   * @param {Object} approvalData - Approval data (estimatedHours, etc.)
   * @returns {Promise<Object>} Updated work order
   */
  async approveWorkOrder(id, user, approvalData = {}) {
    const workOrder = await this.findById(id);
    if (!workOrder) throw new NotFoundError('Work Order');

    // Validate state transition
    validateTransition(MAINTENANCE_ACTIONS.APPROVE_WO, workOrder.status, this.config);

    const nextStatus = getNextStatus(MAINTENANCE_ACTIONS.APPROVE_WO, workOrder.status, this.config);
    const now = new Date();

    // Calculate SLA completion deadline
    const slaCompletionDeadline = calculateCompletionDeadline(
      now,
      workOrder.priority,
      workOrder.type
    );

    // Update work order
    const updated = await this.update(id, {
      status: nextStatus,
      approvedAt: now,
      approvedBy: user.uid || user.id,
      approvedByName: user.displayName || user.name || user.email,
      slaCompletionDeadline,
      estimatedHours: approvalData.estimatedHours || workOrder.estimatedHours,
      statusHistory: [
        ...workOrder.statusHistory,
        {
          from: workOrder.status,
          to: nextStatus,
          changedBy: user.uid || user.id,
          changedAt: now,
          reason: approvalData.reason || 'Work order approved'
        }
      ]
    });

    // Log activity
    await activityLogService.logWorkOrderActivity(
      id,
      ACTIVITY_TYPES.WO_APPROVED,
      user,
      {
        description: `Work order ${workOrder.workOrderId} approved`,
        changes: { before: { status: workOrder.status }, after: { status: nextStatus } }
      }
    );

    return updated;
  }

  /**
   * Reject work order (send back to draft)
   * @param {string} id - Work order ID
   * @param {Object} user - User rejecting
   * @param {string} reason - Rejection reason
   * @returns {Promise<Object>} Updated work order
   */
  async rejectWorkOrder(id, user, reason) {
    const workOrder = await this.findById(id);
    if (!workOrder) throw new NotFoundError('Work Order');

    validateTransition(MAINTENANCE_ACTIONS.REJECT_WO, workOrder.status, this.config);

    const nextStatus = getNextStatus(MAINTENANCE_ACTIONS.REJECT_WO, workOrder.status, this.config);
    const now = new Date();

    const updated = await this.update(id, {
      status: nextStatus,
      statusHistory: [
        ...workOrder.statusHistory,
        {
          from: workOrder.status,
          to: nextStatus,
          changedBy: user.uid || user.id,
          changedAt: now,
          reason: reason || 'Work order rejected'
        }
      ]
    });

    await activityLogService.logWorkOrderActivity(
      id,
      ACTIVITY_TYPES.WO_REJECTED,
      user,
      {
        description: `Work order ${workOrder.workOrderId} rejected`,
        metadata: { reason }
      }
    );

    return updated;
  }

  /**
   * Assign work order to a technician
   * @param {string} id - Work order ID
   * @param {Object} user - User assigning
   * @param {string} technicianId - Technician user ID
   * @param {string} technicianName - Technician name
   * @returns {Promise<Object>} Updated work order
   */
  async assignWorkOrder(id, user, technicianId, technicianName) {
    const workOrder = await this.findById(id);
    if (!workOrder) throw new NotFoundError('Work Order');

    validateTransition(MAINTENANCE_ACTIONS.ASSIGN_WO, workOrder.status, this.config);

    const nextStatus = getNextStatus(MAINTENANCE_ACTIONS.ASSIGN_WO, workOrder.status, this.config);
    const now = new Date();

    const updated = await this.update(id, {
      status: nextStatus,
      assignedTo: technicianId,
      assignedToName: technicianName,
      assignedAt: now,
      statusHistory: [
        ...workOrder.statusHistory,
        {
          from: workOrder.status,
          to: nextStatus,
          changedBy: user.uid || user.id,
          changedAt: now,
          reason: `Assigned to ${technicianName}`
        }
      ]
    });

    await activityLogService.logWorkOrderActivity(
      id,
      ACTIVITY_TYPES.WO_ASSIGNED,
      user,
      {
        description: `Work order ${workOrder.workOrderId} assigned to ${technicianName}`,
        metadata: { technicianId, technicianName }
      }
    );

    return updated;
  }

  /**
   * Reassign work order to different technician
   * @param {string} id - Work order ID
   * @param {Object} user - User reassigning
   * @param {string} technicianId - New technician user ID
   * @param {string} technicianName - New technician name
   * @param {string} reason - Reassignment reason
   * @returns {Promise<Object>} Updated work order
   */
  async reassignWorkOrder(id, user, technicianId, technicianName, reason) {
    const workOrder = await this.findById(id);
    if (!workOrder) throw new NotFoundError('Work Order');

    validateTransition(MAINTENANCE_ACTIONS.REASSIGN_WO, workOrder.status, this.config);

    const nextStatus = getNextStatus(MAINTENANCE_ACTIONS.REASSIGN_WO, workOrder.status, this.config);
    const now = new Date();

    const previousTechnician = workOrder.assignedToName;

    const updated = await this.update(id, {
      status: nextStatus,
      assignedTo: technicianId,
      assignedToName: technicianName,
      assignedAt: now,
      statusHistory: [
        ...workOrder.statusHistory,
        {
          from: workOrder.status,
          to: nextStatus,
          changedBy: user.uid || user.id,
          changedAt: now,
          reason: reason || `Reassigned from ${previousTechnician} to ${technicianName}`
        }
      ]
    });

    await activityLogService.logWorkOrderActivity(
      id,
      ACTIVITY_TYPES.WO_REASSIGNED,
      user,
      {
        description: `Work order ${workOrder.workOrderId} reassigned to ${technicianName}`,
        metadata: { previousTechnician, newTechnician: technicianName, reason }
      }
    );

    return updated;
  }

  /**
   * Start work on work order
   * @param {string} id - Work order ID
   * @param {Object} user - Technician starting work
   * @returns {Promise<Object>} Updated work order
   */
  async startWork(id, user) {
    const workOrder = await this.findById(id);
    if (!workOrder) throw new NotFoundError('Work Order');

    validateTransition(MAINTENANCE_ACTIONS.START_WORK, workOrder.status, this.config);

    const nextStatus = getNextStatus(MAINTENANCE_ACTIONS.START_WORK, workOrder.status, this.config);
    const now = new Date();

    const updated = await this.update(id, {
      status: nextStatus,
      actualStartDate: now,
      startedAt: now,
      actualStartAt: now,  // Track actual start time for labor hours
      statusHistory: [
        ...workOrder.statusHistory,
        {
          from: workOrder.status,
          to: nextStatus,
          changedBy: user.uid || user.id,
          changedAt: now,
          reason: 'Work started'
        }
      ]
    });

    await activityLogService.logWorkOrderActivity(
      id,
      ACTIVITY_TYPES.WO_STARTED,
      user,
      { description: `Work started on ${workOrder.workOrderId}` }
    );

    return updated;
  }

  /**
   * Put work order on hold
   * @param {string} id - Work order ID
   * @param {Object} user - User putting on hold
   * @param {string} reason - Reason for hold
   * @returns {Promise<Object>} Updated work order
   */
  async putOnHold(id, user, reason) {
    const workOrder = await this.findById(id);
    if (!workOrder) throw new NotFoundError('Work Order');

    validateTransition(MAINTENANCE_ACTIONS.PUT_ON_HOLD, workOrder.status, this.config);

    const nextStatus = getNextStatus(MAINTENANCE_ACTIONS.PUT_ON_HOLD, workOrder.status, this.config);
    const now = new Date();

    const updated = await this.update(id, {
      status: nextStatus,
      statusHistory: [
        ...workOrder.statusHistory,
        {
          from: workOrder.status,
          to: nextStatus,
          changedBy: user.uid || user.id,
          changedAt: now,
          reason: reason || 'Work put on hold'
        }
      ]
    });

    // Pause SLA
    await slaService.pauseSLA(id);

    await activityLogService.logWorkOrderActivity(
      id,
      ACTIVITY_TYPES.WO_ON_HOLD,
      user,
      {
        description: `Work order ${workOrder.workOrderId} put on hold`,
        metadata: { reason }
      }
    );

    return updated;
  }

  /**
   * Resume work from hold
   * @param {string} id - Work order ID
   * @param {Object} user - User resuming work
   * @returns {Promise<Object>} Updated work order
   */
  async resumeWork(id, user) {
    const workOrder = await this.findById(id);
    if (!workOrder) throw new NotFoundError('Work Order');

    validateTransition(MAINTENANCE_ACTIONS.RESUME_WORK, workOrder.status, this.config);

    const nextStatus = getNextStatus(MAINTENANCE_ACTIONS.RESUME_WORK, workOrder.status, this.config);
    const now = new Date();

    const updated = await this.update(id, {
      status: nextStatus,
      statusHistory: [
        ...workOrder.statusHistory,
        {
          from: workOrder.status,
          to: nextStatus,
          changedBy: user.uid || user.id,
          changedAt: now,
          reason: 'Work resumed'
        }
      ]
    });

    // Resume SLA
    await slaService.resumeSLA(id);

    await activityLogService.logWorkOrderActivity(
      id,
      ACTIVITY_TYPES.WO_RESUMED,
      user,
      { description: `Work resumed on ${workOrder.workOrderId}` }
    );

    return updated;
  }

  /**
   * Request parts for work order
   * @param {string} id - Work order ID
   * @param {Object} user - User requesting parts
   * @param {Array} parts - Parts requested
   * @returns {Promise<Object>} Updated work order
   */
  async requestParts(id, user, parts) {
    const workOrder = await this.findById(id);
    if (!workOrder) throw new NotFoundError('Work Order');

    validateTransition(MAINTENANCE_ACTIONS.REQUEST_PARTS, workOrder.status, this.config);

    const nextStatus = getNextStatus(MAINTENANCE_ACTIONS.REQUEST_PARTS, workOrder.status, this.config);
    const now = new Date();

    const updated = await this.update(id, {
      status: nextStatus,
      partsRequired: parts,
      statusHistory: [
        ...workOrder.statusHistory,
        {
          from: workOrder.status,
          to: nextStatus,
          changedBy: user.uid || user.id,
          changedAt: now,
          reason: 'Parts requested'
        }
      ]
    });

    await activityLogService.logWorkOrderActivity(
      id,
      ACTIVITY_TYPES.WO_PARTS_REQUESTED,
      user,
      {
        description: `Parts requested for ${workOrder.workOrderId}`,
        metadata: { partsCount: parts.length, parts }
      }
    );

    return updated;
  }

  /**
   * Mark parts as received
   * @param {string} id - Work order ID
   * @param {Object} user - User receiving parts
   * @returns {Promise<Object>} Updated work order
   */
  async receiveParts(id, user) {
    const workOrder = await this.findById(id);
    if (!workOrder) throw new NotFoundError('Work Order');

    validateTransition(MAINTENANCE_ACTIONS.RECEIVE_PARTS, workOrder.status, this.config);

    const nextStatus = getNextStatus(MAINTENANCE_ACTIONS.RECEIVE_PARTS, workOrder.status, this.config);
    const now = new Date();

    const updated = await this.update(id, {
      status: nextStatus,
      statusHistory: [
        ...workOrder.statusHistory,
        {
          from: workOrder.status,
          to: nextStatus,
          changedBy: user.uid || user.id,
          changedAt: now,
          reason: 'Parts received, resuming work'
        }
      ]
    });

    await activityLogService.logWorkOrderActivity(
      id,
      ACTIVITY_TYPES.WO_PARTS_RECEIVED,
      user,
      { description: `Parts received for ${workOrder.workOrderId}` }
    );

    return updated;
  }

  /**
   * Complete work order
   * @param {string} id - Work order ID
   * @param {Object} user - User completing work
   * @param {Object} completionData - Completion data
   * @returns {Promise<Object>} Updated work order
   */
  async completeWork(id, user, completionData) {
    const workOrder = await this.findById(id);
    if (!workOrder) throw new NotFoundError('Work Order');

    validateTransition(MAINTENANCE_ACTIONS.COMPLETE_WORK, workOrder.status, this.config);

    // Validate checklist completion if checklist exists
    if (workOrder.checklist) {
      const validation = await checklistExecutionService.validateWorkOrderCompletion(id);
      if (!validation.valid) {
        throw new ValidationError(
          `Cannot complete work order: ${validation.errors.join(', ')}`
        );
      }
    }

    const nextStatus = getNextStatus(MAINTENANCE_ACTIONS.COMPLETE_WORK, workOrder.status, this.config);
    const now = new Date();

    // Calculate actual hours (laborHours)
    const actualStartAt = workOrder.actualStartAt || workOrder.actualStartDate;
    const laborHours = actualStartAt
      ? (now - new Date(actualStartAt)) / (1000 * 60 * 60)
      : 0;

    // Calculate downtime if provided
    const downtimeMinutes = completionData.downtimeMinutes || workOrder.estimatedDowntimeMinutes || 0;

    const updated = await this.update(id, {
      status: nextStatus,
      actualEndDate: now,
      actualEndAt: now,  // Track actual end time
      completedAt: now,
      completedBy: user.uid || user.id,
      completedByName: user.displayName || user.name || user.email,
      laborHours: Math.round(laborHours * 100) / 100,  // Round to 2 decimals
      downtimeMinutes,
      workPerformed: completionData.workPerformed || '',
      rootCause: completionData.rootCause || workOrder.rootCause || '',
      resolutionSummary: completionData.resolutionSummary || '',
      preventiveAction: completionData.preventiveAction || '',
      statusHistory: [
        ...workOrder.statusHistory,
        {
          from: workOrder.status,
          to: nextStatus,
          changedBy: user.uid || user.id,
          changedAt: now,
          reason: 'Work completed'
        }
      ]
    });

    await activityLogService.logWorkOrderActivity(
      id,
      ACTIVITY_TYPES.WO_COMPLETED,
      user,
      {
        description: `Work order ${workOrder.workOrderId} completed`,
        metadata: { actualHours }
      }
    );

    return updated;
  }

  /**
   * Close work order (final step)
   * @param {string} id - Work order ID
   * @param {Object} user - User closing
   * @returns {Promise<Object>} Updated work order
   */
  async closeWorkOrder(id, user) {
    const workOrder = await this.findById(id);
    if (!workOrder) throw new NotFoundError('Work Order');

    validateTransition(MAINTENANCE_ACTIONS.CLOSE_WO, workOrder.status, this.config);

    const nextStatus = getNextStatus(MAINTENANCE_ACTIONS.CLOSE_WO, workOrder.status, this.config);
    const now = new Date();

    // Calculate SLA compliance
    const slaResponseMet = workOrder.slaResponseDeadline
      ? new Date(workOrder.submittedAt) <= new Date(workOrder.slaResponseDeadline)
      : null;

    const slaCompletionMet = workOrder.slaCompletionDeadline
      ? now <= new Date(workOrder.slaCompletionDeadline)
      : null;

    const updated = await this.update(id, {
      status: nextStatus,
      closedAt: now,
      slaResponseMet,
      slaCompletionMet,
      statusHistory: [
        ...workOrder.statusHistory,
        {
          from: workOrder.status,
          to: nextStatus,
          changedBy: user.uid || user.id,
          changedAt: now,
          reason: 'Work order closed'
        }
      ]
    });

    await activityLogService.logWorkOrderActivity(
      id,
      ACTIVITY_TYPES.WO_CLOSED,
      user,
      {
        description: `Work order ${workOrder.workOrderId} closed`,
        metadata: { slaResponseMet, slaCompletionMet }
      }
    );

    return updated;
  }

  /**
   * Cancel work order
   * @param {string} id - Work order ID
   * @param {Object} user - User cancelling
   * @param {string} reason - Cancellation reason
   * @returns {Promise<Object>} Updated work order
   */
  async cancelWorkOrder(id, user, reason) {
    const workOrder = await this.findById(id);
    if (!workOrder) throw new NotFoundError('Work Order');

    validateTransition(MAINTENANCE_ACTIONS.CANCEL_WO, workOrder.status, this.config);

    const nextStatus = getNextStatus(MAINTENANCE_ACTIONS.CANCEL_WO, workOrder.status, this.config);
    const now = new Date();

    const updated = await this.update(id, {
      status: nextStatus,
      statusHistory: [
        ...workOrder.statusHistory,
        {
          from: workOrder.status,
          to: nextStatus,
          changedBy: user.uid || user.id,
          changedAt: now,
          reason: reason || 'Work order cancelled'
        }
      ]
    });

    await activityLogService.logWorkOrderActivity(
      id,
      ACTIVITY_TYPES.WO_CANCELLED,
      user,
      {
        description: `Work order ${workOrder.workOrderId} cancelled`,
        metadata: { reason }
      }
    );

    return updated;
  }

  /**
   * Reopen work order (after closure)
   * @param {string} id - Work order ID
   * @param {Object} user - User reopening
   * @param {string} reason - Reopen reason
   * @returns {Promise<Object>} Updated work order
   */
  async reopenWorkOrder(id, user, reason) {
    const workOrder = await this.findById(id);
    if (!workOrder) throw new NotFoundError('Work Order');

    // Only closed work orders can be reopened
    if (workOrder.status !== MAINTENANCE_STATUS.CLOSED) {
      throw new ValidationError('Only closed work orders can be reopened');
    }

    const now = new Date();
    const reopenCount = (workOrder.reopenCount || 0) + 1;

    // Create a link to track this is a reopened ticket
    const previousWorkOrderId = workOrder.workOrderId;

    const updated = await this.update(id, {
      status: MAINTENANCE_STATUS.IN_PROGRESS,  // Reopen to IN_PROGRESS
      reopenCount,
      reopenedAt: now,
      reopenedBy: user.uid || user.id,
      reopenedByName: user.displayName || user.name || user.email,
      reopenReason: reason,
      previousWorkOrderRef: previousWorkOrderId,
      statusHistory: [
        ...workOrder.statusHistory,
        {
          from: workOrder.status,
          to: MAINTENANCE_STATUS.IN_PROGRESS,
          changedBy: user.uid || user.id,
          changedAt: now,
          reason: `Reopened: ${reason}`
        }
      ]
    });

    // Log activity
    await activityLogService.logWorkOrderActivity(
      id,
      'WO_REOPENED',
      user,
      {
        description: `Work order ${workOrder.workOrderId} reopened (count: ${reopenCount})`,
        metadata: { reason, reopenCount, previousWorkOrderId }
      }
    );

    // Reinitialize SLA for reopened work order
    const sla = slaService.initializeSLA(updated);
    await this.update(id, { sla });

    logInfo('Work order reopened', {
      workOrderId: workOrder.workOrderId,
      reopenCount,
      reason
    });

    return updated;
  }

  /**
   * Add comment to work order
   * @param {string} id - Work order ID
   * @param {Object} user - User commenting
   * @param {string} text - Comment text
   * @returns {Promise<Object>} Updated work order
   */
  async addComment(id, user, text) {
    const workOrder = await this.findById(id);
    if (!workOrder) throw new NotFoundError('Work Order');

    const now = new Date();
    const comment = {
      commentId: `comment_${now.getTime()}`,
      userId: user.uid || user.id,
      userName: user.displayName || user.name || user.email,
      text,
      timestamp: now
    };

    const updated = await this.update(id, {
      comments: [...(workOrder.comments || []), comment]
    });

    await activityLogService.logWorkOrderActivity(
      id,
      ACTIVITY_TYPES.WO_COMMENT_ADDED,
      user,
      { description: `Comment added to ${workOrder.workOrderId}` }
    );

    return updated;
  }

  /**
   * Attach file to work order
   * @param {string} id - Work order ID
   * @param {Object} user - User attaching file
   * @param {Object} fileInfo - File information
   * @returns {Promise<Object>} Updated work order
   */
  async attachFile(id, user, fileInfo) {
    const workOrder = await this.findById(id);
    if (!workOrder) throw new NotFoundError('Work Order');

    const now = new Date();
    const attachment = {
      fileId: `file_${now.getTime()}`,
      fileName: fileInfo.fileName,
      fileUrl: fileInfo.fileUrl,
      fileType: fileInfo.fileType,
      uploadedBy: user.uid || user.id,
      uploadedAt: now
    };

    const updated = await this.update(id, {
      attachments: [...(workOrder.attachments || []), attachment]
    });

    await activityLogService.logWorkOrderActivity(
      id,
      ACTIVITY_TYPES.WO_FILE_ATTACHED,
      user,
      {
        description: `File attached to ${workOrder.workOrderId}`,
        metadata: { fileName: fileInfo.fileName }
      }
    );

    return updated;
  }

  /**
   * Get work orders with filters
   * @param {Object} filters - Filter criteria
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Work orders
   */
  async getWorkOrders(filters = {}, options = {}) {
    const { limit = 100, orderBy = 'createdAt', orderDirection = 'desc' } = options;

    let query = this.collection.orderBy(orderBy, orderDirection).limit(limit);

    // Apply filters
    if (filters.status) {
      query = query.where('status', '==', filters.status);
    }
    if (filters.priority) {
      query = query.where('priority', '==', filters.priority);
    }
    if (filters.assignedTo) {
      query = query.where('assignedTo', '==', filters.assignedTo);
    }
    if (filters.equipmentId) {
      query = query.where('equipmentId', '==', filters.equipmentId);
    }
    if (filters.type) {
      query = query.where('type', '==', filters.type);
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
}

// Export singleton instance
export const workOrderService = new WorkOrderService();

export default WorkOrderService;
