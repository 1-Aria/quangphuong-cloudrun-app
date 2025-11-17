/**
 * SLA Service
 * Manages Service Level Agreements for work orders
 */

import { db } from '../../../config/firebase.js';
import { COLLECTIONS } from '../../../config/constants.js';
import {
  SLA_TYPE,
  SLA_STATUS,
  ESCALATION_LEVEL,
  SLA_CONFIG,
  calculateSLADeadlines,
  calculateSLAStatus,
  calculateTimeRemaining,
  isSLABreached,
  shouldSendWarning,
  calculatePauseDuration,
  adjustDeadlineForPause,
  determineEscalationLevel,
  getEscalationTargets
} from '../config.js';
import { logInfo, logError, logWarning } from '../../../shared/utils/logger.js';

/**
 * SLA Service
 * Calculates, tracks, and enforces SLA rules
 */
class SLAService {
  /**
   * Initialize SLA for work order
   * @param {Object} workOrder - Work order data
   * @returns {Object} SLA data
   */
  initializeSLA(workOrder) {
    try {
      const startTime = workOrder.createdAt ? new Date(workOrder.createdAt) : new Date();
      const priority = workOrder.priority || 'Medium';

      const deadlines = calculateSLADeadlines(startTime, priority);

      const sla = {
        responseBy: deadlines.responseBy,
        resolveBy: deadlines.resolveBy,
        responseSLAMinutes: deadlines.responseSLAMinutes,
        resolutionSLAMinutes: deadlines.resolutionSLAMinutes,

        // Status tracking
        responseStatus: SLA_STATUS.ON_TRACK,
        resolutionStatus: SLA_STATUS.ON_TRACK,
        responseBreached: false,
        resolutionBreached: false,

        // Breach tracking
        responseBreachedAt: null,
        resolutionBreachedAt: null,
        breachMinutes: 0,

        // Pause tracking
        isPaused: false,
        pauseStartAt: null,
        totalPauseMinutes: 0,

        // Escalation tracking
        escalationLevel: ESCALATION_LEVEL.NONE,
        escalatedAt: null,
        escalatedTo: [],

        // Warnings
        responseWarningsSent: 0,
        resolutionWarningsSent: 0,

        // Metadata
        createdAt: new Date(),
        updatedAt: new Date()
      };

      logInfo('SLA initialized', {
        workOrderId: workOrder.workOrderId,
        priority,
        responseBy: sla.responseBy,
        resolveBy: sla.resolveBy
      });

      return sla;
    } catch (error) {
      logError('Error initializing SLA', { error: error.message });
      throw error;
    }
  }

  /**
   * Update SLA status for work order
   * @param {string} workOrderId - Work order ID
   * @returns {Promise<Object>} Updated SLA data
   */
  async updateSLAStatus(workOrderId) {
    try {
      const workOrderRef = db.collection(COLLECTIONS.WORK_ORDERS).doc(workOrderId);
      const workOrderDoc = await workOrderRef.get();

      if (!workOrderDoc.exists) {
        throw new Error('Work order not found');
      }

      const workOrder = workOrderDoc.data();

      if (!workOrder.sla) {
        logWarning('Work order has no SLA data', { workOrderId });
        return null;
      }

      const now = new Date();
      const sla = workOrder.sla;

      // Adjust deadlines for pause time
      let adjustedResponseBy = new Date(sla.responseBy);
      let adjustedResolveBy = new Date(sla.resolveBy);

      if (sla.totalPauseMinutes > 0) {
        adjustedResponseBy = adjustDeadlineForPause(
          new Date(sla.responseBy),
          sla.totalPauseMinutes
        );
        adjustedResolveBy = adjustDeadlineForPause(
          new Date(sla.resolveBy),
          sla.totalPauseMinutes
        );
      }

      // Calculate current status
      const responseStatus = calculateSLAStatus(adjustedResponseBy, now);
      const resolutionStatus = calculateSLAStatus(adjustedResolveBy, now);

      // Check for breaches
      const responseBreached = isSLABreached(adjustedResponseBy, now);
      const resolutionBreached = isSLABreached(adjustedResolveBy, now);

      // Calculate breach duration
      const breachMinutes = resolutionBreached
        ? calculateTimeRemaining(adjustedResolveBy, now) * -1
        : 0;

      // Determine escalation level
      const escalationLevel = resolutionBreached
        ? determineEscalationLevel(breachMinutes)
        : ESCALATION_LEVEL.NONE;

      // Update SLA data
      const updates = {
        'sla.responseStatus': responseStatus,
        'sla.resolutionStatus': resolutionStatus,
        'sla.responseBreached': responseBreached,
        'sla.resolutionBreached': resolutionBreached,
        'sla.breachMinutes': breachMinutes,
        'sla.escalationLevel': escalationLevel,
        'sla.updatedAt': now
      };

      // Mark breach time if newly breached
      if (responseBreached && !sla.responseBreachedAt) {
        updates['sla.responseBreachedAt'] = now;
      }

      if (resolutionBreached && !sla.resolutionBreachedAt) {
        updates['sla.resolutionBreachedAt'] = now;
      }

      await workOrderRef.update(updates);

      logInfo('SLA status updated', {
        workOrderId: workOrder.workOrderId,
        responseStatus,
        resolutionStatus,
        breachMinutes
      });

      return { ...sla, ...updates };
    } catch (error) {
      logError('Error updating SLA status', { error: error.message });
      throw error;
    }
  }

