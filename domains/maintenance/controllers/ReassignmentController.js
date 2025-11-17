/**
 * Work Order Reassignment Controller
 * HTTP request handlers for work order reassignment operations
 */

import { reassignmentService } from '../services/ReassignmentService.js';
import { asyncHandler } from '../../../shared/middleware/asyncHandler.js';
import { ValidationError } from '../../../shared/errors/AppError.js';

/**
 * Request work order reassignment
 * POST /work-orders/:workOrderId/reassignment/request
 */
export const requestReassignment = asyncHandler(async (req, res) => {
  const { workOrderId } = req.params;
  const reassignmentData = req.body;

  if (!reassignmentData.newAssigneeId) {
    throw new ValidationError('newAssigneeId is required');
  }

  if (!reassignmentData.reason) {
    throw new ValidationError('reason is required');
  }

  const result = await reassignmentService.requestReassignment(
    workOrderId,
    reassignmentData,
    req.user
  );

  res.status(200).json({
    success: true,
    data: result,
    message: 'Reassignment requested successfully'
  });
});

/**
 * Approve reassignment request
 * POST /work-orders/:workOrderId/reassignment/approve
 */
export const approveReassignment = asyncHandler(async (req, res) => {
  const { workOrderId } = req.params;

  const result = await reassignmentService.approveReassignment(
    workOrderId,
    req.user
  );

  res.status(200).json({
    success: true,
    data: result,
    message: 'Reassignment approved successfully'
  });
});

/**
 * Reject reassignment request
 * POST /work-orders/:workOrderId/reassignment/reject
 */
export const rejectReassignment = asyncHandler(async (req, res) => {
  const { workOrderId } = req.params;
  const { rejectionReason } = req.body;

  if (!rejectionReason) {
    throw new ValidationError('rejectionReason is required');
  }

  const result = await reassignmentService.rejectReassignment(
    workOrderId,
    rejectionReason,
    req.user
  );

  res.status(200).json({
    success: true,
    data: result,
    message: 'Reassignment rejected'
  });
});

/**
 * Get reassignment history
 * GET /work-orders/:workOrderId/reassignment/history
 */
export const getReassignmentHistory = asyncHandler(async (req, res) => {
  const { workOrderId } = req.params;

  const result = await reassignmentService.getReassignmentHistory(workOrderId);

  res.status(200).json({
    success: true,
    data: result,
    message: 'Reassignment history retrieved'
  });
});

/**
 * Get labor records
 * GET /work-orders/:workOrderId/reassignment/labor-records
 */
export const getLaborRecords = asyncHandler(async (req, res) => {
  const { workOrderId } = req.params;

  const result = await reassignmentService.getLaborRecords(workOrderId);

  res.status(200).json({
    success: true,
    data: result,
    message: 'Labor records retrieved'
  });
});

/**
 * Get available technicians for reassignment
 * GET /work-orders/:workOrderId/reassignment/available-technicians
 */
export const getAvailableTechnicians = asyncHandler(async (req, res) => {
  const { workOrderId } = req.params;

  const result = await reassignmentService.getAvailableTechnicians(workOrderId);

  res.status(200).json({
    success: true,
    data: result,
    message: 'Available technicians retrieved'
  });
});
