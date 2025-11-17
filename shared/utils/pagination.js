/**
 * Pagination Helper Utilities
 * Provides pagination support for Firestore queries
 */

import { PAGINATION } from '../../config/constants.js';

/**
 * Calculate pagination metadata
 * @param {number} page - Current page (1-indexed)
 * @param {number} limit - Items per page
 * @param {number} total - Total number of items
 * @returns {Object} Pagination metadata
 */
export function calculatePagination(page, limit, total) {
  const currentPage = Math.max(1, parseInt(page) || 1);
  const itemsPerPage = Math.min(
    parseInt(limit) || PAGINATION.DEFAULT_LIMIT,
    PAGINATION.MAX_LIMIT
  );

  const totalPages = Math.ceil(total / itemsPerPage);
  const hasNext = currentPage < totalPages;
  const hasPrev = currentPage > 1;

  return {
    page: currentPage,
    limit: itemsPerPage,
    total,
    totalPages,
    hasNext,
    hasPrev,
    nextPage: hasNext ? currentPage + 1 : null,
    prevPage: hasPrev ? currentPage - 1 : null
  };
}

/**
 * Get offset for pagination
 * @param {number} page - Current page (1-indexed)
 * @param {number} limit - Items per page
 * @returns {number} Offset
 */
export function getOffset(page, limit) {
  const currentPage = Math.max(1, parseInt(page) || 1);
  const itemsPerPage = parseInt(limit) || PAGINATION.DEFAULT_LIMIT;

  return (currentPage - 1) * itemsPerPage;
}

/**
 * Parse pagination parameters from query string
 * @param {Object} query - Express query object
 * @returns {Object} { page, limit, offset }
 */
export function parsePaginationParams(query) {
  const page = Math.max(1, parseInt(query.page) || PAGINATION.DEFAULT_PAGE);
  const limit = Math.min(
    parseInt(query.limit) || PAGINATION.DEFAULT_LIMIT,
    PAGINATION.MAX_LIMIT
  );
  const offset = getOffset(page, limit);

  return { page, limit, offset };
}

/**
 * Create paginated response
 * @param {Array} data - Array of items
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @param {number} total - Total number of items
 * @returns {Object} Paginated response
 */
export function createPaginatedResponse(data, page, limit, total) {
  const pagination = calculatePagination(page, limit, total);

  return {
    success: true,
    data,
    pagination
  };
}

/**
 * Cursor-based pagination helper
 * For Firestore startAfter/endBefore pagination
 * @param {Array} docs - Array of Firestore documents
 * @param {number} limit - Items per page
 * @returns {Object} { items, hasMore, lastDoc }
 */
export function createCursorPagination(docs, limit) {
  const hasMore = docs.length > limit;
  const items = hasMore ? docs.slice(0, limit) : docs;
  const lastDoc = items.length > 0 ? items[items.length - 1] : null;

  return {
    items,
    hasMore,
    lastDoc,
    cursor: lastDoc?.id || null
  };
}

/**
 * Build pagination links for API responses
 * @param {string} baseUrl - Base URL for links
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @param {number} totalPages - Total number of pages
 * @returns {Object} Pagination links
 */
export function buildPaginationLinks(baseUrl, page, limit, totalPages) {
  const links = {
    self: `${baseUrl}?page=${page}&limit=${limit}`
  };

  if (page > 1) {
    links.first = `${baseUrl}?page=1&limit=${limit}`;
    links.prev = `${baseUrl}?page=${page - 1}&limit=${limit}`;
  }

  if (page < totalPages) {
    links.next = `${baseUrl}?page=${page + 1}&limit=${limit}`;
    links.last = `${baseUrl}?page=${totalPages}&limit=${limit}`;
  }

  return links;
}

/**
 * Validate pagination parameters
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {Object} { valid: boolean, errors: Array<string> }
 */
export function validatePaginationParams(page, limit) {
  const errors = [];

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);

  if (isNaN(pageNum) || pageNum < 1) {
    errors.push('Page must be a positive integer');
  }

  if (isNaN(limitNum) || limitNum < 1) {
    errors.push('Limit must be a positive integer');
  }

  if (limitNum > PAGINATION.MAX_LIMIT) {
    errors.push(`Limit cannot exceed ${PAGINATION.MAX_LIMIT}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Calculate range of items being displayed
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @param {number} total - Total number of items
 * @returns {Object} { from, to }
 */
export function getItemRange(page, limit, total) {
  const from = Math.min((page - 1) * limit + 1, total);
  const to = Math.min(page * limit, total);

  return { from, to };
}

export default {
  calculatePagination,
  getOffset,
  parsePaginationParams,
  createPaginatedResponse,
  createCursorPagination,
  buildPaginationLinks,
  validatePaginationParams,
  getItemRange
};
