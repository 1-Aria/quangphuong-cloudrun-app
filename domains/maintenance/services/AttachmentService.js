/**
 * Attachment Service
 * Manages file uploads and attachments for work orders
 */

import { db } from '../../../config/firebase.js';
import { COLLECTIONS } from '../../../config/constants.js';
import { uploadFile, deleteFile, getSignedUrl } from '../../../shared/utils/storage.js';
import { ValidationError, NotFoundError } from '../../../shared/errors/AppError.js';
import { logInfo, logError } from '../../../shared/utils/logger.js';
import { activityLogService } from '../../../shared/services/ActivityLogService.js';
import path from 'path';
import crypto from 'crypto';

/**
 * Attachment Service
 * Handles file uploads, storage, and management for work orders and checklists
 */
class AttachmentService {
  /**
   * Allowed file types for uploads
   */
  static ALLOWED_MIME_TYPES = {
    // Images
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/gif': ['.gif'],
    'image/webp': ['.webp'],
    'image/heic': ['.heic'],
    'image/heif': ['.heif'],

    // Documents
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'application/vnd.ms-excel': ['.xls'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],

    // Videos
    'video/mp4': ['.mp4'],
    'video/quicktime': ['.mov'],
    'video/x-msvideo': ['.avi']
  };

  /**
   * Maximum file size (10MB)
   */
  static MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  /**
   * Upload attachment to work order
   * @param {string} workOrderId - Work order ID
   * @param {Object} file - File object from multer
   * @param {Object} metadata - Additional metadata
   * @param {Object} user - User uploading
   * @returns {Promise<Object>} Attachment record
   */
  async uploadToWorkOrder(workOrderId, file, metadata, user) {
    try {
      // Validate file
      this.validateFile(file);

      // Get work order
      const workOrderRef = db.collection(COLLECTIONS.WORK_ORDERS).doc(workOrderId);
      const workOrderDoc = await workOrderRef.get();

      if (!workOrderDoc.exists) {
        throw new NotFoundError('Work order not found');
      }

      const workOrder = workOrderDoc.data();

      // Generate unique filename
      const filename = this.generateFilename(file);

      // Storage path: work-orders/{workOrderId}/attachments/{filename}
      const storagePath = `work-orders/${workOrder.workOrderId}/attachments/${filename}`;

      // Upload to Cloud Storage
      const gsUri = await uploadFile(storagePath, file.buffer, {
        contentType: file.mimetype,
        metadata: {
          originalName: file.originalname,
          uploadedBy: user.uid || user.id,
          uploadedAt: new Date().toISOString(),
          workOrderId: workOrder.workOrderId
        }
      });

      // Create attachment record
      const attachment = {
        id: crypto.randomUUID(),
        workOrderId: workOrder.workOrderId,
        filename: file.originalname,
        storedFilename: filename,
        storagePath,
        gsUri,
        contentType: file.mimetype,
        size: file.size,
        category: metadata?.category || 'general', // incident, repair, completion
        description: metadata?.description || '',
        uploadedBy: user.uid || user.id,
        uploadedByName: user.displayName || user.name || user.email,
        uploadedAt: new Date(),
        isDeleted: false
      };

      // Update work order
      const attachments = workOrder.attachments || [];
      attachments.push(attachment);

      await workOrderRef.update({
        attachments,
        updatedAt: new Date()
      });

      // Log activity
      await activityLogService.logWorkOrderActivity(
        workOrderId,
        'ATTACHMENT_ADDED',
        user,
        {
          description: `File "${file.originalname}" uploaded`,
          metadata: {
            filename: file.originalname,
            size: file.size,
            contentType: file.mimetype,
            category: attachment.category
          }
        }
      );

      logInfo('Attachment uploaded to work order', {
        workOrderId: workOrder.workOrderId,
        filename: file.originalname,
        size: file.size
      });

      return attachment;
    } catch (error) {
      logError('Error uploading attachment', { error: error.message });
      throw error;
    }
  }

