/**
 * SLA Configuration
 * Service Level Agreement rules and calculations
 */

/**
 * SLA Types
 */
export const SLA_TYPE = {
  RESPONSE: 'Response',   // Time to acknowledge/assign
  RESOLUTION: 'Resolution' // Time to resolve/close
};

/**
 * SLA Status
 */
export const SLA_STATUS = {
  ON_TRACK: 'On Track',
  AT_RISK: 'At Risk',     // Within warning threshold
  BREACHED: 'Breached'
};

/**
 * Escalation Levels
 */
export const ESCALATION_LEVEL = {
  NONE: 'None',
  LEVEL_1: 'Level 1',     // Supervisor
  LEVEL_2: 'Level 2',     // Manager
  LEVEL_3: 'Level 3'      // Plant Manager
};

/**
 * SLA Configuration by Priority
 * Times in minutes
 */
export const SLA_RULES = {
  Critical: {
    responseSLA: 15,        // 15 minutes
    resolutionSLA: 120,     // 2 hours
    warningThreshold: 0.8   // 80% of time elapsed
  },
  High: {
    responseSLA: 60,        // 1 hour
    resolutionSLA: 480,     // 8 hours
    warningThreshold: 0.8
  },
  Medium: {
    responseSLA: 240,       // 4 hours
    resolutionSLA: 2880,    // 48 hours
    warningThreshold: 0.8
  },
  Low: {
    responseSLA: 1440,      // 1 business day (24 hours)
    resolutionSLA: 7200,    // 5 business days (120 hours)
    warningThreshold: 0.8
  }
};

/**
 * SLA Configuration
 */
export const SLA_CONFIG = {
  collection: 'work_orders',
  pauseOnHold: true,              // Pause SLA when work order is ON_HOLD
  businessHoursOnly: false,       // For now, 24/7. Can be changed to business hours
  warningNotificationMinutes: 30, // Notify X minutes before breach
  escalationDelayMinutes: 15,     // Delay between escalation levels
  autoEscalate: true
};

/**
 * Calculate SLA deadlines based on priority
 * @param {Date} startTime - Start time
 * @param {string} priority - Work order priority
 * @returns {Object} SLA deadlines
 */
export function calculateSLADeadlines(startTime, priority) {
  const rules = SLA_RULES[priority];

  if (!rules) {
    throw new Error(`Invalid priority: ${priority}`);
  }

  const responseBy = new Date(startTime.getTime() + rules.responseSLA * 60 * 1000);
  const resolveBy = new Date(startTime.getTime() + rules.resolutionSLA * 60 * 1000);

  return {
    responseBy,
    resolveBy,
    responseSLAMinutes: rules.responseSLA,
    resolutionSLAMinutes: rules.resolutionSLA
  };
}

/**
 * Calculate SLA status
 * @param {Date} deadline - SLA deadline
 * @param {Date} now - Current time
 * @param {number} warningThreshold - Warning threshold (0-1)
 * @returns {string} SLA status
 */
export function calculateSLAStatus(deadline, now = new Date(), warningThreshold = 0.8) {
  if (now > deadline) {
    return SLA_STATUS.BREACHED;
  }

  // Calculate elapsed percentage
  const totalTime = deadline.getTime();
  const elapsed = now.getTime();
  const elapsedPercentage = elapsed / totalTime;

  if (elapsedPercentage >= warningThreshold) {
    return SLA_STATUS.AT_RISK;
  }

  return SLA_STATUS.ON_TRACK;
}

/**
 * Calculate time remaining in minutes
 * @param {Date} deadline - SLA deadline
 * @param {Date} now - Current time
 * @returns {number} Minutes remaining (negative if breached)
 */
export function calculateTimeRemaining(deadline, now = new Date()) {
  const diff = deadline.getTime() - now.getTime();
  return Math.round(diff / (1000 * 60));
}

/**
 * Check if SLA is breached
 * @param {Date} deadline - SLA deadline
 * @param {Date} now - Current time
 * @returns {boolean} True if breached
 */
export function isSLABreached(deadline, now = new Date()) {
  return now > deadline;
}

/**
 * Check if SLA warning should be sent
 * @param {Date} deadline - SLA deadline
 * @param {Date} now - Current time
 * @returns {boolean} True if warning should be sent
 */
export function shouldSendWarning(deadline, now = new Date()) {
  const minutesRemaining = calculateTimeRemaining(deadline, now);
  return minutesRemaining > 0 &&
         minutesRemaining <= SLA_CONFIG.warningNotificationMinutes;
}

/**
 * Calculate pause duration in minutes
 * @param {Date} pauseStart - Pause start time
 * @param {Date} pauseEnd - Pause end time (or now if still paused)
 * @returns {number} Pause duration in minutes
 */
export function calculatePauseDuration(pauseStart, pauseEnd = new Date()) {
  const diff = pauseEnd.getTime() - pauseStart.getTime();
  return Math.round(diff / (1000 * 60));
}

/**
 * Adjust deadline for pause
 * @param {Date} originalDeadline - Original deadline
 * @param {number} pauseMinutes - Minutes to add
 * @returns {Date} Adjusted deadline
 */
export function adjustDeadlineForPause(originalDeadline, pauseMinutes) {
  return new Date(originalDeadline.getTime() + pauseMinutes * 60 * 1000);
}

/**
 * Determine escalation level based on breach duration
 * @param {number} breachMinutes - Minutes since breach
 * @returns {string} Escalation level
 */
export function determineEscalationLevel(breachMinutes) {
  if (breachMinutes <= 0) {
    return ESCALATION_LEVEL.NONE;
  }

  if (breachMinutes < SLA_CONFIG.escalationDelayMinutes) {
    return ESCALATION_LEVEL.LEVEL_1;
  }

  if (breachMinutes < SLA_CONFIG.escalationDelayMinutes * 2) {
    return ESCALATION_LEVEL.LEVEL_2;
  }

  return ESCALATION_LEVEL.LEVEL_3;
}

/**
 * Get escalation targets by level
 * @param {string} level - Escalation level
 * @returns {Array<string>} Role names to escalate to
 */
export function getEscalationTargets(level) {
  switch (level) {
    case ESCALATION_LEVEL.LEVEL_1:
      return ['supervisor'];
    case ESCALATION_LEVEL.LEVEL_2:
      return ['supervisor', 'manager'];
    case ESCALATION_LEVEL.LEVEL_3:
      return ['supervisor', 'manager', 'admin'];
    default:
      return [];
  }
}

export default {
  SLA_TYPE,
  SLA_STATUS,
  ESCALATION_LEVEL,
  SLA_RULES,
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
};