  /**
   * Pause SLA for work order (when ON_HOLD)
   * @param {string} workOrderId - Work order ID
   * @returns {Promise<Object>} Updated SLA data
   */
  async pauseSLA(workOrderId) {
    try {
      if (!SLA_CONFIG.pauseOnHold) {
        logInfo('SLA pause disabled in config', { workOrderId });
        return null;
      }

      const workOrderRef = db.collection(COLLECTIONS.WORK_ORDERS).doc(workOrderId);
      const workOrderDoc = await workOrderRef.get();

      if (!workOrderDoc.exists) {
        throw new Error('Work order not found');
      }

      const workOrder = workOrderDoc.data();

      if (!workOrder.sla || workOrder.sla.isPaused) {
        logWarning('Cannot pause SLA', { workOrderId, reason: 'No SLA or already paused' });
        return null;
      }

      const now = new Date();

      await workOrderRef.update({
        'sla.isPaused': true,
        'sla.pauseStartAt': now,
        'sla.updatedAt': now
      });

      logInfo('SLA paused', { workOrderId: workOrder.workOrderId });

      return { ...workOrder.sla, isPaused: true, pauseStartAt: now };
    } catch (error) {
      logError('Error pausing SLA', { error: error.message });
      throw error;
    }
  }

  /**
   * Resume SLA for work order (when resuming from ON_HOLD)
   * @param {string} workOrderId - Work order ID
   * @returns {Promise<Object>} Updated SLA data
   */
  async resumeSLA(workOrderId) {
    try {
      const workOrderRef = db.collection(COLLECTIONS.WORK_ORDERS).doc(workOrderId);
      const workOrderDoc = await workOrderRef.get();

      if (!workOrderDoc.exists) {
        throw new Error('Work order not found');
      }

      const workOrder = workOrderDoc.data();

      if (!workOrder.sla || !workOrder.sla.isPaused) {
        logWarning('Cannot resume SLA', { workOrderId, reason: 'No SLA or not paused' });
        return null;
      }

      const now = new Date();
      const pauseDuration = calculatePauseDuration(
        new Date(workOrder.sla.pauseStartAt),
        now
      );

      const totalPauseMinutes = (workOrder.sla.totalPauseMinutes || 0) + pauseDuration;

      await workOrderRef.update({
        'sla.isPaused': false,
        'sla.pauseStartAt': null,
        'sla.totalPauseMinutes': totalPauseMinutes,
        'sla.updatedAt': now
      });

      logInfo('SLA resumed', {
        workOrderId: workOrder.workOrderId,
        pauseDuration,
        totalPauseMinutes
      });

      return {
        ...workOrder.sla,
        isPaused: false,
        pauseStartAt: null,
        totalPauseMinutes
      };
    } catch (error) {
      logError('Error resuming SLA', { error: error.message });
      throw error;
    }
  }

  /**
   * Check for SLA breaches across all active work orders
   * @returns {Promise<Object>} Breach report
   */
  async checkSLABreaches() {
    try {
      logInfo('Checking SLA breaches across all work orders');

      const activeStatuses = [
        'Draft',
        'Submitted',
        'Approved',
        'Assigned',
        'In Progress',
        'On Hold'
      ];

      const snapshot = await db
        .collection(COLLECTIONS.WORK_ORDERS)
        .where('status', 'in', activeStatuses.slice(0, 10)) // Firestore limit
        .get();

      const results = {
        total: snapshot.size,
        checked: 0,
        responseBreaches: 0,
        resolutionBreaches: 0,
        atRisk: 0,
        escalated: 0,
        breachedWorkOrders: []
      };

      for (const doc of snapshot.docs) {
        const workOrder = doc.data();

        if (!workOrder.sla) {
          continue;
        }

        results.checked++;

        // Update SLA status
        const updatedSLA = await this.updateSLAStatus(doc.id);

        if (updatedSLA.responseBreached) {
          results.responseBreaches++;
        }

        if (updatedSLA.resolutionBreached) {
          results.resolutionBreaches++;
          results.breachedWorkOrders.push({
            workOrderId: workOrder.workOrderId,
            title: workOrder.title,
            priority: workOrder.priority,
            breachMinutes: updatedSLA.breachMinutes,
            escalationLevel: updatedSLA.escalationLevel
          });
        }

        if (
          updatedSLA.responseStatus === SLA_STATUS.AT_RISK ||
          updatedSLA.resolutionStatus === SLA_STATUS.AT_RISK
        ) {
          results.atRisk++;
        }

        // Check if escalation is needed
        if (
          updatedSLA.resolutionBreached &&
          SLA_CONFIG.autoEscalate &&
          updatedSLA.escalationLevel !== workOrder.sla.escalationLevel
        ) {
          await this.escalate(doc.id, updatedSLA.escalationLevel);
          results.escalated++;
        }
      }

      logInfo('SLA breach check complete', results);

      return results;
    } catch (error) {
      logError('Error checking SLA breaches', { error: error.message });
      throw error;
    }
  }

