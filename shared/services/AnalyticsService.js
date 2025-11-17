/**
 * Analytics Service
 * Provides CMMS analytics, KPIs, and reporting
 */

import { db } from '../../config/firebase.js';
import { COLLECTIONS } from '../../config/constants.js';
import { logInfo, logError } from '../utils/logger.js';

/**
 * Analytics Service
 * Aggregates data across domains for reporting and KPIs
 */
class AnalyticsService {
  /**
   * Get work order analytics
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {Object} filters - Additional filters
   * @returns {Promise<Object>} Work order analytics
   */
  async getWorkOrderAnalytics(startDate, endDate, filters = {}) {
    try {
      let query = db
        .collection(COLLECTIONS.WORK_ORDERS)
        .where('createdAt', '>=', startDate)
        .where('createdAt', '<=', endDate);

      if (filters.type) {
        query = query.where('type', '==', filters.type);
      }

      if (filters.priority) {
        query = query.where('priority', '==', filters.priority);
      }

      const snapshot = await query.get();

      const analytics = {
        total: snapshot.size,
        byStatus: {},
        byType: {},
        byPriority: {},
        completionMetrics: {
          completed: 0,
          onTime: 0,
          overdue: 0,
          averageCompletionDays: 0
        },
        responseMetrics: {
          averageResponseHours: 0,
          averageResolutionHours: 0
        }
      };

      let totalCompletionDays = 0;
      let totalResponseHours = 0;
      let totalResolutionHours = 0;
      let responseCount = 0;
      let resolutionCount = 0;

      snapshot.docs.forEach(doc => {
        const data = doc.data();

        // Count by status
        analytics.byStatus[data.status] =
          (analytics.byStatus[data.status] || 0) + 1;

        // Count by type
        analytics.byType[data.type] = (analytics.byType[data.type] || 0) + 1;

        // Count by priority
        analytics.byPriority[data.priority] =
          (analytics.byPriority[data.priority] || 0) + 1;

        // Completion metrics
        if (data.status === 'Completed') {
          analytics.completionMetrics.completed++;

          const createdAt = new Date(data.createdAt);
          const completedAt = new Date(data.completedAt);
          const completionDays = Math.ceil(
            (completedAt - createdAt) / (1000 * 60 * 60 * 24)
          );
          totalCompletionDays += completionDays;

          // Check if completed on time
          if (data.dueDate) {
            const dueDate = new Date(data.dueDate);
            if (completedAt <= dueDate) {
              analytics.completionMetrics.onTime++;
            } else {
              analytics.completionMetrics.overdue++;
            }
          }
        }

        // Response time (Created -> Assigned/In Progress)
        if (data.assignedAt || data.inProgressAt) {
          const createdAt = new Date(data.createdAt);
          const responseTime = data.assignedAt
            ? new Date(data.assignedAt)
            : new Date(data.inProgressAt);
          const responseHours =
            (responseTime - createdAt) / (1000 * 60 * 60);
          totalResponseHours += responseHours;
          responseCount++;
        }

        // Resolution time (Created -> Completed)
        if (data.completedAt) {
          const createdAt = new Date(data.createdAt);
          const completedAt = new Date(data.completedAt);
          const resolutionHours =
            (completedAt - createdAt) / (1000 * 60 * 60);
          totalResolutionHours += resolutionHours;
          resolutionCount++;
        }
      });

      // Calculate averages
      if (analytics.completionMetrics.completed > 0) {
        analytics.completionMetrics.averageCompletionDays = Math.round(
          totalCompletionDays / analytics.completionMetrics.completed
        );
      }

      if (responseCount > 0) {
        analytics.responseMetrics.averageResponseHours = Math.round(
          (totalResponseHours / responseCount) * 10
        ) / 10;
      }

      if (resolutionCount > 0) {
        analytics.responseMetrics.averageResolutionHours = Math.round(
          (totalResolutionHours / resolutionCount) * 10
        ) / 10;
      }

      return analytics;
    } catch (error) {
      logError('Error getting work order analytics', { error: error.message });
      throw error;
    }
  }

