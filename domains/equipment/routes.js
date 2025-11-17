/**
 * Equipment Domain Routes
 * Defines HTTP endpoints for equipment management
 */

import express from 'express';
import {
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
} from './controllers/EquipmentController.js';

const router = express.Router();

/**
 * Equipment CRUD Operations
 */

// POST /equipment - Create new equipment
router.post('/', createEquipment);

// GET /equipment - List equipment with filters
router.get('/', getEquipment);

// GET /equipment/due-for-maintenance - Get equipment due for maintenance
router.get('/due-for-maintenance', getEquipmentDueForMaintenance);

// GET /equipment/by-equipment-id/:equipmentId - Get by custom equipment ID
router.get('/by-equipment-id/:equipmentId', getEquipmentByEquipmentId);

// GET /equipment/:id - Get specific equipment
router.get('/:id', getEquipmentById);

// PUT /equipment/:id - Update equipment
router.put('/:id', updateEquipment);

// DELETE /equipment/:id - Delete equipment
router.delete('/:id', deleteEquipment);

/**
 * Equipment Operations
 */

// POST /equipment/:id/status - Update equipment status
router.post('/:id/status', updateEquipmentStatus);

// POST /equipment/:id/maintenance - Record maintenance event
router.post('/:id/maintenance', recordMaintenance);

// GET /equipment/:id/maintenance-history - Get maintenance history
router.get('/:id/maintenance-history', getMaintenanceHistory);

// GET /equipment/:id/metrics - Get equipment metrics (MTBF, MTTR, Availability)
router.get('/:id/metrics', getEquipmentMetrics);

// GET /equipment/:id/hierarchy - Get equipment hierarchy (parent-child)
router.get('/:id/hierarchy', getEquipmentHierarchy);

export default router;
