/**
 * Maintenance Domain Configuration
 * Defines statuses, actions, and state transition rules for maintenance incidents
 */

import { COLLECTIONS } from '../../config/constants.js';

/**
 * Work Order Statuses (CMMS State Machine)
 */
export const MAINTENANCE_STATUS = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  ON_HOLD: 'On Hold',
  PENDING_PARTS: 'Pending Parts',
  COMPLETED: 'Completed',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled'
};

/**
 * Work Order Priorities
 */
export const MAINTENANCE_PRIORITY = {
  EMERGENCY: 'Emergency',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low'
};

/**
 * Work Order Types
 */
export const WORK_ORDER_TYPE = {
  BREAKDOWN: 'Breakdown',
  PREVENTIVE: 'Preventive',
  INSPECTION: 'Inspection',
  PROJECT: 'Project',
  SAFETY: 'Safety'
};

/**
 * Maintenance Actions (CMMS)
 */
export const MAINTENANCE_ACTIONS = {
  // Creation & Submission
  CREATE_DRAFT: 'create_draft',
  SUBMIT_WO: 'submit_wo',

  // Planning & Approval
  APPROVE_WO: 'approve_wo',
  REJECT_WO: 'reject_wo',

  // Assignment & Execution
  ASSIGN_WO: 'assign_wo',
  REASSIGN_WO: 'reassign_wo',
  START_WORK: 'start_work',

  // Hold & Resume
  PUT_ON_HOLD: 'put_on_hold',
  RESUME_WORK: 'resume_work',

  // Parts Management
  REQUEST_PARTS: 'request_parts',
  RECEIVE_PARTS: 'receive_parts',

  // Completion
  COMPLETE_WORK: 'complete_work',
  CLOSE_WO: 'close_wo',

  // Cancellation
  CANCEL_WO: 'cancel_wo',

  // Updates & Comments
  ADD_COMMENT: 'add_comment',
  UPDATE_PROGRESS: 'update_progress',
  ATTACH_FILE: 'attach_file'
};

/**
 * State Transition Rules (CMMS State Machine)
 * Defines which actions are allowed in each status and what the next status should be
 */
export const MAINTENANCE_TRANSITIONS = {
  [MAINTENANCE_STATUS.DRAFT]: {
    allowedActions: [
      MAINTENANCE_ACTIONS.SUBMIT_WO,
      MAINTENANCE_ACTIONS.CANCEL_WO,
      MAINTENANCE_ACTIONS.ADD_COMMENT,
      MAINTENANCE_ACTIONS.ATTACH_FILE
    ],
    nextStatus: {
      [MAINTENANCE_ACTIONS.SUBMIT_WO]: MAINTENANCE_STATUS.SUBMITTED,
      [MAINTENANCE_ACTIONS.CANCEL_WO]: MAINTENANCE_STATUS.CANCELLED
    }
  },

  [MAINTENANCE_STATUS.SUBMITTED]: {
    allowedActions: [
      MAINTENANCE_ACTIONS.APPROVE_WO,
      MAINTENANCE_ACTIONS.REJECT_WO,
      MAINTENANCE_ACTIONS.CANCEL_WO,
      MAINTENANCE_ACTIONS.ADD_COMMENT,
      MAINTENANCE_ACTIONS.ATTACH_FILE
    ],
    nextStatus: {
      [MAINTENANCE_ACTIONS.APPROVE_WO]: MAINTENANCE_STATUS.APPROVED,
      [MAINTENANCE_ACTIONS.REJECT_WO]: MAINTENANCE_STATUS.DRAFT,
      [MAINTENANCE_ACTIONS.CANCEL_WO]: MAINTENANCE_STATUS.CANCELLED
    }
  },

  [MAINTENANCE_STATUS.APPROVED]: {
    allowedActions: [
      MAINTENANCE_ACTIONS.ASSIGN_WO,
      MAINTENANCE_ACTIONS.CANCEL_WO,
      MAINTENANCE_ACTIONS.ADD_COMMENT,
      MAINTENANCE_ACTIONS.ATTACH_FILE
    ],
    nextStatus: {
      [MAINTENANCE_ACTIONS.ASSIGN_WO]: MAINTENANCE_STATUS.ASSIGNED,
      [MAINTENANCE_ACTIONS.CANCEL_WO]: MAINTENANCE_STATUS.CANCELLED
    }
  },

  [MAINTENANCE_STATUS.ASSIGNED]: {
    allowedActions: [
      MAINTENANCE_ACTIONS.START_WORK,
      MAINTENANCE_ACTIONS.REASSIGN_WO,
      MAINTENANCE_ACTIONS.CANCEL_WO,
      MAINTENANCE_ACTIONS.ADD_COMMENT,
      MAINTENANCE_ACTIONS.ATTACH_FILE
    ],
    nextStatus: {
      [MAINTENANCE_ACTIONS.START_WORK]: MAINTENANCE_STATUS.IN_PROGRESS,
      [MAINTENANCE_ACTIONS.REASSIGN_WO]: MAINTENANCE_STATUS.ASSIGNED,
      [MAINTENANCE_ACTIONS.CANCEL_WO]: MAINTENANCE_STATUS.CANCELLED
    }
  },

  [MAINTENANCE_STATUS.IN_PROGRESS]: {
    allowedActions: [
      MAINTENANCE_ACTIONS.PUT_ON_HOLD,
      MAINTENANCE_ACTIONS.REQUEST_PARTS,
      MAINTENANCE_ACTIONS.COMPLETE_WORK,
      MAINTENANCE_ACTIONS.REASSIGN_WO,
      MAINTENANCE_ACTIONS.ADD_COMMENT,
      MAINTENANCE_ACTIONS.UPDATE_PROGRESS,
      MAINTENANCE_ACTIONS.ATTACH_FILE
    ],
    nextStatus: {
      [MAINTENANCE_ACTIONS.PUT_ON_HOLD]: MAINTENANCE_STATUS.ON_HOLD,
      [MAINTENANCE_ACTIONS.REQUEST_PARTS]: MAINTENANCE_STATUS.PENDING_PARTS,
      [MAINTENANCE_ACTIONS.COMPLETE_WORK]: MAINTENANCE_STATUS.COMPLETED,
      [MAINTENANCE_ACTIONS.REASSIGN_WO]: MAINTENANCE_STATUS.ASSIGNED
    }
  },

  [MAINTENANCE_STATUS.ON_HOLD]: {
    allowedActions: [
      MAINTENANCE_ACTIONS.RESUME_WORK,
      MAINTENANCE_ACTIONS.CANCEL_WO,
      MAINTENANCE_ACTIONS.ADD_COMMENT,
      MAINTENANCE_ACTIONS.ATTACH_FILE
    ],
    nextStatus: {
      [MAINTENANCE_ACTIONS.RESUME_WORK]: MAINTENANCE_STATUS.IN_PROGRESS,
      [MAINTENANCE_ACTIONS.CANCEL_WO]: MAINTENANCE_STATUS.CANCELLED
    }
  },

  [MAINTENANCE_STATUS.PENDING_PARTS]: {
    allowedActions: [
      MAINTENANCE_ACTIONS.RECEIVE_PARTS,
      MAINTENANCE_ACTIONS.CANCEL_WO,
      MAINTENANCE_ACTIONS.ADD_COMMENT,
      MAINTENANCE_ACTIONS.ATTACH_FILE
    ],
    nextStatus: {
      [MAINTENANCE_ACTIONS.RECEIVE_PARTS]: MAINTENANCE_STATUS.IN_PROGRESS,
      [MAINTENANCE_ACTIONS.CANCEL_WO]: MAINTENANCE_STATUS.CANCELLED
    }
  },

  [MAINTENANCE_STATUS.COMPLETED]: {
    allowedActions: [
      MAINTENANCE_ACTIONS.CLOSE_WO,
      MAINTENANCE_ACTIONS.ADD_COMMENT,
      MAINTENANCE_ACTIONS.ATTACH_FILE
    ],
    nextStatus: {
      [MAINTENANCE_ACTIONS.CLOSE_WO]: MAINTENANCE_STATUS.CLOSED
    }
  },

  [MAINTENANCE_STATUS.CLOSED]: {
    allowedActions: [
      MAINTENANCE_ACTIONS.ADD_COMMENT,
      MAINTENANCE_ACTIONS.ATTACH_FILE
    ],
    nextStatus: {}
  },

  [MAINTENANCE_STATUS.CANCELLED]: {
    allowedActions: [
      MAINTENANCE_ACTIONS.ADD_COMMENT
    ],
    nextStatus: {}
  }
};

