import { AppError } from '../shared/errors/AppError.js';
import { errorResponse } from '../shared/utils/responseFormatter.js';
import { error as logError } from '../shared/utils/logger.js';

/**
 * Centralized Error Handler Middleware
 * Catches all errors from routes/controllers and formats consistent error responses
 * MUST be registered AFTER all routes in index.js
 */
export function errorHandler(err, req, res, next) {
  // Log the error with full context
  logError(err, {
    path: req.path,
    method: req.method,
    requestId: req.id,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    body: req.body
  });

  // Handle operational errors (expected errors)
  if (err.isOperational) {
    return res.status(err.statusCode).json(
      errorResponse(err.errorCode, err.message, err.details)
    );
  }

  // Handle validation errors from Joi/Zod
  if (err.name === 'ValidationError' && err.details) {
    return res.status(400).json(
      errorResponse('VALIDATION_ERROR', err.message, err.details)
    );
  }

  // Handle Firestore errors
  if (err.code && err.code.startsWith('firestore/')) {
    return res.status(500).json(
      errorResponse(
        'DATABASE_ERROR',
        process.env.NODE_ENV === 'production'
          ? 'Database operation failed'
          : err.message
      )
    );
  }

  // Handle programming errors (unexpected errors)
  // Don't leak error details in production
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'An unexpected error occurred'
    : err.message || 'Internal server error';

  return res.status(statusCode).json(
    errorResponse('INTERNAL_ERROR', message)
  );
}

/**
 * 404 Not Found Handler
 * Handles requests to undefined routes
 */
export function notFoundHandler(req, res) {
  res.status(404).json(
    errorResponse(
      'NOT_FOUND',
      `Route ${req.method} ${req.path} not found`
    )
  );
}

/**
 * Async handler wrapper
 * Wraps async route handlers to catch promise rejections
 * Usage: router.get('/path', asyncHandler(async (req, res) => {...}))
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export default errorHandler;
