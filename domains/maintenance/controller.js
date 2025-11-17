/**
 * Maintenance Controller
 * Handles HTTP requests for maintenance incidents
 * Uses action handler map pattern for scalability
 */

import maintenanceService from './service.js';
import { ValidationError } from '../../shared/errors/AppError.js';
import { successResponse } from '../../shared/utils/responseFormatter.js';
import MAINTENANCE_CONFIG from './config.js';

/**
 * Action Handlers Map
 * Maps action names to service methods
 * Easy to extend - just add new entries
 */
const actionHandlers = {
  [MAINTENANCE_CONFIG.actions.REGISTER_INCIDENT]:
    maintenanceService.createIncident.bind(maintenanceService),

  [MAINTENANCE_CONFIG.actions.ASSIGN_INCIDENT]:
    maintenanceService.assignIncident.bind(maintenanceService),

  [MAINTENANCE_CONFIG.actions.SUBMIT_REPORT]:
    maintenanceService.submitReport.bind(maintenanceService),

  [MAINTENANCE_CONFIG.actions.CLOSE_INCIDENT]:
    maintenanceService.closeIncident.bind(maintenanceService)
};

/**
 * Main request handler for maintenance actions
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next middleware
 */
export async function handleMaintenanceAction(req, res, next) {
  try {
    const { action, data } = req.body;

    // Validate request has action
    if (!action) {
      throw new ValidationError('Missing action field');
    }

    // Validate request has data
    if (!data || typeof data !== 'object') {
      throw new ValidationError('Missing or invalid data field');
    }

    // Get action handler
    const handler = actionHandlers[action];
    if (!handler) {
      throw new ValidationError(
        `Unknown action: ${action}. Valid actions: ${Object.keys(actionHandlers).join(', ')}`
      );
    }

    // Execute action
    const result = await handler(data);

    // Return success response
    res.json(successResponse(
      result,
      `Action '${action}' completed successfully`
    ));
  } catch (err) {
    // Pass to error handler middleware
    next(err);
  }
}

/**
 * Get incident by ID
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next middleware
 */
export async function getIncident(req, res, next) {
  try {
    const { id } = req.params;

    const incident = await maintenanceService.getIncidentById(id);

    res.json(successResponse(incident));
  } catch (err) {
    next(err);
  }
}

/**
 * List incidents with optional filters
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next middleware
 */
export async function listIncidents(req, res, next) {
  try {
    const { status, assignee, reporter, machineId, limit = 100 } = req.query;

    let incidents;

    if (status) {
      incidents = await maintenanceService.findIncidentsByStatus(status, parseInt(limit));
    } else if (assignee) {
      incidents = await maintenanceService.findIncidentsByAssignee(assignee, parseInt(limit));
    } else if (reporter) {
      incidents = await maintenanceService.findIncidentsByReporter(reporter, parseInt(limit));
    } else if (machineId) {
      incidents = await maintenanceService.findIncidentsByMachine(machineId, parseInt(limit));
    } else {
      // Get all open incidents by default
      incidents = await maintenanceService.getOpenIncidents(parseInt(limit));
    }

    res.json(successResponse(
      incidents,
      null,
      { count: incidents.length }
    ));
  } catch (err) {
    next(err);
  }
}

export default {
  handleMaintenanceAction,
  getIncident,
  listIncidents
};
