/**
 * Inventory Service
 * Business logic for inventory management
 */

import { BaseService } from '../../../shared/services/BaseService.js';
import { db } from '../../../config/firebase.js';
import {
  INVENTORY_CONFIG,
  TRANSACTION_TYPES,
  calculateStockStatus,
  calculateReorderQuantity,
  calculateStockValue,
  needsReorder
} from '../config.js';
import { ValidationError, NotFoundError } from '../../../shared/errors/AppError.js';
import { logInfo, logError } from '../../../shared/utils/logger.js';

/**
 * Inventory Service
 * Manages inventory items and stock levels
 */
class InventoryService extends BaseService {
  constructor() {
    super(INVENTORY_CONFIG.collection);
  }

  /**
   * Generate custom part number (PART-0000001 format)
   * @returns {Promise<string>} Part number
   */
  async generatePartNumber() {
    try {
      const counterRef = db.collection('counters').doc('inventory');
      const counterDoc = await counterRef.get();

      let nextNumber = 1;
      if (counterDoc.exists) {
        nextNumber = (counterDoc.data().lastNumber || 0) + 1;
      }

      await counterRef.set({ lastNumber: nextNumber });

      return `PART-${String(nextNumber).padStart(7, '0')}`;
    } catch (error) {
      logError('Error generating part number', { error: error.message });
      throw error;
    }
  }

  /**
   * Create new inventory item
   * @param {Object} data - Inventory item data
   * @param {Object} user - User creating the item
   * @returns {Promise<Object>} Created inventory item
   */
  async createInventoryItem(data, user) {
    try {
      // Validate required fields
      const missingFields = INVENTORY_CONFIG.requiredFields.filter(
        field => !data[field] && field !== 'partNumber'
      );

      if (missingFields.length > 0) {
        throw new ValidationError(
          `Missing required fields: ${missingFields.join(', ')}`
        );
      }

      // Validate item type
      if (!INVENTORY_CONFIG.validItemTypes.includes(data.itemType)) {
        throw new ValidationError(`Invalid item type: ${data.itemType}`);
      }

      // Validate unit
      if (!INVENTORY_CONFIG.validUnits.includes(data.unit)) {
        throw new ValidationError(`Invalid unit: ${data.unit}`);
      }

      // Generate part number if not provided
      const partNumber = data.partNumber || await this.generatePartNumber();

      // Check for duplicate part number
      const existing = await this.getByPartNumber(partNumber);
      if (existing) {
        throw new ValidationError(`Part number already exists: ${partNumber}`);
      }

      // Calculate initial stock status
      const quantityOnHand = data.initialQuantity || 0;
      const stockStatus = calculateStockStatus(
        quantityOnHand,
        data.minStockLevel,
        data.maxStockLevel
      );

      // Calculate initial stock value
      const stockValue = calculateStockValue(
        quantityOnHand,
        data.unitCost || 0
      );

      // Prepare inventory data
      const inventoryData = {
        partNumber,
        name: data.name,
        description: data.description || '',
        itemType: data.itemType,
        category: data.category || '',
        unit: data.unit,
        unitCost: data.unitCost || 0,
        quantityOnHand,
        quantityReserved: 0,
        quantityAvailable: quantityOnHand,
        minStockLevel: data.minStockLevel,
        maxStockLevel: data.maxStockLevel,
        reorderPoint: data.reorderPoint || data.minStockLevel,
        reorderQuantity: data.reorderQuantity || null,
        stockStatus,
        stockValue,
        location: data.location || '',
        binLocation: data.binLocation || '',
        supplier: data.supplier || '',
        supplierPartNumber: data.supplierPartNumber || '',
        leadTimeDays: data.leadTimeDays || 0,
        notes: data.notes || '',
        specifications: data.specifications || {},

        // Metrics
        totalIssued: 0,
        totalPurchased: quantityOnHand,
        totalReturned: 0,
        lastIssuedDate: null,
        lastPurchasedDate: quantityOnHand > 0 ? new Date() : null,

        // Metadata
        createdBy: user.uid,
        createdByName: user.displayName || user.email
      };

      const item = await this.create(inventoryData);

      logInfo('Inventory item created', {
        partNumber,
        name: data.name,
        initialQuantity: quantityOnHand
      });

      return item;
    } catch (error) {
      logError('Error creating inventory item', { error: error.message });
      throw error;
    }
  }

