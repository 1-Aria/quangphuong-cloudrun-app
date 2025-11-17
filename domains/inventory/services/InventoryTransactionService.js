/**
 * Inventory Transaction Service
 * Handles atomic inventory transactions with stock updates
 */

import { db } from '../../../config/firebase.js';
import {
  INVENTORY_CONFIG,
  TRANSACTION_TYPES,
  validateTransactionQuantity,
  calculateNewQuantity,
  calculateStockStatus,
  calculateStockValue
} from '../config.js';
import { ValidationError, NotFoundError } from '../../../shared/errors/AppError.js';
import { logInfo, logError } from '../../../shared/utils/logger.js';

/**
 * Inventory Transaction Service
 * Uses Firestore transactions for atomic operations
 */
class InventoryTransactionService {
  constructor() {
    this.transactionsCollection = INVENTORY_CONFIG.transactionsCollection;
    this.inventoryCollection = INVENTORY_CONFIG.collection;
  }

  /**
   * Record inventory transaction (atomic)
   * @param {Object} transactionData - Transaction data
   * @param {Object} user - User performing transaction
   * @returns {Promise<Object>} Transaction record and updated inventory
   */
  async recordTransaction(transactionData, user) {
    try {
      const {
        inventoryItemId,
        transactionType,
        quantity,
        workOrderId = null,
        reference = null,
        notes = '',
        unitCost = null
      } = transactionData;

      // Validate transaction type
      if (!INVENTORY_CONFIG.validTransactionTypes.includes(transactionType)) {
        throw new ValidationError(`Invalid transaction type: ${transactionType}`);
      }

      if (!quantity || quantity <= 0) {
        throw new ValidationError('Quantity must be greater than 0');
      }

      // Run transaction atomically
      const result = await db.runTransaction(async (transaction) => {
        // Get inventory item
        const itemRef = db.collection(this.inventoryCollection).doc(inventoryItemId);
        const itemDoc = await transaction.get(itemRef);

        if (!itemDoc.exists) {
          throw new NotFoundError('Inventory item not found');
        }

        const item = itemDoc.data();

        // Validate transaction quantity
        validateTransactionQuantity(
          transactionType,
          item.quantityOnHand,
          quantity
        );

        // Calculate new quantity
        const newQuantity = calculateNewQuantity(
          transactionType,
          item.quantityOnHand,
          quantity
        );

        // Calculate new stock status
        const newStockStatus = calculateStockStatus(
          newQuantity,
          item.minStockLevel,
          item.maxStockLevel
        );

        // Calculate new stock value
        const costToUse = unitCost || item.unitCost;
        const newStockValue = calculateStockValue(newQuantity, costToUse);

        // Update available quantity
        const newAvailable = newQuantity - (item.quantityReserved || 0);

        // Update inventory item
        const inventoryUpdates = {
          quantityOnHand: newQuantity,
          quantityAvailable: newAvailable,
          stockStatus: newStockStatus,
          stockValue: newStockValue,
          updatedAt: new Date()
        };

        // Update metrics based on transaction type
        if (transactionType === TRANSACTION_TYPES.ISSUE) {
          inventoryUpdates.totalIssued = (item.totalIssued || 0) + quantity;
          inventoryUpdates.lastIssuedDate = new Date();
        } else if (transactionType === TRANSACTION_TYPES.PURCHASE) {
          inventoryUpdates.totalPurchased = (item.totalPurchased || 0) + quantity;
          inventoryUpdates.lastPurchasedDate = new Date();
        } else if (transactionType === TRANSACTION_TYPES.RETURN) {
          inventoryUpdates.totalReturned = (item.totalReturned || 0) + quantity;
        }

        // If unit cost provided, update it
        if (unitCost !== null) {
          inventoryUpdates.unitCost = unitCost;
        }

        transaction.update(itemRef, inventoryUpdates);

        // Create transaction record
        const transactionRecord = {
          inventoryItemId,
          partNumber: item.partNumber,
          itemName: item.name,
          transactionType,
          quantity,
          unitCost: costToUse,
          totalCost: quantity * costToUse,
          quantityBefore: item.quantityOnHand,
          quantityAfter: newQuantity,
          workOrderId,
          reference,
          notes,
          performedBy: user.uid,
          performedByName: user.displayName || user.email,
          timestamp: new Date(),
          createdAt: new Date()
        };

        const transactionRef = db
          .collection(this.transactionsCollection)
          .doc();

        transaction.set(transactionRef, transactionRecord);

        return {
          transaction: { id: transactionRef.id, ...transactionRecord },
          updatedInventory: {
            id: inventoryItemId,
            ...item,
            ...inventoryUpdates
          }
        };
      });

      logInfo('Inventory transaction recorded', {
        partNumber: result.transaction.partNumber,
        type: transactionType,
        quantity,
        workOrderId
      });

      return result;
    } catch (error) {
      logError('Error recording inventory transaction', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Issue stock to work order
   * @param {string} inventoryItemId - Inventory item ID
   * @param {number} quantity - Quantity to issue
   * @param {string} workOrderId - Work order ID
   * @param {Object} user - User performing transaction
   * @returns {Promise<Object>} Transaction result
   */
  async issueStock(inventoryItemId, quantity, workOrderId, user) {
    return await this.recordTransaction(
      {
        inventoryItemId,
        transactionType: TRANSACTION_TYPES.ISSUE,
        quantity,
        workOrderId,
        reference: `WO-${workOrderId}`,
        notes: `Issued to work order ${workOrderId}`
      },
      user
    );
  }

  /**
   * Return stock from work order
   * @param {string} inventoryItemId - Inventory item ID
   * @param {number} quantity - Quantity to return
   * @param {string} workOrderId - Work order ID
   * @param {Object} user - User performing transaction
   * @returns {Promise<Object>} Transaction result
   */
  async returnStock(inventoryItemId, quantity, workOrderId, user) {
    return await this.recordTransaction(
      {
        inventoryItemId,
        transactionType: TRANSACTION_TYPES.RETURN,
        quantity,
        workOrderId,
        reference: `WO-${workOrderId}`,
        notes: `Returned from work order ${workOrderId}`
      },
      user
    );
  }

  /**
   * Record purchase/receipt
   * @param {string} inventoryItemId - Inventory item ID
   * @param {number} quantity - Quantity received
   * @param {number} unitCost - Unit cost
   * @param {string} reference - Purchase order reference
   * @param {Object} user - User performing transaction
   * @returns {Promise<Object>} Transaction result
   */
  async recordPurchase(inventoryItemId, quantity, unitCost, reference, user) {
    return await this.recordTransaction(
      {
        inventoryItemId,
        transactionType: TRANSACTION_TYPES.PURCHASE,
        quantity,
        unitCost,
        reference,
        notes: `Purchase from supplier: ${reference}`
      },
      user
    );
  }

  /**
   * Adjust stock (manual correction)
   * @param {string} inventoryItemId - Inventory item ID
   * @param {number} newQuantity - New quantity (absolute value)
   * @param {string} reason - Reason for adjustment
   * @param {Object} user - User performing transaction
   * @returns {Promise<Object>} Transaction result
   */
  async adjustStock(inventoryItemId, newQuantity, reason, user) {
    return await this.recordTransaction(
      {
        inventoryItemId,
        transactionType: TRANSACTION_TYPES.ADJUSTMENT,
        quantity: newQuantity,
        reference: 'ADJUSTMENT',
        notes: reason
      },
      user
    );
  }

  /**
   * Get transaction history for inventory item
   * @param {string} inventoryItemId - Inventory item ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Transaction history
   */
  async getTransactionHistory(inventoryItemId, options = {}) {
    try {
      const { limit = 50, startDate, endDate, transactionType } = options;

      let query = db
        .collection(this.transactionsCollection)
        .where('inventoryItemId', '==', inventoryItemId)
        .orderBy('timestamp', 'desc')
        .limit(limit);

      if (transactionType) {
        query = query.where('transactionType', '==', transactionType);
      }

      if (startDate) {
        query = query.where('timestamp', '>=', startDate);
      }

      if (endDate) {
        query = query.where('timestamp', '<=', endDate);
      }

      const snapshot = await query.get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      logError('Error getting transaction history', { error: error.message });
      throw error;
    }
  }

  /**
   * Get transactions by work order
   * @param {string} workOrderId - Work order ID
   * @returns {Promise<Array>} Transactions
   */
  async getTransactionsByWorkOrder(workOrderId) {
    try {
      const snapshot = await db
        .collection(this.transactionsCollection)
        .where('workOrderId', '==', workOrderId)
        .orderBy('timestamp', 'desc')
        .get();

      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      logError('Error getting transactions by work order', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get transaction statistics for period
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Object>} Statistics
   */
  async getTransactionStatistics(startDate, endDate) {
    try {
      const snapshot = await db
        .collection(this.transactionsCollection)
        .where('timestamp', '>=', startDate)
        .where('timestamp', '<=', endDate)
        .get();

      const stats = {
        total: snapshot.size,
        byType: {},
        totalValue: 0
      };

      snapshot.docs.forEach(doc => {
        const data = doc.data();

        // Count by type
        if (!stats.byType[data.transactionType]) {
          stats.byType[data.transactionType] = 0;
        }
        stats.byType[data.transactionType]++;

        // Sum total value
        stats.totalValue += data.totalCost || 0;
      });

      return stats;
    } catch (error) {
      logError('Error getting transaction statistics', {
        error: error.message
      });
      throw error;
    }
  }
}

// Export singleton instance
export const inventoryTransactionService = new InventoryTransactionService();

export default InventoryTransactionService;
