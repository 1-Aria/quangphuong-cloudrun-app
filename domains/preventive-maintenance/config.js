/**
 * Preventive Maintenance Configuration
 * Settings for PM schedules, frequencies, and execution
 */

/**
 * Schedule frequencies
 */
export const SCHEDULE_FREQUENCY = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  SEMI_ANNUAL: 'Semi-Annual',
  ANNUAL: 'Annual',
  METER_BASED: 'Meter-Based',
  CUSTOM: 'Custom'
};

/**
 * Schedule status
 */
export const SCHEDULE_STATUS = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  SUSPENDED: 'Suspended',
  COMPLETED: 'Completed'
};

/**
 * PM Work Order priority mapping
 */
export const PM_PRIORITY_MAPPING = {
  [SCHEDULE_FREQUENCY.DAILY]: 'High',
  [SCHEDULE_FREQUENCY.WEEKLY]: 'Medium',
  [SCHEDULE_FREQUENCY.MONTHLY]: 'Medium',
  [SCHEDULE_FREQUENCY.QUARTERLY]: 'Low',
  [SCHEDULE_FREQUENCY.SEMI_ANNUAL]: 'Low',
  [SCHEDULE_FREQUENCY.ANNUAL]: 'Low',
  [SCHEDULE_FREQUENCY.METER_BASED]: 'Medium',
  [SCHEDULE_FREQUENCY.CUSTOM]: 'Medium'
};

/**
 * Checklist item types
 */
export const CHECKLIST_ITEM_TYPE = {
  INSPECTION: 'Inspection',
  MEASUREMENT: 'Measurement',
  ACTION: 'Action',
  VERIFICATION: 'Verification',
  SAFETY_CHECK: 'Safety Check'
};

/**
 * Checklist item status
 */
export const CHECKLIST_ITEM_STATUS = {
  PENDING: 'Pending',
  COMPLETED: 'Completed',
  SKIPPED: 'Skipped',
  FAILED: 'Failed',
  NOT_APPLICABLE: 'Not Applicable'
};

/**
 * PM Configuration
 */
export const PM_CONFIG = {
  collection: 'pm_schedules',
  checklistTemplatesCollection: 'checklist_templates',
  validFrequencies: Object.values(SCHEDULE_FREQUENCY),
  validStatuses: Object.values(SCHEDULE_STATUS),
  defaultLeadTimeDays: 7, // Generate work orders 7 days before due
  overdueGracePeriodDays: 2, // Grace period before marking overdue
  requiredFields: [
    'title',
    'frequency',
    'equipmentId',
    'assignedToId',
    'estimatedDurationHours'
  ]
};

/**
 * Calculate next due date based on frequency
 * @param {Date} lastCompletedDate - Last completion date
 * @param {string} frequency - Schedule frequency
 * @param {number} customDays - Custom interval in days
 * @returns {Date} Next due date
 */
export function calculateNextDueDate(
  lastCompletedDate,
  frequency,
  customDays = null
) {
  const date = new Date(lastCompletedDate);

  switch (frequency) {
    case SCHEDULE_FREQUENCY.DAILY:
      date.setDate(date.getDate() + 1);
      break;

    case SCHEDULE_FREQUENCY.WEEKLY:
      date.setDate(date.getDate() + 7);
      break;

    case SCHEDULE_FREQUENCY.MONTHLY:
      date.setMonth(date.getMonth() + 1);
      break;

    case SCHEDULE_FREQUENCY.QUARTERLY:
      date.setMonth(date.getMonth() + 3);
      break;

    case SCHEDULE_FREQUENCY.SEMI_ANNUAL:
      date.setMonth(date.getMonth() + 6);
      break;

    case SCHEDULE_FREQUENCY.ANNUAL:
      date.setFullYear(date.getFullYear() + 1);
      break;

    case SCHEDULE_FREQUENCY.CUSTOM:
      if (customDays) {
        date.setDate(date.getDate() + customDays);
      } else {
        throw new Error('Custom frequency requires customDays parameter');
      }
      break;

    case SCHEDULE_FREQUENCY.METER_BASED:
      // Meter-based schedules don't use date calculation
      return null;

    default:
      throw new Error(`Invalid frequency: ${frequency}`);
  }

  return date;
}

/**
 * Calculate meter-based next due reading
 * @param {number} lastReading - Last meter reading
 * @param {number} meterInterval - Meter interval
 * @returns {number} Next due reading
 */
export function calculateNextDueReading(lastReading, meterInterval) {
  if (!lastReading || !meterInterval) {
    throw new Error('lastReading and meterInterval are required');
  }
  return lastReading + meterInterval;
}

/**
 * Check if schedule is due
 * @param {Date} nextDueDate - Next due date
 * @param {number} leadTimeDays - Lead time in days
 * @returns {boolean} Is due
 */
