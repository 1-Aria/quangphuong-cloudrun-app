/**
 * Standardized error codes for programmatic error handling
 * These codes can be used by clients to handle specific error cases
 */

export const ERROR_CODES = {
  // General errors (1xxx)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  BAD_REQUEST: 'BAD_REQUEST',

  // Authentication & Authorization errors (2xxx)
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_API_KEY: 'INVALID_API_KEY',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',

  // Validation errors (3xxx)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',
  INVALID_ACTION: 'INVALID_ACTION',

  // Resource errors (4xxx)
  NOT_FOUND: 'NOT_FOUND',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  INCIDENT_NOT_FOUND: 'INCIDENT_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',

  // Conflict errors (5xxx)
  CONFLICT: 'CONFLICT',
  DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',

  // Database errors (6xxx)
  DATABASE_ERROR: 'DATABASE_ERROR',
  QUERY_FAILED: 'QUERY_FAILED',
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',

  // Storage errors (7xxx)
  STORAGE_ERROR: 'STORAGE_ERROR',
  FILE_UPLOAD_FAILED: 'FILE_UPLOAD_FAILED',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',

  // Business logic errors (8xxx)
  ACTION_NOT_ALLOWED: 'ACTION_NOT_ALLOWED',
  OPERATION_FAILED: 'OPERATION_FAILED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS'
};

/**
 * Get human-readable message for error code
 * @param {string} code - Error code
 * @returns {string} Human-readable message
 */
export function getErrorMessage(code) {
  const messages = {
    [ERROR_CODES.INTERNAL_ERROR]: 'An unexpected error occurred',
    [ERROR_CODES.SERVICE_UNAVAILABLE]: 'Service is temporarily unavailable',
    [ERROR_CODES.BAD_REQUEST]: 'Invalid request',

    [ERROR_CODES.UNAUTHORIZED]: 'Authentication required',
    [ERROR_CODES.FORBIDDEN]: 'Access denied',
    [ERROR_CODES.INVALID_API_KEY]: 'Invalid API key',
    [ERROR_CODES.TOKEN_EXPIRED]: 'Authentication token has expired',

    [ERROR_CODES.VALIDATION_ERROR]: 'Validation failed',
    [ERROR_CODES.MISSING_REQUIRED_FIELD]: 'Required field is missing',
    [ERROR_CODES.INVALID_FORMAT]: 'Invalid format',
    [ERROR_CODES.INVALID_ACTION]: 'Invalid action',

    [ERROR_CODES.NOT_FOUND]: 'Resource not found',
    [ERROR_CODES.RESOURCE_NOT_FOUND]: 'Requested resource not found',
    [ERROR_CODES.INCIDENT_NOT_FOUND]: 'Incident not found',
    [ERROR_CODES.USER_NOT_FOUND]: 'User not found',

    [ERROR_CODES.CONFLICT]: 'Resource conflict',
    [ERROR_CODES.DUPLICATE_RESOURCE]: 'Resource already exists',
    [ERROR_CODES.INVALID_STATE_TRANSITION]: 'Invalid state transition',

    [ERROR_CODES.DATABASE_ERROR]: 'Database operation failed',
    [ERROR_CODES.QUERY_FAILED]: 'Database query failed',
    [ERROR_CODES.TRANSACTION_FAILED]: 'Transaction failed',

    [ERROR_CODES.STORAGE_ERROR]: 'Storage operation failed',
    [ERROR_CODES.FILE_UPLOAD_FAILED]: 'File upload failed',
    [ERROR_CODES.FILE_TOO_LARGE]: 'File size exceeds limit',
    [ERROR_CODES.INVALID_FILE_TYPE]: 'Invalid file type',

    [ERROR_CODES.ACTION_NOT_ALLOWED]: 'Action not allowed',
    [ERROR_CODES.OPERATION_FAILED]: 'Operation failed',
    [ERROR_CODES.INSUFFICIENT_PERMISSIONS]: 'Insufficient permissions'
  };

  return messages[code] || 'An error occurred';
}

export default ERROR_CODES;
