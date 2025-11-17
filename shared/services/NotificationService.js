/**
 * Notification Service
 * Multi-channel notification abstraction layer
 */

import { zaloService } from './ZaloService.js';
import { db } from '../../config/firebase.js';
import { COLLECTIONS } from '../../config/constants.js';
import {
  NOTIFICATION_CHANNELS,
  MESSAGE_TEMPLATES,
  formatMessage,
  getChannelsForEvent,
  getZaloGroupIds
} from '../../config/notifications.js';
import { logInfo, logError, logWarning } from '../utils/logger.js';

/**
 * Notification History Collection
 */
const NOTIFICATION_HISTORY = 'notification_history';

/**
 * Notification Service
 * Handles sending notifications across multiple channels
 */
class NotificationService {
  constructor() {
    this.zaloGroupIds = getZaloGroupIds();
  }

  /**
   * Send notification via specified channel
   * @param {string} channel - Channel type
   * @param {Object} recipient - Recipient info
   * @param {string} message - Message to send
   * @returns {Promise<boolean>} Success status
   */
  async sendViaChannel(channel, recipient, message) {
    try {
      switch (channel) {
        case NOTIFICATION_CHANNELS.ZALO_CS:
          if (!recipient.zaloUserId) {
            logWarning('No Zalo user ID for recipient', { recipient });
            return false;
          }
          return await zaloService.sendCSMessage(recipient.zaloUserId, message);

        case NOTIFICATION_CHANNELS.ZALO_GMF:
          if (!recipient.zaloGroupId) {
            logWarning('No Zalo group ID for recipient', { recipient });
            return false;
          }
          return await zaloService.sendGMFMessage(recipient.zaloGroupId, message);

        case NOTIFICATION_CHANNELS.EMAIL:
          // TODO: Implement email sending
          logWarning('Email channel not yet implemented');
          return false;

        case NOTIFICATION_CHANNELS.SMS:
          // TODO: Implement SMS sending
          logWarning('SMS channel not yet implemented');
          return false;

        case NOTIFICATION_CHANNELS.PUSH:
          // TODO: Implement push notifications
          logWarning('Push notification channel not yet implemented');
          return false;

        default:
          logError('Unknown notification channel', { channel });
          return false;
      }
    } catch (error) {
      logError('Error sending notification via channel', {
        channel,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Send notification to a single recipient
   * @param {string} eventType - Event type
   * @param {Object} recipient - Recipient info
   * @param {string} message - Formatted message
   * @returns {Promise<Object>} Send result
   */
  async sendToRecipient(eventType, recipient, message) {
    const channels = getChannelsForEvent(eventType);
    const results = {
      recipient,
      channels: [],
      success: false
    };

    for (const channel of channels) {
      const sent = await this.sendViaChannel(channel, recipient, message);

      results.channels.push({
        channel,
        sent,
        timestamp: new Date()
      });

      if (sent) {
        results.success = true;
      }
    }

    return results;
  }

  /**
   * Send notification to multiple recipients
   * @param {string} eventType - Event type
   * @param {Array<Object>} recipients - Array of recipients
   * @param {Object} data - Data for message template
   * @returns {Promise<Object>} Send results summary
   */
  async sendNotification(eventType, recipients, data) {
    const template = MESSAGE_TEMPLATES[eventType];

    if (!template) {
      logError('No template found for event type', { eventType });
      return { sent: 0, failed: 0 };
    }

    const message = formatMessage(template.template, data);

    const results = {
      eventType,
      sent: 0,
      failed: 0,
      details: []
    };

    for (const recipient of recipients) {
      const result = await this.sendToRecipient(eventType, recipient, message);

      if (result.success) {
        results.sent++;
      } else {
        results.failed++;
      }

      results.details.push(result);
    }

    // Log notification history
    await this.logNotification({
      eventType,
      message,
      recipients: recipients.length,
      sent: results.sent,
      failed: results.failed,
      timestamp: new Date(),
      data
    });

    logInfo('Notification sent', {
      eventType,
      sent: results.sent,
      failed: results.failed
    });

    return results;
  }

  /**
   * Send to Zalo group
   * @param {string} groupKey - Group key ('maintenance', 'supervisors', 'managers', 'all')
   * @param {string} message - Message to send
   * @returns {Promise<boolean>} Success status
   */
  async sendToGroup(groupKey, message) {
    const groupId = this.zaloGroupIds[groupKey];

    if (!groupId) {
      logWarning(`No Zalo group ID configured for: ${groupKey}`);
      return false;
    }

    return await zaloService.sendGMFMessage(groupId, message);
  }

  /**
   * Get user notification preferences
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User preferences
   */
  async getUserPreferences(userId) {
    try {
      const userDoc = await db.collection(COLLECTIONS.USERS).doc(userId).get();

      if (!userDoc.exists) {
        return this.getDefaultPreferences();
      }

      const userData = userDoc.data();
      return userData.notificationPreferences || this.getDefaultPreferences();
    } catch (error) {
      logError('Error getting user preferences', { userId, error: error.message });
      return this.getDefaultPreferences();
    }
  }

  /**
   * Get default notification preferences
   * @returns {Object} Default preferences
   */
  getDefaultPreferences() {
    return {
      zalo: true,
      email: false,
      sms: false,
      push: false,
      mutedEvents: [] // Events user wants to mute
    };
  }

  /**
   * Check if user wants to receive notification for event
   * @param {string} userId - User ID
   * @param {string} eventType - Event type
   * @returns {Promise<boolean>} True if user wants notification
   */
  async shouldNotifyUser(userId, eventType) {
    const prefs = await this.getUserPreferences(userId);

    // Check if event is muted
    if (prefs.mutedEvents && prefs.mutedEvents.includes(eventType)) {
      return false;
    }

    // Check if at least one channel is enabled
    return prefs.zalo || prefs.email || prefs.sms || prefs.push;
  }

  /**
   * Log notification to history
   * @param {Object} notificationData - Notification data
   */
  async logNotification(notificationData) {
    try {
      await db.collection(NOTIFICATION_HISTORY).add({
        ...notificationData,
        createdAt: new Date()
      });
    } catch (error) {
      logError('Error logging notification', { error: error.message });
    }
  }

  /**
   * Get notification history for an entity
   * @param {string} entityType - Entity type (e.g., 'work_order')
   * @param {string} entityId - Entity ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Notification history
   */
  async getNotificationHistory(entityType, entityId, options = {}) {
    try {
      const { limit = 50 } = options;

      const snapshot = await db
        .collection(NOTIFICATION_HISTORY)
        .where('data.entityType', '==', entityType)
        .where('data.entityId', '==', entityId)
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      logError('Error getting notification history', { error: error.message });
      return [];
    }
  }

  /**
   * Get notification statistics
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Object>} Statistics
   */
  async getStatistics(startDate, endDate) {
    try {
      const snapshot = await db
        .collection(NOTIFICATION_HISTORY)
        .where('timestamp', '>=', startDate)
        .where('timestamp', '<=', endDate)
        .get();

      const stats = {
        total: snapshot.size,
        sent: 0,
        failed: 0,
        byEvent: {},
        byChannel: {}
      };

      snapshot.docs.forEach(doc => {
        const data = doc.data();

        stats.sent += data.sent || 0;
        stats.failed += data.failed || 0;

        // By event type
        if (!stats.byEvent[data.eventType]) {
          stats.byEvent[data.eventType] = 0;
        }
        stats.byEvent[data.eventType]++;
      });

      return stats;
    } catch (error) {
      logError('Error getting notification statistics', { error: error.message });
      return null;
    }
  }

  /**
   * Test notification delivery
   * @param {string} channel - Channel to test
   * @param {Object} recipient - Recipient info
   * @returns {Promise<boolean>} Test result
   */
  async testNotification(channel, recipient) {
    const testMessage = `🧪 Test Notification\nChannel: ${channel}\nTime: ${new Date().toISOString()}\n\nIf you received this, notifications are working!`;

    return await this.sendViaChannel(channel, recipient, testMessage);
  }
}

// Export singleton instance
export const notificationService = new NotificationService();

export default NotificationService;
