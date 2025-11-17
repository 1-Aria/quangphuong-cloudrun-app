/**
 * Common Validation Utilities
 * Provides validation functions for common data types
 */

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number (international format)
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid phone
 */
export function isValidPhone(phone) {
  if (!phone || typeof phone !== 'string') return false;

  const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;
  return phoneRegex.test(phone);
}

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid URL
 */
export function isValidUrl(url) {
  if (!url || typeof url !== 'string') return false;

  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate UUID format
 * @param {string} uuid - UUID to validate
 * @returns {boolean} True if valid UUID
 */
export function isValidUUID(uuid) {
  if (!uuid || typeof uuid !== 'string') return false;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate string length
 * @param {string} str - String to validate
 * @param {number} min - Minimum length
 * @param {number} max - Maximum length
 * @returns {boolean} True if within range
 */
export function isValidLength(str, min, max) {
  if (typeof str !== 'string') return false;
  const length = str.length;
  return length >= min && length <= max;
}

/**
 * Validate number is within range
 * @param {number} num - Number to validate
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {boolean} True if within range
 */
export function isInRange(num, min, max) {
  if (typeof num !== 'number' || isNaN(num)) return false;
  return num >= min && num <= max;
}

/**
 * Validate alphanumeric string
 * @param {string} str - String to validate
 * @returns {boolean} True if alphanumeric
 */
export function isAlphanumeric(str) {
  if (!str || typeof str !== 'string') return false;
  return /^[a-zA-Z0-9]+$/.test(str);
}

/**
 * Validate string contains only letters
 * @param {string} str - String to validate
 * @returns {boolean} True if only letters
 */
export function isAlpha(str) {
  if (!str || typeof str !== 'string') return false;
  return /^[a-zA-Z]+$/.test(str);
}

/**
 * Validate string contains only numbers
 * @param {string} str - String to validate
 * @returns {boolean} True if only numbers
 */
export function isNumeric(str) {
  if (!str || typeof str !== 'string') return false;
  return /^[0-9]+$/.test(str);
}

/**
 * Validate required fields in object
 * @param {Object} obj - Object to validate
 * @param {Array<string>} requiredFields - Array of required field names
 * @returns {Object} { valid: boolean, missing: Array<string> }
 */
export function validateRequiredFields(obj, requiredFields) {
  if (!obj || typeof obj !== 'object') {
    return { valid: false, missing: requiredFields };
  }

  const missing = requiredFields.filter(field => {
    const value = obj[field];
    return value === undefined || value === null || value === '';
  });

  return {
    valid: missing.length === 0,
    missing
  };
}

/**
 * Validate object against schema
 * Simple schema validation without external dependencies
 * @param {Object} obj - Object to validate
 * @param {Object} schema - Schema definition
 * @returns {Object} { valid: boolean, errors: Array<string> }
 */
export function validateSchema(obj, schema) {
  const errors = [];

  Object.entries(schema).forEach(([field, rules]) => {
    const value = obj[field];

    // Required check
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push(`${field} is required`);
      return;
    }

    // Skip other checks if not required and value is empty
    if (!rules.required && (value === undefined || value === null || value === '')) {
      return;
    }

    // Type check
    if (rules.type && typeof value !== rules.type) {
      errors.push(`${field} must be of type ${rules.type}`);
    }

    // Min length check (for strings)
    if (rules.minLength && typeof value === 'string' && value.length < rules.minLength) {
      errors.push(`${field} must be at least ${rules.minLength} characters`);
    }

    // Max length check (for strings)
    if (rules.maxLength && typeof value === 'string' && value.length > rules.maxLength) {
      errors.push(`${field} must be at most ${rules.maxLength} characters`);
    }

    // Min value check (for numbers)
    if (rules.min !== undefined && typeof value === 'number' && value < rules.min) {
      errors.push(`${field} must be at least ${rules.min}`);
    }

    // Max value check (for numbers)
    if (rules.max !== undefined && typeof value === 'number' && value > rules.max) {
      errors.push(`${field} must be at most ${rules.max}`);
    }

    // Pattern check (for strings)
    if (rules.pattern && typeof value === 'string' && !rules.pattern.test(value)) {
      errors.push(`${field} has invalid format`);
    }

    // Enum check
    if (rules.enum && !rules.enum.includes(value)) {
      errors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
    }

    // Custom validator
    if (rules.validator && typeof rules.validator === 'function') {
      const customResult = rules.validator(value);
      if (customResult !== true) {
        errors.push(customResult || `${field} is invalid`);
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Sanitize string (remove HTML tags, trim, etc.)
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
export function sanitizeString(str) {
  if (!str || typeof str !== 'string') return '';

  return str
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .trim(); // Trim whitespace
}

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @param {Object} options - Validation options
 * @returns {Object} { valid: boolean, strength: string, errors: Array<string> }
 */
export function validatePassword(password, options = {}) {
  const {
    minLength = 8,
    requireUppercase = true,
    requireLowercase = true,
    requireNumbers = true,
    requireSpecialChars = false
  } = options;

  const errors = [];
  let strength = 'weak';

  if (!password || typeof password !== 'string') {
    return { valid: false, strength: 'none', errors: ['Password is required'] };
  }

  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters`);
  }

  if (requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (requireNumbers && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  // Calculate strength
  if (errors.length === 0) {
    let strengthScore = 0;
    if (password.length >= 12) strengthScore++;
    if (/[A-Z]/.test(password)) strengthScore++;
    if (/[a-z]/.test(password)) strengthScore++;
    if (/[0-9]/.test(password)) strengthScore++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strengthScore++;

    if (strengthScore >= 4) strength = 'strong';
    else if (strengthScore >= 3) strength = 'medium';
  }

  return {
    valid: errors.length === 0,
    strength,
    errors
  };
}

export default {
  isValidEmail,
  isValidPhone,
  isValidUrl,
  isValidUUID,
  isValidLength,
  isInRange,
  isAlphanumeric,
  isAlpha,
  isNumeric,
  validateRequiredFields,
  validateSchema,
  sanitizeString,
  validatePassword
};