  /**
   * Get equipment analytics
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Object>} Equipment analytics
   */
  async getEquipmentAnalytics(startDate, endDate) {
    try {
      const snapshot = await db.collection(COLLECTIONS.EQUIPMENT).get();

      const analytics = {
        total: snapshot.size,
        byStatus: {},
        byType: {},
        byCriticality: {},
        downtimeMetrics: {
          totalDowntimeHours: 0,
          averageDowntimeHours: 0,
          equipmentWithDowntime: 0
        },
        reliabilityMetrics: {
          averageMTBF: 0,
          averageMTTR: 0,
          averageAvailability: 0
        }
      };

      let totalMTBF = 0;
      let totalMTTR = 0;
      let totalAvailability = 0;
      let mtbfCount = 0;
      let mttrCount = 0;
      let availabilityCount = 0;

      snapshot.docs.forEach(doc => {
        const data = doc.data();

        // Count by status
        analytics.byStatus[data.status] =
          (analytics.byStatus[data.status] || 0) + 1;

        // Count by type
        analytics.byType[data.equipmentType] =
          (analytics.byType[data.equipmentType] || 0) + 1;

        // Count by criticality
        analytics.byCriticality[data.criticality] =
          (analytics.byCriticality[data.criticality] || 0) + 1;

        // Downtime metrics
        if (data.totalDowntimeHours && data.totalDowntimeHours > 0) {
          analytics.downtimeMetrics.totalDowntimeHours +=
            data.totalDowntimeHours;
          analytics.downtimeMetrics.equipmentWithDowntime++;
        }

        // Reliability metrics
        if (data.mtbf) {
          totalMTBF += data.mtbf;
          mtbfCount++;
        }

        if (data.mttr) {
          totalMTTR += data.mttr;
          mttrCount++;
        }

        if (data.availabilityPercent !== undefined) {
          totalAvailability += data.availabilityPercent;
          availabilityCount++;
        }
      });

      // Calculate averages
      if (analytics.downtimeMetrics.equipmentWithDowntime > 0) {
        analytics.downtimeMetrics.averageDowntimeHours = Math.round(
          analytics.downtimeMetrics.totalDowntimeHours /
            analytics.downtimeMetrics.equipmentWithDowntime
        );
      }

      if (mtbfCount > 0) {
        analytics.reliabilityMetrics.averageMTBF = Math.round(
          totalMTBF / mtbfCount
        );
      }

      if (mttrCount > 0) {
        analytics.reliabilityMetrics.averageMTTR = Math.round(
          totalMTTR / mttrCount
        );
      }

      if (availabilityCount > 0) {
        analytics.reliabilityMetrics.averageAvailability = Math.round(
          totalAvailability / availabilityCount
        );
      }

      return analytics;
    } catch (error) {
      logError('Error getting equipment analytics', { error: error.message });
      throw error;
    }
  }

  /**
   * Get inventory analytics
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Object>} Inventory analytics
   */
  async getInventoryAnalytics(startDate, endDate) {
    try {
      const inventorySnapshot = await db
        .collection(COLLECTIONS.INVENTORY)
        .get();

      const transactionsSnapshot = await db
        .collection(COLLECTIONS.INVENTORY_TRANSACTIONS)
        .where('timestamp', '>=', startDate)
        .where('timestamp', '<=', endDate)
        .get();

      const analytics = {
        inventory: {
          total: inventorySnapshot.size,
          byType: {},
          byStockStatus: {},
          totalValue: 0,
          itemsNeedingReorder: 0
        },
        transactions: {
          total: transactionsSnapshot.size,
          byType: {},
          totalValue: 0,
          totalQuantity: 0
        }
      };

      // Inventory analytics
      inventorySnapshot.docs.forEach(doc => {
        const data = doc.data();

        // Count by type
        analytics.inventory.byType[data.itemType] =
          (analytics.inventory.byType[data.itemType] || 0) + 1;

        // Count by stock status
        analytics.inventory.byStockStatus[data.stockStatus] =
          (analytics.inventory.byStockStatus[data.stockStatus] || 0) + 1;

        // Total value
        analytics.inventory.totalValue += data.stockValue || 0;

        // Items needing reorder
        if (
          data.quantityOnHand <= data.reorderPoint &&
          data.stockStatus !== 'Out of Stock'
        ) {
          analytics.inventory.itemsNeedingReorder++;
        }
      });

      // Transaction analytics
      transactionsSnapshot.docs.forEach(doc => {
        const data = doc.data();

        // Count by type
        analytics.transactions.byType[data.transactionType] =
          (analytics.transactions.byType[data.transactionType] || 0) + 1;

        // Total value and quantity
        analytics.transactions.totalValue += data.totalCost || 0;
        analytics.transactions.totalQuantity += data.quantity || 0;
      });

      // Round total values
      analytics.inventory.totalValue = Math.round(
        analytics.inventory.totalValue
      );
      analytics.transactions.totalValue = Math.round(
        analytics.transactions.totalValue
      );

      return analytics;
    } catch (error) {
      logError('Error getting inventory analytics', { error: error.message });
      throw error;
    }
  }

