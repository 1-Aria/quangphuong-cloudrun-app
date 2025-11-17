/**
 * Inventory Domain Routes
 * Defines HTTP endpoints for inventory management
 */

import express from 'express';
import {
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
} from './controllers/InventoryController.js';

const router = express.Router();

/**
 * Inventory Item CRUD Operations
 */

// POST /inventory - Create new inventory item
router.post('/', createInventoryItem);

// GET /inventory - List inventory items with filters
router.get('/', getInventoryItems);

// GET /inventory/reorder-needed - Get items needing reorder
router.get('/reorder-needed', getItemsNeedingReorder);

// GET /inventory/by-part-number/:partNumber - Get by part number
router.get('/by-part-number/:partNumber', getInventoryByPartNumber);

// GET /inventory/transactions/by-work-order/:workOrderId - Get transactions by work order
router.get('/transactions/by-work-order/:workOrderId', getTransactionsByWorkOrder);

// GET /inventory/:id - Get specific inventory item
router.get('/:id', getInventoryItemById);

// PUT /inventory/:id - Update inventory item
router.put('/:id', updateInventoryItem);

// DELETE /inventory/:id - Delete inventory item
router.delete('/:id', deleteInventoryItem);

/**
 * Stock Operations
 */

// POST /inventory/:id/reserve - Reserve stock for work order
router.post('/:id/reserve', reserveStock);

// POST /inventory/:id/release - Release reserved stock
router.post('/:id/release', releaseReservedStock);

/**
 * Inventory Transactions
 */

// POST /inventory/:id/transactions - Record generic transaction
router.post('/:id/transactions', recordTransaction);

// GET /inventory/:id/transactions - Get transaction history for item
router.get('/:id/transactions', getTransactionHistory);

// POST /inventory/:id/issue - Issue stock to work order
router.post('/:id/issue', issueStock);

// POST /inventory/:id/return - Return stock from work order
router.post('/:id/return', returnStock);

// POST /inventory/:id/purchase - Record purchase/receipt
router.post('/:id/purchase', recordPurchase);

// POST /inventory/:id/adjust - Adjust stock (manual correction)
router.post('/:id/adjust', adjustStock);

export default router;
