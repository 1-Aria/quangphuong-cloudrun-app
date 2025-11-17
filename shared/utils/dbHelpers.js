/**
 * Database Helper Utilities
 * Provides common database operations and query building utilities
 */

import { db } from '../../config/firebase.js';

/**
 * Build Firestore query with multiple filters
 * @param {Object} collection - Firestore collection reference
 * @param {Object} filters - Key-value pairs for filtering
 * @param {Object} options - Query options (orderBy, limit, etc.)
 * @returns {Object} Firestore query
 */
export function buildQuery(collection, filters = {}, options = {}) {
  let query = collection;

  // Apply filters
  Object.entries(filters).forEach(([field, value]) => {
    if (value !== undefined && value !== null) {
      query = query.where(field, '==', value);
    }
  });

  // Apply ordering
  if (options.orderBy) {
    const direction = options.orderDirection || 'asc';
    query = query.orderBy(options.orderBy, direction);
  }

  // Apply limit
  if (options.limit) {
    query = query.limit(options.limit);
  }

  // Apply offset (startAfter for pagination)
  if (options.startAfter) {
    query = query.startAfter(options.startAfter);
  }

  return query;
}

/**
 * Convert Firestore Timestamp to JavaScript Date
 * @param {Object} timestamp - Firestore Timestamp
 * @returns {Date|null} JavaScript Date object
 */
export function timestampToDate(timestamp) {
  if (!timestamp) return null;
  if (timestamp.toDate) return timestamp.toDate();
  if (timestamp._seconds) {
    return new Date(timestamp._seconds * 1000);
  }
  return new Date(timestamp);
}

/**
 * Convert JavaScript Date to Firestore Timestamp
 * @param {Date|string|number} date - Date to convert
 * @returns {Object} Firestore Timestamp
 */
export function dateToTimestamp(date) {
  if (!date) return null;
  const jsDate = date instanceof Date ? date : new Date(date);
  return db.Timestamp.fromDate(jsDate);
}

/**
 * Batch write operation
 * @param {Array<Object>} operations - Array of {type, ref, data}
 * @returns {Promise<void>}
 */
export async function batchWrite(operations) {
  const batch = db.batch();

  operations.forEach(({ type, ref, data }) => {
    switch (type) {
      case 'set':
        batch.set(ref, data);
        break;
      case 'update':
        batch.update(ref, data);
        break;
      case 'delete':
        batch.delete(ref);
        break;
      default:
        throw new Error(`Unknown batch operation type: ${type}`);
    }
  });

  await batch.commit();
}

/**
 * Execute a transaction
 * @param {Function} callback - Transaction callback
 * @returns {Promise<any>} Transaction result
 */
export async function runTransaction(callback) {
  return await db.runTransaction(callback);
}

/**
 * Get documents by IDs in batch
 * @param {string} collectionName - Collection name
 * @param {Array<string>} ids - Array of document IDs
 * @returns {Promise<Array>} Array of documents
 */
export async function getDocumentsByIds(collectionName, ids) {
  if (!ids || ids.length === 0) return [];

  const collection = db.collection(collectionName);
  const chunks = chunkArray(ids, 10); // Firestore 'in' limit is 10

  const allDocs = [];

  for (const chunk of chunks) {
    const snapshot = await collection.where('__name__', 'in', chunk).get();
    const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    allDocs.push(...docs);
  }

  return allDocs;
}

/**
 * Check if document exists
 * @param {string} collectionName - Collection name
 * @param {string} id - Document ID
 * @returns {Promise<boolean>} True if exists
 */
export async function documentExists(collectionName, id) {
  const doc = await db.collection(collectionName).doc(id).get();
  return doc.exists;
}

/**
 * Count documents matching query
 * @param {string} collectionName - Collection name
 * @param {Object} filters - Filters to apply
 * @returns {Promise<number>} Document count
 */
export async function countDocuments(collectionName, filters = {}) {
  const collection = db.collection(collectionName);
  const query = buildQuery(collection, filters);
  const snapshot = await query.get();
  return snapshot.size;
}

/**
 * Delete documents matching query
 * @param {string} collectionName - Collection name
 * @param {Object} filters - Filters to apply
 * @param {number} batchSize - Batch size for deletion
 * @returns {Promise<number>} Number of deleted documents
 */
export async function deleteDocuments(collectionName, filters = {}, batchSize = 500) {
  const collection = db.collection(collectionName);
  const query = buildQuery(collection, filters, { limit: batchSize });

  return new Promise((resolve, reject) => {
    deleteQueryBatch(db, query, batchSize, resolve, reject);
  });
}

/**
 * Helper function for batch deletion
 * @private
 */
function deleteQueryBatch(db, query, batchSize, resolve, reject) {
  query
    .get()
    .then((snapshot) => {
      if (snapshot.size === 0) {
        return 0;
      }

      const batch = db.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      return batch.commit().then(() => {
        return snapshot.size;
      });
    })
    .then((numDeleted) => {
      if (numDeleted === 0) {
        resolve();
        return;
      }

      process.nextTick(() => {
        deleteQueryBatch(db, query, batchSize, resolve, reject);
      });
    })
    .catch(reject);
}

/**
 * Chunk array into smaller arrays
 * @param {Array} array - Array to chunk
 * @param {number} size - Chunk size
 * @returns {Array<Array>} Chunked arrays
 */
function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Sanitize data for Firestore (remove undefined values)
 * @param {Object} data - Data to sanitize
 * @returns {Object} Sanitized data
 */
export function sanitizeData(data) {
  const sanitized = {};

  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined) {
      sanitized[key] = value;
    }
  });

  return sanitized;
}

export default {
  buildQuery,
  timestampToDate,
  dateToTimestamp,
  batchWrite,
  runTransaction,
  getDocumentsByIds,
  documentExists,
  countDocuments,
  deleteDocuments,
  sanitizeData
};
