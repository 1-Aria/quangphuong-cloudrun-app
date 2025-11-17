/**
 * ID Generator Utility
 * Generates custom formatted IDs for various entities
 */

import { db } from '../../config/firebase.js';
import { COLLECTIONS } from '../../config/constants.js';

/**
 * ID Prefixes for different entity types
 */
export const ID_PREFIXES = {
  WORK_ORDER: 'WO',
  EQUIPMENT: 'EQ',
  PART: 'PT',
  INVENTORY_TRANSACTION: 'INV',
  CHECKLIST: 'CK',
  USER: 'USR',
  ACTIVITY_LOG: 'AL'
};

/**
 * ID Formats
 */
export const ID_FORMATS = {
  WORK_ORDER: 'WO-0000000',      // WO-0000123
  EQUIPMENT: 'EQ-000000',         // EQ-000456
  PART: 'PT-000000',              // PT-001234
  INVENTORY_TRANSACTION: 'INV-0000000', // INV-0000789
  CHECKLIST: 'CK-00000',          // CK-00123
  USER: 'USR-000000',             // USR-000001
  ACTIVITY_LOG: 'AL-00000000'     // AL-00000001
};

/**
 * Get the next sequence number from Firestore counter
 * @param {string} entityType - Type of entity (e.g., 'work_orders', 'equipment')
 * @returns {Promise<number>} Next sequence number
 */
async function getNextSequence(entityType) {
  const counterRef = db.collection(COLLECTIONS.COUNTERS || 'counters').doc(entityType);

  try {
    // Use Firestore transaction to ensure atomicity
    const nextNumber = await db.runTransaction(async (transaction) => {
      const counterDoc = await transaction.get(counterRef);

      let currentValue = 0;
      if (counterDoc.exists) {
        currentValue = counterDoc.data().value || 0;
      }

      const nextValue = currentValue + 1;

      // Update or create the counter document
      if (counterDoc.exists) {
        transaction.update(counterRef, {
          value: nextValue,
          lastUpdated: new Date()
        });
      } else {
        transaction.set(counterRef, {
          value: nextValue,
          createdAt: new Date(),
          lastUpdated: new Date()
        });
      }

      return nextValue;
    });

    return nextNumber;
  } catch (error) {
    console.error(`Error getting next sequence for ${entityType}:`, error);
    throw new Error(`Failed to generate ID for ${entityType}`);
  }
}

/**
 * Pad number with leading zeros
 * @param {number} num - Number to pad
 * @param {number} length - Total length of padded string
 * @returns {string} Padded number
 */
function padNumber(num, length) {
  return num.toString().padStart(length, '0');
}

/**
 * Generate Work Order ID
 * Format: WO-0000123
 * @returns {Promise<string>} Generated Work Order ID
 */
export async function generateWorkOrderId() {
  const sequence = await getNextSequence('work_orders');
  return `${ID_PREFIXES.WORK_ORDER}-${padNumber(sequence, 7)}`;
}

/**
 * Generate Equipment ID
 * Format: EQ-000456
 * @returns {Promise<string>} Generated Equipment ID
 */
export async function generateEquipmentId() {
  const sequence = await getNextSequence('equipment');
  return `${ID_PREFIXES.EQUIPMENT}-${padNumber(sequence, 6)}`;
}

/**
 * Generate Part ID
 * Format: PT-001234
 * @returns {Promise<string>} Generated Part ID
 */
export async function generatePartId() {
  const sequence = await getNextSequence('parts');
  return `${ID_PREFIXES.PART}-${padNumber(sequence, 6)}`;
}

/**
 * Generate Inventory Transaction ID
 * Format: INV-0000789
 * @returns {Promise<string>} Generated Transaction ID
 */
export async function generateInventoryTransactionId() {
  const sequence = await getNextSequence('inventory_transactions');
  return `${ID_PREFIXES.INVENTORY_TRANSACTION}-${padNumber(sequence, 7)}`;
}

/**
 * Generate Checklist ID
 * Format: CK-00123
 * @returns {Promise<string>} Generated Checklist ID
 */
export async function generateChecklistId() {
  const sequence = await getNextSequence('checklists');
  return `${ID_PREFIXES.CHECKLIST}-${padNumber(sequence, 5)}`;
}

/**
 * Generate User ID
 * Format: USR-000001
 * @returns {Promise<string>} Generated User ID
 */
export async function generateUserId() {
  const sequence = await getNextSequence('users');
  return `${ID_PREFIXES.USER}-${padNumber(sequence, 6)}`;
}

/**
 * Generate Activity Log ID
 * Format: AL-00000001
 * @returns {Promise<string>} Generated Activity Log ID
 */
export async function generateActivityLogId() {
  const sequence = await getNextSequence('activity_logs');
  return `${ID_PREFIXES.ACTIVITY_LOG}-${padNumber(sequence, 8)}`;
}

/**
 * Generate custom ID with prefix and padding
 * @param {string} prefix - ID prefix
 * @param {string} entityType - Entity type for counter
 * @param {number} padding - Number of digits for padding
 * @returns {Promise<string>} Generated ID
 */
export async function generateCustomId(prefix, entityType, padding = 6) {
  const sequence = await getNextSequence(entityType);
  return `${prefix}-${padNumber(sequence, padding)}`;
}

/**
 * Reset counter for an entity type (use with caution!)
 * @param {string} entityType - Type of entity
 * @param {number} startValue - Starting value (default: 0)
 * @returns {Promise<void>}
 */
export async function resetCounter(entityType, startValue = 0) {
  const counterRef = db.collection(COLLECTIONS.COUNTERS || 'counters').doc(entityType);

  await counterRef.set({
    value: startValue,
    lastReset: new Date(),
    lastUpdated: new Date()
  });
}

/**
 * Get current counter value without incrementing
 * @param {string} entityType - Type of entity
 * @returns {Promise<number>} Current counter value
 */
export async function getCurrentCounter(entityType) {
  const counterRef = db.collection(COLLECTIONS.COUNTERS || 'counters').doc(entityType);
  const doc = await counterRef.get();

  if (!doc.exists) {
    return 0;
  }

  return doc.data().value || 0;
}

/**
 * Validate ID format
 * @param {string} id - ID to validate
 * @param {string} prefix - Expected prefix
 * @returns {boolean} True if valid format
 */
export function validateIdFormat(id, prefix) {
  if (!id || typeof id !== 'string') return false;

  const regex = new RegExp(`^${prefix}-\\d+$`);
  return regex.test(id);
}

/**
 * Extract sequence number from ID
 * @param {string} id - Full ID (e.g., 'WO-0000123')
 * @returns {number|null} Sequence number or null if invalid
 */
export function extractSequenceFromId(id) {
  if (!id || typeof id !== 'string') return null;

  const parts = id.split('-');
  if (parts.length !== 2) return null;

  const sequence = parseInt(parts[1], 10);
  return isNaN(sequence) ? null : sequence;
}

export default {
  ID_PREFIXES,
  ID_FORMATS,
  generateWorkOrderId,
  generateEquipmentId,
  generatePartId,
  generateInventoryTransactionId,
  generateChecklistId,
  generateUserId,
  generateActivityLogId,
  generateCustomId,
  resetCounter,
  getCurrentCounter,
  validateIdFormat,
  extractSequenceFromId
};
