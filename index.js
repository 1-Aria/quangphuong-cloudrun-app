/**
 * Cloud Run Backend - Main Entry Point
 * Multi-domain architecture with centralized middleware
 */

import express from 'express';
import cors from 'cors';

// Configuration
import { config, validateConfig } from './config/environment.js';
import { info as logInfo, error as logError } from './shared/utils/logger.js';

// Middleware
import { requestLogger } from './middleware/requestLogger.js';
import { verifyApiKey } from './middleware/verifyApiKey.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

// Domain Routes
import maintenanceRoutes from './domains/maintenance/routes.js';
import equipmentRoutes from './domains/equipment/routes.js';
import inventoryRoutes from './domains/inventory/routes.js';
import pmRoutes from './domains/preventive-maintenance/routes.js';

// Shared Routes
import analyticsRoutes from './shared/routes/analyticsRoutes.js';

// Initialize Express app
const app = express();

// Validate configuration on startup
try {
  validateConfig();
  logInfo('Configuration validated successfully');
} catch (error) {
  logError('Configuration validation failed', { error: error.message });
  process.exit(1);
}

// ============================================================================
// MIDDLEWARE REGISTRATION (Order is important!)
// ============================================================================

// 1. CORS - Enable cross-origin requests
app.use(cors({
  origin: config.security.corsOrigins,
  credentials: true
}));

// 2. Body Parser - Parse JSON request bodies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 3. Request Logger - Log all incoming requests with unique ID
app.use(requestLogger);

// 4. API Key Validator - Global authentication
// Note: Can be moved to specific routes if you want public endpoints
app.use(verifyApiKey);

// ============================================================================
// DOMAIN ROUTES REGISTRATION
// ============================================================================

/**
 * Domain Registration Pattern
 * Makes it easy to add new domains (Logistics, HR, Production, etc.)
 */
const domains = [
  { path: '/maintenance', router: maintenanceRoutes, name: 'Maintenance' },
  { path: '/equipment', router: equipmentRoutes, name: 'Equipment' },
  { path: '/inventory', router: inventoryRoutes, name: 'Inventory' },
  { path: '/pm', router: pmRoutes, name: 'Preventive Maintenance' },
  { path: '/analytics', router: analyticsRoutes, name: 'Analytics' }
  // Add future domains here:
  // { path: '/logistics', router: logisticsRoutes, name: 'Logistics' },
  // { path: '/hr', router: hrRoutes, name: 'HR' },
  // { path: '/production', router: productionRoutes, name: 'Production' }
];

// Register all domains
domains.forEach(({ path, router, name }) => {
  app.use(path, router);
  logInfo(`Domain registered: ${name}`, { path });
});

// ============================================================================
// HEALTH CHECK & SYSTEM ENDPOINTS
// ============================================================================

/**
 * Health check endpoint
 * Used by Cloud Run and monitoring tools
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: config.cloudRun.serviceName || 'maintenance-system',
    version: process.env.npm_package_version || '1.0.0',
    environment: config.server.nodeEnv,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

/**
 * Root endpoint - API info
 */
app.get('/', (req, res) => {
  res.json({
    name: 'Maintenance Reporting System API',
    version: '1.0.0',
    status: 'running',
    domains: domains.map(d => ({
      name: d.name,
      path: d.path
    })),
    documentation: '/api-docs' // Future: Add Swagger docs here
  });
});

// ============================================================================
// ERROR HANDLING (Must be registered AFTER all routes)
// ============================================================================

// 404 Handler - Undefined routes
app.use(notFoundHandler);

// Global Error Handler - Catches all errors
app.use(errorHandler);

// ============================================================================
// SERVER STARTUP
// ============================================================================

const PORT = config.server.port;

app.listen(PORT, () => {
  logInfo('Server started successfully', {
    port: PORT,
    environment: config.server.nodeEnv,
    isCloudRun: config.cloudRun.isCloudRun,
    service: config.cloudRun.serviceName,
    registeredDomains: domains.map(d => d.name)
  });

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   🚀  Cloud Run Backend - Multi-Domain System               ║
║                                                              ║
║   Status: Running                                            ║
║   Port: ${PORT}                                              ║
║   Environment: ${config.server.nodeEnv.padEnd(46)}║
║   Domains: ${domains.length} registered                                    ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
  `);
});

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

process.on('SIGTERM', () => {
  logInfo('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logInfo('SIGINT received, shutting down gracefully');
  process.exit(0);
});

export default app;