  /**
   * Get inventory item by part number
   * @param {string} partNumber - Part number
   * @returns {Promise<Object|null>} Inventory item or null
   */
  async getByPartNumber(partNumber) {
    try {
      const snapshot = await db
        .collection(this.collectionName)
        .where('partNumber', '==', partNumber)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      logError('Error getting inventory by part number', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update stock quantity
   * @param {string} id - Inventory item ID
   * @param {number} newQuantity - New quantity
   * @param {Object} user - User performing update
   * @returns {Promise<Object>} Updated inventory item
   */
  async updateStockQuantity(id, newQuantity, user) {
    try {
      const item = await this.findById(id);

      if (!item) {
        throw new NotFoundError('Inventory item not found');
      }

      if (newQuantity < 0) {
        throw new ValidationError('Quantity cannot be negative');
      }

      // Calculate new stock status
      const stockStatus = calculateStockStatus(
        newQuantity,
        item.minStockLevel,
        item.maxStockLevel
      );

      // Calculate new stock value
      const stockValue = calculateStockValue(newQuantity, item.unitCost);

      // Calculate available quantity (on hand - reserved)
      const quantityAvailable = newQuantity - (item.quantityReserved || 0);

      const updates = {
        quantityOnHand: newQuantity,
        quantityAvailable,
        stockStatus,
        stockValue
      };

      const updatedItem = await this.update(id, updates);

      logInfo('Stock quantity updated', {
        partNumber: item.partNumber,
        oldQuantity: item.quantityOnHand,
        newQuantity
      });

      return updatedItem;
    } catch (error) {
      logError('Error updating stock quantity', { error: error.message });
      throw error;
    }
  }

  /**
   * Reserve stock for work order
   * @param {string} id - Inventory item ID
   * @param {number} quantity - Quantity to reserve
   * @param {string} workOrderId - Work order ID
   * @returns {Promise<Object>} Updated inventory item
   */
  async reserveStock(id, quantity, workOrderId) {
    try {
      const item = await this.findById(id);

      if (!item) {
        throw new NotFoundError('Inventory item not found');
      }

      if (quantity > item.quantityAvailable) {
        throw new ValidationError(
          `Insufficient available stock. Available: ${item.quantityAvailable}, Requested: ${quantity}`
        );
      }

      const newReserved = (item.quantityReserved || 0) + quantity;
      const newAvailable = item.quantityOnHand - newReserved;

      const updates = {
        quantityReserved: newReserved,
        quantityAvailable: newAvailable
      };

      const updatedItem = await this.update(id, updates);

      logInfo('Stock reserved', {
        partNumber: item.partNumber,
        quantity,
        workOrderId
      });

      return updatedItem;
    } catch (error) {
      logError('Error reserving stock', { error: error.message });
      throw error;
    }
  }

  /**
   * Release reserved stock
   * @param {string} id - Inventory item ID
   * @param {number} quantity - Quantity to release
   * @returns {Promise<Object>} Updated inventory item
   */
  async releaseReservedStock(id, quantity) {
    try {
      const item = await this.findById(id);

      if (!item) {
        throw new NotFoundError('Inventory item not found');
      }

      if (quantity > item.quantityReserved) {
        throw new ValidationError(
          `Cannot release more than reserved. Reserved: ${item.quantityReserved}, Requested: ${quantity}`
        );
      }

      const newReserved = item.quantityReserved - quantity;
      const newAvailable = item.quantityOnHand - newReserved;

      const updates = {
        quantityReserved: newReserved,
        quantityAvailable: newAvailable
      };

      return await this.update(id, updates);
    } catch (error) {
      logError('Error releasing reserved stock', { error: error.message });
      throw error;
    }
  }

  /**
   * Get items needing reorder
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Items needing reorder
   */
  async getItemsNeedingReorder(options = {}) {
    try {
      const { itemType, location, limit = 100 } = options;

      let query = db.collection(this.collectionName);

      if (itemType) {
        query = query.where('itemType', '==', itemType);
      }

      if (location) {
        query = query.where('location', '==', location);
      }

      query = query.limit(limit * 2); // Get extra for client-side filtering

      const snapshot = await query.get();
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Filter items that need reorder
      const itemsNeedingReorder = items
        .filter(item =>
          needsReorder(item.quantityOnHand, item.reorderPoint)
        )
        .slice(0, limit);

      return itemsNeedingReorder;
    } catch (error) {
      logError('Error getting items needing reorder', { error: error.message });
      throw error;
    }
  }

  /**
   * Search inventory items
   * @param {Object} filters - Search filters
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Search results
   */
  async searchInventory(filters = {}, options = {}) {
    try {
      const {
        itemType,
        category,
        stockStatus,
        location,
        supplier,
        searchTerm
      } = filters;

      const { limit = 100, offset = 0 } = options;

      let query = db.collection(this.collectionName);

      if (itemType) {
        query = query.where('itemType', '==', itemType);
      }

      if (category) {
        query = query.where('category', '==', category);
      }

      if (stockStatus) {
        query = query.where('stockStatus', '==', stockStatus);
      }

      if (location) {
        query = query.where('location', '==', location);
      }

      if (supplier) {
        query = query.where('supplier', '==', supplier);
      }

      query = query.orderBy('createdAt', 'desc').limit(limit).offset(offset);

      const snapshot = await query.get();
      let items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Client-side search term filtering
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        items = items.filter(item =>
          item.name.toLowerCase().includes(term) ||
          item.partNumber.toLowerCase().includes(term) ||
          item.description?.toLowerCase().includes(term)
        );
      }

      return {
        items,
        total: items.length,
        limit,
        offset
      };
    } catch (error) {
      logError('Error searching inventory', { error: error.message });
      throw error;
    }
  }
}

// Export singleton instance
export const inventoryService = new InventoryService();

export default InventoryService;