  /**
   * Get PM analytics
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Object>} PM analytics
   */
  async getPMAnalytics(startDate, endDate) {
    try {
      const snapshot = await db.collection('pm_schedules').get();

      const analytics = {
        total: snapshot.size,
        byStatus: {},
        byFrequency: {},
        complianceMetrics: {
          totalScheduled: 0,
          totalCompleted: 0,
          totalOnTime: 0,
          totalOverdue: 0,
          totalSkipped: 0,
          averageComplianceRate: 0
        }
      };

      let complianceRateSum = 0;
      let complianceRateCount = 0;

      snapshot.docs.forEach(doc => {
        const data = doc.data();

        // Count by status
        analytics.byStatus[data.status] =
          (analytics.byStatus[data.status] || 0) + 1;

        // Count by frequency
        analytics.byFrequency[data.frequency] =
          (analytics.byFrequency[data.frequency] || 0) + 1;

        // Sum metrics
        analytics.complianceMetrics.totalScheduled +=
          data.totalScheduled || 0;
        analytics.complianceMetrics.totalCompleted +=
          data.totalCompleted || 0;
        analytics.complianceMetrics.totalOnTime += data.totalOnTime || 0;
        analytics.complianceMetrics.totalOverdue += data.totalOverdue || 0;
        analytics.complianceMetrics.totalSkipped += data.totalSkipped || 0;

        if (data.complianceRate !== undefined && data.totalCompleted > 0) {
          complianceRateSum += data.complianceRate;
          complianceRateCount++;
        }
      });

      // Calculate average compliance rate
      if (complianceRateCount > 0) {
        analytics.complianceMetrics.averageComplianceRate = Math.round(
          complianceRateSum / complianceRateCount
        );
      }

      return analytics;
    } catch (error) {
      logError('Error getting PM analytics', { error: error.message });
      throw error;
    }
  }

  /**
   * Get dashboard KPIs
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Object>} Dashboard KPIs
   */
  async getDashboardKPIs(startDate, endDate) {
    try {
      logInfo('Generating dashboard KPIs', { startDate, endDate });

      // Run analytics in parallel
      const [workOrderAnalytics, equipmentAnalytics, inventoryAnalytics, pmAnalytics] = await Promise.all([
        this.getWorkOrderAnalytics(startDate, endDate),
        this.getEquipmentAnalytics(startDate, endDate),
        this.getInventoryAnalytics(startDate, endDate),
        this.getPMAnalytics(startDate, endDate)
      ]);

      const kpis = {
        period: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        },
        workOrders: {
          total: workOrderAnalytics.total,
          completed: workOrderAnalytics.completionMetrics.completed,
          completionRate:
            workOrderAnalytics.total > 0
              ? Math.round(
                  (workOrderAnalytics.completionMetrics.completed /
                    workOrderAnalytics.total) *
                    100
                )
              : 0,
          averageCompletionDays:
            workOrderAnalytics.completionMetrics.averageCompletionDays,
          averageResponseHours:
            workOrderAnalytics.responseMetrics.averageResponseHours,
          onTimeRate:
            workOrderAnalytics.completionMetrics.completed > 0
              ? Math.round(
                  (workOrderAnalytics.completionMetrics.onTime /
                    workOrderAnalytics.completionMetrics.completed) *
                    100
                )
              : 0
        },
        equipment: {
          total: equipmentAnalytics.total,
          operational:
            equipmentAnalytics.byStatus['Operational'] || 0,
          down: equipmentAnalytics.byStatus['Down'] || 0,
          maintenance:
            equipmentAnalytics.byStatus['Under Maintenance'] || 0,
          averageAvailability:
            equipmentAnalytics.reliabilityMetrics.averageAvailability,
          averageMTBF: equipmentAnalytics.reliabilityMetrics.averageMTBF,
          averageMTTR: equipmentAnalytics.reliabilityMetrics.averageMTTR
        },
        inventory: {
          totalItems: inventoryAnalytics.inventory.total,
          totalValue: inventoryAnalytics.inventory.totalValue,
          itemsNeedingReorder:
            inventoryAnalytics.inventory.itemsNeedingReorder,
          outOfStock:
            inventoryAnalytics.inventory.byStockStatus['Out of Stock'] || 0,
          lowStock:
            inventoryAnalytics.inventory.byStockStatus['Low Stock'] || 0,
          transactionsCount: inventoryAnalytics.transactions.total
        },
        preventiveMaintenance: {
          totalSchedules: pmAnalytics.total,
          activeSchedules: pmAnalytics.byStatus['Active'] || 0,
          completionRate:
            pmAnalytics.complianceMetrics.totalScheduled > 0
              ? Math.round(
                  (pmAnalytics.complianceMetrics.totalCompleted /
                    pmAnalytics.complianceMetrics.totalScheduled) *
                    100
                )
              : 0,
          complianceRate:
            pmAnalytics.complianceMetrics.averageComplianceRate,
          overdueCount: pmAnalytics.complianceMetrics.totalOverdue
        }
      };

      return kpis;
    } catch (error) {
      logError('Error generating dashboard KPIs', { error: error.message });
      throw error;
    }
  }

  /**
   * Get trend data for charts
   * @param {string} metricType - Metric type (workOrders, equipment, etc.)
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {string} groupBy - Group by (day, week, month)
   * @returns {Promise<Array>} Trend data
   */
  async getTrendData(metricType, startDate, endDate, groupBy = 'day') {
    try {
      // This would generate time-series data for charts
      // Implementation depends on specific requirements
      logInfo('Generating trend data', {
        metricType,
        startDate,
        endDate,
        groupBy
      });

      // Placeholder for trend data generation
      return [];
    } catch (error) {
      logError('Error generating trend data', { error: error.message });
      throw error;
    }
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();

export default AnalyticsService;
