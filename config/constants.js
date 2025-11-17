/**
 * Global Constants
 * Application-wide constants and enums
 */

/**
 * HTTP Status Codes
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
};

/**
 * Pagination Defaults
 */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 100,
  MAX_LIMIT: 1000
};

/**
 * Collection Names
 * Firestore collection names used across the application
 */
export const COLLECTIONS = {
  // Legacy (to be migrated to WORK_ORDERS)
  INCIDENTS: 'incidents',

  // CMMS Core Collections
  WORK_ORDERS: 'work_orders',
  EQUIPMENT: 'equipment',
  INVENTORY: 'inventory',
  INVENTORY_TRANSACTIONS: 'inventory_transactions',
  CHECKLIST_TEMPLATES: 'checklist_templates',

  // Notification Collections
  NOTIFICATION_HISTORY: 'notification_history',
  ZALO_TOKENS: 'zalo_tokens',
  MESSAGE_CACHE: 'message_cache',

  // System Collections
  ACTIVITY_LOGS: 'activity_logs',
  AUDIT_LOGS: 'audit_logs',
  USERS: 'users',
  COUNTERS: 'counters',

  // Future domain collections
  // SHIPMENTS: 'shipments',
  // EMPLOYEES: 'employees',
  // PRODUCTION_ORDERS: 'production_orders'
};

/**
 * Common Field Names
 */
export const FIELDS = {
  ID: 'id',
  CREATED_AT: 'createdAt',
  UPDATED_AT: 'updatedAt',
  DELETED_AT: 'deletedAt',
  STATUS: 'status'
};

/**
 * Date/Time Formats
 */
export const DATE_FORMATS = {
  ISO: 'YYYY-MM-DDTHH:mm:ss.SSSZ',
  DATE_ONLY: 'YYYY-MM-DD',
  TIME_ONLY: 'HH:mm:ss',
  DISPLAY: 'DD/MM/YYYY HH:mm'
};

/**
 * File Upload Constraints
 */
export const FILE_UPLOAD = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB in bytes
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain'],
  ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.txt']
};

/**
 * Request Constraints
 */
export const REQUEST = {
  MAX_BODY_SIZE: '10mb',
  TIMEOUT: 30000 // 30 seconds in ms
};

/**
 * Cache TTL (Time To Live) in seconds
 */
export const CACHE_TTL = {
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 3600, // 1 hour
  DAY: 86400 // 24 hours
};

/**
 * Validation Constraints
 */
export const VALIDATION = {
  MIN_PASSWORD_LENGTH: 8,
  MAX_STRING_LENGTH: 1000,
  MAX_TEXT_LENGTH: 10000,
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE_REGEX: /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/
};

/**
 * Environment Names
 */
export const ENVIRONMENTS = {
  DEVELOPMENT: 'development',
  STAGING: 'staging',
  PRODUCTION: 'production',
  TEST: 'test'
};

export default {
  HTTP_STATUS,
  PAGINATION,
  COLLECTIONS,
  FIELDS,
  DATE_FORMATS,
  FILE_UPLOAD,
  REQUEST,
  CACHE_TTL,
  VALIDATION,
  ENVIRONMENTS
};
