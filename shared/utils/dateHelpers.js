/**
 * Date Helper Utilities
 * Provides date formatting, parsing, and manipulation functions
 */

/**
 * Format date to ISO string
 * @param {Date|string|number} date - Date to format
 * @returns {string} ISO formatted date string
 */
export function toISOString(date) {
  if (!date) return null;
  const jsDate = date instanceof Date ? date : new Date(date);
  return jsDate.toISOString();
}

/**
 * Format date to YYYY-MM-DD
 * @param {Date|string|number} date - Date to format
 * @returns {string} Date string in YYYY-MM-DD format
 */
export function toDateString(date) {
  if (!date) return null;
  const jsDate = date instanceof Date ? date : new Date(date);
  return jsDate.toISOString().split('T')[0];
}

/**
 * Format date to HH:MM:SS
 * @param {Date|string|number} date - Date to format
 * @returns {string} Time string in HH:MM:SS format
 */
export function toTimeString(date) {
  if (!date) return null;
  const jsDate = date instanceof Date ? date : new Date(date);
  return jsDate.toTimeString().split(' ')[0];
}

/**
 * Format date for display (DD/MM/YYYY HH:MM)
 * @param {Date|string|number} date - Date to format
 * @param {string} locale - Locale for formatting (default: 'en-US')
 * @returns {string} Formatted date string
 */
export function toDisplayString(date, locale = 'en-US') {
  if (!date) return null;
  const jsDate = date instanceof Date ? date : new Date(date);

  return jsDate.toLocaleString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Get start of day (00:00:00)
 * @param {Date|string|number} date - Date
 * @returns {Date} Start of day
 */
export function startOfDay(date = new Date()) {
  const jsDate = date instanceof Date ? date : new Date(date);
  jsDate.setHours(0, 0, 0, 0);
  return jsDate;
}

/**
 * Get end of day (23:59:59)
 * @param {Date|string|number} date - Date
 * @returns {Date} End of day
 */
export function endOfDay(date = new Date()) {
  const jsDate = date instanceof Date ? date : new Date(date);
  jsDate.setHours(23, 59, 59, 999);
  return jsDate;
}

/**
 * Add days to date
 * @param {Date|string|number} date - Date
 * @param {number} days - Number of days to add (can be negative)
 * @returns {Date} New date
 */
export function addDays(date, days) {
  const jsDate = date instanceof Date ? new Date(date) : new Date(date);
  jsDate.setDate(jsDate.getDate() + days);
  return jsDate;
}

/**
 * Add hours to date
 * @param {Date|string|number} date - Date
 * @param {number} hours - Number of hours to add (can be negative)
 * @returns {Date} New date
 */
export function addHours(date, hours) {
  const jsDate = date instanceof Date ? new Date(date) : new Date(date);
  jsDate.setHours(jsDate.getHours() + hours);
  return jsDate;
}

/**
 * Add minutes to date
 * @param {Date|string|number} date - Date
 * @param {number} minutes - Number of minutes to add (can be negative)
 * @returns {Date} New date
 */
export function addMinutes(date, minutes) {
  const jsDate = date instanceof Date ? new Date(date) : new Date(date);
  jsDate.setMinutes(jsDate.getMinutes() + minutes);
  return jsDate;
}

/**
 * Get difference between two dates in days
 * @param {Date|string|number} date1 - First date
 * @param {Date|string|number} date2 - Second date
 * @returns {number} Difference in days
 */
export function diffInDays(date1, date2) {
  const d1 = date1 instanceof Date ? date1 : new Date(date1);
  const d2 = date2 instanceof Date ? date2 : new Date(date2);
  const diffTime = Math.abs(d2 - d1);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Get difference between two dates in hours
 * @param {Date|string|number} date1 - First date
 * @param {Date|string|number} date2 - Second date
 * @returns {number} Difference in hours
 */
export function diffInHours(date1, date2) {
  const d1 = date1 instanceof Date ? date1 : new Date(date1);
  const d2 = date2 instanceof Date ? date2 : new Date(date2);
  const diffTime = Math.abs(d2 - d1);
  return Math.ceil(diffTime / (1000 * 60 * 60));
}

/**
 * Get difference between two dates in minutes
 * @param {Date|string|number} date1 - First date
 * @param {Date|string|number} date2 - Second date
 * @returns {number} Difference in minutes
 */
export function diffInMinutes(date1, date2) {
  const d1 = date1 instanceof Date ? date1 : new Date(date1);
  const d2 = date2 instanceof Date ? date2 : new Date(date2);
  const diffTime = Math.abs(d2 - d1);
  return Math.ceil(diffTime / (1000 * 60));
}

/**
 * Check if date is in the past
 * @param {Date|string|number} date - Date to check
 * @returns {boolean} True if date is in the past
 */
export function isPast(date) {
  const jsDate = date instanceof Date ? date : new Date(date);
  return jsDate < new Date();
}

/**
 * Check if date is in the future
 * @param {Date|string|number} date - Date to check
 * @returns {boolean} True if date is in the future
 */
export function isFuture(date) {
  const jsDate = date instanceof Date ? date : new Date(date);
  return jsDate > new Date();
}

/**
 * Check if date is today
 * @param {Date|string|number} date - Date to check
 * @returns {boolean} True if date is today
 */
export function isToday(date) {
  const jsDate = date instanceof Date ? date : new Date(date);
  const today = new Date();
  return jsDate.toDateString() === today.toDateString();
}

/**
 * Get relative time string (e.g., "2 hours ago", "in 3 days")
 * @param {Date|string|number} date - Date to format
 * @returns {string} Relative time string
 */
export function getRelativeTime(date) {
  const jsDate = date instanceof Date ? date : new Date(date);
  const now = new Date();
  const diffMs = now - jsDate;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return 'just now';
  } else if (diffMin < 60) {
    return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
  } else if (diffHour < 24) {
    return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
  } else if (diffDay < 7) {
    return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
  } else {
    return toDisplayString(date);
  }
}

/**
 * Parse date from string with various formats
 * @param {string} dateString - Date string
 * @returns {Date|null} Parsed date or null if invalid
 */
export function parseDate(dateString) {
  if (!dateString) return null;

  const date = new Date(dateString);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Check if a date is valid
 * @param {any} date - Value to check
 * @returns {boolean} True if valid date
 */
export function isValidDate(date) {
  if (!date) return false;
  const jsDate = date instanceof Date ? date : new Date(date);
  return !isNaN(jsDate.getTime());
}

export default {
  toISOString,
  toDateString,
  toTimeString,
  toDisplayString,
  startOfDay,
  endOfDay,
  addDays,
  addHours,
  addMinutes,
  diffInDays,
  diffInHours,
  diffInMinutes,
  isPast,
  isFuture,
  isToday,
  getRelativeTime,
  parseDate,
  isValidDate
};
