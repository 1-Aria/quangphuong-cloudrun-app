/**
 * Analytics Routes
 * API routes for analytics and reporting
 */

import express from 'express';
import * as analyticsController from '../controllers/AnalyticsController.js';

const router = express.Router();

// Dashboard KPIs
router.get('/dashboard', analyticsController.getDashboardKPIs);

// Domain-specific analytics
router.get('/work-orders', analyticsController.getWorkOrderAnalytics);
router.get('/equipment', analyticsController.getEquipmentAnalytics);
router.get('/inventory', analyticsController.getInventoryAnalytics);
router.get('/preventive-maintenance', analyticsController.getPMAnalytics);

// Trend data
router.get('/trends/:metricType', analyticsController.getTrendData);

export default router;
