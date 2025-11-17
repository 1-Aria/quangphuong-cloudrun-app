/**
 * Work Order Reassignment Service
 * Manages technician reassignment for work orders
 */

import { db } from '../../../config/firebase.js';
import { COLLECTIONS } from '../../../config/constants.js';
import { MAINTENANCE_STATUS } from '../config.js';
import { ValidationError, NotFoundError, PermissionError } from '../../../shared/errors/AppError.js';
import { logInfo, logError, logWarning } from '../../../shared/utils/logger.js';
import { activityLogService } from '../../../shared/services/ActivityLogService.js';

/**
 * Reassignment Service
 * Handles work order reassignment logic, labor hour recording, and skill validation
 */
class ReassignmentService {
  /**
   * Request reassignment of work order
   * @param {string} workOrderId - Work order ID
   * @param {Object} reassignmentData - Reassignment request data
   * @param {Object} user - User requesting reassignment
   * @returns {Promise<Object>} Updated work order
   */
  async requestReassignment(workOrderId, reassignmentData, user) {
    try {
      const workOrderRef = db.collection(COLLECTIONS.WORK_ORDERS).doc(workOrderId);
      const workOrderDoc = await workOrderRef.get();

      if (!workOrderDoc.exists) {
        throw new NotFoundError('Work order not found');
      }

      const workOrder = workOrderDoc.data();

      // Validate work order is assigned
      if (!workOrder.assignedToId) {
        throw new ValidationError('Work order is not assigned to anyone');
      }

      // Validate work order is not closed or cancelled
      const invalidStatuses = [MAINTENANCE_STATUS.CLOSED, MAINTENANCE_STATUS.CANCELLED];
      if (invalidStatuses.includes(workOrder.status)) {
        throw new ValidationError(
          `Cannot reassign ${workOrder.status.toLowerCase()} work orders`
        );
      }

      // Validate requester has permission
      // Either assigned technician or supervisor/manager
      const isAssignedTechnician = workOrder.assignedToId === (user.uid || user.id);
      const isSupervisor = user.role === 'supervisor' || user.role === 'manager' || user.role === 'admin';

      if (!isAssignedTechnician && !isSupervisor) {
        throw new PermissionError(
          'Only assigned technician or supervisor can request reassignment'
        );
      }

      // Validate required fields
      if (!reassignmentData.reason || !reassignmentData.reason.trim()) {
        throw new ValidationError('Reassignment reason is required');
      }

      if (!reassignmentData.newAssigneeId) {
        throw new ValidationError('New assignee ID is required');
      }

      // Cannot reassign to same person
      if (reassignmentData.newAssigneeId === workOrder.assignedToId) {
        throw new ValidationError('Cannot reassign to the same technician');
      }

      // Validate new assignee exists (check users collection)
      const newAssigneeDoc = await db
        .collection(COLLECTIONS.USERS)
        .doc(reassignmentData.newAssigneeId)
        .get();

      if (!newAssigneeDoc.exists) {
        throw new NotFoundError('New assignee not found');
      }

      const newAssignee = newAssigneeDoc.data();

      // Skill validation if required skills specified
      if (
        reassignmentData.validateSkills &&
        workOrder.requiredSkills &&
        workOrder.requiredSkills.length > 0
      ) {
        const hasRequiredSkills = this.validateTechnicianSkills(
          newAssignee,
          workOrder.requiredSkills
        );

        if (!hasRequiredSkills) {
          throw new ValidationError(
            `New assignee does not have required skills: ${workOrder.requiredSkills.join(', ')}`
          );
        }
      }

      // Calculate labor hours for current assignee if work has started
      let laborHoursForPreviousAssignee = 0;
      if (workOrder.actualStartAt) {
        const now = new Date();
        laborHoursForPreviousAssignee = (now - new Date(workOrder.actualStartAt)) / (1000 * 60 * 60);
        laborHoursForPreviousAssignee = Math.round(laborHoursForPreviousAssignee * 100) / 100;
      }

      const now = new Date();

      // Create reassignment record
      const reassignmentRecord = {
        from: {
          userId: workOrder.assignedToId,
          userName: workOrder.assignedToName,
          assignedAt: workOrder.assignedAt,
          laborHours: laborHoursForPreviousAssignee
        },
        to: {
          userId: reassignmentData.newAssigneeId,
          userName: newAssignee.displayName || newAssignee.name || newAssignee.email,
          assignedAt: now
        },
        requestedBy: user.uid || user.id,
        requestedByName: user.displayName || user.name || user.email,
        reason: reassignmentData.reason.trim(),
        requestedAt: now,
        approvedAt: null,
        approvedBy: null,
        status: 'pending' // pending, approved, rejected
      };

      // Auto-approve if requester is supervisor/manager
      if (isSupervisor) {
        reassignmentRecord.status = 'approved';
        reassignmentRecord.approvedAt = now;
        reassignmentRecord.approvedBy = user.uid || user.id;

        // Execute reassignment immediately
        await this.executeReassignment(
          workOrderId,
          workOrder,
          reassignmentRecord,
          laborHoursForPreviousAssignee
        );
      } else {
        // Store pending reassignment request
        const reassignmentHistory = workOrder.reassignmentHistory || [];
        reassignmentHistory.push(reassignmentRecord);

        await workOrderRef.update({
          reassignmentHistory,
          pendingReassignment: reassignmentRecord,
          updatedAt: now
        });

        logInfo('Reassignment requested', {
          workOrderId: workOrder.workOrderId,
          from: workOrder.assignedToId,
          to: reassignmentData.newAssigneeId,
          reason: reassignmentData.reason
        });
      }

      // Log activity
      await activityLogService.logWorkOrderActivity(
        workOrderId,
        'REASSIGNMENT_REQUESTED',
        user,
        {
          description: `Reassignment requested from ${workOrder.assignedToName} to ${reassignmentRecord.to.userName}`,
          metadata: {
            fromUserId: workOrder.assignedToId,
            toUserId: reassignmentData.newAssigneeId,
            reason: reassignmentData.reason,
            autoApproved: isSupervisor
          }
        }
      );

      return {
        ...workOrder,
        reassignmentHistory: [...(workOrder.reassignmentHistory || []), reassignmentRecord],
        pendingReassignment: isSupervisor ? null : reassignmentRecord
      };
    } catch (error) {
      logError('Error requesting reassignment', { error: error.message });
      throw error;
    }
  }

