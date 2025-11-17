/**
 * Preventive Maintenance Routes
 * API routes for PM schedules and checklist templates
 */

import express from 'express';
import * as pmController from './controllers/PMController.js';

const router = express.Router();

// ==================== PM Schedule Routes ====================

// CRUD operations
router.post('/schedules', pmController.createSchedule);
router.get('/schedules', pmController.getSchedules);
router.get('/schedules/stats', pmController.getStatistics);
router.get('/schedules/due', pmController.getDueSchedules);
router.get('/schedules/overdue', pmController.getOverdueSchedules);
router.get('/schedules/:id', pmController.getScheduleById);
router.put('/schedules/:id', pmController.updateSchedule);
router.delete('/schedules/:id', pmController.deleteSchedule);

// Query operations
router.get(
  '/schedules/by-equipment/:equipmentId',
  pmController.getSchedulesByEquipment
);
router.get(
  '/schedules/by-assignee/:assignedToId',
  pmController.getSchedulesByAssignee
);

// Schedule operations
router.put('/schedules/:id/status', pmController.updateScheduleStatus);
router.post('/schedules/:id/skip', pmController.skipExecution);

// Work order generation
router.post(
  '/schedules/:id/generate-work-order',
  pmController.generateWorkOrder
);
router.post('/schedules/process-due', pmController.processDueSchedules);

// ==================== Checklist Template Routes ====================

// CRUD operations
router.post('/templates', pmController.createTemplate);
router.get('/templates', pmController.getTemplates);
router.get('/templates/categories', pmController.getCategories);
router.get('/templates/:id', pmController.getTemplateById);
router.put('/templates/:id', pmController.updateTemplate);
router.delete('/templates/:id', pmController.deleteTemplate);

// Query operations
router.get(
  '/templates/by-category/:category',
  pmController.getTemplatesByCategory
);

// Template operations
router.post('/templates/:id/duplicate', pmController.duplicateTemplate);

export default router;
