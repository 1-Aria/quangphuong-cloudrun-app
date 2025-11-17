/**
 * Structured Logger for Google Cloud Logging
 * Provides JSON-formatted logs with severity levels and metadata
 */

/**
 * Log severity levels (aligned with Google Cloud Logging)
 */
export const LOG_LEVELS = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  NOTICE: 'NOTICE',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
  CRITICAL: 'CRITICAL',
  ALERT: 'ALERT',
  EMERGENCY: 'EMERGENCY'
};

/**
 * Base log function
 * @param {string} severity - Log severity level
 * @param {string|Object} message - Log message or structured data
 * @param {Object} metadata - Additional metadata
 */
function log(severity, message, metadata = {}) {
  const logEntry = {
    severity,
    timestamp: new Date().toISOString(),
    ...(typeof message === 'string' ? { message } : message),
    ...metadata
  };

  // Add trace context if available (for Cloud Trace integration)
  if (global.traceContext) {
    logEntry.trace = global.traceContext.trace;
    logEntry.spanId = global.traceContext.spanId;
  }

  const output = JSON.stringify(logEntry);

  // Route to appropriate console method based on severity
  switch (severity) {
    case LOG_LEVELS.ERROR:
    case LOG_LEVELS.CRITICAL:
    case LOG_LEVELS.ALERT:
    case LOG_LEVELS.EMERGENCY:
      console.error(output);
      break;
    case LOG_LEVELS.WARNING:
      console.warn(output);
      break;
    default:
      console.log(output);
  }
}

/**
 * Log debug message
 * @param {string|Object} message - Log message or structured data
 * @param {Object} metadata - Additional metadata
 */
export function debug(message, metadata = {}) {
  log(LOG_LEVELS.DEBUG, message, metadata);
}

/**
 * Log info message
 * @param {string|Object} message - Log message or structured data
 * @param {Object} metadata - Additional metadata
 */
export function info(message, metadata = {}) {
  log(LOG_LEVELS.INFO, message, metadata);
}

/**
 * Log notice message
 * @param {string|Object} message - Log message or structured data
 * @param {Object} metadata - Additional metadata
 */
export function notice(message, metadata = {}) {
  log(LOG_LEVELS.NOTICE, message, metadata);
}

/**
 * Log warning message
 * @param {string|Object} message - Log message or structured data
 * @param {Object} metadata - Additional metadata
 */
export function warn(message, metadata = {}) {
  log(LOG_LEVELS.WARNING, message, metadata);
}

/**
 * Log error message
 * @param {string|Object|Error} message - Log message, structured data, or Error object
 * @param {Object} metadata - Additional metadata
 */
export function error(message, metadata = {}) {
  const logData = message instanceof Error
    ? {
        message: message.message,
        stack: message.stack,
        name: message.name,
        ...(message.statusCode && { statusCode: message.statusCode }),
        ...(message.errorCode && { errorCode: message.errorCode })
      }
    : message;

  log(LOG_LEVELS.ERROR, logData, metadata);
}

/**
 * Log critical error message
 * @param {string|Object|Error} message - Log message, structured data, or Error object
 * @param {Object} metadata - Additional metadata
 */
export function critical(message, metadata = {}) {
  const logData = message instanceof Error
    ? {
        message: message.message,
        stack: message.stack,
        name: message.name
      }
    : message;

  log(LOG_LEVELS.CRITICAL, logData, metadata);
}

/**
 * Log HTTP request
 * @param {Object} req - Express request object
 * @param {Object} additionalData - Additional data to log
 */
export function logRequest(req, additionalData = {}) {
  info({
    message: 'Incoming request',
    method: req.method,
    path: req.path,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    requestId: req.id,
    ...additionalData
  });
}

/**
 * Log HTTP response
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {number} duration - Request duration in ms
 */
export function logResponse(req, res, duration) {
  const logData = {
    message: 'Request completed',
    method: req.method,
    path: req.path,
    statusCode: res.statusCode,
    duration: `${duration}ms`,
    requestId: req.id
  };

  // Use appropriate log level based on status code
  if (res.statusCode >= 500) {
    error(logData);
  } else if (res.statusCode >= 400) {
    warn(logData);
  } else {
    info(logData);
  }
}

/**
 * Log database operation
 * @param {string} operation - Operation name (create, read, update, delete)
 * @param {string} collection - Collection name
 * @param {Object} metadata - Additional metadata
 */
export function logDatabaseOperation(operation, collection, metadata = {}) {
  debug({
    message: 'Database operation',
    operation,
    collection,
    ...metadata
  });
}

/**
 * Log business event
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
export function logEvent(event, data = {}) {
  info({
    message: 'Business event',
    event,
    ...data
  });
}

export default {
  debug,
  info,
  notice,
  warn,
  error,
  critical,
  logRequest,
  logResponse,
  logDatabaseOperation,
  logEvent,
  LOG_LEVELS
};
