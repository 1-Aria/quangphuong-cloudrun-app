/**
 * Notification Configuration
 * Defines notification templates, channels, and recipient rules
 */

/**
 * Notification Channels
 */
export const NOTIFICATION_CHANNELS = {
  ZALO_CS: 'zalo_cs',       // Zalo 1:1 private message
  ZALO_GMF: 'zalo_gmf',     // Zalo group message
  EMAIL: 'email',           // Email (future)
  SMS: 'sms',               // SMS (future)
  PUSH: 'push'              // Push notification (future)
};

/**
 * Notification Event Types
 */
export const NOTIFICATION_EVENTS = {
  // Work Order Lifecycle
  WO_SUBMITTED: 'wo_submitted',
  WO_APPROVED: 'wo_approved',
  WO_REJECTED: 'wo_rejected',
  WO_ASSIGNED: 'wo_assigned',
  WO_REASSIGNED: 'wo_reassigned',
  WO_STARTED: 'wo_started',
  WO_COMPLETED: 'wo_completed',
  WO_CLOSED: 'wo_closed',
  WO_CANCELLED: 'wo_cancelled',
  WO_ON_HOLD: 'wo_on_hold',
  WO_RESUMED: 'wo_resumed',

  // Parts Management
  WO_PARTS_REQUESTED: 'wo_parts_requested',
  WO_PARTS_RECEIVED: 'wo_parts_received',

  // SLA Alerts
  SLA_WARNING_50: 'sla_warning_50',      // 50% time elapsed
  SLA_WARNING_75: 'sla_warning_75',      // 75% time elapsed
  SLA_WARNING_90: 'sla_warning_90',      // 90% time elapsed
  SLA_BREACHED: 'sla_breached',          // SLA missed
  SLA_ESCALATED: 'sla_escalated',        // Auto-escalated

  // Comments & Updates
  WO_COMMENT_ADDED: 'wo_comment_added',
  WO_FILE_ATTACHED: 'wo_file_attached'
};

/**
 * Message Templates
 * Variables: ${variable} will be replaced with actual values
 */
