/**
 * File Upload Middleware
 * Handles multipart form data using multer
 */

import multer from 'multer';
import { ValidationError } from '../shared/errors/AppError.js';

/**
 * Maximum file size (10MB)
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Allowed MIME types for uploads
 */
const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',

  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

  // Videos
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo'
];

/**
 * File filter function
 * @param {Object} req - Express request
 * @param {Object} file - Multer file object
 * @param {Function} cb - Callback
 */
const fileFilter = (req, file, cb) => {
  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(
      new ValidationError(
        `File type ${file.mimetype} is not allowed. Allowed types: images, PDFs, Office documents, videos`
      ),
      false
    );
  }

  cb(null, true);
};

/**
 * Multer configuration for memory storage
 * Files are stored in memory buffer for upload to Cloud Storage
 */
const storage = multer.memoryStorage();

/**
 * Multer upload middleware
 */
export const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1 // Single file upload
  },
  fileFilter
});

/**
 * Middleware for single file upload
 * Field name: 'file'
 */
export const uploadSingle = upload.single('file');

/**
 * Middleware for multiple file uploads
 * Field name: 'files'
 * Max count: 5 files
 */
export const uploadMultiple = upload.array('files', 5);

/**
 * Error handler for multer errors
 * @param {Error} err - Error object
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
export const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`
      });
    }

    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Too many files uploaded'
      });
    }

    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        error: 'Unexpected field name for file upload. Use "file" or "files"'
      });
    }

    return res.status(400).json({
      success: false,
      error: `Upload error: ${err.message}`
    });
  }

  // Pass other errors to global error handler
  next(err);
};

export default {
  upload,
  uploadSingle,
  uploadMultiple,
  handleUploadError
};
