/**
 * SLA Calculator Utility
 * Calculates SLA deadlines, elapsed time, and remaining time
 * Handles business hours, holidays, and pause conditions
 */

import {
  getResponseSLA,
  getCompletionSLA,
  shouldPauseSLA,
  SLA_CALCULATION,
  ESCALATION_RULES
} from '../../config/sla.js';
import {
  isWorkingDay,
  isWithinBusinessHours,
  isBusinessTime,
  getNextBusinessDay,
  getBusinessHoursStart,
  getBusinessHoursEnd,
  BUSINESS_HOURS,
  HOURS_PER_BUSINESS_DAY
} from '../../config/businessHours.js';

/**
 * Calculate SLA deadline from a start time
 * @param {Date} startTime - Start time
 * @param {number} minutes - SLA time in minutes
 * @param {boolean} businessHoursOnly - Whether to count only business hours
 * @returns {Date} Deadline
 */
export function calculateDeadline(startTime, minutes, businessHoursOnly = true) {
  if (!businessHoursOnly) {
    // Calendar time - just add minutes
    const deadline = new Date(startTime);
    deadline.setMinutes(deadline.getMinutes() + minutes);
    return deadline;
  }

  // Business hours calculation
  let remainingMinutes = minutes;
  let currentTime = new Date(startTime);

  // Add grace period
  const gracePeriod = SLA_CALCULATION.gracePeriods?.response || 0;
  remainingMinutes += gracePeriod;

  while (remainingMinutes > 0) {
    // If not a working day, move to next working day
    if (!isWorkingDay(currentTime)) {
      currentTime = getBusinessHoursStart(getNextBusinessDay(currentTime));
      continue;
    }

    // If before business hours, jump to start of business hours
    if (currentTime.getHours() < BUSINESS_HOURS.start.hour) {
      currentTime = getBusinessHoursStart(currentTime);
      continue;
    }

    // If after business hours, move to next business day
    if (currentTime.getHours() >= BUSINESS_HOURS.end.hour) {
      currentTime = getBusinessHoursStart(getNextBusinessDay(currentTime));
      continue;
    }

    // Calculate minutes until end of current business period
    const minutesUntilEndOfDay = getMinutesUntilEndOfBusinessDay(currentTime);

    if (remainingMinutes <= minutesUntilEndOfDay) {
      // Deadline is within current business day
      currentTime.setMinutes(currentTime.getMinutes() + remainingMinutes);
      remainingMinutes = 0;
    } else {
      // Move to next business day
      remainingMinutes -= minutesUntilEndOfDay;
      currentTime = getBusinessHoursStart(getNextBusinessDay(currentTime));
    }
  }

  return currentTime;
}

/**
 * Calculate response SLA deadline for a work order
 * @param {Date} createdAt - Work order creation time
 * @param {string} priority - Work order priority
 * @param {string} type - Work order type
 * @returns {Date} Response deadline
 */
export function calculateResponseDeadline(createdAt, priority, type) {
  const sla = getResponseSLA(priority, type);
  return calculateDeadline(createdAt, sla.minutes, sla.businessHoursOnly);
}

/**
 * Calculate completion SLA deadline for a work order
 * @param {Date} approvedAt - Work order approval time
 * @param {string} priority - Work order priority
 * @param {string} type - Work order type
 * @returns {Date} Completion deadline
 */
export function calculateCompletionDeadline(approvedAt, priority, type) {
  const sla = getCompletionSLA(priority, type);
  const minutes = sla.hours * 60;

  // Add completion grace period
  const gracePeriod = SLA_CALCULATION.gracePeriods?.completion || 0;
  const totalMinutes = minutes + gracePeriod;

  return calculateDeadline(approvedAt, totalMinutes, sla.businessHoursOnly);
}

/**
 * Calculate elapsed time between two dates (respecting business hours)
 * @param {Date} startTime - Start time
 * @param {Date} endTime - End time
 * @param {boolean} businessHoursOnly - Count only business hours
 * @param {Array<Object>} pausePeriods - Array of {start, end} pause periods
 * @returns {number} Elapsed time in minutes
 */