  /**
   * Upload photo to checklist item
   * @param {string} workOrderId - Work order ID
   * @param {number} itemOrder - Checklist item order
   * @param {Object} file - File object from multer
   * @param {Object} user - User uploading
   * @returns {Promise<Object>} Photo record
   */
  async uploadToChecklistItem(workOrderId, itemOrder, file, user) {
    try {
      // Validate file (must be image)
      this.validateFile(file);

      if (!file.mimetype.startsWith('image/')) {
        throw new ValidationError('Only images are allowed for checklist items');
      }

      // Get work order
      const workOrderRef = db.collection(COLLECTIONS.WORK_ORDERS).doc(workOrderId);
      const workOrderDoc = await workOrderRef.get();

      if (!workOrderDoc.exists) {
        throw new NotFoundError('Work order not found');
      }

      const workOrder = workOrderDoc.data();

      if (!workOrder.checklist) {
        throw new ValidationError('Work order does not have a checklist');
      }

      // Find checklist item
      const itemIndex = workOrder.checklist.items.findIndex(
        item => item.order === itemOrder
      );

      if (itemIndex === -1) {
        throw new NotFoundError(`Checklist item ${itemOrder} not found`);
      }

      // Generate unique filename
      const filename = this.generateFilename(file);

      // Storage path: work-orders/{workOrderId}/checklist/{itemOrder}/{filename}
      const storagePath = `work-orders/${workOrder.workOrderId}/checklist/item-${itemOrder}/${filename}`;

      // Upload to Cloud Storage
      const gsUri = await uploadFile(storagePath, file.buffer, {
        contentType: file.mimetype,
        metadata: {
          originalName: file.originalname,
          uploadedBy: user.uid || user.id,
          uploadedAt: new Date().toISOString(),
          workOrderId: workOrder.workOrderId,
          checklistItemOrder: itemOrder
        }
      });

      // Create photo record
      const photo = {
        id: crypto.randomUUID(),
        filename: file.originalname,
        storedFilename: filename,
        storagePath,
        gsUri,
        contentType: file.mimetype,
        size: file.size,
        uploadedBy: user.uid || user.id,
        uploadedByName: user.displayName || user.name || user.email,
        uploadedAt: new Date()
      };

      // Update checklist item
      const updatedItems = [...workOrder.checklist.items];
      const photos = updatedItems[itemIndex].photos || [];
      photos.push(photo);
      updatedItems[itemIndex].photos = photos;

      await workOrderRef.update({
        'checklist.items': updatedItems,
        updatedAt: new Date()
      });

      logInfo('Photo uploaded to checklist item', {
        workOrderId: workOrder.workOrderId,
        itemOrder,
        filename: file.originalname
      });

      return photo;
    } catch (error) {
      logError('Error uploading checklist photo', { error: error.message });
      throw error;
    }
  }

  /**
   * Get signed URL for attachment download
   * @param {string} workOrderId - Work order ID
   * @param {string} attachmentId - Attachment ID
   * @param {number} expirationMinutes - URL expiration in minutes (default: 60)
   * @returns {Promise<string>} Signed URL
   */
  async getAttachmentUrl(workOrderId, attachmentId, expirationMinutes = 60) {
    try {
      const workOrderDoc = await db
        .collection(COLLECTIONS.WORK_ORDERS)
        .doc(workOrderId)
        .get();

      if (!workOrderDoc.exists) {
        throw new NotFoundError('Work order not found');
      }

      const workOrder = workOrderDoc.data();
      const attachment = workOrder.attachments?.find(a => a.id === attachmentId);

      if (!attachment) {
        throw new NotFoundError('Attachment not found');
      }

      if (attachment.isDeleted) {
        throw new ValidationError('Attachment has been deleted');
      }

      const signedUrl = await getSignedUrl(
        attachment.storagePath,
        expirationMinutes * 60 * 1000
      );

      return {
        url: signedUrl,
        filename: attachment.filename,
        contentType: attachment.contentType,
        size: attachment.size,
        expiresAt: new Date(Date.now() + expirationMinutes * 60 * 1000)
      };
    } catch (error) {
      logError('Error generating attachment URL', { error: error.message });
      throw error;
    }
  }

