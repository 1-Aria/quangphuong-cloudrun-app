import crypto from 'crypto';
import { UnauthorizedError } from '../shared/errors/AppError.js';
import { error as logError } from '../shared/utils/logger.js';

/**
 * API Key Verification Middleware
 * Validates x-api-key header with timing-attack protection
 */
export function verifyApiKey(req, res, next) {
  try {
    const clientKey = req.header('x-api-key');
    const serverKey = process.env.API_KEY;

    // Check if API key is configured
    if (!serverKey) {
      logError('API_KEY environment variable is not set');
      throw new UnauthorizedError('API authentication not configured');
    }

    // Check if client provided API key
    if (!clientKey) {
      throw new UnauthorizedError('Missing API key');
    }

    // Timing-safe comparison to prevent timing attacks
    const clientKeyBuffer = Buffer.from(clientKey);
    const serverKeyBuffer = Buffer.from(serverKey);

    // Ensure both buffers are same length before comparison
    if (clientKeyBuffer.length !== serverKeyBuffer.length) {
      logError({
        message: 'API key authentication failed',
        reason: 'Invalid key length',
        ip: req.ip,
        path: req.path
      });
      throw new UnauthorizedError('Invalid API key');
    }

    // Constant-time comparison
    const isValid = crypto.timingSafeEqual(clientKeyBuffer, serverKeyBuffer);

    if (!isValid) {
      logError({
        message: 'API key authentication failed',
        reason: 'Key mismatch',
        ip: req.ip,
        path: req.path,
        userAgent: req.get('user-agent')
      });
      throw new UnauthorizedError('Invalid API key');
    }

    // Authentication successful
    next();
  } catch (err) {
    // Pass to error handler middleware
    next(err);
  }
}

export default verifyApiKey;
