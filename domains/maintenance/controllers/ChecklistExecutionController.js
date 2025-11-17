/**
 * Checklist Execution Controller
 * HTTP request handlers for checklist execution on work orders
 */

import { checklistExecutionService } from '../services/ChecklistExecutionService.js';
import { asyncHandler } from '../../../shared/middleware/asyncHandler.js';
import { ValidationError } from '../../../shared/errors/AppError.js';

/**
 * Attach checklist to work order
 * POST /work-orders/:workOrderId/checklist
 */
export const attachChecklist = asyncHandler(async (req, res) => {
  const { workOrderId } = req.params;
  const { templateId } = req.body;

  if (!templateId) {
    throw new ValidationError('templateId is required');
  }

  const result = await checklistExecutionService.attachChecklist(
    workOrderId,
    templateId,
    req.user
  );

  res.status(200).json({
    success: true,
    data: result,
    message: 'Checklist attached successfully'
  });
});

/**
 * Start checklist execution
 * POST /work-orders/:workOrderId/checklist/start
 */
export const startChecklistExecution = asyncHandler(async (req, res) => {
  const { workOrderId } = req.params;

  const result = await checklistExecutionService.startChecklistExecution(
    workOrderId,
    req.user
  );

  res.status(200).json({
    success: true,
    data: result,
    message: 'Checklist execution started'
  });
});

/**
 * Complete checklist item
 * PUT /work-orders/:workOrderId/checklist/items/:itemOrder
 */
export const completeChecklistItem = asyncHandler(async (req, res) => {
  const { workOrderId, itemOrder } = req.params;
  const itemData = req.body;

  const result = await checklistExecutionService.completeChecklistItem(
    workOrderId,
    parseInt(itemOrder, 10),
    itemData,
    req.user
  );

  res.status(200).json({
    success: true,
    data: result,
    message: 'Checklist item completed'
  });
});

/**
 * Complete entire checklist
 * POST /work-orders/:workOrderId/checklist/complete
 */
export const completeChecklist = asyncHandler(async (req, res) => {
  const { workOrderId } = req.params;

  const result = await checklistExecutionService.completeChecklist(
    workOrderId,
    req.user
  );

  res.status(200).json({
    success: true,
    data: result,
    message: 'Checklist completed successfully'
  });
});

/**
 * Validate work order completion
 * GET /work-orders/:workOrderId/checklist/validate
 */
export const validateWorkOrderCompletion = asyncHandler(async (req, res) => {
  const { workOrderId } = req.params;

  const result = await checklistExecutionService.validateWorkOrderCompletion(
    workOrderId
  );

  res.status(200).json({
    success: true,
    data: result,
    message: result.valid ? 'Validation passed' : 'Validation failed'
  });
});

/**
 * Get checklist statistics
 * GET /work-orders/:workOrderId/checklist/statistics
 */
export const getChecklistStatistics = asyncHandler(async (req, res) => {
  const { workOrderId } = req.params;

  const result = await checklistExecutionService.getChecklistStatistics(
    workOrderId
  );

  res.status(200).json({
    success: true,
    data: result,
    message: 'Checklist statistics retrieved'
  });
});

/**
 * Remove checklist from work order
 * DELETE /work-orders/:workOrderId/checklist
 */
export const removeChecklist = asyncHandler(async (req, res) => {
  const { workOrderId } = req.params;

  const result = await checklistExecutionService.removeChecklist(
    workOrderId,
    req.user
  );

  res.status(200).json({
    success: true,
    data: result,
    message: 'Checklist removed successfully'
  });
});