export function calculateElapsedTime(startTime, endTime, businessHoursOnly = true, pausePeriods = []) {
  if (!businessHoursOnly) {
    // Calendar time
    let elapsed = (endTime - startTime) / (1000 * 60);

    // Subtract pause periods
    pausePeriods.forEach(pause => {
      const pauseDuration = (pause.end - pause.start) / (1000 * 60);
      elapsed -= pauseDuration;
    });

    return Math.max(0, elapsed);
  }

  // Business hours calculation
  let elapsedMinutes = 0;
  let currentTime = new Date(startTime);
  const endDateTime = new Date(endTime);

  while (currentTime < endDateTime) {
    if (isWorkingDay(currentTime) && isWithinBusinessHours(currentTime)) {
      // Check if this minute is in a pause period
      const isPaused = pausePeriods.some(pause => {
        return currentTime >= pause.start && currentTime < pause.end;
      });

      if (!isPaused) {
        elapsedMinutes++;
      }
    }

    currentTime.setMinutes(currentTime.getMinutes() + 1);

    // Optimization: Skip to next business day if we're past business hours
    if (currentTime.getHours() >= BUSINESS_HOURS.end.hour && currentTime < endDateTime) {
      const nextBizDay = getNextBusinessDay(currentTime);
      if (nextBizDay < endDateTime) {
        currentTime = getBusinessHoursStart(nextBizDay);
      }
    }
  }

  return elapsedMinutes;
}

/**
 * Calculate remaining time until deadline
 * @param {Date} deadline - SLA deadline
 * @param {Date} currentTime - Current time (default: now)
 * @param {boolean} businessHoursOnly - Count only business hours
 * @returns {number} Remaining time in minutes (negative if overdue)
 */
export function calculateRemainingTime(deadline, currentTime = new Date(), businessHoursOnly = true) {
  if (currentTime >= deadline) {
    // Overdue - return negative elapsed time
    return -calculateElapsedTime(deadline, currentTime, businessHoursOnly);
  }

  return calculateElapsedTime(currentTime, deadline, businessHoursOnly);
}

/**
 * Check if SLA is breached
 * @param {Date} deadline - SLA deadline
 * @param {Date} currentTime - Current time (default: now)
 * @returns {boolean} True if breached
 */
export function isSLABreached(deadline, currentTime = new Date()) {
  return currentTime > deadline;
}

/**
 * Calculate SLA compliance percentage
 * @param {Date} startTime - Start time
 * @param {Date} deadline - Deadline
 * @param {Date} currentTime - Current time (default: now)
 * @param {boolean} businessHoursOnly - Count only business hours
 * @returns {number} Percentage (0-100, can exceed 100 if overdue)
 */
export function calculateSLAProgress(startTime, deadline, currentTime = new Date(), businessHoursOnly = true) {
  const totalTime = calculateElapsedTime(startTime, deadline, businessHoursOnly);
  const elapsedTime = calculateElapsedTime(startTime, currentTime, businessHoursOnly);

  if (totalTime === 0) return 0;

  return Math.round((elapsedTime / totalTime) * 100);
}

/**
 * Get SLA status
 * @param {Date} deadline - SLA deadline
 * @param {Date} currentTime - Current time (default: now)
 * @param {boolean} businessHoursOnly - Count only business hours
 * @returns {Object} { status, remainingMinutes, remainingPercent }
 */
export function getSLAStatus(deadline, currentTime = new Date(), businessHoursOnly = true) {
  const remainingMinutes = calculateRemainingTime(deadline, currentTime, businessHoursOnly);
  const isBreached = remainingMinutes < 0;

  let status = 'on_track';
  if (isBreached) {
    status = 'breached';
  } else {
    const totalMinutes = calculateElapsedTime(new Date(deadline.getTime() - remainingMinutes * 60000), deadline, businessHoursOnly);
    const percentRemaining = (remainingMinutes / totalMinutes) * 100;

    if (percentRemaining <= 10) {
      status = 'critical'; // Less than 10% time remaining
    } else if (percentRemaining <= 25) {
      status = 'urgent'; // Less than 25% time remaining
    } else if (percentRemaining <= 50) {
      status = 'warning'; // Less than 50% time remaining
    }
  }

  return {
    status,
    remainingMinutes: Math.abs(remainingMinutes),
    isOverdue: isBreached,
    deadline: deadline
  };
}