/**
 * Maintenance Domain Configuration (CMMS)
 */
export const MAINTENANCE_CONFIG = {
  collection: COLLECTIONS.INCIDENTS,
  statuses: MAINTENANCE_STATUS,
  priorities: MAINTENANCE_PRIORITY,
  types: WORK_ORDER_TYPE,
  actions: MAINTENANCE_ACTIONS,
  transitions: MAINTENANCE_TRANSITIONS,

  // Initial status for new work orders
  initialStatus: MAINTENANCE_STATUS.DRAFT,

  // Fields required for work order creation
  requiredFields: {
    draft: ['title', 'type', 'priority', 'equipmentId'],
    submitted: ['title', 'type', 'priority', 'equipmentId', 'description', 'requestedBy'],
    approved: ['title', 'type', 'priority', 'equipmentId', 'description', 'requestedBy', 'estimatedHours']
  },

  // SLA response times in minutes by priority
  slaResponseTimes: {
    [MAINTENANCE_PRIORITY.EMERGENCY]: 15,   // 15 minutes
    [MAINTENANCE_PRIORITY.HIGH]: 60,        // 1 hour
    [MAINTENANCE_PRIORITY.MEDIUM]: 240,     // 4 hours
    [MAINTENANCE_PRIORITY.LOW]: 480         // 8 hours
  },

  // SLA completion times in hours by priority
  slaCompletionTimes: {
    [MAINTENANCE_PRIORITY.EMERGENCY]: 4,    // 4 hours
    [MAINTENANCE_PRIORITY.HIGH]: 24,        // 1 day
    [MAINTENANCE_PRIORITY.MEDIUM]: 72,      // 3 days
    [MAINTENANCE_PRIORITY.LOW]: 168         // 7 days
  },

  // Auto-escalation rules
  escalationRules: {
    enabled: true,
    checkInterval: 15, // Check every 15 minutes
    escalationSteps: [
      { afterMinutes: 30, action: 'notify_supervisor' },
      { afterMinutes: 60, action: 'notify_manager' },
      { afterMinutes: 120, action: 'escalate_priority' }
    ]
  }
};

export default MAINTENANCE_CONFIG;
