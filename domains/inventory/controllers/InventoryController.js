/**
 * Inventory Controller
 * HTTP request handlers for inventory management
 */

import { inventoryService } from '../services/InventoryService.js';
import { inventoryTransactionService } from '../services/InventoryTransactionService.js';
import { PERMISSIONS } from '../../../config/roles.js';
import { hasPermission } from '../../../shared/utils/permissions.js';
import { ValidationError, ForbiddenError } from '../../../shared/errors/AppError.js';
import { successResponse } from '../../../shared/utils/responseFormatter.js';

/**
 * Create new inventory item
 * POST /inventory
 */
export async function createInventoryItem(req, res, next) {
  try {
    if (!hasPermission(req.user, PERMISSIONS.INVENTORY_CREATE)) {
      throw new ForbiddenError(
        'You do not have permission to create inventory items'
      );
    }

    const item = await inventoryService.createInventoryItem(req.body, req.user);

    res
      .status(201)
      .json(successResponse(item, 'Inventory item created successfully'));
  } catch (error) {
    next(error);
  }
}

/**
 * Get inventory items with filters
 * GET /inventory
 */
export async function getInventoryItems(req, res, next) {
  try {
    if (!hasPermission(req.user, PERMISSIONS.INVENTORY_VIEW)) {
      throw new ForbiddenError(
        'You do not have permission to view inventory'
      );
    }

    const filters = {
      itemType: req.query.itemType,
      category: req.query.category,
      stockStatus: req.query.stockStatus,
      location: req.query.location,
      supplier: req.query.supplier,
      searchTerm: req.query.search
    };

    const options = {
      limit: parseInt(req.query.limit) || 100,
      offset: parseInt(req.query.offset) || 0
    };

    const result = await inventoryService.searchInventory(filters, options);

    res.json(
      successResponse(result.items, 'Inventory items retrieved successfully', {
        total: result.total,
        limit: result.limit,
        offset: result.offset
      })
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Get inventory item by ID
 * GET /inventory/:id
 */
export async function getInventoryItemById(req, res, next) {
  try {
    if (!hasPermission(req.user, PERMISSIONS.INVENTORY_VIEW)) {
      throw new ForbiddenError(
        'You do not have permission to view inventory'
      );
    }

    const item = await inventoryService.findById(req.params.id);

    if (!item) {
      throw new ValidationError('Inventory item not found');
    }

    res.json(successResponse(item, 'Inventory item retrieved successfully'));
  } catch (error) {
    next(error);
  }
}

/**
 * Get inventory item by part number
 * GET /inventory/by-part-number/:partNumber
 */
export async function getInventoryByPartNumber(req, res, next) {
  try {
    if (!hasPermission(req.user, PERMISSIONS.INVENTORY_VIEW)) {
      throw new ForbiddenError(
        'You do not have permission to view inventory'
      );
    }

    const item = await inventoryService.getByPartNumber(req.params.partNumber);

    if (!item) {
      throw new ValidationError('Inventory item not found');
    }

    res.json(successResponse(item, 'Inventory item retrieved successfully'));
  } catch (error) {
    next(error);
  }
}

/**
 * Update inventory item
 * PUT /inventory/:id
 */
export async function updateInventoryItem(req, res, next) {
  try {
    if (!hasPermission(req.user, PERMISSIONS.INVENTORY_EDIT)) {
      throw new ForbiddenError(
        'You do not have permission to edit inventory items'
      );
    }

    const item = await inventoryService.update(req.params.id, req.body);

    res.json(successResponse(item, 'Inventory item updated successfully'));
  } catch (error) {
    next(error);
  }
}

/**
 * Delete inventory item
 * DELETE /inventory/:id
 */
export async function deleteInventoryItem(req, res, next) {
  try {
    if (!hasPermission(req.user, PERMISSIONS.INVENTORY_DELETE)) {
      throw new ForbiddenError(
        'You do not have permission to delete inventory items'
      );
    }

    await inventoryService.delete(req.params.id);

    res.json(successResponse(null, 'Inventory item deleted successfully'));
  } catch (error) {
    next(error);
  }
}

/**
 * Get items needing reorder
 * GET /inventory/reorder-needed
 */
export async function getItemsNeedingReorder(req, res, next) {
  try {
    if (!hasPermission(req.user, PERMISSIONS.INVENTORY_VIEW)) {
      throw new ForbiddenError(
        'You do not have permission to view inventory'
      );
    }

    const options = {
      itemType: req.query.itemType,
      location: req.query.location,
      limit: parseInt(req.query.limit) || 100
    };

    const items = await inventoryService.getItemsNeedingReorder(options);

    res.json(
      successResponse(items, 'Items needing reorder retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Reserve stock for work order
 * POST /inventory/:id/reserve
 */
export async function reserveStock(req, res, next) {
  try {
    if (!hasPermission(req.user, PERMISSIONS.INVENTORY_EDIT)) {
      throw new ForbiddenError(
        'You do not have permission to reserve stock'
      );
    }

    const { quantity, workOrderId } = req.body;

    if (!quantity || !workOrderId) {
      throw new ValidationError('Quantity and workOrderId are required');
    }

    const item = await inventoryService.reserveStock(
      req.params.id,
      quantity,
      workOrderId
    );

    res.json(successResponse(item, 'Stock reserved successfully'));
  } catch (error) {
    next(error);
  }
}

/**
 * Release reserved stock
 * POST /inventory/:id/release
 */
export async function releaseReservedStock(req, res, next) {
  try {
    if (!hasPermission(req.user, PERMISSIONS.INVENTORY_EDIT)) {
      throw new ForbiddenError(
        'You do not have permission to release reserved stock'
      );
    }

    const { quantity } = req.body;

    if (!quantity) {
      throw new ValidationError('Quantity is required');
    }

    const item = await inventoryService.releaseReservedStock(
      req.params.id,
      quantity
    );

    res.json(successResponse(item, 'Reserved stock released successfully'));
  } catch (error) {
    next(error);
  }
}

// ==================== Transaction Endpoints ====================

/**
 * Record inventory transaction
 * POST /inventory/:id/transactions
 */
export async function recordTransaction(req, res, next) {
  try {
    if (!hasPermission(req.user, PERMISSIONS.INVENTORY_EDIT)) {
      throw new ForbiddenError(
        'You do not have permission to record inventory transactions'
      );
    }

    const transactionData = {
      inventoryItemId: req.params.id,
      ...req.body
    };

    const result = await inventoryTransactionService.recordTransaction(
      transactionData,
      req.user
    );

    res.status(201).json(
      successResponse(result, 'Transaction recorded successfully')
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Issue stock to work order
 * POST /inventory/:id/issue
 */
export async function issueStock(req, res, next) {
  try {
    if (!hasPermission(req.user, PERMISSIONS.INVENTORY_EDIT)) {
      throw new ForbiddenError('You do not have permission to issue stock');
    }

    const { quantity, workOrderId } = req.body;

    if (!quantity || !workOrderId) {
      throw new ValidationError('Quantity and workOrderId are required');
    }

    const result = await inventoryTransactionService.issueStock(
      req.params.id,
      quantity,
      workOrderId,
      req.user
    );

    res.json(successResponse(result, 'Stock issued successfully'));
  } catch (error) {
    next(error);
  }
}

/**
 * Return stock from work order
 * POST /inventory/:id/return
 */
export async function returnStock(req, res, next) {
  try {
    if (!hasPermission(req.user, PERMISSIONS.INVENTORY_EDIT)) {
      throw new ForbiddenError('You do not have permission to return stock');
    }

    const { quantity, workOrderId } = req.body;

    if (!quantity || !workOrderId) {
      throw new ValidationError('Quantity and workOrderId are required');
    }

    const result = await inventoryTransactionService.returnStock(
      req.params.id,
      quantity,
      workOrderId,
      req.user
    );

    res.json(successResponse(result, 'Stock returned successfully'));
  } catch (error) {
    next(error);
  }
}

/**
 * Record purchase/receipt
 * POST /inventory/:id/purchase
 */
export async function recordPurchase(req, res, next) {
  try {
    if (!hasPermission(req.user, PERMISSIONS.INVENTORY_EDIT)) {
      throw new ForbiddenError(
        'You do not have permission to record purchases'
      );
    }

    const { quantity, unitCost, reference } = req.body;

    if (!quantity || !unitCost) {
      throw new ValidationError('Quantity and unitCost are required');
    }

    const result = await inventoryTransactionService.recordPurchase(
      req.params.id,
      quantity,
      unitCost,
      reference,
      req.user
    );

    res.json(successResponse(result, 'Purchase recorded successfully'));
  } catch (error) {
    next(error);
  }
}

/**
 * Adjust stock
 * POST /inventory/:id/adjust
 */
export async function adjustStock(req, res, next) {
  try {
    if (!hasPermission(req.user, PERMISSIONS.INVENTORY_EDIT)) {
      throw new ForbiddenError('You do not have permission to adjust stock');
    }

    const { newQuantity, reason } = req.body;

    if (newQuantity === undefined || !reason) {
      throw new ValidationError('newQuantity and reason are required');
    }

    const result = await inventoryTransactionService.adjustStock(
      req.params.id,
      newQuantity,
      reason,
      req.user
    );

    res.json(successResponse(result, 'Stock adjusted successfully'));
  } catch (error) {
    next(error);
  }
}

/**
 * Get transaction history for item
 * GET /inventory/:id/transactions
 */
export async function getTransactionHistory(req, res, next) {
  try {
    if (!hasPermission(req.user, PERMISSIONS.INVENTORY_VIEW)) {
      throw new ForbiddenError(
        'You do not have permission to view transaction history'
      );
    }

    const options = {
      limit: parseInt(req.query.limit) || 50,
      startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate) : undefined,
      transactionType: req.query.transactionType
    };

    const history = await inventoryTransactionService.getTransactionHistory(
      req.params.id,
      options
    );

    res.json(
      successResponse(history, 'Transaction history retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Get transactions by work order
 * GET /inventory/transactions/by-work-order/:workOrderId
 */
export async function getTransactionsByWorkOrder(req, res, next) {
  try {
    if (!hasPermission(req.user, PERMISSIONS.INVENTORY_VIEW)) {
      throw new ForbiddenError(
        'You do not have permission to view transactions'
      );
    }

    const transactions = await inventoryTransactionService.getTransactionsByWorkOrder(
      req.params.workOrderId
    );

    res.json(
      successResponse(transactions, 'Transactions retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
}

export default {
  createInventoryItem,
  getInventoryItems,
  getInventoryItemById,
  getInventoryByPartNumber,
  updateInventoryItem,
  deleteInventoryItem,
  getItemsNeedingReorder,
  reserveStock,
  releaseReservedStock,
  recordTransaction,
  issueStock,
  returnStock,
  recordPurchase,
  adjustStock,
  getTransactionHistory,
  getTransactionsByWorkOrder
};
