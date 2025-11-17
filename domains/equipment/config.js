/**
 * Equipment Management Configuration
 * Defines equipment statuses, categories, and business rules
 */

/**
 * Equipment Status
 */
export const EQUIPMENT_STATUS = {
  OPERATIONAL: 'Operational',
  DOWN: 'Down',
  MAINTENANCE: 'Under Maintenance',
  RETIRED: 'Retired',
  RESERVED: 'Reserved'
};

/**
 * Equipment Criticality Levels
 */
export const EQUIPMENT_CRITICALITY = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low'
};

/**
 * Equipment Categories
 */
export const EQUIPMENT_CATEGORIES = {
  PRODUCTION: 'Production Equipment',
  HVAC: 'HVAC Systems',
  ELECTRICAL: 'Electrical Systems',
  MECHANICAL: 'Mechanical Systems',
  IT: 'IT Equipment',
  FACILITY: 'Facility Equipment',
  SAFETY: 'Safety Equipment',
  TOOLS: 'Tools & Instruments',
  VEHICLES: 'Vehicles',
  OTHER: 'Other'
};

/**
 * Maintenance Types
 */
export const MAINTENANCE_TYPES = {
  PREVENTIVE: 'Preventive',
  CORRECTIVE: 'Corrective',
  PREDICTIVE: 'Predictive',
  INSPECTION: 'Inspection'
};

/**
 * Equipment Configuration
 */
export const EQUIPMENT_CONFIG = {
  collection: 'equipment',

  // Valid status values
  validStatuses: Object.values(EQUIPMENT_STATUS),

  // Valid criticality levels
  validCriticalities: Object.values(EQUIPMENT_CRITICALITY),

  // Valid categories
  validCategories: Object.values(EQUIPMENT_CATEGORIES),

  // Maintenance interval units
  maintenanceIntervalUnits: ['days', 'weeks', 'months', 'years', 'hours', 'cycles'],

  // Required fields for equipment creation
  requiredFields: [
    'equipmentId',
    'name',
    'category',
    'status',
    'criticality'
  ],

  // Fields that can be updated
  updatableFields: [
    'name',
    'description',
    'category',
    'status',
    'criticality',
    'location',
    'department',
    'manufacturer',
    'model',
    'serialNumber',
    'purchaseDate',
    'purchaseCost',
    'warrantyExpiryDate',
    'specifications',
    'parentEquipmentId',
    'assignedTo',
    'notes'
  ],

  // Metrics to track
  metrics: {
    mtbf: true,           // Mean Time Between Failures
    mttr: true,           // Mean Time To Repair
    availability: true,   // Equipment Availability %
    utilizationRate: true // Equipment Utilization %
  }
};

/**
 * Status Transition Rules
 * Defines which status transitions are allowed
 */
export const STATUS_TRANSITIONS = {
  [EQUIPMENT_STATUS.OPERATIONAL]: [
    EQUIPMENT_STATUS.DOWN,
    EQUIPMENT_STATUS.MAINTENANCE,
    EQUIPMENT_STATUS.RESERVED,
    EQUIPMENT_STATUS.RETIRED
  ],
  [EQUIPMENT_STATUS.DOWN]: [
    EQUIPMENT_STATUS.MAINTENANCE,
    EQUIPMENT_STATUS.OPERATIONAL,
    EQUIPMENT_STATUS.RETIRED
  ],
  [EQUIPMENT_STATUS.MAINTENANCE]: [
    EQUIPMENT_STATUS.OPERATIONAL,
    EQUIPMENT_STATUS.DOWN,
    EQUIPMENT_STATUS.RETIRED
  ],
  [EQUIPMENT_STATUS.RESERVED]: [
    EQUIPMENT_STATUS.OPERATIONAL,
    EQUIPMENT_STATUS.DOWN,
    EQUIPMENT_STATUS.MAINTENANCE
  ],
  [EQUIPMENT_STATUS.RETIRED]: [] // Terminal state - no transitions allowed
};

/**
 * Validate status transition
 * @param {string} currentStatus - Current equipment status
 * @param {string} newStatus - Target status
 * @returns {boolean} True if transition is valid
 */
