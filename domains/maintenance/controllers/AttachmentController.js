/**
 * Attachment Controller
 * HTTP request handlers for file uploads and attachment management
 */

import { attachmentService } from '../services/AttachmentService.js';
import { asyncHandler } from '../../../shared/middleware/asyncHandler.js';
import { ValidationError } from '../../../shared/errors/AppError.js';

/**
 * Upload attachment to work order
 * POST /work-orders/:workOrderId/attachments
 * Content-Type: multipart/form-data
 * Body: file (required), category (optional), description (optional)
 */
export const uploadAttachment = asyncHandler(async (req, res) => {
  const { workOrderId } = req.params;

  if (!req.file) {
    throw new ValidationError('No file uploaded. Please include a file in the request.');
  }

  const metadata = {
    category: req.body.category || 'general', // incident, repair, completion
    description: req.body.description || ''
  };

  const attachment = await attachmentService.uploadToWorkOrder(
    workOrderId,
    req.file,
    metadata,
    req.user
  );

  res.status(201).json({
    success: true,
    data: attachment,
    message: 'File uploaded successfully'
  });
});

/**
 * Upload photo to checklist item
 * POST /work-orders/:workOrderId/checklist/items/:itemOrder/photos
 * Content-Type: multipart/form-data
 * Body: file (required, must be image)
 */
export const uploadChecklistPhoto = asyncHandler(async (req, res) => {
  const { workOrderId, itemOrder } = req.params;

  if (!req.file) {
    throw new ValidationError('No file uploaded. Please include an image file in the request.');
  }

  const photo = await attachmentService.uploadToChecklistItem(
    workOrderId,
    parseInt(itemOrder, 10),
    req.file,
    req.user
  );

  res.status(201).json({
    success: true,
    data: photo,
    message: 'Photo uploaded successfully'
  });
});

/**
 * Get signed URL for attachment download
 * GET /work-orders/:workOrderId/attachments/:attachmentId/url
 * Query params: expirationMinutes (optional, default: 60)
 */
export const getAttachmentUrl = asyncHandler(async (req, res) => {
  const { workOrderId, attachmentId } = req.params;
  const expirationMinutes = parseInt(req.query.expirationMinutes, 10) || 60;

  const result = await attachmentService.getAttachmentUrl(
    workOrderId,
    attachmentId,
    expirationMinutes
  );

  res.status(200).json({
    success: true,
    data: result,
    message: 'Signed URL generated successfully'
  });
});

/**
 * List attachments for work order
 * GET /work-orders/:workOrderId/attachments
 * Query params: category, contentType, includeDeleted
 */
export const listAttachments = asyncHandler(async (req, res) => {
  const { workOrderId } = req.params;

  const filters = {
    category: req.query.category,
    contentType: req.query.contentType,
    includeDeleted: req.query.includeDeleted === 'true'
  };

  const attachments = await attachmentService.listAttachments(
    workOrderId,
    filters
  );

  res.status(200).json({
    success: true,
    data: attachments,
    count: attachments.length,
    message: 'Attachments retrieved successfully'
  });
});

/**
 * Delete attachment
 * DELETE /work-orders/:workOrderId/attachments/:attachmentId
 */
export const deleteAttachment = asyncHandler(async (req, res) => {
  const { workOrderId, attachmentId } = req.params;

  await attachmentService.deleteAttachment(workOrderId, attachmentId, req.user);

  res.status(200).json({
    success: true,
    message: 'Attachment deleted successfully'
  });
});
