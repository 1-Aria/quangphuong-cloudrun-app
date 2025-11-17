import { randomUUID } from 'crypto';
import { logRequest, logResponse } from '../shared/utils/logger.js';

/**
 * Request Logger Middleware
 * Generates unique request ID and logs all incoming requests and responses
 */
export function requestLogger(req, res, next) {
  // Generate unique request ID
  req.id = randomUUID();

  // Capture start time
  const startTime = Date.now();

  // Log incoming request
  logRequest(req);

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logResponse(req, res, duration);
  });

  next();
}

export default requestLogger;