/**
 * Calculate pause periods from work order history
 * @param {Array<Object>} statusHistory - Array of status changes
 * @returns {Array<Object>} Array of {start, end} pause periods
 */
export function calculatePausePeriods(statusHistory) {
  const pausePeriods = [];
  let pauseStart = null;

  statusHistory.forEach(change => {
    const status = change.status || change.newStatus;
    const timestamp = change.timestamp || change.changedAt;

    if (shouldPauseSLA(status)) {
      // Entering a pause state
      if (!pauseStart) {
        pauseStart = new Date(timestamp);
      }
    } else {
      // Exiting a pause state
      if (pauseStart) {
        pausePeriods.push({
          start: pauseStart,
          end: new Date(timestamp)
        });
        pauseStart = null;
      }
    }
  });

  // If currently in pause state, pause period continues until now
  if (pauseStart) {
    pausePeriods.push({
      start: pauseStart,
      end: new Date()
    });
  }

  return pausePeriods;
}

/**
 * Helper: Get minutes until end of business day
 * @param {Date} time - Current time
 * @returns {number} Minutes until end of business hours
 */
function getMinutesUntilEndOfBusinessDay(time) {
  const endOfDay = getBusinessHoursEnd(time);
  const diff = (endOfDay - time) / (1000 * 60);

  // Account for lunch break if applicable
  if (BUSINESS_HOURS.lunchBreak?.enabled) {
    const lunchStart = new Date(time);
    lunchStart.setHours(BUSINESS_HOURS.lunchBreak.start.hour, BUSINESS_HOURS.lunchBreak.start.minute, 0, 0);

    const lunchEnd = new Date(time);
    lunchEnd.setHours(BUSINESS_HOURS.lunchBreak.end.hour, BUSINESS_HOURS.lunchBreak.end.minute, 0, 0);

    // If we haven't reached lunch yet, subtract lunch duration
    if (time < lunchStart) {
      const lunchDuration = (lunchEnd - lunchStart) / (1000 * 60);
      return diff - lunchDuration;
    }
  }

  return Math.max(0, diff);
}

/**
 * Format remaining time as human-readable string
 * @param {number} minutes - Minutes
 * @returns {string} Formatted string (e.g., "2h 30m", "3d 4h")
 */
export function formatRemainingTime(minutes) {
  if (minutes < 0) {
    return `Overdue by ${formatRemainingTime(Math.abs(minutes))}`;
  }

  if (minutes < 60) {
    return `${Math.round(minutes)}m`;
  }

  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);

  if (hours < 24) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  if (remainingHours > 0) {
    return `${days}d ${remainingHours}h`;
  }

  return `${days}d`;
}

/**
 * Get escalation actions for current SLA status
 * @param {Object} slaStatus - SLA status object from getSLAStatus
 * @param {string} slaType - 'response' or 'completion'
 * @returns {Array<string>} Array of escalation actions
 */
export function getEscalationActions(slaStatus, slaType = 'response') {
  if (!ESCALATION_RULES.enabled) return [];

  const actions = [];

  if (slaStatus.isOverdue) {
    // SLA breached - get breach actions
    const breachActions = ESCALATION_RULES.breachActions[slaType] || [];
    const overdueMinutes = slaStatus.remainingMinutes;

    breachActions.forEach(action => {
      if (overdueMinutes >= action.delay) {
        actions.push(action.action);
      }
    });
  } else {
    // Check warning thresholds
    const progress = 100 - (slaStatus.remainingMinutes / (slaStatus.remainingMinutes + calculateElapsedTime(new Date(), slaStatus.deadline))) * 100;

    ESCALATION_RULES.warningThresholds.forEach(threshold => {
      if (progress >= threshold.percent) {
        actions.push(threshold.action);
      }
    });
  }

  return actions;
}

export default {
  calculateDeadline,
  calculateResponseDeadline,
  calculateCompletionDeadline,
  calculateElapsedTime,
  calculateRemainingTime,
  isSLABreached,
  calculateSLAProgress,
  getSLAStatus,
  calculatePausePeriods,
  formatRemainingTime,
  getEscalationActions
};