export const MESSAGE_TEMPLATES = {
  [NOTIFICATION_EVENTS.WO_SUBMITTED]: {
    title: 'Work Order Submitted',
    template: `🔔 Work Order Submitted
ID: \${workOrderId}
Title: \${title}
Priority: \${priority}
Type: \${type}
Equipment: \${equipmentName}
Requested by: \${requestedByName}

Awaiting approval from supervisor.`
  },

  [NOTIFICATION_EVENTS.WO_APPROVED]: {
    title: 'Work Order Approved',
    template: `✅ Work Order Approved
ID: \${workOrderId}
Title: \${title}
Priority: \${priority}
Approved by: \${approvedByName}
SLA Deadline: \${slaDeadline}

Ready for assignment to technician.`
  },

  [NOTIFICATION_EVENTS.WO_REJECTED]: {
    title: 'Work Order Rejected',
    template: `❌ Work Order Rejected
ID: \${workOrderId}
Title: \${title}
Reason: \${reason}

Please review and resubmit.`
  },

  [NOTIFICATION_EVENTS.WO_ASSIGNED]: {
    title: 'Work Order Assigned',
    template: `👷 New Work Order Assigned to You
ID: \${workOrderId}
Title: \${title}
Priority: \${priority}
Equipment: \${equipmentName}
Location: \${location}
SLA Deadline: \${slaDeadline}

Please review and start work when ready.`
  },

  [NOTIFICATION_EVENTS.WO_REASSIGNED]: {
    title: 'Work Order Reassigned',
    template: `🔄 Work Order Reassigned
ID: \${workOrderId}
From: \${previousTechnician}
To: \${newTechnician}
Reason: \${reason}

Please coordinate the handover.`
  },

  [NOTIFICATION_EVENTS.WO_STARTED]: {
    title: 'Work Started',
    template: `🔧 Work Started
ID: \${workOrderId}
Title: \${title}
Technician: \${technicianName}
Started at: \${startTime}

Work is now in progress.`
  },

  [NOTIFICATION_EVENTS.WO_COMPLETED]: {
    title: 'Work Completed',
    template: `✔️ Work Order Completed
ID: \${workOrderId}
Title: \${title}
Completed by: \${completedByName}
Duration: \${actualHours} hours

Awaiting closure approval.`
  },

  [NOTIFICATION_EVENTS.WO_CLOSED]: {
    title: 'Work Order Closed',
    template: `🏁 Work Order Closed
ID: \${workOrderId}
Title: \${title}
SLA Response: \${slaResponseMet}
SLA Completion: \${slaCompletionMet}

Work order has been successfully closed.`
  },

  [NOTIFICATION_EVENTS.WO_CANCELLED]: {
    title: 'Work Order Cancelled',
    template: `🚫 Work Order Cancelled
ID: \${workOrderId}
Title: \${title}
Reason: \${reason}

This work order has been cancelled.`
  },

  [NOTIFICATION_EVENTS.WO_ON_HOLD]: {
    title: 'Work Order On Hold',
    template: `⏸️ Work Order On Hold
ID: \${workOrderId}
Title: \${title}
Reason: \${reason}

Work has been paused.`
  },

  [NOTIFICATION_EVENTS.WO_RESUMED]: {
    title: 'Work Resumed',
    template: `▶️ Work Order Resumed
ID: \${workOrderId}
Title: \${title}

Work has resumed.`
  },

  [NOTIFICATION_EVENTS.WO_PARTS_REQUESTED]: {
    title: 'Parts Requested',
    template: `📦 Parts Requested
ID: \${workOrderId}
Parts Count: \${partsCount}
Requested by: \${technicianName}

Please issue requested parts.`
  },

  [NOTIFICATION_EVENTS.WO_PARTS_RECEIVED]: {
    title: 'Parts Received',
    template: `📦 Parts Received
ID: \${workOrderId}
Title: \${title}

Parts have been received. Work can resume.`
  },

  [NOTIFICATION_EVENTS.SLA_WARNING_50]: {
    title: 'SLA Warning - 50%',
    template: `⚠️ SLA Warning: 50% Time Elapsed
ID: \${workOrderId}
Title: \${title}
Priority: \${priority}
Deadline: \${deadline}
Remaining: \${remainingTime}

Please expedite to meet SLA.`
  },

  [NOTIFICATION_EVENTS.SLA_WARNING_75]: {
    title: 'SLA Warning - 75%',
    template: `⚠️ SLA WARNING: 75% Time Elapsed
ID: \${workOrderId}
Title: \${title}
Priority: \${priority}
Deadline: \${deadline}
Remaining: \${remainingTime}

URGENT: SLA deadline approaching!`
  },

  [NOTIFICATION_EVENTS.SLA_WARNING_90]: {
    title: 'SLA Critical - 90%',
    template: `🚨 SLA CRITICAL: 90% Time Elapsed
ID: \${workOrderId}
Title: \${title}
Priority: \${priority}
Deadline: \${deadline}
Remaining: \${remainingTime}

CRITICAL: Immediate action required!`
  },

  [NOTIFICATION_EVENTS.SLA_BREACHED]: {
    title: 'SLA Breached',
    template: `🔴 SLA BREACHED
ID: \${workOrderId}
Title: \${title}
Priority: \${priority}
Deadline: \${deadline}
Overdue by: \${overdueTime}

SLA has been missed. Escalation required.`
  },

  [NOTIFICATION_EVENTS.SLA_ESCALATED]: {
    title: 'SLA Auto-Escalated',
    template: `📈 Auto-Escalated
ID: \${workOrderId}
Title: \${title}
Previous Priority: \${oldPriority}
New Priority: \${newPriority}

Work order has been auto-escalated due to SLA breach.`
  },

  [NOTIFICATION_EVENTS.WO_COMMENT_ADDED]: {
    title: 'New Comment',
    template: `💬 New Comment Added
ID: \${workOrderId}
From: \${userName}
Comment: \${commentText}`
  },

  [NOTIFICATION_EVENTS.WO_FILE_ATTACHED]: {
    title: 'File Attached',
    template: `📎 File Attached
ID: \${workOrderId}
File: \${fileName}
Uploaded by: \${userName}`
  }
};

