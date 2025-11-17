/**
 * MTTR and Downtime Report Service
 * Calculates Mean Time To Repair, equipment downtime, and availability metrics
 */

import { db } from '../../../config/firebase.js';
import { COLLECTIONS } from '../../../config/constants.js';
import { MAINTENANCE_STATUS } from '../config.js';
import { ValidationError } from '../../../shared/errors/AppError.js';
import { logInfo, logError } from '../../../shared/utils/logger.js';

/**
 * MTTR Report Service
 * Generates maintenance metrics reports including MTTR, MTBF, and availability
 */
class MTTRReportService {
  /**
   * Calculate MTTR (Mean Time To Repair) for date range
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {Object} filters - Optional filters (equipmentId, priority, etc.)
   * @returns {Promise<Object>} MTTR statistics
   */
  async calculateMTTR(startDate, endDate, filters = {}) {
    try {
      // Validate dates
      if (!startDate || !endDate) {
        throw new ValidationError('Start date and end date are required');
      }

      if (new Date(startDate) > new Date(endDate)) {
        throw new ValidationError('Start date must be before end date');
      }

      logInfo('Calculating MTTR', { startDate, endDate, filters });

      // Build query
      let query = db
        .collection(COLLECTIONS.WORK_ORDERS)
        .where('closedAt', '>=', startDate)
        .where('closedAt', '<=', endDate);

      // Apply filters
      if (filters.equipmentId) {
        query = query.where('equipmentId', '==', filters.equipmentId);
      }

      if (filters.priority) {
        query = query.where('priority', '==', filters.priority);
      }

      if (filters.workType) {
        query = query.where('workType', '==', filters.workType);
      }

      const snapshot = await query.get();

      const workOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Filter completed work orders only
      const completedWorkOrders = workOrders.filter(
        wo => wo.status === MAINTENANCE_STATUS.CLOSED && wo.laborHours > 0
      );

      if (completedWorkOrders.length === 0) {
        return {
          mttr: 0,
          totalWorkOrders: 0,
          totalRepairHours: 0,
          minRepairHours: 0,
          maxRepairHours: 0,
          medianRepairHours: 0,
          byPriority: {},
          byEquipment: {},
          dateRange: { startDate, endDate }
        };
      }

      // Calculate total repair time
      const totalRepairHours = completedWorkOrders.reduce(
        (sum, wo) => sum + (wo.laborHours || 0),
        0
      );

      // Calculate MTTR (average repair time)
      const mttr = totalRepairHours / completedWorkOrders.length;

      // Calculate min, max
      const repairHours = completedWorkOrders.map(wo => wo.laborHours || 0);
      const minRepairHours = Math.min(...repairHours);
      const maxRepairHours = Math.max(...repairHours);

      // Calculate median
      const sortedHours = [...repairHours].sort((a, b) => a - b);
      const mid = Math.floor(sortedHours.length / 2);
      const medianRepairHours =
        sortedHours.length % 2 === 0
          ? (sortedHours[mid - 1] + sortedHours[mid]) / 2
          : sortedHours[mid];

      // Calculate by priority
      const byPriority = this.groupByField(completedWorkOrders, 'priority');

      // Calculate by equipment
      const byEquipment = this.groupByField(completedWorkOrders, 'equipmentId');

      const result = {
        mttr: Math.round(mttr * 100) / 100,
        totalWorkOrders: completedWorkOrders.length,
        totalRepairHours: Math.round(totalRepairHours * 100) / 100,
        minRepairHours: Math.round(minRepairHours * 100) / 100,
        maxRepairHours: Math.round(maxRepairHours * 100) / 100,
        medianRepairHours: Math.round(medianRepairHours * 100) / 100,
        byPriority,
        byEquipment,
        dateRange: { startDate, endDate }
      };

      logInfo('MTTR calculated', result);

      return result;
    } catch (error) {
      logError('Error calculating MTTR', { error: error.message });
      throw error;
    }
  }