export function isValidStatusTransition(currentStatus, newStatus) {
  if (currentStatus === newStatus) {
    return true; // Same status is always valid
  }

  const allowedTransitions = STATUS_TRANSITIONS[currentStatus];
  return allowedTransitions && allowedTransitions.includes(newStatus);
}

/**
 * Calculate MTBF (Mean Time Between Failures)
 * @param {Array} maintenanceHistory - Array of maintenance records
 * @param {Date} startDate - Start date for calculation
 * @param {Date} endDate - End date for calculation
 * @returns {number} MTBF in hours
 */
export function calculateMTBF(maintenanceHistory, startDate, endDate) {
  const failures = maintenanceHistory.filter(record =>
    record.type === MAINTENANCE_TYPES.CORRECTIVE &&
    record.date >= startDate &&
    record.date <= endDate
  );

  if (failures.length === 0) {
    return null; // No failures in period
  }

  const totalTimeHours = (endDate - startDate) / (1000 * 60 * 60);
  return totalTimeHours / failures.length;
}

/**
 * Calculate MTTR (Mean Time To Repair)
 * @param {Array} maintenanceHistory - Array of maintenance records
 * @param {Date} startDate - Start date for calculation
 * @param {Date} endDate - End date for calculation
 * @returns {number} MTTR in hours
 */
export function calculateMTTR(maintenanceHistory, startDate, endDate) {
  const repairs = maintenanceHistory.filter(record =>
    record.type === MAINTENANCE_TYPES.CORRECTIVE &&
    record.completedDate &&
    record.startDate &&
    record.completedDate >= startDate &&
    record.completedDate <= endDate
  );

  if (repairs.length === 0) {
    return null; // No repairs in period
  }

  const totalRepairTime = repairs.reduce((sum, record) => {
    const repairTime = (record.completedDate - record.startDate) / (1000 * 60 * 60);
    return sum + repairTime;
  }, 0);

  return totalRepairTime / repairs.length;
}

/**
 * Calculate equipment availability
 * @param {number} totalTime - Total time period in hours
 * @param {number} downtime - Total downtime in hours
 * @returns {number} Availability percentage (0-100)
 */
export function calculateAvailability(totalTime, downtime) {
  if (totalTime === 0) {
    return 0;
  }

  const uptime = totalTime - downtime;
  return (uptime / totalTime) * 100;
}

/**
 * Determine if equipment is due for maintenance
 * @param {Object} equipment - Equipment object
 * @param {Date} currentDate - Current date
 * @returns {boolean} True if maintenance is due
 */
export function isMaintenanceDue(equipment, currentDate = new Date()) {
  if (!equipment.nextMaintenanceDate) {
    return false;
  }

  return currentDate >= new Date(equipment.nextMaintenanceDate);
}

/**
 * Calculate next maintenance date
 * @param {Date} lastMaintenanceDate - Last maintenance date
 * @param {number} interval - Maintenance interval
 * @param {string} unit - Interval unit (days, weeks, months, years)
 * @returns {Date} Next maintenance date
 */
export function calculateNextMaintenanceDate(lastMaintenanceDate, interval, unit) {
  const date = new Date(lastMaintenanceDate);

  switch (unit) {
    case 'days':
      date.setDate(date.getDate() + interval);
      break;
    case 'weeks':
      date.setDate(date.getDate() + (interval * 7));
      break;
    case 'months':
      date.setMonth(date.getMonth() + interval);
      break;
    case 'years':
      date.setFullYear(date.getFullYear() + interval);
      break;
    case 'hours':
      date.setHours(date.getHours() + interval);
      break;
    default:
      throw new Error(`Invalid maintenance interval unit: ${unit}`);
  }

  return date;
}

export default {
  EQUIPMENT_STATUS,
  EQUIPMENT_CRITICALITY,
  EQUIPMENT_CATEGORIES,
  MAINTENANCE_TYPES,
  EQUIPMENT_CONFIG,
  STATUS_TRANSITIONS,
  isValidStatusTransition,
  calculateMTBF,
  calculateMTTR,
  calculateAvailability,
  isMaintenanceDue,
  calculateNextMaintenanceDate
};