  /**
   * Approve reassignment request
   * @param {string} workOrderId - Work order ID
   * @param {Object} user - User approving (must be supervisor/manager)
   * @returns {Promise<Object>} Updated work order
   */
  async approveReassignment(workOrderId, user) {
    try {
      const workOrderRef = db.collection(COLLECTIONS.WORK_ORDERS).doc(workOrderId);
      const workOrderDoc = await workOrderRef.get();

      if (!workOrderDoc.exists) {
        throw new NotFoundError('Work order not found');
      }

      const workOrder = workOrderDoc.data();

      // Validate pending reassignment exists
      if (!workOrder.pendingReassignment) {
        throw new ValidationError('No pending reassignment request');
      }

      // Validate user has permission (supervisor/manager/admin)
      const hasPermission = ['supervisor', 'manager', 'admin'].includes(user.role);
      if (!hasPermission) {
        throw new PermissionError('Only supervisors and managers can approve reassignments');
      }

      const now = new Date();

      // Update reassignment record
      const reassignmentRecord = {
        ...workOrder.pendingReassignment,
        status: 'approved',
        approvedAt: now,
        approvedBy: user.uid || user.id,
        approvedByName: user.displayName || user.name || user.email
      };

      // Execute reassignment
      await this.executeReassignment(
        workOrderId,
        workOrder,
        reassignmentRecord,
        reassignmentRecord.from.laborHours
      );

      // Log activity
      await activityLogService.logWorkOrderActivity(
        workOrderId,
        'REASSIGNMENT_APPROVED',
        user,
        {
          description: `Reassignment approved from ${reassignmentRecord.from.userName} to ${reassignmentRecord.to.userName}`,
          metadata: {
            fromUserId: reassignmentRecord.from.userId,
            toUserId: reassignmentRecord.to.userId
          }
        }
      );

      logInfo('Reassignment approved', {
        workOrderId: workOrder.workOrderId,
        approvedBy: user.uid || user.id
      });

      return await workOrderRef.get().then(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      logError('Error approving reassignment', { error: error.message });
      throw error;
    }
  }

  /**
   * Reject reassignment request
   * @param {string} workOrderId - Work order ID
   * @param {string} rejectionReason - Reason for rejection
   * @param {Object} user - User rejecting (must be supervisor/manager)
   * @returns {Promise<Object>} Updated work order
   */
  async rejectReassignment(workOrderId, rejectionReason, user) {
    try {
      const workOrderRef = db.collection(COLLECTIONS.WORK_ORDERS).doc(workOrderId);
      const workOrderDoc = await workOrderRef.get();

      if (!workOrderDoc.exists) {
        throw new NotFoundError('Work order not found');
      }

      const workOrder = workOrderDoc.data();

      // Validate pending reassignment exists
      if (!workOrder.pendingReassignment) {
        throw new ValidationError('No pending reassignment request');
      }

      // Validate user has permission
      const hasPermission = ['supervisor', 'manager', 'admin'].includes(user.role);
      if (!hasPermission) {
        throw new PermissionError('Only supervisors and managers can reject reassignments');
      }

      if (!rejectionReason || !rejectionReason.trim()) {
        throw new ValidationError('Rejection reason is required');
      }

      const now = new Date();

      // Update reassignment record
      const reassignmentRecord = {
        ...workOrder.pendingReassignment,
        status: 'rejected',
        rejectedAt: now,
        rejectedBy: user.uid || user.id,
        rejectedByName: user.displayName || user.name || user.email,
        rejectionReason: rejectionReason.trim()
      };

      // Update reassignment history
      const reassignmentHistory = workOrder.reassignmentHistory || [];
      const pendingIndex = reassignmentHistory.findIndex(r => r.status === 'pending');
      if (pendingIndex !== -1) {
        reassignmentHistory[pendingIndex] = reassignmentRecord;
      } else {
        reassignmentHistory.push(reassignmentRecord);
      }

      await workOrderRef.update({
        reassignmentHistory,
        pendingReassignment: null,
        updatedAt: now
      });

      // Log activity
      await activityLogService.logWorkOrderActivity(
        workOrderId,
        'REASSIGNMENT_REJECTED',
        user,
        {
          description: `Reassignment request rejected: ${rejectionReason}`,
          metadata: {
            fromUserId: reassignmentRecord.from.userId,
            toUserId: reassignmentRecord.to.userId,
            rejectionReason
          }
        }
      );

      logInfo('Reassignment rejected', {
        workOrderId: workOrder.workOrderId,
        rejectedBy: user.uid || user.id,
        reason: rejectionReason
      });

      return {
        ...workOrder,
        reassignmentHistory,
        pendingReassignment: null
      };
    } catch (error) {
      logError('Error rejecting reassignment', { error: error.message });
      throw error;
    }
  }

  /**
   * Execute reassignment (internal method)
   * @param {string} workOrderId - Work order ID
   * @param {Object} workOrder - Current work order data
   * @param {Object} reassignmentRecord - Reassignment record
   * @param {number} laborHours - Labor hours for previous assignee
   * @private
   */
  async executeReassignment(workOrderId, workOrder, reassignmentRecord, laborHours) {
    const workOrderRef = db.collection(COLLECTIONS.WORK_ORDERS).doc(workOrderId);
    const now = new Date();

    // Update reassignment history
    const reassignmentHistory = workOrder.reassignmentHistory || [];
    const existingIndex = reassignmentHistory.findIndex(
      r => r.requestedAt === reassignmentRecord.requestedAt
    );

    if (existingIndex !== -1) {
      reassignmentHistory[existingIndex] = reassignmentRecord;
    } else {
      reassignmentHistory.push(reassignmentRecord);
    }

    // Record labor hours for previous assignee
    const laborRecords = workOrder.laborRecords || [];
    if (laborHours > 0) {
      laborRecords.push({
        userId: reassignmentRecord.from.userId,
        userName: reassignmentRecord.from.userName,
        startedAt: reassignmentRecord.from.assignedAt,
        endedAt: now,
        hours: laborHours,
        recordedAt: now
      });
    }

    // Update work order
    await workOrderRef.update({
      assignedToId: reassignmentRecord.to.userId,
      assignedToName: reassignmentRecord.to.userName,
      assignedAt: reassignmentRecord.to.assignedAt,
      reassignmentHistory,
      reassignmentCount: (workOrder.reassignmentCount || 0) + 1,
      laborRecords,
      pendingReassignment: null,
      actualStartAt: null, // Reset start time for new assignee
      updatedAt: now,
      statusHistory: [
        ...(workOrder.statusHistory || []),
        {
          from: workOrder.status,
          to: workOrder.status, // Status stays same
          changedBy: reassignmentRecord.approvedBy || reassignmentRecord.requestedBy,
          changedAt: now,
          reason: `Reassigned to ${reassignmentRecord.to.userName}: ${reassignmentRecord.reason}`
        }
      ]
    });

    logInfo('Reassignment executed', {
      workOrderId: workOrder.workOrderId,
      from: reassignmentRecord.from.userId,
      to: reassignmentRecord.to.userId,
      laborHours
    });
  }

  /**
   * Validate technician has required skills
   * @param {Object} technician - Technician user object
   * @param {Array<string>} requiredSkills - Required skills
   * @returns {boolean} Has all required skills
   * @private
   */
  validateTechnicianSkills(technician, requiredSkills) {
    if (!technician.skills || !Array.isArray(technician.skills)) {
      return false;
    }

    const technicianSkills = technician.skills.map(s => s.toLowerCase());
    return requiredSkills.every(skill =>
      technicianSkills.includes(skill.toLowerCase())
    );
  }

  /**
   * Get reassignment history for work order
   * @param {string} workOrderId - Work order ID
   * @returns {Promise<Array>} Reassignment history
   */
  async getReassignmentHistory(workOrderId) {
    try {
      const workOrderDoc = await db
        .collection(COLLECTIONS.WORK_ORDERS)
        .doc(workOrderId)
        .get();

      if (!workOrderDoc.exists) {
        throw new NotFoundError('Work order not found');
      }

      const workOrder = workOrderDoc.data();
      return workOrder.reassignmentHistory || [];
    } catch (error) {
      logError('Error getting reassignment history', { error: error.message });
      throw error;
    }
  }

  /**
   * Get labor records for work order
   * @param {string} workOrderId - Work order ID
   * @returns {Promise<Array>} Labor records
   */
  async getLaborRecords(workOrderId) {
    try {
      const workOrderDoc = await db
        .collection(COLLECTIONS.WORK_ORDERS)
        .doc(workOrderId)
        .get();

      if (!workOrderDoc.exists) {
        throw new NotFoundError('Work order not found');
      }

      const workOrder = workOrderDoc.data();
      return workOrder.laborRecords || [];
    } catch (error) {
      logError('Error getting labor records', { error: error.message });
      throw error;
    }
  }

  /**
   * Get available technicians for reassignment
   * @param {string} workOrderId - Work order ID
   * @returns {Promise<Array>} Available technicians
   */
  async getAvailableTechnicians(workOrderId) {
    try {
      const workOrderDoc = await db
        .collection(COLLECTIONS.WORK_ORDERS)
        .doc(workOrderId)
        .get();

      if (!workOrderDoc.exists) {
        throw new NotFoundError('Work order not found');
      }

      const workOrder = workOrderDoc.data();

      // Get all technicians
      const techniciansSnapshot = await db
        .collection(COLLECTIONS.USERS)
        .where('role', '==', 'technician')
        .get();

      const technicians = techniciansSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Filter out current assignee
      const availableTechnicians = technicians.filter(
        tech => tech.id !== workOrder.assignedToId
      );

      // If required skills specified, annotate matching technicians
      if (workOrder.requiredSkills && workOrder.requiredSkills.length > 0) {
        return availableTechnicians.map(tech => ({
          ...tech,
          hasRequiredSkills: this.validateTechnicianSkills(tech, workOrder.requiredSkills),
          matchingSkills: tech.skills?.filter(skill =>
            workOrder.requiredSkills.some(req => req.toLowerCase() === skill.toLowerCase())
          ) || []
        }));
      }

      return availableTechnicians;
    } catch (error) {
      logError('Error getting available technicians', { error: error.message });
      throw error;
    }
  }
}

// Export singleton instance
export const reassignmentService = new ReassignmentService();

export default ReassignmentService;
