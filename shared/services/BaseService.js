import { db } from '../../config/firebase.js';

/**
 * BaseService - Abstract base class for all domain services
 * Provides common CRUD operations and Firestore abstractions
 *
 * Usage:
 *   class MyService extends BaseService {
 *     constructor() {
 *       super('my_collection');
 *     }
 *   }
 */
export class BaseService {
  constructor(collectionName) {
    if (!collectionName) {
      throw new Error('Collection name is required for BaseService');
    }
    this.collectionName = collectionName;
    this.collection = db.collection(collectionName);
  }

  /**
   * Create a new document in the collection
   * @param {Object} data - Document data
   * @returns {Promise<Object>} Created document with ID
   */
  async create(data) {
    const timestamp = new Date();
    const docData = {
      ...data,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    const docRef = await this.collection.add(docData);

    return {
      id: docRef.id,
      ...docData
    };
  }

  /**
   * Find a document by ID
   * @param {string} id - Document ID
   * @returns {Promise<Object|null>} Document data or null if not found
   */
  async findById(id) {
    if (!id) {
      return null;
    }

    const doc = await this.collection.doc(id).get();

    if (!doc.exists) {
      return null;
    }

    return {
      id: doc.id,
      ...doc.data()
    };
  }

  /**
   * Update a document by ID
   * @param {string} id - Document ID
   * @param {Object} data - Updated fields
   * @returns {Promise<Object>} Updated document reference
   */
  async update(id, data) {
    if (!id) {
      throw new Error('Document ID is required for update');
    }

    const updateData = {
      ...data,
      updatedAt: new Date()
    };

    await this.collection.doc(id).update(updateData);

    return {
      id,
      ...updateData
    };
  }

  /**
   * Delete a document by ID
   * @param {string} id - Document ID
   * @returns {Promise<Object>} Deleted document reference
   */
  async delete(id) {
    if (!id) {
      throw new Error('Document ID is required for delete');
    }

    await this.collection.doc(id).delete();

    return { id };
  }

  /**
   * Query documents with filters
   * @param {Object} filters - Key-value pairs for filtering
   * @param {number} limit - Maximum number of results (default: 100)
   * @param {string} orderBy - Field to order by (optional)
   * @param {string} orderDirection - 'asc' or 'desc' (default: 'asc')
   * @returns {Promise<Array>} Array of matching documents
   */
  async query(filters = {}, limit = 100, orderBy = null, orderDirection = 'asc') {
    let query = this.collection;

    // Apply filters
    for (const [field, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) {
        query = query.where(field, '==', value);
      }
    }

    // Apply ordering
    if (orderBy) {
      query = query.orderBy(orderBy, orderDirection);
    }

    // Apply limit
    query = query.limit(limit);

    const snapshot = await query.get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  /**
   * Get all documents in the collection
   * @param {number} limit - Maximum number of results (default: 100)
   * @returns {Promise<Array>} Array of all documents
   */
  async findAll(limit = 100) {
    const snapshot = await this.collection.limit(limit).get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  /**
   * Count documents matching filters
   * @param {Object} filters - Key-value pairs for filtering
   * @returns {Promise<number>} Count of matching documents
   */
  async count(filters = {}) {
    let query = this.collection;

    // Apply filters
    for (const [field, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) {
        query = query.where(field, '==', value);
      }
    }

    const snapshot = await query.get();
    return snapshot.size;
  }

  /**
   * Check if a document exists
   * @param {string} id - Document ID
   * @returns {Promise<boolean>} True if document exists
   */
  async exists(id) {
    if (!id) {
      return false;
    }

    const doc = await this.collection.doc(id).get();
    return doc.exists;
  }

  /**
   * Batch create multiple documents
   * @param {Array<Object>} dataArray - Array of document data
   * @returns {Promise<Array>} Array of created document references
   */
  async batchCreate(dataArray) {
    const batch = db.batch();
    const timestamp = new Date();
    const refs = [];

    for (const data of dataArray) {
      const docRef = this.collection.doc();
      batch.set(docRef, {
        ...data,
        createdAt: timestamp,
        updatedAt: timestamp
      });
      refs.push({ id: docRef.id, ...data });
    }

    await batch.commit();
    return refs;
  }

  /**
   * Batch update multiple documents
   * @param {Array<{id: string, data: Object}>} updates - Array of {id, data} pairs
   * @returns {Promise<void>}
   */
  async batchUpdate(updates) {
    const batch = db.batch();
    const timestamp = new Date();

    for (const { id, data } of updates) {
      const docRef = this.collection.doc(id);
      batch.update(docRef, {
        ...data,
        updatedAt: timestamp
      });
    }

    await batch.commit();
  }

  /**
   * Execute a transaction
   * @param {Function} callback - Transaction callback function
   * @returns {Promise<any>} Transaction result
   */
  async transaction(callback) {
    return db.runTransaction(async (transaction) => {
      return await callback(transaction, this.collection);
    });
  }
}

export default BaseService;
