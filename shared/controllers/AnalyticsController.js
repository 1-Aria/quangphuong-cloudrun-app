/**
 * Analytics Controller
 * HTTP request handlers for analytics and reporting
 */

import { analyticsService } from '../services/AnalyticsService.js';
import { PERMISSIONS } from '../../config/roles.js';
import { hasPermission } from '../utils/permissions.js';
import { ValidationError, ForbiddenError } from '../errors/AppError.js';
import { successResponse } from '../utils/responseFormatter.js';

/**
 * Parse date range from query parameters
 * @param {Object} query - Request query
 * @returns {Object} Start and end dates
 */
function parseDateRange(query) {
  const defaultDays = 30;

  let startDate, endDate;

  if (query.startDate) {
    startDate = new Date(query.startDate);
    if (isNaN(startDate.getTime())) {
      throw new ValidationError('Invalid startDate format');
    }
  }

  if (query.endDate) {
    endDate = new Date(query.endDate);
    if (isNaN(endDate.getTime())) {
      throw new ValidationError('Invalid endDate format');
    }
  }

  // Default to last 30 days if not provided
  if (!endDate) {
    endDate = new Date();
  }

  if (!startDate) {
    startDate = new Date();
    startDate.setDate(startDate.getDate() - defaultDays);
  }

  // Ensure startDate is before endDate
  if (startDate > endDate) {
    throw new ValidationError('startDate must be before endDate');
  }

  return { startDate, endDate };
}

/**
 * Get dashboard KPIs
 * GET /analytics/dashboard
 */
export async function getDashboardKPIs(req, res, next) {
  try {
    if (!hasPermission(req.user, PERMISSIONS.ANALYTICS_VIEW)) {
      throw new ForbiddenError(
        'You do not have permission to view analytics'
      );
    }

    const { startDate, endDate } = parseDateRange(req.query);

    const kpis = await analyticsService.getDashboardKPIs(startDate, endDate);

    res.json(successResponse(kpis, 'Dashboard KPIs retrieved successfully'));
  } catch (error) {
    next(error);
  }
}

/**
 * Get work order analytics
 * GET /analytics/work-orders
 */
export async function getWorkOrderAnalytics(req, res, next) {
  try {
    if (!hasPermission(req.user, PERMISSIONS.ANALYTICS_VIEW)) {
      throw new ForbiddenError(
        'You do not have permission to view analytics'
      );
    }

    const { startDate, endDate } = parseDateRange(req.query);

    const filters = {
      type: req.query.type,
      priority: req.query.priority
    };

    const analytics = await analyticsService.getWorkOrderAnalytics(
      startDate,
      endDate,
      filters
    );

    res.json(
      successResponse(analytics, 'Work order analytics retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Get equipment analytics
 * GET /analytics/equipment
 */
export async function getEquipmentAnalytics(req, res, next) {
  try {
    if (!hasPermission(req.user, PERMISSIONS.ANALYTICS_VIEW)) {
      throw new ForbiddenError(
        'You do not have permission to view analytics'
      );
    }

    const { startDate, endDate } = parseDateRange(req.query);

    const analytics = await analyticsService.getEquipmentAnalytics(
      startDate,
      endDate
    );

    res.json(
      successResponse(analytics, 'Equipment analytics retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Get inventory analytics
 * GET /analytics/inventory
 */
export async function getInventoryAnalytics(req, res, next) {
  try {
    if (!hasPermission(req.user, PERMISSIONS.ANALYTICS_VIEW)) {
      throw new ForbiddenError(
        'You do not have permission to view analytics'
      );
    }

    const { startDate, endDate } = parseDateRange(req.query);

    const analytics = await analyticsService.getInventoryAnalytics(
      startDate,
      endDate
    );

    res.json(
      successResponse(analytics, 'Inventory analytics retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Get PM analytics
 * GET /analytics/preventive-maintenance
 */
export async function getPMAnalytics(req, res, next) {
  try {
    if (!hasPermission(req.user, PERMISSIONS.ANALYTICS_VIEW)) {
      throw new ForbiddenError(
        'You do not have permission to view analytics'
      );
    }

    const { startDate, endDate } = parseDateRange(req.query);

    const analytics = await analyticsService.getPMAnalytics(startDate, endDate);

    res.json(successResponse(analytics, 'PM analytics retrieved successfully'));
  } catch (error) {
    next(error);
  }
}

/**
 * Get trend data
 * GET /analytics/trends/:metricType
 */
export async function getTrendData(req, res, next) {
  try {
    if (!hasPermission(req.user, PERMISSIONS.ANALYTICS_VIEW)) {
      throw new ForbiddenError(
        'You do not have permission to view analytics'
      );
    }

    const { metricType } = req.params;
    const { startDate, endDate } = parseDateRange(req.query);
    const groupBy = req.query.groupBy || 'day';

    const trendData = await analyticsService.getTrendData(
      metricType,
      startDate,
      endDate,
      groupBy
    );

    res.json(successResponse(trendData, 'Trend data retrieved successfully'));
  } catch (error) {
    next(error);
  }
}

export default {
  getDashboardKPIs,
  getWorkOrderAnalytics,
  getEquipmentAnalytics,
  getInventoryAnalytics,
  getPMAnalytics,
  getTrendData
};
