/**
 * Work Order Integration Service
 * Handles integration between Work Orders, Equipment, and Inventory
 */

import { equipmentService } from '../../domains/equipment/services/EquipmentService.js';
import { inventoryService } from '../../domains/inventory/services/InventoryService.js';
import { inventoryTransactionService } from '../../domains/inventory/services/InventoryTransactionService.js';
import { EQUIPMENT_STATUS } from '../../domains/equipment/config.js';
import { logInfo, logError } from '../utils/logger.js';

/**
 * Work Order Integration Service
 * Coordinates actions across Work Orders, Equipment, and Inventory
 */
class WorkOrderIntegrationService {
  /**
   * Handle work order assignment - update equipment status
   * @param {Object} workOrder - Work order data
   * @param {Object} user - User performing action
   */
  async onWorkOrderAssigned(workOrder, user) {
    try {
      // If work order has equipment, check if equipment should be marked as reserved
      if (workOrder.equipmentId) {
        const equipment = await equipmentService.getByEquipmentId(
          workOrder.equipmentId
        );

        if (equipment && equipment.status === EQUIPMENT_STATUS.OPERATIONAL) {
          // Optionally mark equipment as reserved
          // await equipmentService.updateEquipmentStatus(
          //   equipment.id,
          //   EQUIPMENT_STATUS.RESERVED,
          //   user,
          //   `Reserved for work order ${workOrder.workOrderId}`
          // );

          logInfo('Equipment associated with work order', {
            workOrderId: workOrder.workOrderId,
            equipmentId: workOrder.equipmentId
          });
        }
      }

      // If parts were pre-requested, reserve inventory
      if (workOrder.partsRequested && workOrder.partsRequested.length > 0) {
        await this.reservePartsForWorkOrder(
          workOrder.id,
          workOrder.partsRequested,
          user
        );
      }
    } catch (error) {
      logError('Error handling work order assignment integration', {
        error: error.message
      });
      // Don't throw - integration errors shouldn't block work order assignment
    }
  }

  /**
   * Handle work order start - update equipment status
   * @param {Object} workOrder - Work order data
   * @param {Object} user - User performing action
   */
  async onWorkOrderStarted(workOrder, user) {
    try {
      // Mark equipment as under maintenance
      if (workOrder.equipmentId) {
        const equipment = await equipmentService.getByEquipmentId(
          workOrder.equipmentId
        );

        if (equipment) {
          await equipmentService.updateEquipmentStatus(
            equipment.id,
            EQUIPMENT_STATUS.MAINTENANCE,
            user,
            `Work order ${workOrder.workOrderId} started`
          );

          logInfo('Equipment marked as under maintenance', {
            workOrderId: workOrder.workOrderId,
            equipmentId: workOrder.equipmentId
          });
        }
      }
    } catch (error) {
      logError('Error handling work order start integration', {
        error: error.message
      });
    }
  }

  /**
   * Handle work order completion - update equipment status and record maintenance
   * @param {Object} workOrder - Work order data
   * @param {Object} user - User performing action
   */
  async onWorkOrderCompleted(workOrder, user) {
    try {
      if (workOrder.equipmentId) {
        const equipment = await equipmentService.getByEquipmentId(
          workOrder.equipmentId
        );

        if (equipment) {
          // Record maintenance event on equipment
          await equipmentService.recordMaintenance(
            equipment.id,
            {
              type: workOrder.type,
              description: workOrder.completionNotes || workOrder.title,
              workOrderId: workOrder.workOrderId
            },
            user
          );

          // Return equipment to operational status
          await equipmentService.updateEquipmentStatus(
            equipment.id,
            EQUIPMENT_STATUS.OPERATIONAL,
            user,
            `Work order ${workOrder.workOrderId} completed`
          );

          logInfo('Equipment maintenance recorded and returned to operational', {
            workOrderId: workOrder.workOrderId,
            equipmentId: workOrder.equipmentId
          });
        }
      }

      // Release any unreturned reserved parts
      // (Actual parts used should have been issued via inventory transactions)
    } catch (error) {
      logError('Error handling work order completion integration', {
        error: error.message
      });
    }
  }

  /**
   * Handle work order cancellation - release reserved parts and equipment
   * @param {Object} workOrder - Work order data
   * @param {Object} user - User performing action
   */
  async onWorkOrderCancelled(workOrder, user) {
    try {
      // Return equipment to operational status
      if (workOrder.equipmentId) {
        const equipment = await equipmentService.getByEquipmentId(
          workOrder.equipmentId
        );

        if (
          equipment &&
          (equipment.status === EQUIPMENT_STATUS.MAINTENANCE ||
            equipment.status === EQUIPMENT_STATUS.RESERVED)
        ) {
          await equipmentService.updateEquipmentStatus(
            equipment.id,
            EQUIPMENT_STATUS.OPERATIONAL,
            user,
            `Work order ${workOrder.workOrderId} cancelled`
          );
        }
      }

      // Release reserved inventory (if any)
      if (workOrder.partsRequested && workOrder.partsRequested.length > 0) {
        await this.releasePartsForWorkOrder(workOrder.partsRequested);
      }

      logInfo('Work order cancellation cleanup completed', {
        workOrderId: workOrder.workOrderId
      });
    } catch (error) {
      logError('Error handling work order cancellation integration', {
        error: error.message
      });
    }
  }

