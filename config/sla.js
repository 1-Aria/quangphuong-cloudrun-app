/**
 * SLA (Service Level Agreement) Configuration
 * Defines response times, completion times, and escalation rules
 */

import { MAINTENANCE_PRIORITY, WORK_ORDER_TYPE } from '../domains/maintenance/config.js';

/**
 * SLA Response Times (Time to first response)
 * Time in minutes from work order creation to first response/acknowledgment
 */
export const SLA_RESPONSE_TIMES = {
  [MAINTENANCE_PRIORITY.EMERGENCY]: {
    minutes: 15,
    businessHoursOnly: false // Emergency is 24/7
  },
  [MAINTENANCE_PRIORITY.HIGH]: {
    minutes: 60,
    businessHoursOnly: true
  },
  [MAINTENANCE_PRIORITY.MEDIUM]: {
    minutes: 240, // 4 hours
    businessHoursOnly: true
  },
  [MAINTENANCE_PRIORITY.LOW]: {
    minutes: 480, // 8 hours
    businessHoursOnly: true
  }
};

/**
 * SLA Completion Times (Time to complete work order)
 * Time in hours from work order approval to completion
 */
export const SLA_COMPLETION_TIMES = {
  [MAINTENANCE_PRIORITY.EMERGENCY]: {
    hours: 4,
    businessHoursOnly: false
  },
  [MAINTENANCE_PRIORITY.HIGH]: {
    hours: 24,
    businessHoursOnly: true
  },
  [MAINTENANCE_PRIORITY.MEDIUM]: {
    hours: 72,
    businessHoursOnly: true
  },
  [MAINTENANCE_PRIORITY.LOW]: {
    hours: 168, // 7 days
    businessHoursOnly: true
  }
};

/**
 * Work Order Type specific SLA overrides
 * Some work order types may have different SLA requirements
 */
export const TYPE_SLA_OVERRIDES = {
  [WORK_ORDER_TYPE.BREAKDOWN]: {
    // Breakdowns are treated with higher urgency
    [MAINTENANCE_PRIORITY.MEDIUM]: {
      response: { minutes: 120, businessHoursOnly: true },
      completion: { hours: 48, businessHoursOnly: true }
    },
    [MAINTENANCE_PRIORITY.LOW]: {
      response: { minutes: 240, businessHoursOnly: true },
      completion: { hours: 120, businessHoursOnly: true }
    }
  },
  [WORK_ORDER_TYPE.SAFETY]: {
    // Safety issues get emergency treatment regardless of stated priority
    [MAINTENANCE_PRIORITY.HIGH]: {
      response: { minutes: 15, businessHoursOnly: false },
      completion: { hours: 8, businessHoursOnly: false }
    },
    [MAINTENANCE_PRIORITY.MEDIUM]: {
      response: { minutes: 30, businessHoursOnly: false },
      completion: { hours: 12, businessHoursOnly: false }
    }
  },
  [WORK_ORDER_TYPE.PREVENTIVE]: {
    // Preventive maintenance has more flexible SLA
    [MAINTENANCE_PRIORITY.MEDIUM]: {
      response: { minutes: 480, businessHoursOnly: true },
      completion: { hours: 120, businessHoursOnly: true }
    }
  }
};

/**
 * Escalation Rules
 * Define what happens when SLA deadlines are approaching or breached
 */
export const ESCALATION_RULES = {
  enabled: true,

  // Warning thresholds (percentage of SLA time elapsed)
  warningThresholds: [
    { percent: 50, action: 'warning_notification' },
    { percent: 75, action: 'urgent_notification' },
    { percent: 90, action: 'critical_notification' }
  ],

  // Actions when SLA is breached
  breachActions: {
    response: [
      { action: 'notify_supervisor', delay: 0 },
      { action: 'notify_manager', delay: 30 }, // 30 minutes after breach
      { action: 'create_incident_report', delay: 60 }
    ],
    completion: [
      { action: 'notify_supervisor', delay: 0 },
      { action: 'notify_department_head', delay: 60 },
      { action: 'escalate_priority', delay: 120 }
    ]
  },

  // Auto-escalation settings
  autoEscalation: {
    enabled: true,
    escalateAfterMinutes: 120, // Auto-escalate priority if overdue by 2 hours
    maxPriority: MAINTENANCE_PRIORITY.HIGH // Don't auto-escalate beyond HIGH
  }
};