/**
 * Recipient Rules
 * Defines who should receive notifications for each event
 */
export const RECIPIENT_RULES = {
  [NOTIFICATION_EVENTS.WO_SUBMITTED]: (workOrder) => [
    { type: 'role', role: 'supervisor', message: 'New work order awaiting your approval' }
  ],

  [NOTIFICATION_EVENTS.WO_APPROVED]: (workOrder) => [
    { type: 'user', userId: workOrder.requestedBy, message: 'Your work order has been approved' },
    { type: 'role', role: 'planner', message: 'Work order approved and ready for assignment' }
  ],

  [NOTIFICATION_EVENTS.WO_REJECTED]: (workOrder) => [
    { type: 'user', userId: workOrder.requestedBy, message: 'Your work order was rejected' }
  ],

  [NOTIFICATION_EVENTS.WO_ASSIGNED]: (workOrder) => [
    { type: 'user', userId: workOrder.assignedTo, message: 'You have been assigned a work order' },
    { type: 'user', userId: workOrder.requestedBy, message: 'Your work order has been assigned' }
  ],

  [NOTIFICATION_EVENTS.WO_REASSIGNED]: (workOrder, context) => [
    { type: 'user', userId: workOrder.assignedTo, message: 'Work order reassigned to you' },
    { type: 'user', userId: context.previousTechnicianId, message: 'Work order reassigned to another technician' }
  ],

  [NOTIFICATION_EVENTS.WO_STARTED]: (workOrder) => [
    { type: 'user', userId: workOrder.requestedBy, message: 'Work has started on your request' },
    { type: 'role', role: 'supervisor', message: 'Work started' }
  ],

  [NOTIFICATION_EVENTS.WO_COMPLETED]: (workOrder) => [
    { type: 'user', userId: workOrder.requestedBy, message: 'Work on your order is complete' },
    { type: 'role', role: 'supervisor', message: 'Work order ready for closure' }
  ],

  [NOTIFICATION_EVENTS.WO_CLOSED]: (workOrder) => [
    { type: 'user', userId: workOrder.requestedBy, message: 'Your work order is closed' },
    { type: 'user', userId: workOrder.assignedTo, message: 'Work order closed' }
  ],

  [NOTIFICATION_EVENTS.WO_CANCELLED]: (workOrder, context) => [
    { type: 'user', userId: workOrder.requestedBy, message: 'Your work order was cancelled' },
    { type: 'user', userId: workOrder.assignedTo, message: 'Assigned work order cancelled' }
  ],

  [NOTIFICATION_EVENTS.WO_ON_HOLD]: (workOrder) => [
    { type: 'user', userId: workOrder.requestedBy, message: 'Work on your order is on hold' },
    { type: 'role', role: 'supervisor', message: 'Work order placed on hold' }
  ],

  [NOTIFICATION_EVENTS.WO_PARTS_REQUESTED]: (workOrder) => [
    { type: 'role', role: 'inventory_manager', message: 'Parts requested for work order' },
    { type: 'role', role: 'warehouse_staff', message: 'Parts requested' }
  ],

  [NOTIFICATION_EVENTS.WO_PARTS_RECEIVED]: (workOrder) => [
    { type: 'user', userId: workOrder.assignedTo, message: 'Requested parts have arrived' }
  ],

  [NOTIFICATION_EVENTS.SLA_WARNING_50]: (workOrder) => [
    { type: 'user', userId: workOrder.assignedTo, message: 'SLA warning: 50% time elapsed' }
  ],

  [NOTIFICATION_EVENTS.SLA_WARNING_75]: (workOrder) => [
    { type: 'user', userId: workOrder.assignedTo, message: 'SLA warning: 75% time elapsed' },
    { type: 'role', role: 'supervisor', message: 'SLA warning' }
  ],

  [NOTIFICATION_EVENTS.SLA_WARNING_90]: (workOrder) => [
    { type: 'user', userId: workOrder.assignedTo, message: 'CRITICAL: SLA warning 90%' },
    { type: 'role', role: 'supervisor', message: 'CRITICAL: SLA warning 90%' },
    { type: 'role', role: 'manager', message: 'CRITICAL: SLA approaching deadline' }
  ],

  [NOTIFICATION_EVENTS.SLA_BREACHED]: (workOrder) => [
    { type: 'user', userId: workOrder.assignedTo, message: 'SLA BREACHED' },
    { type: 'role', role: 'supervisor', message: 'SLA BREACHED' },
    { type: 'role', role: 'manager', message: 'SLA BREACHED - immediate action required' }
  ],

  [NOTIFICATION_EVENTS.SLA_ESCALATED]: (workOrder) => [
    { type: 'role', role: 'manager', message: 'Work order auto-escalated' },
    { type: 'role', role: 'supervisor', message: 'Work order auto-escalated' }
  ],

  [NOTIFICATION_EVENTS.WO_COMMENT_ADDED]: (workOrder, context) => {
    // Notify all participants except the commenter
    const recipients = [];

    if (workOrder.assignedTo && workOrder.assignedTo !== context.commenterId) {
      recipients.push({ type: 'user', userId: workOrder.assignedTo });
    }
    if (workOrder.requestedBy && workOrder.requestedBy !== context.commenterId) {
      recipients.push({ type: 'user', userId: workOrder.requestedBy });
    }

    return recipients;
  }
};

