/**
 * Notification Trigger Service
 * Triggers notifications based on work order events
 */

import { notificationService } from './NotificationService.js';
import { db } from '../../config/firebase.js';
import { COLLECTIONS } from '../../config/constants.js';
import { NOTIFICATION_EVENTS, RECIPIENT_RULES } from '../../config/notifications.js';
import { formatRemainingTime } from '../utils/slaCalculator.js';
import { logInfo, logError } from '../utils/logger.js';

/**
 * Notification Trigger Service
 * Determines recipients and triggers notifications for work order events
 */
class NotificationTriggerService {
  /**
   * Get users by role
   * @param {string} role - Role name
   * @returns {Promise<Array>} Users with that role
   */
  async getUsersByRole(role) {
    try {
      const snapshot = await db
        .collection(COLLECTIONS.USERS)
        .where('role', '==', role)
        .get();

      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      logError('Error getting users by role', { role, error: error.message });
      return [];
    }
  }

  /**
   * Get user by ID
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} User data
   */
  async getUserById(userId) {
    try {
      const doc = await db.collection(COLLECTIONS.USERS).doc(userId).get();

      if (!doc.exists) {
        return null;
      }

      return { id: doc.id, ...doc.data() };
    } catch (error) {
      logError('Error getting user by ID', { userId, error: error.message });
      return null;
    }
  }

  /**
   * Resolve recipients from rules
   * @param {Array} recipientRules - Recipient rules from config
   * @returns {Promise<Array>} Resolved recipients with Zalo IDs
   */
  async resolveRecipients(recipientRules) {
    const recipients = [];

    for (const rule of recipientRules) {
      if (rule.type === 'user') {
        // Single user
        const user = await this.getUserById(rule.userId);
        if (user && user.zaloUserId) {
          recipients.push({
            userId: user.id,
            zaloUserId: user.zaloUserId,
            name: user.displayName || user.email
          });
        }
      } else if (rule.type === 'role') {
        // All users with role
        const users = await getUsersByRole(rule.role);
        users.forEach(user => {
          if (user.zaloUserId) {
            recipients.push({
              userId: user.id,
              zaloUserId: user.zaloUserId,
              name: user.displayName || user.email,
              role: rule.role
            });
          }
        });
      }
    }

    return recipients;
  }

  /**
   * Trigger notification for work order event
   * @param {string} eventType - Notification event type
   * @param {Object} workOrder - Work order data
   * @param {Object} context - Additional context data
   */
  async triggerWorkOrderNotification(eventType, workOrder, context = {}) {
    try {
      // Get recipient rules for this event
      const recipientRuleFn = RECIPIENT_RULES[eventType];

      if (!recipientRuleFn) {
        logError('No recipient rules found for event', { eventType });
        return;
      }

      // Get recipient rules
      const recipientRules = recipientRuleFn(workOrder, context);

      // Resolve to actual users
      const recipients = await this.resolveRecipients(recipientRules);

      if (recipients.length === 0) {
        logInfo('No recipients found for notification', { eventType });
        return;
      }

      // Prepare notification data
      const data = {
        workOrderId: workOrder.workOrderId,
        title: workOrder.title,
        priority: workOrder.priority,
        type: workOrder.type,
        equipmentName: workOrder.equipmentName || '',
        location: workOrder.location || '',
        requestedByName: workOrder.requestedByName || '',
        approvedByName: workOrder.approvedByName || '',
        assignedToName: workOrder.assignedToName || workOrder.assignedTo || '',
        completedByName: workOrder.completedByName || '',
        slaDeadline: workOrder.slaCompletionDeadline
          ? new Date(workOrder.slaCompletionDeadline).toLocaleString('vi-VN')
          : 'N/A',
        slaResponseMet: workOrder.slaResponseMet ? '✅ Met' : '❌ Missed',
        slaCompletionMet: workOrder.slaCompletionMet ? '✅ Met' : '❌ Missed',
        actualHours: workOrder.actualHours?.toFixed(2) || 'N/A',
        startTime: workOrder.actualStartDate
          ? new Date(workOrder.actualStartDate).toLocaleString('vi-VN')
          : '',
        ...context // Include any additional context
      };

      // Send notification
      await notificationService.sendNotification(eventType, recipients, data);

      logInfo('Work order notification triggered', {
        eventType,
        workOrderId: workOrder.workOrderId,
        recipientCount: recipients.length
      });
    } catch (error) {
      logError('Error triggering work order notification', {
        eventType,
        error: error.message
      });
    }
  }