  /**
   * Calculate downtime statistics
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {Object} filters - Optional filters
   * @returns {Promise<Object>} Downtime statistics
   */
  async calculateDowntime(startDate, endDate, filters = {}) {
    try {
      // Validate dates
      if (!startDate || !endDate) {
        throw new ValidationError('Start date and end date are required');
      }

      if (new Date(startDate) > new Date(endDate)) {
        throw new ValidationError('Start date must be before end date');
      }

      logInfo('Calculating downtime', { startDate, endDate, filters });

      // Build query
      let query = db
        .collection(COLLECTIONS.WORK_ORDERS)
        .where('closedAt', '>=', startDate)
        .where('closedAt', '<=', endDate);

      // Apply filters
      if (filters.equipmentId) {
        query = query.where('equipmentId', '==', filters.equipmentId);
      }

      if (filters.priority) {
        query = query.where('priority', '==', filters.priority);
      }

      const snapshot = await query.get();

      const workOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Filter work orders with downtime data
      const workOrdersWithDowntime = workOrders.filter(
        wo => wo.status === MAINTENANCE_STATUS.CLOSED && wo.downtimeMinutes > 0
      );

      if (workOrdersWithDowntime.length === 0) {
        return {
          totalDowntimeHours: 0,
          totalDowntimeMinutes: 0,
          totalIncidents: 0,
          averageDowntimeHours: 0,
          byEquipment: {},
          byPriority: {},
          byImpact: {},
          dateRange: { startDate, endDate }
        };
      }

      // Calculate total downtime
      const totalDowntimeMinutes = workOrdersWithDowntime.reduce(
        (sum, wo) => sum + (wo.downtimeMinutes || 0),
        0
      );

      const totalDowntimeHours = totalDowntimeMinutes / 60;
      const averageDowntimeHours = totalDowntimeHours / workOrdersWithDowntime.length;

      // Group by equipment
      const byEquipment = {};
      workOrdersWithDowntime.forEach(wo => {
        const equipmentId = wo.equipmentId || 'Unknown';
        if (!byEquipment[equipmentId]) {
          byEquipment[equipmentId] = {
            equipmentId,
            equipmentName: wo.equipmentName || equipmentId,
            totalDowntimeMinutes: 0,
            totalDowntimeHours: 0,
            incidentCount: 0
          };
        }
        byEquipment[equipmentId].totalDowntimeMinutes += wo.downtimeMinutes || 0;
        byEquipment[equipmentId].totalDowntimeHours = Math.round(
          (byEquipment[equipmentId].totalDowntimeMinutes / 60) * 100
        ) / 100;
        byEquipment[equipmentId].incidentCount++;
      });

      // Group by priority
      const byPriority = {};
      workOrdersWithDowntime.forEach(wo => {
        const priority = wo.priority || 'Unknown';
        if (!byPriority[priority]) {
          byPriority[priority] = {
            priority,
            totalDowntimeMinutes: 0,
            totalDowntimeHours: 0,
            incidentCount: 0
          };
        }
        byPriority[priority].totalDowntimeMinutes += wo.downtimeMinutes || 0;
        byPriority[priority].totalDowntimeHours = Math.round(
          (byPriority[priority].totalDowntimeMinutes / 60) * 100
        ) / 100;
        byPriority[priority].incidentCount++;
      });

      // Group by impact
      const byImpact = {};
      workOrdersWithDowntime.forEach(wo => {
        const impact = wo.impact || 'Unknown';
        if (!byImpact[impact]) {
          byImpact[impact] = {
            impact,
            totalDowntimeMinutes: 0,
            totalDowntimeHours: 0,
            incidentCount: 0
          };
        }
        byImpact[impact].totalDowntimeMinutes += wo.downtimeMinutes || 0;
        byImpact[impact].totalDowntimeHours = Math.round(
          (byImpact[impact].totalDowntimeMinutes / 60) * 100
        ) / 100;
        byImpact[impact].incidentCount++;
      });

      const result = {
        totalDowntimeHours: Math.round(totalDowntimeHours * 100) / 100,
        totalDowntimeMinutes,
        totalIncidents: workOrdersWithDowntime.length,
        averageDowntimeHours: Math.round(averageDowntimeHours * 100) / 100,
        byEquipment,
        byPriority,
        byImpact,
        dateRange: { startDate, endDate }
      };

      logInfo('Downtime calculated', result);

      return result;
    } catch (error) {
      logError('Error calculating downtime', { error: error.message });
      throw error;
    }
  }