  /**
   * Delete attachment from work order
   * @param {string} workOrderId - Work order ID
   * @param {string} attachmentId - Attachment ID
   * @param {Object} user - User deleting
   * @returns {Promise<void>}
   */
  async deleteAttachment(workOrderId, attachmentId, user) {
    try {
      const workOrderRef = db.collection(COLLECTIONS.WORK_ORDERS).doc(workOrderId);
      const workOrderDoc = await workOrderRef.get();

      if (!workOrderDoc.exists) {
        throw new NotFoundError('Work order not found');
      }

      const workOrder = workOrderDoc.data();
      const attachmentIndex = workOrder.attachments?.findIndex(a => a.id === attachmentId);

      if (attachmentIndex === -1 || attachmentIndex === undefined) {
        throw new NotFoundError('Attachment not found');
      }

      const attachment = workOrder.attachments[attachmentIndex];

      // Soft delete - mark as deleted but keep record
      const updatedAttachments = [...workOrder.attachments];
      updatedAttachments[attachmentIndex] = {
        ...attachment,
        isDeleted: true,
        deletedBy: user.uid || user.id,
        deletedByName: user.displayName || user.name || user.email,
        deletedAt: new Date()
      };

      await workOrderRef.update({
        attachments: updatedAttachments,
        updatedAt: new Date()
      });

      // Delete from Cloud Storage
      try {
        await deleteFile(attachment.storagePath);
      } catch (storageError) {
        logError('Failed to delete file from storage', {
          storagePath: attachment.storagePath,
          error: storageError.message
        });
        // Continue even if storage deletion fails
      }

      // Log activity
      await activityLogService.logWorkOrderActivity(
        workOrderId,
        'ATTACHMENT_DELETED',
        user,
        {
          description: `File "${attachment.filename}" deleted`,
          metadata: { filename: attachment.filename }
        }
      );

      logInfo('Attachment deleted', {
        workOrderId: workOrder.workOrderId,
        filename: attachment.filename
      });
    } catch (error) {
      logError('Error deleting attachment', { error: error.message });
      throw error;
    }
  }

  /**
   * List attachments for work order
   * @param {string} workOrderId - Work order ID
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} List of attachments
   */
  async listAttachments(workOrderId, filters = {}) {
    try {
      const workOrderDoc = await db
        .collection(COLLECTIONS.WORK_ORDERS)
        .doc(workOrderId)
        .get();

      if (!workOrderDoc.exists) {
        throw new NotFoundError('Work order not found');
      }

      const workOrder = workOrderDoc.data();
      let attachments = workOrder.attachments || [];

      // Filter out deleted attachments by default
      if (filters.includeDeleted !== true) {
        attachments = attachments.filter(a => !a.isDeleted);
      }

      // Filter by category
      if (filters.category) {
        attachments = attachments.filter(a => a.category === filters.category);
      }

      // Filter by content type
      if (filters.contentType) {
        attachments = attachments.filter(a =>
          a.contentType.startsWith(filters.contentType)
        );
      }

      return attachments;
    } catch (error) {
      logError('Error listing attachments', { error: error.message });
      throw error;
    }
  }

  /**
   * Validate file for upload
   * @param {Object} file - File object from multer
   * @private
   */
  validateFile(file) {
    if (!file) {
      throw new ValidationError('No file provided');
    }

    // Check file size
    if (file.size > AttachmentService.MAX_FILE_SIZE) {
      throw new ValidationError(
        `File size exceeds maximum allowed size of ${AttachmentService.MAX_FILE_SIZE / (1024 * 1024)}MB`
      );
    }

    // Check MIME type
    if (!AttachmentService.ALLOWED_MIME_TYPES[file.mimetype]) {
      throw new ValidationError(
        `File type ${file.mimetype} is not allowed. Allowed types: images, PDFs, Office documents, videos`
      );
    }

    // Check file has content
    if (!file.buffer || file.buffer.length === 0) {
      throw new ValidationError('File is empty');
    }
  }

  /**
   * Generate unique filename
   * @param {Object} file - File object
   * @returns {string} Generated filename
   * @private
   */
  generateFilename(file) {
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(file.originalname);
    return `${timestamp}-${random}${ext}`;
  }
}

// Export singleton instance
export const attachmentService = new AttachmentService();

export default AttachmentService;
