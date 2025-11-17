/**
 * Maintenance Domain Routes
 * Defines HTTP endpoints for maintenance operations
 */

import express from 'express';

// Legacy controller (to be deprecated)
import {
  handleMaintenanceAction,
  getIncident,
  listIncidents
} from './controller.js';

// New CMMS Work Order Controller
import {
  createWorkOrder,
  getWorkOrders,
  getWorkOrderById,
  updateWorkOrder,
  executeWorkOrderAction,
  getWorkOrderHistory,
  getWorkOrderSLAStatus,
  deleteWorkOrder
} from './controllers/WorkOrderController.js';

// Checklist Execution Controller
import {
  attachChecklist,
  startChecklistExecution,
  completeChecklistItem,
  completeChecklist,
  validateWorkOrderCompletion,
  getChecklistStatistics,
  removeChecklist
} from './controllers/ChecklistExecutionController.js';

// Reassignment Controller
import {
  requestReassignment,
  approveReassignment,
  rejectReassignment,
  getReassignmentHistory,
  getLaborRecords,
  getAvailableTechnicians
} from './controllers/ReassignmentController.js';

// MTTR Report Controller
import {
  getMTTR,
  getDowntime,
  getAvailability,
  getComprehensiveReport
} from './controllers/MTTRReportController.js';

// Attachment Controller
import {
  uploadAttachment,
  uploadChecklistPhoto,
  getAttachmentUrl,
  listAttachments,
  deleteAttachment
} from './controllers/AttachmentController.js';

// Upload middleware
import { uploadSingle, handleUploadError } from '../../middleware/upload.js';

const router = express.Router();

// ===== NEW CMMS ENDPOINTS =====

/**
 * Work Order CRUD Operations
 */

// POST /maintenance/work-orders - Create new work order
router.post('/work-orders', createWorkOrder);

// GET /maintenance/work-orders - List work orders with filters
router.get('/work-orders', getWorkOrders);

// GET /maintenance/work-orders/:id - Get specific work order
router.get('/work-orders/:id', getWorkOrderById);

// PUT /maintenance/work-orders/:id - Update work order
router.put('/work-orders/:id', updateWorkOrder);

// DELETE /maintenance/work-orders/:id - Delete work order (draft/cancelled only)
router.delete('/work-orders/:id', deleteWorkOrder);

/**
 * Work Order Actions & Operations
 */

// POST /maintenance/work-orders/:id/actions - Execute state transitions
// Body: { action: 'submit_wo' | 'approve_wo' | 'assign_wo' | ..., data: {...} }
router.post('/work-orders/:id/actions', executeWorkOrderAction);

// GET /maintenance/work-orders/:id/history - Get activity history
router.get('/work-orders/:id/history', getWorkOrderHistory);

// GET /maintenance/work-orders/:id/sla-status - Get SLA status
router.get('/work-orders/:id/sla-status', getWorkOrderSLAStatus);

/**
 * Checklist Execution Operations
 */

// POST /maintenance/work-orders/:workOrderId/checklist - Attach checklist template
router.post('/work-orders/:workOrderId/checklist', attachChecklist);

// POST /maintenance/work-orders/:workOrderId/checklist/start - Start checklist execution
router.post('/work-orders/:workOrderId/checklist/start', startChecklistExecution);

// PUT /maintenance/work-orders/:workOrderId/checklist/items/:itemOrder - Complete checklist item
router.put('/work-orders/:workOrderId/checklist/items/:itemOrder', completeChecklistItem);

// POST /maintenance/work-orders/:workOrderId/checklist/complete - Complete entire checklist
router.post('/work-orders/:workOrderId/checklist/complete', completeChecklist);

// GET /maintenance/work-orders/:workOrderId/checklist/validate - Validate work order completion
router.get('/work-orders/:workOrderId/checklist/validate', validateWorkOrderCompletion);

// GET /maintenance/work-orders/:workOrderId/checklist/statistics - Get checklist statistics
router.get('/work-orders/:workOrderId/checklist/statistics', getChecklistStatistics);

// DELETE /maintenance/work-orders/:workOrderId/checklist - Remove checklist
router.delete('/work-orders/:workOrderId/checklist', removeChecklist);

/**
 * Work Order Reassignment Operations
 */

// POST /maintenance/work-orders/:workOrderId/reassignment/request - Request reassignment
router.post('/work-orders/:workOrderId/reassignment/request', requestReassignment);

// POST /maintenance/work-orders/:workOrderId/reassignment/approve - Approve reassignment
router.post('/work-orders/:workOrderId/reassignment/approve', approveReassignment);

// POST /maintenance/work-orders/:workOrderId/reassignment/reject - Reject reassignment
router.post('/work-orders/:workOrderId/reassignment/reject', rejectReassignment);

// GET /maintenance/work-orders/:workOrderId/reassignment/history - Get reassignment history
router.get('/work-orders/:workOrderId/reassignment/history', getReassignmentHistory);

// GET /maintenance/work-orders/:workOrderId/reassignment/labor-records - Get labor records
router.get('/work-orders/:workOrderId/reassignment/labor-records', getLaborRecords);

// GET /maintenance/work-orders/:workOrderId/reassignment/available-technicians - Get available technicians
router.get('/work-orders/:workOrderId/reassignment/available-technicians', getAvailableTechnicians);

/**
 * MTTR and Downtime Reports
 */

// GET /maintenance/reports/mttr - Calculate MTTR (Mean Time To Repair)
router.get('/reports/mttr', getMTTR);

// GET /maintenance/reports/downtime - Calculate downtime statistics
router.get('/reports/downtime', getDowntime);

// GET /maintenance/reports/availability/:equipmentId - Calculate equipment availability
router.get('/reports/availability/:equipmentId', getAvailability);

// GET /maintenance/reports/comprehensive - Generate comprehensive maintenance report
router.get('/reports/comprehensive', getComprehensiveReport);

/**
 * File Upload & Attachment Operations
 */

// POST /maintenance/work-orders/:workOrderId/attachments - Upload attachment to work order
router.post('/work-orders/:workOrderId/attachments', uploadSingle, uploadAttachment);

// GET /maintenance/work-orders/:workOrderId/attachments - List attachments
router.get('/work-orders/:workOrderId/attachments', listAttachments);

// GET /maintenance/work-orders/:workOrderId/attachments/:attachmentId/url - Get signed URL for download
router.get('/work-orders/:workOrderId/attachments/:attachmentId/url', getAttachmentUrl);

// DELETE /maintenance/work-orders/:workOrderId/attachments/:attachmentId - Delete attachment
router.delete('/work-orders/:workOrderId/attachments/:attachmentId', deleteAttachment);

// POST /maintenance/work-orders/:workOrderId/checklist/items/:itemOrder/photos - Upload photo to checklist item
router.post('/work-orders/:workOrderId/checklist/items/:itemOrder/photos', uploadSingle, uploadChecklistPhoto);

// Apply upload error handler
router.use(handleUploadError);


// ===== LEGACY ENDPOINTS (Deprecated) =====

/**
 * POST /maintenance
 * Main endpoint for maintenance actions
 * Body: { action: string, data: object }
 * @deprecated Use /work-orders endpoints instead
 */
router.post('/', handleMaintenanceAction);

/**
 * GET /maintenance
 * List incidents with optional filters
 * Query params: status, assignee, reporter, machineId, limit
 * @deprecated Use GET /work-orders instead
 */
router.get('/', listIncidents);

/**
 * GET /maintenance/:id
 * Get specific incident by ID
 * @deprecated Use GET /work-orders/:id instead
 */
router.get('/:id', getIncident);

export default router;