export function isScheduleDue(nextDueDate, leadTimeDays = 0) {
  if (!nextDueDate) return false;

  const now = new Date();
  const dueDate = new Date(nextDueDate);

  // Apply lead time
  const leadTimeDate = new Date(dueDate);
  leadTimeDate.setDate(leadTimeDate.getDate() - leadTimeDays);

  return now >= leadTimeDate;
}

/**
 * Check if schedule is overdue
 * @param {Date} nextDueDate - Next due date
 * @param {number} gracePeriodDays - Grace period in days
 * @returns {boolean} Is overdue
 */
export function isScheduleOverdue(nextDueDate, gracePeriodDays = 0) {
  if (!nextDueDate) return false;

  const now = new Date();
  const dueDate = new Date(nextDueDate);

  // Apply grace period
  const overdueDate = new Date(dueDate);
  overdueDate.setDate(overdueDate.getDate() + gracePeriodDays);

  return now > overdueDate;
}

/**
 * Check if meter-based schedule is due
 * @param {number} currentReading - Current meter reading
 * @param {number} nextDueReading - Next due reading
 * @param {number} leadThreshold - Lead threshold percentage (0-100)
 * @returns {boolean} Is due
 */
export function isMeterScheduleDue(
  currentReading,
  nextDueReading,
  leadThreshold = 10
) {
  if (!currentReading || !nextDueReading) return false;

  // Calculate lead reading based on threshold
  const thresholdReading = nextDueReading * (1 - leadThreshold / 100);

  return currentReading >= thresholdReading;
}

/**
 * Calculate schedule completion percentage
 * @param {number} totalCompleted - Total completed executions
 * @param {number} totalScheduled - Total scheduled executions
 * @returns {number} Completion percentage
 */
export function calculateCompletionRate(totalCompleted, totalScheduled) {
  if (!totalScheduled || totalScheduled === 0) return 0;
  return Math.round((totalCompleted / totalScheduled) * 100);
}

/**
 * Calculate average compliance rate
 * @param {number} totalOnTime - Total on-time completions
 * @param {number} totalCompleted - Total completed executions
 * @returns {number} Compliance percentage
 */
export function calculateComplianceRate(totalOnTime, totalCompleted) {
  if (!totalCompleted || totalCompleted === 0) return 0;
  return Math.round((totalOnTime / totalCompleted) * 100);
}

/**
 * Validate checklist item
 * @param {Object} item - Checklist item
 * @throws {Error} If validation fails
 */
export function validateChecklistItem(item) {
  if (!item.description || item.description.trim() === '') {
    throw new Error('Checklist item description is required');
  }

  if (!PM_CONFIG.validItemTypes?.includes(item.type)) {
    if (
      !Object.values(CHECKLIST_ITEM_TYPE).includes(item.type) &&
      item.type !== undefined
    ) {
      throw new Error(`Invalid checklist item type: ${item.type}`);
    }
  }

  if (item.requiresMeasurement) {
    if (!item.measurementUnit) {
      throw new Error('Measurement unit is required for measurement items');
    }
  }
}

/**
 * Validate PM schedule data
 * @param {Object} schedule - Schedule data
 * @throws {Error} If validation fails
 */
export function validateSchedule(schedule) {
  // Check required fields
  const missingFields = PM_CONFIG.requiredFields.filter(
    field => !schedule[field]
  );

  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }

  // Validate frequency
  if (!PM_CONFIG.validFrequencies.includes(schedule.frequency)) {
    throw new Error(`Invalid frequency: ${schedule.frequency}`);
  }

  // Validate meter-based schedule
  if (schedule.frequency === SCHEDULE_FREQUENCY.METER_BASED) {
    if (!schedule.meterInterval || schedule.meterInterval <= 0) {
      throw new Error('Meter interval is required for meter-based schedules');
    }
  }

  // Validate custom frequency
  if (schedule.frequency === SCHEDULE_FREQUENCY.CUSTOM) {
    if (!schedule.customIntervalDays || schedule.customIntervalDays <= 0) {
      throw new Error('Custom interval days is required for custom schedules');
    }
  }

  // Validate duration
  if (
    schedule.estimatedDurationHours &&
    schedule.estimatedDurationHours <= 0
  ) {
    throw new Error('Estimated duration must be greater than 0');
  }

  return true;
}

export default {
  SCHEDULE_FREQUENCY,
  SCHEDULE_STATUS,
  PM_PRIORITY_MAPPING,
  CHECKLIST_ITEM_TYPE,
  CHECKLIST_ITEM_STATUS,
  PM_CONFIG,
  calculateNextDueDate,
  calculateNextDueReading,
  isScheduleDue,
  isScheduleOverdue,
  isMeterScheduleDue,
  calculateCompletionRate,
  calculateComplianceRate,
  validateChecklistItem,
  validateSchedule
};
