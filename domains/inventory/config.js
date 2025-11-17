/**
 * Inventory Management Configuration
 * Defines inventory item types, transaction types, and business rules
 */

/**
 * Inventory Item Types
 */
export const INVENTORY_ITEM_TYPES = {
  SPARE_PART: 'Spare Part',
  CONSUMABLE: 'Consumable',
  TOOL: 'Tool',
  MATERIAL: 'Material',
  SAFETY_EQUIPMENT: 'Safety Equipment',
  CHEMICAL: 'Chemical',
  OTHER: 'Other'
};

/**
 * Inventory Transaction Types
 */
export const TRANSACTION_TYPES = {
  PURCHASE: 'Purchase',           // Stock in from supplier
  ISSUE: 'Issue',                 // Stock out to work order
  RETURN: 'Return',               // Return from work order
  ADJUSTMENT: 'Adjustment',       // Manual adjustment (audit, correction)
  TRANSFER: 'Transfer',           // Transfer between locations
  DISPOSAL: 'Disposal',           // Disposal/write-off
  DAMAGE: 'Damage',               // Damaged/lost
  INITIAL: 'Initial Stock'        // Initial stock entry
};

/**
 * Stock Status
 */
export const STOCK_STATUS = {
  IN_STOCK: 'In Stock',
  LOW_STOCK: 'Low Stock',
  OUT_OF_STOCK: 'Out of Stock',
  DISCONTINUED: 'Discontinued'
};

/**
 * Unit of Measurement
 */
export const UNIT_OF_MEASUREMENT = {
  PIECE: 'Piece',
  BOX: 'Box',
  LITER: 'Liter',
  KILOGRAM: 'Kilogram',
  METER: 'Meter',
  SQUARE_METER: 'Square Meter',
  CUBIC_METER: 'Cubic Meter',
  SET: 'Set',
  ROLL: 'Roll',
  PACK: 'Pack'
};

/**
 * Inventory Configuration
 */
export const INVENTORY_CONFIG = {
  collection: 'inventory',
  transactionsCollection: 'inventory_transactions',

  // Valid item types
  validItemTypes: Object.values(INVENTORY_ITEM_TYPES),

  // Valid transaction types
  validTransactionTypes: Object.values(TRANSACTION_TYPES),

  // Valid units
  validUnits: Object.values(UNIT_OF_MEASUREMENT),

  // Required fields for inventory item creation
  requiredFields: [
    'partNumber',
    'name',
    'itemType',
    'unit',
    'minStockLevel',
    'maxStockLevel'
  ],

  // Fields that can be updated
  updatableFields: [
    'name',
    'description',
    'itemType',
    'category',
    'unit',
    'unitCost',
    'minStockLevel',
    'maxStockLevel',
    'reorderPoint',
    'reorderQuantity',
    'location',
    'binLocation',
    'supplier',
    'supplierPartNumber',
    'leadTimeDays',
    'notes',
    'specifications'
  ],

  // Stock level thresholds
  thresholds: {
    lowStockMultiplier: 1.2,  // Low stock = minStockLevel * 1.2
    criticalMultiplier: 1.0   // Critical = at or below minStockLevel
  }
};

/**
 * Calculate stock status
 * @param {number} currentQuantity - Current quantity on hand
 * @param {number} minStockLevel - Minimum stock level
 * @param {number} maxStockLevel - Maximum stock level
 * @returns {string} Stock status
 */
export function calculateStockStatus(currentQuantity, minStockLevel, maxStockLevel) {
  if (currentQuantity <= 0) {
    return STOCK_STATUS.OUT_OF_STOCK;
  }

  if (currentQuantity <= minStockLevel * INVENTORY_CONFIG.thresholds.lowStockMultiplier) {
    return STOCK_STATUS.LOW_STOCK;
  }

  return STOCK_STATUS.IN_STOCK;
}

/**
 * Calculate reorder quantity
 * @param {number} currentQuantity - Current quantity
 * @param {number} minStockLevel - Minimum stock level
 * @param {number} maxStockLevel - Maximum stock level
 * @param {number} reorderPoint - Reorder point (optional)
 * @returns {number|null} Recommended reorder quantity or null if not needed
 */
