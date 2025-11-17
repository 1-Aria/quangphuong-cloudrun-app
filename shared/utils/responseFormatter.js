/**
 * Response Formatter Utilities
 * Provides consistent response shapes across all API endpoints
 */

/**
 * Format successful response
 * @param {*} data - Response data
 * @param {string} message - Optional success message
 * @param {Object} meta - Optional metadata (pagination, etc.)
 * @returns {Object} Formatted success response
 */
export function successResponse(data, message = null, meta = null) {
  const response = {
    success: true,
    data
  };

  if (message) {
    response.message = message;
  }

  if (meta) {
    response.meta = meta;
  }

  return response;
}

/**
 * Format error response
 * @param {string} code - Error code
 * @param {string} message - Error message
 * @param {*} details - Optional error details (validation errors, etc.)
 * @returns {Object} Formatted error response
 */
export function errorResponse(code, message, details = null) {
  const response = {
    success: false,
    error: {
      code,
      message
    }
  };

  if (details) {
    response.error.details = details;
  }

  return response;
}

/**
 * Format paginated response
 * @param {Array} data - Array of items
 * @param {number} page - Current page number
 * @param {number} limit - Items per page
 * @param {number} total - Total number of items
 * @returns {Object} Formatted paginated response
 */
export function paginatedResponse(data, page, limit, total) {
  const totalPages = Math.ceil(total / limit);

  return successResponse(data, null, {
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  });
}

/**
 * Format validation error response
 * @param {Array|Object} validationErrors - Validation errors from Joi/Zod
 * @returns {Object} Formatted validation error response
 */
export function validationErrorResponse(validationErrors) {
  return errorResponse(
    'VALIDATION_ERROR',
    'Validation failed',
    validationErrors
  );
}

/**
 * Format not found error response
 * @param {string} resource - Resource name
 * @returns {Object} Formatted not found error response
 */
export function notFoundResponse(resource = 'Resource') {
  return errorResponse(
    'NOT_FOUND',
    `${resource} not found`
  );
}

/**
 * Format unauthorized error response
 * @param {string} message - Custom message
 * @returns {Object} Formatted unauthorized error response
 */
export function unauthorizedResponse(message = 'Unauthorized') {
  return errorResponse('UNAUTHORIZED', message);
}

export default {
  successResponse,
  errorResponse,
  paginatedResponse,
  validationErrorResponse,
  notFoundResponse,
  unauthorizedResponse
};
