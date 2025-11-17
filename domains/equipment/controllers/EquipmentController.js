/**
 * Equipment Controller
 * HTTP request handlers for equipment management
 */

import { equipmentService } from '../services/EquipmentService.js';
import { PERMISSIONS } from '../../../config/roles.js';
import { hasPermission } from '../../../shared/utils/permissions.js';
import { ValidationError, ForbiddenError } from '../../../shared/errors/AppError.js';
import { successResponse } from '../../../shared/utils/responseFormatter.js';

/**
 * Create new equipment
 * POST /equipment
 */
export async function createEquipment(req, res, next) {
  try {
    // Check permission
    if (!hasPermission(req.user, PERMISSIONS.EQUIPMENT_CREATE)) {
      throw new ForbiddenError('You do not have permission to create equipment');
    }

    const equipment = await equipmentService.createEquipment(req.body, req.user);

    res.status(201).json(
      successResponse(equipment, 'Equipment created successfully')
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Get equipment list with filters
 * GET /equipment
 */
export async function getEquipment(req, res, next) {
  try {
    // Check permission
    if (!hasPermission(req.user, PERMISSIONS.EQUIPMENT_VIEW)) {
      throw new ForbiddenError('You do not have permission to view equipment');
    }

    const filters = {
      status: req.query.status,
      category: req.query.category,
      criticality: req.query.criticality,
      department: req.query.department,
      location: req.query.location,
      assignedTo: req.query.assignedTo,
      manufacturer: req.query.manufacturer,
      searchTerm: req.query.search
    };

    const options = {
      limit: parseInt(req.query.limit) || 100,
      offset: parseInt(req.query.offset) || 0
    };

    const result = await equipmentService.searchEquipment(filters, options);

    res.json(
      successResponse(result.equipment, 'Equipment retrieved successfully', {
        total: result.total,
        limit: result.limit,
        offset: result.offset
      })
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Get equipment by ID
 * GET /equipment/:id
 */
export async function getEquipmentById(req, res, next) {
  try {
    // Check permission
    if (!hasPermission(req.user, PERMISSIONS.EQUIPMENT_VIEW)) {
      throw new ForbiddenError('You do not have permission to view equipment');
    }

    const equipment = await equipmentService.findById(req.params.id);

    if (!equipment) {
      throw new ValidationError('Equipment not found');
    }

    res.json(successResponse(equipment, 'Equipment retrieved successfully'));
  } catch (error) {
    next(error);
  }
}

/**
 * Get equipment by custom equipment ID
 * GET /equipment/by-equipment-id/:equipmentId
 */
export async function getEquipmentByEquipmentId(req, res, next) {
  try {
    // Check permission
    if (!hasPermission(req.user, PERMISSIONS.EQUIPMENT_VIEW)) {
      throw new ForbiddenError('You do not have permission to view equipment');
    }

    const equipment = await equipmentService.getByEquipmentId(
      req.params.equipmentId
    );

    if (!equipment) {
      throw new ValidationError('Equipment not found');
    }

    res.json(successResponse(equipment, 'Equipment retrieved successfully'));
  } catch (error) {
    next(error);
  }
}

/**
 * Update equipment
 * PUT /equipment/:id
 */
export async function updateEquipment(req, res, next) {
  try {
    // Check permission
    if (!hasPermission(req.user, PERMISSIONS.EQUIPMENT_EDIT)) {
      throw new ForbiddenError('You do not have permission to edit equipment');
    }

    const equipment = await equipmentService.update(req.params.id, req.body);

    res.json(successResponse(equipment, 'Equipment updated successfully'));
  } catch (error) {
    next(error);
  }
}

/**
 * Delete equipment
 * DELETE /equipment/:id
 */
export async function deleteEquipment(req, res, next) {
  try {
    // Check permission
    if (!hasPermission(req.user, PERMISSIONS.EQUIPMENT_DELETE)) {
      throw new ForbiddenError('You do not have permission to delete equipment');
    }

    await equipmentService.delete(req.params.id);

    res.json(successResponse(null, 'Equipment deleted successfully'));
  } catch (error) {
    next(error);
  }
}

/**
 * Update equipment status
 * POST /equipment/:id/status
 */
export async function updateEquipmentStatus(req, res, next) {
  try {
    // Check permission
    if (!hasPermission(req.user, PERMISSIONS.EQUIPMENT_EDIT)) {
      throw new ForbiddenError(
        'You do not have permission to update equipment status'
      );
    }

    const { status, reason } = req.body;

    if (!status) {
      throw new ValidationError('Status is required');
    }

    const equipment = await equipmentService.updateEquipmentStatus(
      req.params.id,
      status,
      req.user,
      reason
    );

    res.json(successResponse(equipment, 'Equipment status updated successfully'));
  } catch (error) {
    next(error);
  }
}

/**
 * Record maintenance event
 * POST /equipment/:id/maintenance
 */
export async function recordMaintenance(req, res, next) {
  try {
    // Check permission
    if (!hasPermission(req.user, PERMISSIONS.EQUIPMENT_EDIT)) {
      throw new ForbiddenError(
        'You do not have permission to record maintenance'
      );
    }

    const equipment = await equipmentService.recordMaintenance(
      req.params.id,
      req.body,
      req.user
    );

    res.json(successResponse(equipment, 'Maintenance recorded successfully'));
  } catch (error) {
    next(error);
  }
}

/**
 * Get equipment maintenance history
 * GET /equipment/:id/maintenance-history
 */
export async function getMaintenanceHistory(req, res, next) {
  try {
    // Check permission
    if (!hasPermission(req.user, PERMISSIONS.EQUIPMENT_VIEW)) {
      throw new ForbiddenError(
        'You do not have permission to view maintenance history'
      );
    }

    const options = {
      limit: parseInt(req.query.limit) || 50,
      startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate) : undefined
    };

    const history = await equipmentService.getMaintenanceHistory(
      req.params.id,
      options
    );

    res.json(
      successResponse(history, 'Maintenance history retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Calculate equipment metrics
 * GET /equipment/:id/metrics
 */
export async function getEquipmentMetrics(req, res, next) {
  try {
    // Check permission
    if (!hasPermission(req.user, PERMISSIONS.EQUIPMENT_VIEW)) {
      throw new ForbiddenError(
        'You do not have permission to view equipment metrics'
      );
    }

    const startDate = req.query.startDate
      ? new Date(req.query.startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: 30 days ago

    const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();

    const metrics = await equipmentService.calculateMetrics(
      req.params.id,
      startDate,
      endDate
    );

    res.json(successResponse(metrics, 'Equipment metrics calculated successfully'));
  } catch (error) {
    next(error);
  }
}

/**
 * Get equipment due for maintenance
 * GET /equipment/due-for-maintenance
 */
export async function getEquipmentDueForMaintenance(req, res, next) {
  try {
    // Check permission
    if (!hasPermission(req.user, PERMISSIONS.EQUIPMENT_VIEW)) {
      throw new ForbiddenError(
        'You do not have permission to view equipment maintenance schedule'
      );
    }

    const options = {
      department: req.query.department,
      criticality: req.query.criticality,
      limit: parseInt(req.query.limit) || 100
    };

    const equipment = await equipmentService.getEquipmentDueForMaintenance(
      options
    );

    res.json(
      successResponse(
        equipment,
        'Equipment due for maintenance retrieved successfully'
      )
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Get equipment hierarchy
 * GET /equipment/:id/hierarchy
 */
export async function getEquipmentHierarchy(req, res, next) {
  try {
    // Check permission
    if (!hasPermission(req.user, PERMISSIONS.EQUIPMENT_VIEW)) {
      throw new ForbiddenError(
        'You do not have permission to view equipment hierarchy'
      );
    }

    const equipment = await equipmentService.findById(req.params.id);

    if (!equipment) {
      throw new ValidationError('Equipment not found');
    }

    const children = await equipmentService.getEquipmentHierarchy(
      equipment.equipmentId
    );

    res.json(
      successResponse(
        { parent: equipment, children },
        'Equipment hierarchy retrieved successfully'
      )
    );
  } catch (error) {
    next(error);
  }
}

export default {
  createEquipment,
  getEquipment,
  getEquipmentById,
  getEquipmentByEquipmentId,
  updateEquipment,
  deleteEquipment,
  updateEquipmentStatus,
  recordMaintenance,
  getMaintenanceHistory,
  getEquipmentMetrics,
  getEquipmentDueForMaintenance,
  getEquipmentHierarchy
};
