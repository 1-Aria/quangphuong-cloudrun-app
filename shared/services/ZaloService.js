/**
 * Zalo Messaging Service
 * Handles Zalo Official Account (OA) messaging integration
 * Translated from Google Apps Script to Node.js
 */

import axios from 'axios';
import { db } from '../../config/firebase.js';
import { COLLECTIONS } from '../../config/constants.js';
import { logInfo, logError, logWarning } from '../utils/logger.js';

/**
 * Zalo OAuth and API endpoints
 */
const ZALO_OAUTH_URL = 'https://oauth.zaloapp.com/v4/oa/access_token';
const ZALO_CS_MESSAGE_URL = 'https://openapi.zalo.me/v3.0/oa/message/cs';
const ZALO_GMF_MESSAGE_URL = 'https://openapi.zalo.me/v3.0/oa/group/message';

/**
 * Zalo error codes
 */
const ZALO_EXPIRED_TOKEN_ERROR = -216; // Invalid/expired access token

/**
 * Token storage collection
 */
const TOKEN_COLLECTION = 'zalo_tokens';

/**
 * Zalo Service
 * Manages OAuth tokens and sends messages via Zalo OA
 */
class ZaloService {
  constructor() {
    this.appId = process.env.ZALO_APP_ID;
    this.secretKey = process.env.ZALO_SECRET_KEY;
    this.oaId = process.env.ZALO_OA_ID;
  }

  /**
   * Get stored tokens from Firestore
   * @returns {Promise<Object>} Token data
   */
  async getStoredTokens() {
    try {
      const tokenDoc = await db
        .collection(TOKEN_COLLECTION)
        .doc('primary')
        .get();

      if (!tokenDoc.exists) {
        logWarning('No stored Zalo tokens found');
        return null;
      }

      return tokenDoc.data();
    } catch (error) {
      logError('Error retrieving stored tokens', { error: error.message });
      throw error;
    }
  }

  /**
   * Store tokens in Firestore
   * @param {string} accessToken - Access token
   * @param {string} refreshToken - Refresh token
   * @param {number} expiresIn - Token expiration in seconds
   */
  async storeTokens(accessToken, refreshToken, expiresIn = 90000) {
    try {
      const expiryTimestamp = Math.floor(Date.now() / 1000) + expiresIn;

      await db.collection(TOKEN_COLLECTION).doc('primary').set({
        accessToken,
        refreshToken,
        expiresAt: expiryTimestamp,
        updatedAt: new Date()
      });

      logInfo('Zalo tokens stored successfully', {
        expiresAt: new Date(expiryTimestamp * 1000).toISOString()
      });
    } catch (error) {
      logError('Error storing tokens', { error: error.message });
      throw error;
    }
  }

  /**
   * Refresh Zalo access token using refresh token
   * @returns {Promise<string|null>} New access token or null if refresh fails
   */
  async refreshAccessToken() {
    try {
      const tokens = await this.getStoredTokens();

      if (!tokens || !tokens.refreshToken) {
        logError('No refresh token found. Initial authorization required.');
        return null;
      }

      const payload = new URLSearchParams({
        refresh_token: tokens.refreshToken,
        app_id: this.appId,
        grant_type: 'refresh_token'
      });

      logInfo('Attempting to refresh Zalo access token');

      const response = await axios.post(ZALO_OAUTH_URL, payload, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'secret_key': this.secretKey
        }
      });