  /**
   * Calculate equipment availability
   * @param {string} equipmentId - Equipment ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Object>} Availability metrics
   */
  async calculateAvailability(equipmentId, startDate, endDate) {
    try {
      if (!equipmentId) {
        throw new ValidationError('Equipment ID is required');
      }

      if (!startDate || !endDate) {
        throw new ValidationError('Start date and end date are required');
      }

      if (new Date(startDate) > new Date(endDate)) {
        throw new ValidationError('Start date must be before end date');
      }

      logInfo('Calculating availability', { equipmentId, startDate, endDate });

      // Get equipment details
      const equipmentDoc = await db
        .collection(COLLECTIONS.EQUIPMENT)
        .doc(equipmentId)
        .get();

      if (!equipmentDoc.exists) {
        throw new ValidationError('Equipment not found');
      }

      const equipment = equipmentDoc.data();

      // Get work orders for this equipment in date range
      const snapshot = await db
        .collection(COLLECTIONS.WORK_ORDERS)
        .where('equipmentId', '==', equipmentId)
        .where('closedAt', '>=', startDate)
        .where('closedAt', '<=', endDate)
        .get();

      const workOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Calculate total downtime
      const totalDowntimeMinutes = workOrders.reduce(
        (sum, wo) => sum + (wo.downtimeMinutes || 0),
        0
      );

      // Calculate total period in minutes
      const periodMinutes =
        (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60);

      // Calculate availability percentage
      // Availability = (Total Time - Downtime) / Total Time * 100
      const availability =
        periodMinutes > 0
          ? ((periodMinutes - totalDowntimeMinutes) / periodMinutes) * 100
          : 100;

      // Calculate MTBF (Mean Time Between Failures)
      const failureCount = workOrders.length;
      const mtbf = failureCount > 0 ? periodMinutes / failureCount : 0;

      // Calculate MTTR for this equipment
      const completedWorkOrders = workOrders.filter(
        wo => wo.status === MAINTENANCE_STATUS.CLOSED && wo.laborHours > 0
      );

      const totalRepairHours = completedWorkOrders.reduce(
        (sum, wo) => sum + (wo.laborHours || 0),
        0
      );

      const mttr =
        completedWorkOrders.length > 0
          ? totalRepairHours / completedWorkOrders.length
          : 0;

      const result = {
        equipmentId,
        equipmentName: equipment.name || equipmentId,
        availability: Math.round(availability * 100) / 100,
        mttr: Math.round(mttr * 100) / 100,
        mtbf: Math.round((mtbf / 60) * 100) / 100, // Convert to hours
        totalDowntimeHours: Math.round((totalDowntimeMinutes / 60) * 100) / 100,
        totalDowntimeMinutes,
        failureCount,
        totalWorkOrders: workOrders.length,
        dateRange: { startDate, endDate }
      };

      logInfo('Availability calculated', result);

      return result;
    } catch (error) {
      logError('Error calculating availability', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate comprehensive maintenance report
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {Object} filters - Optional filters
   * @returns {Promise<Object>} Comprehensive report
   */
  async generateMaintenanceReport(startDate, endDate, filters = {}) {
    try {
      logInfo('Generating maintenance report', { startDate, endDate, filters });

      // Calculate all metrics in parallel
      const [mttrData, downtimeData] = await Promise.all([
        this.calculateMTTR(startDate, endDate, filters),
        this.calculateDowntime(startDate, endDate, filters)
      ]);

      // Get top equipment by downtime
      const topEquipmentByDowntime = Object.values(downtimeData.byEquipment)
        .sort((a, b) => b.totalDowntimeHours - a.totalDowntimeHours)
        .slice(0, 10);

      // Get work order trends
      const trends = await this.getWorkOrderTrends(startDate, endDate, filters);

      const report = {
        summary: {
          mttr: mttrData.mttr,
          totalDowntimeHours: downtimeData.totalDowntimeHours,
          totalWorkOrders: mttrData.totalWorkOrders,
          totalIncidents: downtimeData.totalIncidents
        },
        mttr: mttrData,
        downtime: downtimeData,
        topEquipmentByDowntime,
        trends,
        dateRange: { startDate, endDate },
        generatedAt: new Date()
      };

      logInfo('Maintenance report generated', {
        mttr: report.summary.mttr,
        downtime: report.summary.totalDowntimeHours
      });

      return report;
    } catch (error) {
      logError('Error generating maintenance report', { error: error.message });
      throw error;
    }
  }

  /**
   * Get work order trends over time
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} Trend data
   * @private
   */
  async getWorkOrderTrends(startDate, endDate, filters = {}) {
    try {
      let query = db
        .collection(COLLECTIONS.WORK_ORDERS)
        .where('createdAt', '>=', startDate)
        .where('createdAt', '<=', endDate);

      if (filters.equipmentId) {
        query = query.where('equipmentId', '==', filters.equipmentId);
      }

      const snapshot = await query.get();
      const workOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Group by week
      const weeklyData = {};

      workOrders.forEach(wo => {
        const date = new Date(wo.createdAt);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay()); // Start of week
        const weekKey = weekStart.toISOString().split('T')[0];

        if (!weeklyData[weekKey]) {
          weeklyData[weekKey] = {
            week: weekKey,
            totalWorkOrders: 0,
            completedWorkOrders: 0,
            totalDowntimeMinutes: 0,
            totalRepairHours: 0
          };
        }

        weeklyData[weekKey].totalWorkOrders++;

        if (wo.status === MAINTENANCE_STATUS.CLOSED) {
          weeklyData[weekKey].completedWorkOrders++;
          weeklyData[weekKey].totalDowntimeMinutes += wo.downtimeMinutes || 0;
          weeklyData[weekKey].totalRepairHours += wo.laborHours || 0;
        }
      });

      return Object.values(weeklyData).sort((a, b) =>
        a.week.localeCompare(b.week)
      );
    } catch (error) {
      logError('Error getting work order trends', { error: error.message });
      throw error;
    }
  }

  /**
   * Group work orders by field and calculate metrics
   * @param {Array} workOrders - Work orders
   * @param {string} field - Field to group by
   * @returns {Object} Grouped metrics
   * @private
   */
  groupByField(workOrders, field) {
    const grouped = {};

    workOrders.forEach(wo => {
      const key = wo[field] || 'Unknown';

      if (!grouped[key]) {
        grouped[key] = {
          [field]: key,
          count: 0,
          totalRepairHours: 0,
          mttr: 0
        };
      }

      grouped[key].count++;
      grouped[key].totalRepairHours += wo.laborHours || 0;
    });

    // Calculate MTTR for each group
    Object.values(grouped).forEach(group => {
      group.mttr = group.count > 0 ? group.totalRepairHours / group.count : 0;
      group.mttr = Math.round(group.mttr * 100) / 100;
      group.totalRepairHours = Math.round(group.totalRepairHours * 100) / 100;
    });

    return grouped;
  }
}

// Export singleton instance
export const mttrReportService = new MTTRReportService();

export default MTTRReportService;
