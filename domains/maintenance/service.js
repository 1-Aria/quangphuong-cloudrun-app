/**
 * Maintenance Service
 * Handles business logic for maintenance incidents
 * Extends BaseService for common CRUD operations
 */

import { BaseService } from '../../shared/services/BaseService.js';
import { NotFoundError, ValidationError } from '../../shared/errors/AppError.js';
import { validateTransition, getNextStatus } from '../../shared/utils/statusValidator.js';
import { logEvent } from '../../shared/utils/logger.js';
import MAINTENANCE_CONFIG from './config.js';

class MaintenanceService extends BaseService {
  constructor() {
    super(MAINTENANCE_CONFIG.collection); // 'incidents'
    this.config = MAINTENANCE_CONFIG;
  }

  /**
   * Create a new incident
   * @param {Object} data - Incident data
   * @returns {Promise<Object>} Created incident
   */
  async createIncident(data) {
    // Validate required fields
    const missingFields = this.config.requiredFields.filter(field => !data[field]);
    if (missingFields.length > 0) {
      throw new ValidationError(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Create incident with initial status
    const incident = await this.create({
      ...data,
      status: this.config.initialStatus
    });

    logEvent('incident_created', {
      incidentId: incident.id,
      reporter: data.reporter,
      machineId: data.machineId,
      status: incident.status
    });

    return incident;
  }

  /**
   * Assign incident to technician
   * @param {Object} data - { id, assignee }
   * @returns {Promise<Object>} Updated incident
   */
  async assignIncident(data) {
    const { id, assignee } = data;

    if (!id || !assignee) {
      throw new ValidationError('Incident ID and assignee are required');
    }

    // Get current incident
    const incident = await this.findById(id);
    if (!incident) {
      throw new NotFoundError('Incident');
    }

    // Validate state transition
    validateTransition(
      this.config.actions.ASSIGN_INCIDENT,
      incident.status,
      this.config
    );

    // Get next status
    const nextStatus = getNextStatus(
      this.config.actions.ASSIGN_INCIDENT,
      incident.status,
      this.config
    );

    // Update incident
    const updated = await this.update(id, {
      assignedTo: assignee,
      status: nextStatus
    });

    logEvent('incident_assigned', {
      incidentId: id,
      assignedTo: assignee,
      previousStatus: incident.status,
      newStatus: nextStatus
    });

    return updated;
  }

  /**
   * Submit report for incident
   * @param {Object} data - { id, report }
   * @returns {Promise<Object>} Updated incident
   */
  async submitReport(data) {
    const { id, report } = data;

    if (!id || !report) {
      throw new ValidationError('Incident ID and report are required');
    }

    // Get current incident
    const incident = await this.findById(id);
    if (!incident) {
      throw new NotFoundError('Incident');
    }

    // Validate state transition
    validateTransition(
      this.config.actions.SUBMIT_REPORT,
      incident.status,
      this.config
    );

    // Update incident (status stays the same)
    const updated = await this.update(id, {
      report
    });

    logEvent('incident_report_submitted', {
      incidentId: id,
      status: incident.status
    });

    return updated;
  }

  /**
   * Close incident
   * @param {Object} data - { id }
   * @returns {Promise<Object>} Updated incident
   */
  async closeIncident(data) {
    const { id } = data;

    if (!id) {
      throw new ValidationError('Incident ID is required');
    }

    // Get current incident
    const incident = await this.findById(id);
    if (!incident) {
      throw new NotFoundError('Incident');
    }

    // Validate state transition
    validateTransition(
      this.config.actions.CLOSE_INCIDENT,
      incident.status,
      this.config
    );

    // Get next status
    const nextStatus = getNextStatus(
      this.config.actions.CLOSE_INCIDENT,
      incident.status,
      this.config
    );

    // Update incident
    const updated = await this.update(id, {
      status: nextStatus,
      closedAt: new Date()
    });

    logEvent('incident_closed', {
      incidentId: id,
      previousStatus: incident.status,
      closedBy: data.closedBy || 'system'
    });

    return updated;
  }

  /**
   * Get incident by ID (alias for findById)
   * @param {string} id - Incident ID
   * @returns {Promise<Object>} Incident
   */
  async getIncidentById(id) {
    const incident = await this.findById(id);
    if (!incident) {
      throw new NotFoundError('Incident');
    }
    return incident;
  }

  /**
   * Find incidents by status
   * @param {string} status - Status to filter by
   * @param {number} limit - Max results
   * @returns {Promise<Array>} Incidents
   */
  async findIncidentsByStatus(status, limit = 100) {
    return await this.query({ status }, limit);
  }

  /**
   * Find incidents by assignee
   * @param {string} assignee - Assignee to filter by
   * @param {number} limit - Max results
   * @returns {Promise<Array>} Incidents
   */
  async findIncidentsByAssignee(assignee, limit = 100) {
    return await this.query({ assignedTo: assignee }, limit);
  }

  /**
   * Find incidents by reporter
   * @param {string} reporter - Reporter to filter by
   * @param {number} limit - Max results
   * @returns {Promise<Array>} Incidents
   */
  async findIncidentsByReporter(reporter, limit = 100) {
    return await this.query({ reporter }, limit);
  }

  /**
   * Find incidents by machine
   * @param {string} machineId - Machine ID to filter by
   * @param {number} limit - Max results
   * @returns {Promise<Array>} Incidents
   */
  async findIncidentsByMachine(machineId, limit = 100) {
    return await this.query({ machineId }, limit);
  }

  /**
   * Get all open incidents (New or In Progress)
   * @param {number} limit - Max results
   * @returns {Promise<Array>} Incidents
   */
  async getOpenIncidents(limit = 100) {
    // Note: Firestore doesn't support OR queries easily
    // So we get both statuses separately and merge
    const newIncidents = await this.findIncidentsByStatus(this.config.statuses.NEW, limit);
    const inProgressIncidents = await this.findIncidentsByStatus(this.config.statuses.IN_PROGRESS, limit);

    return [...newIncidents, ...inProgressIncidents]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }
}

// Export singleton instance
export default new MaintenanceService();
