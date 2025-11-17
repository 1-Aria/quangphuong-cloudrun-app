/**
 * MTTR and Downtime Report Controller
 * HTTP request handlers for maintenance metrics reports
 */

import { mttrReportService } from '../services/MTTRReportService.js';
import { asyncHandler } from '../../../shared/middleware/asyncHandler.js';
import { ValidationError } from '../../../shared/errors/AppError.js';

/**
 * Calculate MTTR
 * GET /reports/mttr
 */
export const getMTTR = asyncHandler(async (req, res) => {
  const { startDate, endDate, equipmentId, priority, workType } = req.query;

  if (!startDate || !endDate) {
    throw new ValidationError('startDate and endDate query parameters are required');
  }

  const filters = {};
  if (equipmentId) filters.equipmentId = equipmentId;
  if (priority) filters.priority = priority;
  if (workType) filters.workType = workType;

  const result = await mttrReportService.calculateMTTR(
    new Date(startDate),
    new Date(endDate),
    filters
  );

  res.status(200).json({
    success: true,
    data: result,
    message: 'MTTR calculated successfully'
  });
});

/**
 * Calculate downtime statistics
 * GET /reports/downtime
 */
export const getDowntime = asyncHandler(async (req, res) => {
  const { startDate, endDate, equipmentId, priority } = req.query;

  if (!startDate || !endDate) {
    throw new ValidationError('startDate and endDate query parameters are required');
  }

  const filters = {};
  if (equipmentId) filters.equipmentId = equipmentId;
  if (priority) filters.priority = priority;

  const result = await mttrReportService.calculateDowntime(
    new Date(startDate),
    new Date(endDate),
    filters
  );

  res.status(200).json({
    success: true,
    data: result,
    message: 'Downtime statistics calculated successfully'
  });
});

/**
 * Calculate equipment availability
 * GET /reports/availability/:equipmentId
 */
export const getAvailability = asyncHandler(async (req, res) => {
  const { equipmentId } = req.params;
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    throw new ValidationError('startDate and endDate query parameters are required');
  }

  const result = await mttrReportService.calculateAvailability(
    equipmentId,
    new Date(startDate),
    new Date(endDate)
  );

  res.status(200).json({
    success: true,
    data: result,
    message: 'Availability metrics calculated successfully'
  });
});

/**
 * Generate comprehensive maintenance report
 * GET /reports/comprehensive
 */
export const getComprehensiveReport = asyncHandler(async (req, res) => {
  const { startDate, endDate, equipmentId, priority, workType } = req.query;

  if (!startDate || !endDate) {
    throw new ValidationError('startDate and endDate query parameters are required');
  }

  const filters = {};
  if (equipmentId) filters.equipmentId = equipmentId;
  if (priority) filters.priority = priority;
  if (workType) filters.workType = workType;

  const result = await mttrReportService.generateMaintenanceReport(
    new Date(startDate),
    new Date(endDate),
    filters
  );

  res.status(200).json({
    success: true,
    data: result,
    message: 'Comprehensive maintenance report generated successfully'
  });
});