  /**
   * Reserve parts for work order
   * @param {string} workOrderId - Work order ID
   * @param {Array} parts - Array of parts to reserve
   * @param {Object} user - User performing action
   */
  async reservePartsForWorkOrder(workOrderId, parts, user) {
    try {
      for (const part of parts) {
        const inventory = await inventoryService.getByPartNumber(part.partId);

        if (inventory) {
          await inventoryService.reserveStock(
            inventory.id,
            part.quantity,
            workOrderId
          );

          logInfo('Parts reserved for work order', {
            workOrderId,
            partNumber: part.partId,
            quantity: part.quantity
          });
        }
      }
    } catch (error) {
      logError('Error reserving parts for work order', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Release parts reserved for work order
   * @param {Array} parts - Array of parts to release
   */
  async releasePartsForWorkOrder(parts) {
    try {
      for (const part of parts) {
        const inventory = await inventoryService.getByPartNumber(part.partId);

        if (inventory) {
          await inventoryService.releaseReservedStock(
            inventory.id,
            part.quantity
          );

          logInfo('Reserved parts released', {
            partNumber: part.partId,
            quantity: part.quantity
          });
        }
      }
    } catch (error) {
      logError('Error releasing reserved parts', { error: error.message });
    }
  }

  /**
   * Issue parts to work order (inventory transaction)
   * @param {string} workOrderId - Work order ID
   * @param {Array} parts - Array of parts to issue
   * @param {Object} user - User performing action
   * @returns {Promise<Array>} Issued transactions
   */
  async issuePartsToWorkOrder(workOrderId, parts, user) {
    try {
      const transactions = [];

      for (const part of parts) {
        const inventory = await inventoryService.getByPartNumber(part.partId);

        if (inventory) {
          const result = await inventoryTransactionService.issueStock(
            inventory.id,
            part.quantity,
            workOrderId,
            user
          );

          transactions.push(result.transaction);

          logInfo('Parts issued to work order', {
            workOrderId,
            partNumber: part.partId,
            quantity: part.quantity
          });
        }
      }

      return transactions;
    } catch (error) {
      logError('Error issuing parts to work order', { error: error.message });
      throw error;
    }
  }

  /**
   * Return unused parts from work order
   * @param {string} workOrderId - Work order ID
   * @param {Array} parts - Array of parts to return
   * @param {Object} user - User performing action
   * @returns {Promise<Array>} Return transactions
   */
  async returnPartsFromWorkOrder(workOrderId, parts, user) {
    try {
      const transactions = [];

      for (const part of parts) {
        const inventory = await inventoryService.getByPartNumber(part.partId);

        if (inventory) {
          const result = await inventoryTransactionService.returnStock(
            inventory.id,
            part.quantity,
            workOrderId,
            user
          );

          transactions.push(result.transaction);

          logInfo('Parts returned from work order', {
            workOrderId,
            partNumber: part.partId,
            quantity: part.quantity
          });
        }
      }

      return transactions;
    } catch (error) {
      logError('Error returning parts from work order', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get complete work order context with equipment and inventory
   * @param {Object} workOrder - Work order data
   * @returns {Promise<Object>} Complete context
   */
  async getWorkOrderContext(workOrder) {
    try {
      const context = {
        workOrder,
        equipment: null,
        inventory: [],
        transactions: []
      };

      // Get equipment details
      if (workOrder.equipmentId) {
        context.equipment = await equipmentService.getByEquipmentId(
          workOrder.equipmentId
        );
      }

      // Get inventory transactions for this work order
      context.transactions = await inventoryTransactionService.getTransactionsByWorkOrder(
        workOrder.workOrderId || workOrder.id
      );

      // Get inventory item details for each transaction
      const inventoryIds = [
        ...new Set(context.transactions.map(t => t.inventoryItemId))
      ];

      for (const id of inventoryIds) {
        const item = await inventoryService.findById(id);
        if (item) {
          context.inventory.push(item);
        }
      }

      return context;
    } catch (error) {
      logError('Error getting work order context', { error: error.message });
      throw error;
    }
  }
}

// Export singleton instance
export const workOrderIntegrationService = new WorkOrderIntegrationService();

export default WorkOrderIntegrationService;