      if (response.status === 200) {
        const result = response.data;

        // Check for error in JSON body despite 200 status
        if (result.error || result.error_name) {
          throw new Error(
            `Zalo returned error: ${result.error_description || result.error_name}`
          );
        }

        // Use fallback if Zalo doesn't provide expires_in
        const expiresIn = result.expires_in || 90000;

        // CRITICAL: Store new tokens (Zalo tokens are single-use)
        await this.storeTokens(
          result.access_token,
          result.refresh_token,
          expiresIn
        );

        logInfo('Token refresh successful', {
          newTokenPrefix: result.access_token.substring(0, 10) + '...'
        });

        return result.access_token;
      } else {
        logError('Token refresh failed', {
          status: response.status,
          data: response.data
        });
        return null;
      }
    } catch (error) {
      logError('Token refresh error', {
        error: error.message,
        response: error.response?.data
      });
      return null;
    }
  }

  /**
   * Get a valid access token (refresh if needed)
   * @returns {Promise<string|null>} Valid access token
   */
  async getValidAccessToken() {
    try {
      const tokens = await this.getStoredTokens();

      if (!tokens || !tokens.accessToken) {
        logWarning('No access token found');
        return null;
      }

      // Note: We rely on reactive refresh (on -216 error)
      // rather than proactive time-based refresh
      return tokens.accessToken;
    } catch (error) {
      logError('Error getting access token', { error: error.message });
      return null;
    }
  }

  /**
   * Check if message ID is duplicate using Firestore
   * @param {string} msgId - Message ID
   * @returns {Promise<boolean>} True if duplicate
   */
  async isDuplicateMessage(msgId) {
    if (!msgId) return true;

    try {
      const cacheRef = db.collection('message_cache').doc(msgId);
      const doc = await cacheRef.get();

      if (doc.exists) {
        logInfo('Duplicate message ignored', { msgId });
        return true;
      }

      // Store message ID with 6-hour expiration
      const expiryTime = new Date();
      expiryTime.setHours(expiryTime.getHours() + 6);

      await cacheRef.set({
        timestamp: new Date(),
        expiresAt: expiryTime
      });

      return false;
    } catch (error) {
      logError('Error checking duplicate message', { error: error.message });
      return false; // Allow message on error
    }
  }

  /**
   * Centralized fetch with token refresh retry logic
   * @param {string} url - API endpoint URL
   * @param {Object} payload - Request payload
   * @param {string} logContext - Context for logging (e.g., "CS_MESSAGE", "GMF_MESSAGE")
   * @returns {Promise<Object|null>} Response data or null on failure
   */
  async fetchWithTokenRefresh(url, payload, logContext) {
    const MAX_ATTEMPTS = 2;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        // Get current access token
        let accessToken = await this.getValidAccessToken();

        if (!accessToken) {
          logError(`${logContext} FATAL: No valid token`, { attempt });
          return null;
        }

        // Make API request
        const response = await axios.post(url, payload, {
          headers: {
            'Content-Type': 'application/json',
            'access_token': accessToken
          }
        });

        const result = response.data;

        // Check for token expiration (HTTP 401 OR Zalo error -216)
        let isTokenExpiredError = false;

        if (response.status === 401) {
          // Standard OAuth 401
          isTokenExpiredError = true;
        } else if (response.status === 200 && result.error === ZALO_EXPIRED_TOKEN_ERROR) {
          // Zalo's custom error response inside JSON body
          isTokenExpiredError = true;
        }

        // Handle token expiration on first attempt
        if (isTokenExpiredError && attempt === 1) {
          logWarning(`${logContext} Token expired, refreshing...`, {
            errorCode: result.error || 401
          });

          // Force token refresh
          const newAccessToken = await this.refreshAccessToken();

          if (!newAccessToken) {
            logError(`${logContext} Refresh failed`, { attempt });
            return null;
          }

          // Retry will use new token in next iteration
          continue;
        }

        // Check for success
        if (response.status === 200 && result.error === 0) {
          logInfo(`${logContext} Success`, {
            attempt,
            response: JSON.stringify(result)
          });
          return result;
        }

        // Final failure
        const errorDetails = result.message || JSON.stringify(result);
        logError(`${logContext} Failed`, {
          status: response.status,
          attempt,
          details: errorDetails
        });
        return null;

      } catch (error) {
        logError(`${logContext} Exception`, {
          attempt,
          error: error.message,
          response: error.response?.data
        });

        // Don't retry on network errors
        return null;
      }
    }

    return null;
  }

  /**
   * Send 1:1 private chat message (CS - Customer Service)
   * @param {string} userId - Zalo user ID
   * @param {string} message - Message text
   * @returns {Promise<boolean>} True if sent successfully
   */
  async sendCSMessage(userId, message) {
    if (!userId || !message) {
      logError('CS Message: Missing userId or message');
      return false;
    }

    const payload = {
      recipient: { user_id: userId },
      message: { text: message }
    };

    const result = await this.fetchWithTokenRefresh(
      ZALO_CS_MESSAGE_URL,
      payload,
      'CS_MESSAGE'
    );

    return result !== null;
  }

  /**
   * Send group chat message (GMF - Group Message Feature)
   * @param {string} groupId - Zalo group ID
   * @param {string} message - Message text
   * @returns {Promise<boolean>} True if sent successfully
   */
  async sendGMFMessage(groupId, message) {
    if (!groupId || !message) {
      logError('GMF Message: Missing groupId or message');
      return false;
    }

    const payload = {
      recipient: { group_id: groupId },
      message: { text: message }
    };

    const result = await this.fetchWithTokenRefresh(
      ZALO_GMF_MESSAGE_URL,
      payload,
      'GMF_MESSAGE'
    );

    return result !== null;
  }

  /**
   * Send message to multiple recipients
   * @param {Array<Object>} recipients - Array of {type: 'user'|'group', id: string}
   * @param {string} message - Message text
   * @returns {Promise<Object>} Results summary
   */
  async sendBulkMessage(recipients, message) {
    const results = {
      sent: 0,
      failed: 0,
      errors: []
    };

    for (const recipient of recipients) {
      let success = false;

      if (recipient.type === 'user') {
        success = await this.sendCSMessage(recipient.id, message);
      } else if (recipient.type === 'group') {
        success = await this.sendGMFMessage(recipient.id, message);
      }

      if (success) {
        results.sent++;
      } else {
        results.failed++;
        results.errors.push({
          recipient,
          error: 'Send failed'
        });
      }
    }

    logInfo('Bulk message send completed', results);
    return results;
  }

  /**
   * Clean up expired message cache entries
   * Should be called periodically (e.g., daily via Cloud Scheduler)
   */
  async cleanupMessageCache() {
    try {
      const now = new Date();
      const snapshot = await db
        .collection('message_cache')
        .where('expiresAt', '<', now)
        .limit(500)
        .get();

      const batch = db.batch();
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();

      logInfo('Message cache cleanup completed', {
        deletedCount: snapshot.size
      });
    } catch (error) {
      logError('Message cache cleanup failed', { error: error.message });
    }
  }
}

// Export singleton instance
export const zaloService = new ZaloService();

export default ZaloService;