export function calculateReorderQuantity(
  currentQuantity,
  minStockLevel,
  maxStockLevel,
  reorderPoint = null
) {
  const threshold = reorderPoint || minStockLevel;

  if (currentQuantity > threshold) {
    return null; // No reorder needed
  }

  // Reorder to max stock level
  return maxStockLevel - currentQuantity;
}

/**
 * Calculate stock value
 * @param {number} quantity - Quantity
 * @param {number} unitCost - Unit cost
 * @returns {number} Total value
 */
export function calculateStockValue(quantity, unitCost) {
  return quantity * unitCost;
}

/**
 * Validate transaction quantity
 * @param {string} transactionType - Transaction type
 * @param {number} currentQuantity - Current quantity
 * @param {number} transactionQuantity - Transaction quantity
 * @returns {boolean} True if valid
 * @throws {Error} If invalid
 */
export function validateTransactionQuantity(
  transactionType,
  currentQuantity,
  transactionQuantity
) {
  if (transactionQuantity <= 0) {
    throw new Error('Transaction quantity must be greater than 0');
  }

  // For stock-out transactions, check if we have enough stock
  const stockOutTypes = [
    TRANSACTION_TYPES.ISSUE,
    TRANSACTION_TYPES.TRANSFER,
    TRANSACTION_TYPES.DISPOSAL,
    TRANSACTION_TYPES.DAMAGE
  ];

  if (stockOutTypes.includes(transactionType)) {
    if (transactionQuantity > currentQuantity) {
      throw new Error(
        `Insufficient stock. Current: ${currentQuantity}, Requested: ${transactionQuantity}`
      );
    }
  }

  return true;
}

/**
 * Calculate new quantity after transaction
 * @param {string} transactionType - Transaction type
 * @param {number} currentQuantity - Current quantity
 * @param {number} transactionQuantity - Transaction quantity
 * @returns {number} New quantity
 */
export function calculateNewQuantity(transactionType, currentQuantity, transactionQuantity) {
  // Stock-in transactions
  const stockInTypes = [
    TRANSACTION_TYPES.PURCHASE,
    TRANSACTION_TYPES.RETURN,
    TRANSACTION_TYPES.INITIAL
  ];

  // Stock-out transactions
  const stockOutTypes = [
    TRANSACTION_TYPES.ISSUE,
    TRANSACTION_TYPES.TRANSFER,
    TRANSACTION_TYPES.DISPOSAL,
    TRANSACTION_TYPES.DAMAGE
  ];

  if (stockInTypes.includes(transactionType)) {
    return currentQuantity + transactionQuantity;
  }

  if (stockOutTypes.includes(transactionType)) {
    return currentQuantity - transactionQuantity;
  }

  // For ADJUSTMENT, use the transaction quantity directly
  if (transactionType === TRANSACTION_TYPES.ADJUSTMENT) {
    return transactionQuantity;
  }

  return currentQuantity;
}

/**
 * Determine if item needs reorder
 * @param {number} currentQuantity - Current quantity
 * @param {number} reorderPoint - Reorder point
 * @returns {boolean} True if reorder is needed
 */
export function needsReorder(currentQuantity, reorderPoint) {
  return currentQuantity <= reorderPoint;
}

/**
 * Calculate turnover rate
 * @param {number} totalIssued - Total quantity issued in period
 * @param {number} averageStock - Average stock level in period
 * @returns {number} Turnover rate
 */
export function calculateTurnoverRate(totalIssued, averageStock) {
  if (averageStock === 0) {
    return 0;
  }

  return totalIssued / averageStock;
}

/**
 * Calculate days of stock
 * @param {number} currentQuantity - Current quantity
 * @param {number} averageDailyUsage - Average daily usage
 * @returns {number} Days of stock remaining
 */
export function calculateDaysOfStock(currentQuantity, averageDailyUsage) {
  if (averageDailyUsage === 0) {
    return Infinity; // No usage, stock lasts forever
  }

  return currentQuantity / averageDailyUsage;
}

export default {
  INVENTORY_ITEM_TYPES,
  TRANSACTION_TYPES,
  STOCK_STATUS,
  UNIT_OF_MEASUREMENT,
  INVENTORY_CONFIG,
  calculateStockStatus,
  calculateReorderQuantity,
  calculateStockValue,
  validateTransactionQuantity,
  calculateNewQuantity,
  needsReorder,
  calculateTurnoverRate,
  calculateDaysOfStock
};