/**
 * Channel Selection Rules
 * Determine which channel(s) to use for each event
 */
export const CHANNEL_RULES = {
  // Critical notifications go to multiple channels
  [NOTIFICATION_EVENTS.SLA_BREACHED]: [
    NOTIFICATION_CHANNELS.ZALO_CS,
    NOTIFICATION_CHANNELS.ZALO_GMF
  ],

  [NOTIFICATION_EVENTS.SLA_WARNING_90]: [
    NOTIFICATION_CHANNELS.ZALO_CS,
    NOTIFICATION_CHANNELS.ZALO_GMF
  ],

  // High priority uses both CS and GMF
  [NOTIFICATION_EVENTS.WO_ASSIGNED]: [
    NOTIFICATION_CHANNELS.ZALO_CS,
    NOTIFICATION_CHANNELS.ZALO_GMF
  ],

  [NOTIFICATION_EVENTS.SLA_ESCALATED]: [
    NOTIFICATION_CHANNELS.ZALO_CS,
    NOTIFICATION_CHANNELS.ZALO_GMF
  ],

  // Default: Use Zalo CS (1:1 message) for all other events
  default: [NOTIFICATION_CHANNELS.ZALO_CS]
};

/**
 * Get channels for an event
 * @param {string} eventType - Notification event type
 * @returns {Array<string>} Array of channel types
 */
export function getChannelsForEvent(eventType) {
  return CHANNEL_RULES[eventType] || CHANNEL_RULES.default;
}

/**
 * Format message template with data
 * @param {string} template - Template string
 * @param {Object} data - Data to fill template
 * @returns {string} Formatted message
 */
export function formatMessage(template, data) {
  let message = template;

  Object.keys(data).forEach(key => {
    const placeholder = `\${${key}}`;
    message = message.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), data[key] || '');
  });

  return message;
}

/**
 * Get Zalo Group IDs from environment
 */
export function getZaloGroupIds() {
  return {
    maintenance: process.env.ZALO_GROUP_MAINTENANCE || null,
    supervisors: process.env.ZALO_GROUP_SUPERVISORS || null,
    managers: process.env.ZALO_GROUP_MANAGERS || null,
    all: process.env.ZALO_GROUP_ALL || null
  };
}

export default {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_EVENTS,
  MESSAGE_TEMPLATES,
  RECIPIENT_RULES,
  CHANNEL_RULES,
  getChannelsForEvent,
  formatMessage,
  getZaloGroupIds
};