/**
 * SLA Calculation Methods
 */
export const SLA_CALCULATION = {
  // How to calculate business hours
  businessHours: {
    method: 'strict', // 'strict' or 'lenient'
    // strict: Only count actual business hours (8am-5pm)
    // lenient: Count full 24 hours on business days
  },

  // Grace periods (buffer time added to deadlines)
  gracePeriods: {
    response: 5, // 5 minutes grace period for response
    completion: 60 // 1 hour grace period for completion
  },

  // Pause SLA during certain conditions
  pauseConditions: {
    onHold: true, // Pause when work order is on hold
    pendingParts: true, // Pause when waiting for parts
    pendingApproval: false, // Don't pause during approval process
    afterBusinessHours: false // Don't pause outside business hours for emergency
  }
};

/**
 * SLA Metrics and KPIs
 */
export const SLA_METRICS = {
  // Target compliance rates
  targets: {
    responseCompliance: 95, // 95% of work orders should meet response SLA
    completionCompliance: 90, // 90% of work orders should meet completion SLA
    overallCompliance: 92 // 92% overall SLA compliance target
  },

  // Reporting periods
  reportingPeriods: ['daily', 'weekly', 'monthly', 'quarterly'],

  // Metrics to track
  metricsToTrack: [
    'average_response_time',
    'average_completion_time',
    'response_sla_compliance',
    'completion_sla_compliance',
    'overdue_work_orders',
    'escalated_work_orders',
    'breach_count_by_priority',
    'breach_count_by_type'
  ]
};

/**
 * Get SLA response time for priority and type
 * @param {string} priority - Work order priority
 * @param {string} type - Work order type
 * @returns {Object} SLA response configuration
 */
export function getResponseSLA(priority, type) {
  // Check for type-specific override
  if (TYPE_SLA_OVERRIDES[type]?.[priority]?.response) {
    return TYPE_SLA_OVERRIDES[type][priority].response;
  }

  // Return default for priority
  return SLA_RESPONSE_TIMES[priority] || SLA_RESPONSE_TIMES[MAINTENANCE_PRIORITY.MEDIUM];
}

/**
 * Get SLA completion time for priority and type
 * @param {string} priority - Work order priority
 * @param {string} type - Work order type
 * @returns {Object} SLA completion configuration
 */
export function getCompletionSLA(priority, type) {
  // Check for type-specific override
  if (TYPE_SLA_OVERRIDES[type]?.[priority]?.completion) {
    return TYPE_SLA_OVERRIDES[type][priority].completion;
  }

  // Return default for priority
  return SLA_COMPLETION_TIMES[priority] || SLA_COMPLETION_TIMES[MAINTENANCE_PRIORITY.MEDIUM];
}

/**
 * Check if SLA should be paused for a given status
 * @param {string} status - Work order status
 * @returns {boolean} True if SLA should be paused
 */
export function shouldPauseSLA(status) {
  const pauseStatuses = [];

  if (SLA_CALCULATION.pauseConditions.onHold) {
    pauseStatuses.push('On Hold');
  }

  if (SLA_CALCULATION.pauseConditions.pendingParts) {
    pauseStatuses.push('Pending Parts');
  }

  if (SLA_CALCULATION.pauseConditions.pendingApproval) {
    pauseStatuses.push('Submitted');
  }

  return pauseStatuses.includes(status);
}

export default {
  SLA_RESPONSE_TIMES,
  SLA_COMPLETION_TIMES,
  TYPE_SLA_OVERRIDES,
  ESCALATION_RULES,
  SLA_CALCULATION,
  SLA_METRICS,
  getResponseSLA,
  getCompletionSLA,
  shouldPauseSLA
};
