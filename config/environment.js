/**
 * Centralized Environment Configuration
 * All environment variables and configuration in one place
 */

export const config = {
  // Server configuration
  server: {
    port: process.env.PORT || 8080,
    nodeEnv: process.env.NODE_ENV || 'development',
    isProduction: process.env.NODE_ENV === 'production',
    isDevelopment: process.env.NODE_ENV !== 'production'
  },

  // Firebase configuration
  firebase: {
    storageBucket: process.env.STORAGE_BUCKET || 'quang-phuong-database.firebasestorage.app',
    projectId: process.env.FIREBASE_PROJECT_ID || null,
    // Path to service account file for local development
    serviceAccountPath: process.env.SERVICE_ACCOUNT_PATH || './admin/service-account.json'
  },

  // Security configuration
  security: {
    apiKey: process.env.API_KEY,
    // CORS allowed origins (comma-separated in env var)
    corsOrigins: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
      : ['*'], // Default to all origins (update for production)
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'), // 15 minutes in ms
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100') // Max requests per window
  },

  // Cloud Run detection
  cloudRun: {
    isCloudRun: !!process.env.K_SERVICE,
    serviceName: process.env.K_SERVICE || null,
    revision: process.env.K_REVISION || null,
    configuration: process.env.K_CONFIGURATION || null
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    enableRequestLogging: process.env.ENABLE_REQUEST_LOGGING !== 'false',
    enableDatabaseLogging: process.env.ENABLE_DATABASE_LOGGING === 'true'
  },

  // Feature flags
  features: {
    enableAuditLogging: process.env.ENABLE_AUDIT_LOGGING === 'true',
    enableMetrics: process.env.ENABLE_METRICS === 'true',
    enableTracing: process.env.ENABLE_TRACING === 'true'
  },

  // Database configuration
  database: {
    defaultPageLimit: parseInt(process.env.DEFAULT_PAGE_LIMIT || '100'),
    maxPageLimit: parseInt(process.env.MAX_PAGE_LIMIT || '1000')
  },

  // Zalo messaging configuration
  zalo: {
    appId: process.env.ZALO_APP_ID,
    secretKey: process.env.ZALO_SECRET_KEY,
    oaId: process.env.ZALO_OA_ID,
    // Zalo group IDs for notifications
    groups: {
      maintenance: process.env.ZALO_GROUP_MAINTENANCE || null,
      supervisors: process.env.ZALO_GROUP_SUPERVISORS || null,
      managers: process.env.ZALO_GROUP_MANAGERS || null,
      all: process.env.ZALO_GROUP_ALL || null
    }
  },

  // Notification configuration
  notifications: {
    enabled: process.env.ENABLE_NOTIFICATIONS !== 'false',
    channels: {
      zalo: process.env.ENABLE_ZALO_NOTIFICATIONS !== 'false',
      email: process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true',
      sms: process.env.ENABLE_SMS_NOTIFICATIONS === 'true',
      push: process.env.ENABLE_PUSH_NOTIFICATIONS === 'true'
    }
  }
};

/**
 * Validate required configuration
 * Throws error if critical config is missing
 */
export function validateConfig() {
  const errors = [];

  // Check required environment variables
  if (!config.security.apiKey) {
    errors.push('API_KEY environment variable is required');
  }

  if (config.cloudRun.isCloudRun && !config.firebase.projectId) {
    errors.push('FIREBASE_PROJECT_ID should be set when running on Cloud Run');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

export default config;
