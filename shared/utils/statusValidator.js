/**
 * Generic Status Validator
 * Works with any domain configuration (maintenance, logistics, hr, etc.)
 */

import { ValidationError } from '../errors/AppError.js';

/**
 * Check if an action can be performed in the current status
 * @param {string} action - Action to perform
 * @param {string} currentStatus - Current status
 * @param {Object} domainConfig - Domain configuration with transitions
 * @returns {boolean} True if action is allowed
 */
export function canPerformAction(action, currentStatus, domainConfig) {
  if (!domainConfig || !domainConfig.transitions) {
    throw new Error('Domain configuration with transitions is required');
  }

  const statusConfig = domainConfig.transitions[currentStatus];

  if (!statusConfig) {
    return false;
  }

  const allowedActions = statusConfig.allowedActions || [];
  return allowedActions.includes(action);
}

/**
 * Get the next status after performing an action
 * @param {string} action - Action being performed
 * @param {string} currentStatus - Current status
 * @param {Object} domainConfig - Domain configuration with transitions
 * @returns {string} Next status
 */
export function getNextStatus(action, currentStatus, domainConfig) {
  if (!domainConfig || !domainConfig.transitions) {
    throw new Error('Domain configuration with transitions is required');
  }

  const statusConfig = domainConfig.transitions[currentStatus];

  if (!statusConfig) {
    return currentStatus;
  }

  const nextStatus = statusConfig.nextStatus?.[action];
  return nextStatus || currentStatus;
}

/**
 * Validate that an action can be performed (throws error if not)
 * @param {string} action - Action to perform
 * @param {string} currentStatus - Current status
 * @param {Object} domainConfig - Domain configuration with transitions
 * @throws {ValidationError} If action is not allowed
 */
export function validateTransition(action, currentStatus, domainConfig) {
  if (!canPerformAction(action, currentStatus, domainConfig)) {
    const statusConfig = domainConfig.transitions[currentStatus];
    const allowedActions = statusConfig?.allowedActions || [];

    throw new ValidationError(
      `Action '${action}' is not allowed when status is '${currentStatus}'. ` +
      `Allowed actions: ${allowedActions.length > 0 ? allowedActions.join(', ') : 'none'}`
    );
  }
}

/**
 * Get all allowed actions for a status
 * @param {string} status - Current status
 * @param {Object} domainConfig - Domain configuration with transitions
 * @returns {Array<string>} Array of allowed actions
 */
export function getAllowedActions(status, domainConfig) {
  if (!domainConfig || !domainConfig.transitions) {
    return [];
  }

  const statusConfig = domainConfig.transitions[status];
  return statusConfig?.allowedActions || [];
}

/**
 * Check if a status is terminal (no actions allowed)
 * @param {string} status - Status to check
 * @param {Object} domainConfig - Domain configuration with transitions
 * @returns {boolean} True if status is terminal
 */
export function isTerminalStatus(status, domainConfig) {
  const allowedActions = getAllowedActions(status, domainConfig);
  return allowedActions.length === 0;
}

export default {
  canPerformAction,
  getNextStatus,
  validateTransition,
  getAllowedActions,
  isTerminalStatus
};
