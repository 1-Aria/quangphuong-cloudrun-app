/**
 * Storage Utilities
 * Handles file operations with Google Cloud Storage
 */

import { bucket } from '../../config/firebase.js';
import { ValidationError } from '../errors/AppError.js';
import { error as logError, info as logInfo } from './logger.js';

/**
 * Upload a file to Cloud Storage
 * @param {string} path - Destination path in bucket
 * @param {Buffer|string} content - File content
 * @param {Object} options - Upload options
 * @returns {Promise<string>} GS URI of uploaded file
 */
export async function uploadFile(path, content, options = {}) {
  try {
    if (!path) {
      throw new ValidationError('File path is required');
    }

    if (!content) {
      throw new ValidationError('File content is required');
    }

    const file = bucket.file(path);

    // Upload options
    const uploadOptions = {
      resumable: false,
      ...options
    };

    await file.save(content, uploadOptions);

    const gsUri = `gs://${bucket.name}/${path}`;

    logInfo('File uploaded to Cloud Storage', {
      path,
      gsUri,
      size: Buffer.byteLength(content)
    });

    return gsUri;
  } catch (error) {
    logError('File upload failed', {
      path,
      error: error.message
    });
    throw error;
  }
}

/**
 * Download a file from Cloud Storage
 * @param {string} path - File path in bucket
 * @returns {Promise<Buffer>} File content
 */
export async function downloadFile(path) {
  try {
    if (!path) {
      throw new ValidationError('File path is required');
    }

    const file = bucket.file(path);
    const [content] = await file.download();

    logInfo('File downloaded from Cloud Storage', { path });

    return content;
  } catch (error) {
    logError('File download failed', {
      path,
      error: error.message
    });
    throw error;
  }
}

/**
 * Delete a file from Cloud Storage
 * @param {string} path - File path in bucket
 * @returns {Promise<void>}
 */
export async function deleteFile(path) {
  try {
    if (!path) {
      throw new ValidationError('File path is required');
    }

    const file = bucket.file(path);
    await file.delete();

    logInfo('File deleted from Cloud Storage', { path });
  } catch (error) {
    logError('File deletion failed', {
      path,
      error: error.message
    });
    throw error;
  }
}

/**
 * Get a signed URL for temporary file access
 * @param {string} path - File path in bucket
 * @param {number} expirationMs - Expiration time in milliseconds (default: 1 hour)
 * @returns {Promise<string>} Signed URL
 */
export async function getSignedUrl(path, expirationMs = 3600000) {
  try {
    if (!path) {
      throw new ValidationError('File path is required');
    }

    const file = bucket.file(path);

    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + expirationMs
    });

    logInfo('Generated signed URL', {
      path,
      expiresIn: `${expirationMs / 1000}s`
    });

    return url;
  } catch (error) {
    logError('Signed URL generation failed', {
      path,
      error: error.message
    });
    throw error;
  }
}

/**
 * Check if a file exists in Cloud Storage
 * @param {string} path - File path in bucket
 * @returns {Promise<boolean>} True if file exists
 */
export async function fileExists(path) {
  try {
    if (!path) {
      return false;
    }

    const file = bucket.file(path);
    const [exists] = await file.exists();

    return exists;
  } catch (error) {
    logError('File existence check failed', {
      path,
      error: error.message
    });
    return false;
  }
}

/**
 * Get file metadata
 * @param {string} path - File path in bucket
 * @returns {Promise<Object>} File metadata
 */
export async function getFileMetadata(path) {
  try {
    if (!path) {
      throw new ValidationError('File path is required');
    }

    const file = bucket.file(path);
    const [metadata] = await file.getMetadata();

    return {
      name: metadata.name,
      bucket: metadata.bucket,
      size: metadata.size,
      contentType: metadata.contentType,
      created: metadata.timeCreated,
      updated: metadata.updated
    };
  } catch (error) {
    logError('Failed to get file metadata', {
      path,
      error: error.message
    });
    throw error;
  }
}

export default {
  uploadFile,
  downloadFile,
  deleteFile,
  getSignedUrl,
  fileExists,
  getFileMetadata
};
