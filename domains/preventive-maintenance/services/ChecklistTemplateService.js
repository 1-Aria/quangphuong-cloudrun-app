/**
 * Checklist Template Service
 * Manages reusable checklist templates for PM schedules
 */

import { BaseService } from '../../../shared/services/BaseService.js';
import { db } from '../../../config/firebase.js';
import {
  PM_CONFIG,
  CHECKLIST_ITEM_TYPE,
  validateChecklistItem
} from '../config.js';
import { ValidationError, NotFoundError } from '../../../shared/errors/AppError.js';
import { logInfo, logError } from '../../../shared/utils/logger.js';

/**
 * Checklist Template Service
 * Manages checklist templates that can be reused across PM schedules
 */
class ChecklistTemplateService extends BaseService {
  constructor() {
    super(PM_CONFIG.checklistTemplatesCollection);
  }

  /**
   * Create checklist template
   * @param {Object} data - Template data
   * @param {Object} user - User creating template
   * @returns {Promise<Object>} Created template
   */
  async createTemplate(data, user) {
    try {
      // Validate required fields
      if (!data.name || !data.name.trim()) {
        throw new ValidationError('Template name is required');
      }

      if (!data.category || !data.category.trim()) {
        throw new ValidationError('Template category is required');
      }

      if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
        throw new ValidationError('Template must have at least one checklist item');
      }

      // Validate all checklist items
      data.items.forEach((item, index) => {
        try {
          validateChecklistItem(item);
        } catch (error) {
          throw new ValidationError(
            `Item ${index + 1} validation failed: ${error.message}`
          );
        }
      });

      // Check for duplicate template name
      const existing = await this.getByName(data.name);
      if (existing) {
        throw new ValidationError(`Template name already exists: ${data.name}`);
      }

      // Prepare template data
      const templateData = {
        name: data.name.trim(),
        description: data.description || '',
        category: data.category.trim(),
        applicableEquipmentTypes: data.applicableEquipmentTypes || [],
        items: data.items.map((item, index) => ({
          order: index + 1,
          description: item.description.trim(),
          type: item.type || CHECKLIST_ITEM_TYPE.INSPECTION,
          requiresMeasurement: item.requiresMeasurement || false,
          measurementUnit: item.measurementUnit || null,
          expectedRange: item.expectedRange || null,
          instructions: item.instructions || '',
          safetyNotes: item.safetyNotes || '',
          isRequired: item.isRequired !== false, // Default to true
          failureCritical: item.failureCritical || false
        })),
        estimatedDurationMinutes: data.estimatedDurationMinutes || 0,
        isActive: data.isActive !== false, // Default to true
        version: 1,
        usageCount: 0,
        createdBy: user.uid,
        createdByName: user.displayName || user.email
      };

      const template = await this.create(templateData);

      logInfo('Checklist template created', {
        templateId: template.id,
        name: template.name,
        itemCount: template.items.length
      });

      return template;
    } catch (error) {
      logError('Error creating checklist template', { error: error.message });
      throw error;
    }
  }

  /**
   * Get template by name
   * @param {string} name - Template name
   * @returns {Promise<Object|null>} Template or null
   */
  async getByName(name) {
    try {
      const snapshot = await db
        .collection(this.collectionName)
        .where('name', '==', name)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      logError('Error getting template by name', { error: error.message });
      throw error;
    }
  }

  /**
   * Get templates by category
   * @param {string} category - Category name
   * @returns {Promise<Array>} Templates
   */
  async getByCategory(category) {
    try {
      const snapshot = await db
        .collection(this.collectionName)
        .where('category', '==', category)
        .where('isActive', '==', true)
        .orderBy('name')
        .get();

      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      logError('Error getting templates by category', { error: error.message });
      throw error;
    }
  }

  /**
   * Get templates applicable to equipment type
   * @param {string} equipmentType - Equipment type
   * @returns {Promise<Array>} Applicable templates
   */
  async getApplicableTemplates(equipmentType) {
    try {
      const snapshot = await db
        .collection(this.collectionName)
        .where('applicableEquipmentTypes', 'array-contains', equipmentType)
        .where('isActive', '==', true)
        .orderBy('name')
        .get();

      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      logError('Error getting applicable templates', { error: error.message });
      throw error;
    }
  }

  /**
   * Update template
   * @param {string} id - Template ID
   * @param {Object} updates - Updates
   * @returns {Promise<Object>} Updated template
   */
  async updateTemplate(id, updates) {
    try {
      const template = await this.findById(id);

      if (!template) {
        throw new NotFoundError('Template not found');
      }

      // Validate items if provided
      if (updates.items) {
        if (!Array.isArray(updates.items) || updates.items.length === 0) {
          throw new ValidationError('Template must have at least one checklist item');
        }

        updates.items.forEach((item, index) => {
          try {
            validateChecklistItem(item);
          } catch (error) {
            throw new ValidationError(
              `Item ${index + 1} validation failed: ${error.message}`
            );
          }
        });

        // Re-order items
        updates.items = updates.items.map((item, index) => ({
          ...item,
          order: index + 1
        }));

        // Increment version
        updates.version = (template.version || 1) + 1;
      }

      // Check for name conflicts if name is being updated
      if (updates.name && updates.name !== template.name) {
        const existing = await this.getByName(updates.name);
        if (existing) {
          throw new ValidationError(`Template name already exists: ${updates.name}`);
        }
      }

      const updatedTemplate = await this.update(id, updates);

      logInfo('Checklist template updated', {
        templateId: id,
        version: updates.version
      });

      return updatedTemplate;
    } catch (error) {
      logError('Error updating checklist template', { error: error.message });
      throw error;
    }
  }

  /**
   * Duplicate template
   * @param {string} id - Source template ID
   * @param {string} newName - New template name
   * @param {Object} user - User duplicating template
   * @returns {Promise<Object>} New template
   */
  async duplicateTemplate(id, newName, user) {
    try {
      const sourceTemplate = await this.findById(id);

      if (!sourceTemplate) {
        throw new NotFoundError('Source template not found');
      }

      // Create new template with same structure
      const newTemplateData = {
        name: newName,
        description: `Copy of ${sourceTemplate.name}`,
        category: sourceTemplate.category,
        applicableEquipmentTypes: sourceTemplate.applicableEquipmentTypes,
        items: sourceTemplate.items,
        estimatedDurationMinutes: sourceTemplate.estimatedDurationMinutes,
        isActive: true
      };

      return await this.createTemplate(newTemplateData, user);
    } catch (error) {
      logError('Error duplicating template', { error: error.message });
      throw error;
    }
  }

  /**
   * Increment usage count
   * @param {string} id - Template ID
   */
  async incrementUsageCount(id) {
    try {
      const template = await this.findById(id);

      if (!template) {
        return; // Silently fail
      }

      await this.update(id, {
        usageCount: (template.usageCount || 0) + 1,
        lastUsedDate: new Date()
      });
    } catch (error) {
      logError('Error incrementing template usage count', {
        error: error.message
      });
      // Don't throw - this is non-critical
    }
  }

  /**
   * Get popular templates
   * @param {number} limit - Number of templates to return
   * @returns {Promise<Array>} Popular templates
   */
  async getPopularTemplates(limit = 10) {
    try {
      const snapshot = await db
        .collection(this.collectionName)
        .where('isActive', '==', true)
        .orderBy('usageCount', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      logError('Error getting popular templates', { error: error.message });
      throw error;
    }
  }

  /**
   * Search templates
   * @param {Object} filters - Search filters
   * @returns {Promise<Array>} Templates
   */
  async searchTemplates(filters = {}) {
    try {
      const { category, equipmentType, searchTerm, isActive } = filters;

      let query = db.collection(this.collectionName);

      if (category) {
        query = query.where('category', '==', category);
      }

      if (equipmentType) {
        query = query.where('applicableEquipmentTypes', 'array-contains', equipmentType);
      }

      if (isActive !== undefined) {
        query = query.where('isActive', '==', isActive);
      }

      query = query.orderBy('name');

      const snapshot = await query.get();
      let templates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Client-side search term filtering
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        templates = templates.filter(
          template =>
            template.name.toLowerCase().includes(term) ||
            template.description?.toLowerCase().includes(term)
        );
      }

      return templates;
    } catch (error) {
      logError('Error searching templates', { error: error.message });
      throw error;
    }
  }

  /**
   * Get all categories
   * @returns {Promise<Array>} Unique categories
   */
  async getCategories() {
    try {
      const snapshot = await db
        .collection(this.collectionName)
        .where('isActive', '==', true)
        .get();

      const categories = new Set();
      snapshot.docs.forEach(doc => {
        const category = doc.data().category;
        if (category) {
          categories.add(category);
        }
      });

      return Array.from(categories).sort();
    } catch (error) {
      logError('Error getting template categories', { error: error.message });
      throw error;
    }
  }

  /**
   * Deactivate template
   * @param {string} id - Template ID
   * @returns {Promise<Object>} Updated template
   */
  async deactivateTemplate(id) {
    try {
      return await this.update(id, {
        isActive: false,
        deactivatedAt: new Date()
      });
    } catch (error) {
      logError('Error deactivating template', { error: error.message });
      throw error;
    }
  }

  /**
   * Activate template
   * @param {string} id - Template ID
   * @returns {Promise<Object>} Updated template
   */
  async activateTemplate(id) {
    try {
      return await this.update(id, {
        isActive: true,
        activatedAt: new Date()
      });
    } catch (error) {
      logError('Error activating template', { error: error.message });
      throw error;
    }
  }
}

// Export singleton instance
export const checklistTemplateService = new ChecklistTemplateService();

export default ChecklistTemplateService;
