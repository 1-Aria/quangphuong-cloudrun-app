/**
 * Business Hours Configuration
 * Defines working hours, holidays, and timezone settings
 */

/**
 * Timezone configuration
 */
export const TIMEZONE = {
  default: 'Asia/Ho_Chi_Minh', // Vietnam timezone (UTC+7)
  displayFormat: 'DD/MM/YYYY HH:mm'
};

/**
 * Working days (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
 */
export const WORKING_DAYS = [1, 2, 3, 4, 5, 6]; // Monday to Saturday

/**
 * Business hours (24-hour format)
 */
export const BUSINESS_HOURS = {
  start: { hour: 8, minute: 0 },   // 8:00 AM
  end: { hour: 17, minute: 0 },    // 5:00 PM
  lunchBreak: {
    enabled: true,
    start: { hour: 12, minute: 0 }, // 12:00 PM
    end: { hour: 13, minute: 0 }    // 1:00 PM
  }
};

/**
 * Total business hours per day (excluding lunch break)
 */
export const HOURS_PER_BUSINESS_DAY = 8; // 9 hours - 1 hour lunch = 8 hours

/**
 * Company holidays (YYYY-MM-DD format)
 * These dates will be treated as non-working days
 */
export const COMPANY_HOLIDAYS = [
  // 2025 Vietnam Public Holidays
  '2025-01-01', // New Year's Day
  '2025-01-28', // Tet Holiday Eve
  '2025-01-29', // Tet Holiday (Lunar New Year) - Day 1
  '2025-01-30', // Tet Holiday - Day 2
  '2025-01-31', // Tet Holiday - Day 3
  '2025-02-01', // Tet Holiday - Day 4
  '2025-02-02', // Tet Holiday - Day 5
  '2025-04-10', // Hung Kings' Commemoration Day
  '2025-04-30', // Reunification Day
  '2025-05-01', // International Labor Day
  '2025-09-02', // National Day

  // Add more holidays as needed
];

/**
 * Emergency override settings
 * For emergency work orders, these settings can override normal business hours
 */
export const EMERGENCY_SETTINGS = {
  // Emergency work orders are handled 24/7
  use24x7: true,

  // If use24x7 is false, define emergency hours
  emergencyHours: {
    start: { hour: 0, minute: 0 },
    end: { hour: 23, minute: 59 }
  },

  // Emergency work orders work on all days including weekends and holidays
  workOnHolidays: true,
  workOnWeekends: true
};

/**
 * Shift configurations (for multi-shift operations)
 */
export const SHIFTS = {
  enabled: false, // Set to true if using shift-based operations
  shifts: [
    {
      name: 'Morning Shift',
      start: { hour: 6, minute: 0 },
      end: { hour: 14, minute: 0 }
    },
    {
      name: 'Afternoon Shift',
      start: { hour: 14, minute: 0 },
      end: { hour: 22, minute: 0 }
    },
    {
      name: 'Night Shift',
      start: { hour: 22, minute: 0 },
      end: { hour: 6, minute: 0 }
    }
  ]
};

/**
 * Check if a date is a working day
 * @param {Date} date - Date to check
 * @returns {boolean} True if it's a working day
 */
export function isWorkingDay(date) {
  const dayOfWeek = date.getDay();
  const dateString = date.toISOString().split('T')[0];

  // Check if it's a weekend (not in working days)
  if (!WORKING_DAYS.includes(dayOfWeek)) {
    return false;
  }

  // Check if it's a company holiday
  if (COMPANY_HOLIDAYS.includes(dateString)) {
    return false;
  }

  return true;
}

/**
 * Check if a time is within business hours
 * @param {Date} date - Date and time to check
 * @returns {boolean} True if within business hours
 */
export function isWithinBusinessHours(date) {
  const hour = date.getHours();
  const minute = date.getMinutes();
  const timeInMinutes = hour * 60 + minute;

  const startTime = BUSINESS_HOURS.start.hour * 60 + BUSINESS_HOURS.start.minute;
  const endTime = BUSINESS_HOURS.end.hour * 60 + BUSINESS_HOURS.end.minute;

  // Check if time is within main business hours
  if (timeInMinutes < startTime || timeInMinutes >= endTime) {
    return false;
  }

  // Check if time is during lunch break
  if (BUSINESS_HOURS.lunchBreak.enabled) {
    const lunchStart = BUSINESS_HOURS.lunchBreak.start.hour * 60 + BUSINESS_HOURS.lunchBreak.start.minute;
    const lunchEnd = BUSINESS_HOURS.lunchBreak.end.hour * 60 + BUSINESS_HOURS.lunchBreak.end.minute;

    if (timeInMinutes >= lunchStart && timeInMinutes < lunchEnd) {
      return false;
    }
  }

  return true;
}

/**
 * Check if a date/time is a business time (working day + business hours)
 * @param {Date} date - Date and time to check
 * @returns {boolean} True if it's business time
 */
export function isBusinessTime(date) {
  return isWorkingDay(date) && isWithinBusinessHours(date);
}

/**
 * Get the next business day
 * @param {Date} date - Starting date
 * @returns {Date} Next business day
 */
export function getNextBusinessDay(date) {
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);

  while (!isWorkingDay(nextDay)) {
    nextDay.setDate(nextDay.getDate() + 1);
  }

  return nextDay;
}

/**
 * Get the start of business hours for a given date
 * @param {Date} date - Date
 * @returns {Date} Start of business hours
 */
export function getBusinessHoursStart(date) {
  const businessStart = new Date(date);
  businessStart.setHours(BUSINESS_HOURS.start.hour, BUSINESS_HOURS.start.minute, 0, 0);
  return businessStart;
}

/**
 * Get the end of business hours for a given date
 * @param {Date} date - Date
 * @returns {Date} End of business hours
 */
export function getBusinessHoursEnd(date) {
  const businessEnd = new Date(date);
  businessEnd.setHours(BUSINESS_HOURS.end.hour, BUSINESS_HOURS.end.minute, 0, 0);
  return businessEnd;
}

export default {
  TIMEZONE,
  WORKING_DAYS,
  BUSINESS_HOURS,
  HOURS_PER_BUSINESS_DAY,
  COMPANY_HOLIDAYS,
  EMERGENCY_SETTINGS,
  SHIFTS,
  isWorkingDay,
  isWithinBusinessHours,
  isBusinessTime,
  getNextBusinessDay,
  getBusinessHoursStart,
  getBusinessHoursEnd
};