  /**
   * Escalate work order
   * @param {string} workOrderId - Work order ID
   * @param {string} level - Escalation level
   * @returns {Promise<void>}
   */
  async escalate(workOrderId, level) {
    try {
      const targets = getEscalationTargets(level);
      const now = new Date();

      await db
        .collection(COLLECTIONS.WORK_ORDERS)
        .doc(workOrderId)
        .update({
          'sla.escalationLevel': level,
          'sla.escalatedAt': now,
          'sla.escalatedTo': targets,
          'sla.updatedAt': now
        });

      // Log activity
      await db.collection(COLLECTIONS.ACTIVITY_LOGS).add({
        workOrderId,
        action: 'SLA_ESCALATED',
        details: {
          level,
          targets
        },
        timestamp: now,
        createdAt: now
      });

      logInfo('Work order escalated', {
        workOrderId,
        level,
        targets
      });

      // TODO: Send notification to escalation targets
    } catch (error) {
      logError('Error escalating work order', { error: error.message });
      throw error;
    }
  }

  /**
   * Get SLA statistics
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Object>} SLA statistics
   */
  async getSLAStatistics(startDate, endDate) {
    try {
      const snapshot = await db
        .collection(COLLECTIONS.WORK_ORDERS)
        .where('createdAt', '>=', startDate)
        .where('createdAt', '<=', endDate)
        .get();

      const stats = {
        total: snapshot.size,
        withSLA: 0,
        responseBreaches: 0,
        resolutionBreaches: 0,
        onTrack: 0,
        atRisk: 0,
        averageResponseMinutes: 0,
        averageResolutionMinutes: 0,
        complianceRate: 0,
        byPriority: {}
      };

      let totalResponseMinutes = 0;
      let totalResolutionMinutes = 0;
      let responseCount = 0;
      let resolutionCount = 0;

      snapshot.docs.forEach(doc => {
        const data = doc.data();

        if (!data.sla) {
          return;
        }

        stats.withSLA++;

        // Count breaches
        if (data.sla.responseBreached) {
          stats.responseBreaches++;
        }

        if (data.sla.resolutionBreached) {
          stats.resolutionBreaches++;
        }

        // Count status
        if (data.sla.resolutionStatus === SLA_STATUS.ON_TRACK) {
          stats.onTrack++;
        } else if (data.sla.resolutionStatus === SLA_STATUS.AT_RISK) {
          stats.atRisk++;
        }

        // Calculate actual times
        if (data.assignedAt) {
          const responseMinutes = Math.round(
            (new Date(data.assignedAt) - new Date(data.createdAt)) / (1000 * 60)
          );
          totalResponseMinutes += responseMinutes;
          responseCount++;
        }

        if (data.closedAt) {
          const resolutionMinutes = Math.round(
            (new Date(data.closedAt) - new Date(data.createdAt)) / (1000 * 60)
          );
          totalResolutionMinutes += resolutionMinutes;
          resolutionCount++;
        }

        // Count by priority
        if (!stats.byPriority[data.priority]) {
          stats.byPriority[data.priority] = {
            total: 0,
            breached: 0
          };
        }
        stats.byPriority[data.priority].total++;
        if (data.sla.resolutionBreached) {
          stats.byPriority[data.priority].breached++;
        }
      });

      // Calculate averages
      if (responseCount > 0) {
        stats.averageResponseMinutes = Math.round(totalResponseMinutes / responseCount);
      }

      if (resolutionCount > 0) {
        stats.averageResolutionMinutes = Math.round(
          totalResolutionMinutes / resolutionCount
        );
      }

      // Calculate compliance rate
      if (stats.withSLA > 0) {
        const compliant = stats.withSLA - stats.resolutionBreaches;
        stats.complianceRate = Math.round((compliant / stats.withSLA) * 100);
      }

      return stats;
    } catch (error) {
      logError('Error getting SLA statistics', { error: error.message });
      throw error;
    }
  }
}

// Export singleton instance
export const slaService = new SLAService();

export default SLAService;