  /**
   * Trigger SLA warning notification
   * @param {Object} workOrder - Work order data
   * @param {number} percentElapsed - Percentage of SLA time elapsed (50, 75, 90)
   * @param {Object} slaStatus - SLA status data
   */
  async triggerSLAWarning(workOrder, percentElapsed, slaStatus) {
    let eventType;

    if (percentElapsed >= 90) {
      eventType = NOTIFICATION_EVENTS.SLA_WARNING_90;
    } else if (percentElapsed >= 75) {
      eventType = NOTIFICATION_EVENTS.SLA_WARNING_75;
    } else if (percentElapsed >= 50) {
      eventType = NOTIFICATION_EVENTS.SLA_WARNING_50;
    } else {
      return; // No warning needed
    }

    const context = {
      deadline: new Date(slaStatus.deadline).toLocaleString('vi-VN'),
      remainingTime: formatRemainingTime(slaStatus.remainingMinutes),
      percentElapsed: `${percentElapsed}%`
    };

    await this.triggerWorkOrderNotification(eventType, workOrder, context);
  }

  /**
   * Trigger SLA breach notification
   * @param {Object} workOrder - Work order data
   * @param {Object} slaStatus - SLA status data
   */
  async triggerSLABreach(workOrder, slaStatus) {
    const context = {
      deadline: new Date(slaStatus.deadline).toLocaleString('vi-VN'),
      overdueTime: formatRemainingTime(Math.abs(slaStatus.remainingMinutes))
    };

    await this.triggerWorkOrderNotification(
      NOTIFICATION_EVENTS.SLA_BREACHED,
      workOrder,
      context
    );
  }

  /**
   * Trigger escalation notification
   * @param {Object} workOrder - Work order data
   * @param {string} oldPriority - Previous priority
   * @param {string} newPriority - New priority
   */
  async triggerEscalation(workOrder, oldPriority, newPriority) {
    const context = {
      oldPriority,
      newPriority
    };

    await this.triggerWorkOrderNotification(
      NOTIFICATION_EVENTS.SLA_ESCALATED,
      workOrder,
      context
    );
  }

  /**
   * Trigger comment notification
   * @param {Object} workOrder - Work order data
   * @param {Object} comment - Comment data
   */
  async triggerCommentNotification(workOrder, comment) {
    const context = {
      userName: comment.userName,
      commentText: comment.text.length > 100
        ? comment.text.substring(0, 100) + '...'
        : comment.text,
      commenterId: comment.userId
    };

    await this.triggerWorkOrderNotification(
      NOTIFICATION_EVENTS.WO_COMMENT_ADDED,
      workOrder,
      context
    );
  }

  /**
   * Trigger file attachment notification
   * @param {Object} workOrder - Work order data
   * @param {Object} file - File data
   */
  async triggerFileAttachmentNotification(workOrder, file) {
    const context = {
      fileName: file.fileName,
      userName: file.uploadedByName || 'Unknown'
    };

    await this.triggerWorkOrderNotification(
      NOTIFICATION_EVENTS.WO_FILE_ATTACHED,
      workOrder,
      context
    );
  }

  /**
   * Trigger parts requested notification
   * @param {Object} workOrder - Work order data
   * @param {Array} parts - Parts requested
   */
  async triggerPartsRequestedNotification(workOrder, parts) {
    const context = {
      partsCount: parts.length,
      technicianName: workOrder.assignedToName
    };

    await this.triggerWorkOrderNotification(
      NOTIFICATION_EVENTS.WO_PARTS_REQUESTED,
      workOrder,
      context
    );
  }

  /**
   * Trigger reassignment notification
   * @param {Object} workOrder - Work order data
   * @param {string} previousTechnicianId - Previous technician user ID
   * @param {string} previousTechnician - Previous technician name
   * @param {string} newTechnician - New technician name
   * @param {string} reason - Reassignment reason
   */
  async triggerReassignmentNotification(
    workOrder,
    previousTechnicianId,
    previousTechnician,
    newTechnician,
    reason
  ) {
    const context = {
      previousTechnicianId,
      previousTechnician,
      newTechnician,
      reason: reason || 'Not specified'
    };

    await this.triggerWorkOrderNotification(
      NOTIFICATION_EVENTS.WO_REASSIGNED,
      workOrder,
      context
    );
  }
}

// Export singleton instance
export const notificationTriggerService = new NotificationTriggerService();

export default NotificationTriggerService;
