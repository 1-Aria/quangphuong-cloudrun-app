/**
 * Role-Based Access Control (RBAC) Configuration
 * Defines roles, permissions, and access control rules
 */

/**
 * System Roles
 * Hierarchical roles with increasing privileges
 */
export const ROLES = {
  // Public access (no authentication required)
  PUBLIC: 'public',

  // Authenticated users
  USER: 'user',

  // CMMS Maintenance roles
  OPERATOR: 'operator',            // Machine operator - can request work orders
  TECHNICIAN: 'technician',        // Maintenance technician - executes work
  PLANNER: 'planner',              // Maintenance planner - schedules and plans work
  SUPERVISOR: 'supervisor',        // Maintenance supervisor - assigns and approves work
  INVENTORY_MANAGER: 'inventory_manager', // Manages parts and inventory

  // Other domain-specific roles
  WAREHOUSE_STAFF: 'warehouse_staff', // Logistics domain
  HR_STAFF: 'hr_staff',            // HR domain
  PRODUCTION_STAFF: 'production_staff', // Production domain

  // Administrative roles
  MANAGER: 'manager',              // Department manager
  ADMIN: 'admin',                  // System administrator
  SUPER_ADMIN: 'super_admin'       // Full system access
};

/**
 * Permissions
 * Granular permissions for specific actions
 */
export const PERMISSIONS = {
  // Work Order permissions (CMMS)
  WO_VIEW: 'work_order:view',
  WO_VIEW_ALL: 'work_order:view_all',
  WO_CREATE: 'work_order:create',
  WO_UPDATE: 'work_order:update',
  WO_DELETE: 'work_order:delete',
  WO_SUBMIT: 'work_order:submit',
  WO_APPROVE: 'work_order:approve',
  WO_REJECT: 'work_order:reject',
  WO_ASSIGN: 'work_order:assign',
  WO_REASSIGN: 'work_order:reassign',
  WO_START: 'work_order:start',
  WO_COMPLETE: 'work_order:complete',
  WO_CLOSE: 'work_order:close',
  WO_CANCEL: 'work_order:cancel',
  WO_HOLD: 'work_order:hold',
  WO_COMMENT: 'work_order:comment',
  WO_ATTACH: 'work_order:attach',

  // Equipment permissions
  EQUIPMENT_VIEW: 'equipment:view',
  EQUIPMENT_CREATE: 'equipment:create',
  EQUIPMENT_EDIT: 'equipment:edit',
  EQUIPMENT_DELETE: 'equipment:delete',
  EQUIPMENT_HISTORY: 'equipment:history',
  EQUIPMENT_METRICS: 'equipment:metrics',

  // Inventory permissions
  INVENTORY_VIEW: 'inventory:view',
  INVENTORY_CREATE: 'inventory:create',
  INVENTORY_EDIT: 'inventory:edit',
  INVENTORY_DELETE: 'inventory:delete',
  INVENTORY_ISSUE: 'inventory:issue',
  INVENTORY_RECEIVE: 'inventory:receive',
  INVENTORY_ADJUST: 'inventory:adjust',
  INVENTORY_TRANSFER: 'inventory:transfer',
  INVENTORY_RESERVE: 'inventory:reserve',

  // Preventive Maintenance permissions
  PM_VIEW: 'pm:view',
  PM_CREATE: 'pm:create',
  PM_EDIT: 'pm:edit',
  PM_DELETE: 'pm:delete',
  PM_EXECUTE: 'pm:execute',

  // Checklist permissions
  CHECKLIST_VIEW: 'checklist:view',
  CHECKLIST_CREATE: 'checklist:create',
  CHECKLIST_UPDATE: 'checklist:update',
  CHECKLIST_DELETE: 'checklist:delete',
  CHECKLIST_EXECUTE: 'checklist:execute',

  // Planning permissions
  PLANNING_VIEW: 'planning:view',
  PLANNING_CREATE: 'planning:create',
  PLANNING_UPDATE: 'planning:update',
  PLANNING_SCHEDULE: 'planning:schedule',

  // Reporting & Analytics
  REPORT_VIEW: 'report:view',
  REPORT_EXPORT: 'report:export',
  DASHBOARD_VIEW: 'dashboard:view',
  ANALYTICS_VIEW: 'analytics:view',

  // Logistics domain (future)
  LOGISTICS_VIEW: 'logistics:view',
  LOGISTICS_CREATE: 'logistics:create',
  LOGISTICS_UPDATE: 'logistics:update',
  LOGISTICS_DELETE: 'logistics:delete',

  // HR domain (future)
  HR_VIEW: 'hr:view',
  HR_CREATE: 'hr:create',
  HR_UPDATE: 'hr:update',
  HR_DELETE: 'hr:delete',

  // Production domain (future)
  PRODUCTION_VIEW: 'production:view',
  PRODUCTION_CREATE: 'production:create',
  PRODUCTION_UPDATE: 'production:update',
  PRODUCTION_DELETE: 'production:delete',

  // System permissions
  USER_MANAGE: 'user:manage',
  ROLE_MANAGE: 'role:manage',
  SYSTEM_CONFIGURE: 'system:configure',
  AUDIT_VIEW: 'audit:view'
};

/**
 * Role to Permissions Mapping
 * Defines what each role can do
 */
export const ROLE_PERMISSIONS = {
  [ROLES.PUBLIC]: [
    // Public users have no permissions (can only access public routes)
  ],

  [ROLES.USER]: [
    PERMISSIONS.WO_VIEW,           // Can view their own work orders
    PERMISSIONS.EQUIPMENT_VIEW,
    PERMISSIONS.DASHBOARD_VIEW
  ],

  [ROLES.OPERATOR]: [
    // Machine operators can request work orders
    PERMISSIONS.WO_VIEW,
    PERMISSIONS.WO_CREATE,
    PERMISSIONS.WO_SUBMIT,
    PERMISSIONS.WO_COMMENT,
    PERMISSIONS.WO_ATTACH,
    PERMISSIONS.EQUIPMENT_VIEW,
    PERMISSIONS.DASHBOARD_VIEW
  ],

  [ROLES.TECHNICIAN]: [
    // Technicians execute work orders
    PERMISSIONS.WO_VIEW,
    PERMISSIONS.WO_VIEW_ALL,
    PERMISSIONS.WO_UPDATE,
    PERMISSIONS.WO_START,
    PERMISSIONS.WO_COMPLETE,
    PERMISSIONS.WO_HOLD,
    PERMISSIONS.WO_COMMENT,
    PERMISSIONS.WO_ATTACH,
    PERMISSIONS.EQUIPMENT_VIEW,
    PERMISSIONS.EQUIPMENT_HISTORY,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_REQUEST,
    PERMISSIONS.CHECKLIST_VIEW,
    PERMISSIONS.CHECKLIST_EXECUTE,
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.REPORT_VIEW
  ],

  [ROLES.PLANNER]: [
    // Planners schedule and plan maintenance work
    PERMISSIONS.WO_VIEW,
    PERMISSIONS.WO_VIEW_ALL,
    PERMISSIONS.WO_CREATE,
    PERMISSIONS.WO_UPDATE,
    PERMISSIONS.WO_SUBMIT,
    PERMISSIONS.WO_COMMENT,
    PERMISSIONS.WO_ATTACH,
    PERMISSIONS.EQUIPMENT_VIEW,
    PERMISSIONS.EQUIPMENT_CREATE,
    PERMISSIONS.EQUIPMENT_EDIT,
    PERMISSIONS.EQUIPMENT_HISTORY,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.PM_VIEW,
    PERMISSIONS.PM_CREATE,
    PERMISSIONS.PM_EDIT,
    PERMISSIONS.PM_EXECUTE,
    PERMISSIONS.CHECKLIST_VIEW,
    PERMISSIONS.CHECKLIST_CREATE,
    PERMISSIONS.CHECKLIST_UPDATE,
    PERMISSIONS.PLANNING_VIEW,
    PERMISSIONS.PLANNING_CREATE,
    PERMISSIONS.PLANNING_UPDATE,
    PERMISSIONS.PLANNING_SCHEDULE,
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.ANALYTICS_VIEW
  ],

  [ROLES.SUPERVISOR]: [
    // Supervisors approve and assign work orders
    PERMISSIONS.WO_VIEW,
    PERMISSIONS.WO_VIEW_ALL,
    PERMISSIONS.WO_CREATE,
    PERMISSIONS.WO_UPDATE,
    PERMISSIONS.WO_DELETE,
    PERMISSIONS.WO_SUBMIT,
    PERMISSIONS.WO_APPROVE,
    PERMISSIONS.WO_REJECT,
    PERMISSIONS.WO_ASSIGN,
    PERMISSIONS.WO_REASSIGN,
    PERMISSIONS.WO_START,
    PERMISSIONS.WO_COMPLETE,
    PERMISSIONS.WO_CLOSE,
    PERMISSIONS.WO_CANCEL,
    PERMISSIONS.WO_HOLD,
    PERMISSIONS.WO_COMMENT,
    PERMISSIONS.WO_ATTACH,
    PERMISSIONS.EQUIPMENT_VIEW,
    PERMISSIONS.EQUIPMENT_CREATE,
    PERMISSIONS.EQUIPMENT_EDIT,
    PERMISSIONS.EQUIPMENT_HISTORY,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_EDIT,
    PERMISSIONS.PM_VIEW,
    PERMISSIONS.PM_CREATE,
    PERMISSIONS.PM_EDIT,
    PERMISSIONS.PM_DELETE,
    PERMISSIONS.PM_EXECUTE,
    PERMISSIONS.CHECKLIST_VIEW,
    PERMISSIONS.CHECKLIST_CREATE,
    PERMISSIONS.CHECKLIST_UPDATE,
    PERMISSIONS.CHECKLIST_EXECUTE,
    PERMISSIONS.PLANNING_VIEW,
    PERMISSIONS.PLANNING_CREATE,
    PERMISSIONS.PLANNING_UPDATE,
    PERMISSIONS.PLANNING_SCHEDULE,
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.ANALYTICS_VIEW
  ],

  [ROLES.INVENTORY_MANAGER]: [
    // Manages parts and inventory
    PERMISSIONS.WO_VIEW,
    PERMISSIONS.WO_COMMENT,
    PERMISSIONS.EQUIPMENT_VIEW,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_CREATE,
    PERMISSIONS.INVENTORY_EDIT,
    PERMISSIONS.INVENTORY_DELETE,
    PERMISSIONS.INVENTORY_ISSUE,
    PERMISSIONS.INVENTORY_RECEIVE,
    PERMISSIONS.INVENTORY_ADJUST,
    PERMISSIONS.INVENTORY_TRANSFER,
    PERMISSIONS.INVENTORY_RESERVE,
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.ANALYTICS_VIEW
  ],

  [ROLES.WAREHOUSE_STAFF]: [
    PERMISSIONS.WO_VIEW,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_ISSUE,
    PERMISSIONS.INVENTORY_RECEIVE,
    PERMISSIONS.LOGISTICS_VIEW,
    PERMISSIONS.LOGISTICS_CREATE,
    PERMISSIONS.LOGISTICS_UPDATE,
    PERMISSIONS.DASHBOARD_VIEW
  ],

  [ROLES.HR_STAFF]: [
    PERMISSIONS.HR_VIEW,
    PERMISSIONS.HR_CREATE,
    PERMISSIONS.HR_UPDATE,
    PERMISSIONS.USER_MANAGE,
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.REPORT_VIEW
  ],

  [ROLES.PRODUCTION_STAFF]: [
    PERMISSIONS.WO_VIEW,
    PERMISSIONS.WO_CREATE,
    PERMISSIONS.WO_SUBMIT,
    PERMISSIONS.WO_COMMENT,
    PERMISSIONS.EQUIPMENT_VIEW,
    PERMISSIONS.PRODUCTION_VIEW,
    PERMISSIONS.PRODUCTION_CREATE,
    PERMISSIONS.PRODUCTION_UPDATE,
    PERMISSIONS.DASHBOARD_VIEW
  ],

  [ROLES.MANAGER]: [
    // Managers get all permissions in their domain
    PERMISSIONS.WO_VIEW,
    PERMISSIONS.WO_VIEW_ALL,
    PERMISSIONS.WO_CREATE,
    PERMISSIONS.WO_UPDATE,
    PERMISSIONS.WO_DELETE,
    PERMISSIONS.WO_SUBMIT,
    PERMISSIONS.WO_APPROVE,
    PERMISSIONS.WO_REJECT,
    PERMISSIONS.WO_ASSIGN,
    PERMISSIONS.WO_REASSIGN,
    PERMISSIONS.WO_START,
    PERMISSIONS.WO_COMPLETE,
    PERMISSIONS.WO_CLOSE,
    PERMISSIONS.WO_CANCEL,
    PERMISSIONS.WO_HOLD,
    PERMISSIONS.WO_COMMENT,
    PERMISSIONS.WO_ATTACH,
    PERMISSIONS.EQUIPMENT_VIEW,
    PERMISSIONS.EQUIPMENT_CREATE,
    PERMISSIONS.EQUIPMENT_EDIT,
    PERMISSIONS.EQUIPMENT_DELETE,
    PERMISSIONS.EQUIPMENT_HISTORY,
    PERMISSIONS.EQUIPMENT_METRICS,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_CREATE,
    PERMISSIONS.INVENTORY_EDIT,
    PERMISSIONS.INVENTORY_DELETE,
    PERMISSIONS.INVENTORY_ISSUE,
    PERMISSIONS.INVENTORY_RECEIVE,
    PERMISSIONS.INVENTORY_ADJUST,
    PERMISSIONS.INVENTORY_TRANSFER,
    PERMISSIONS.INVENTORY_RESERVE,
    PERMISSIONS.PM_VIEW,
    PERMISSIONS.PM_CREATE,
    PERMISSIONS.PM_EDIT,
    PERMISSIONS.PM_DELETE,
    PERMISSIONS.PM_EXECUTE,
    PERMISSIONS.CHECKLIST_VIEW,
    PERMISSIONS.CHECKLIST_CREATE,
    PERMISSIONS.CHECKLIST_UPDATE,
    PERMISSIONS.CHECKLIST_DELETE,
    PERMISSIONS.CHECKLIST_EXECUTE,
    PERMISSIONS.PLANNING_VIEW,
    PERMISSIONS.PLANNING_CREATE,
    PERMISSIONS.PLANNING_UPDATE,
    PERMISSIONS.PLANNING_SCHEDULE,
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.LOGISTICS_VIEW,
    PERMISSIONS.LOGISTICS_CREATE,
    PERMISSIONS.LOGISTICS_UPDATE,
    PERMISSIONS.LOGISTICS_DELETE,
    PERMISSIONS.HR_VIEW,
    PERMISSIONS.PRODUCTION_VIEW,
    PERMISSIONS.PRODUCTION_CREATE,
    PERMISSIONS.PRODUCTION_UPDATE,
    PERMISSIONS.AUDIT_VIEW
  ],

  [ROLES.ADMIN]: [
    // Admins get almost everything except super admin functions
    ...Object.values(PERMISSIONS).filter(p => p !== PERMISSIONS.SYSTEM_CONFIGURE)
  ],

  [ROLES.SUPER_ADMIN]: [
    // Super admins get everything
    ...Object.values(PERMISSIONS)
  ]
};

/**
 * Role Hierarchy
 * Higher roles inherit permissions from lower roles
 */
export const ROLE_HIERARCHY = {
  [ROLES.PUBLIC]: 0,
  [ROLES.USER]: 1,
  [ROLES.OPERATOR]: 2,
  [ROLES.TECHNICIAN]: 3,
  [ROLES.WAREHOUSE_STAFF]: 3,
  [ROLES.HR_STAFF]: 3,
  [ROLES.PRODUCTION_STAFF]: 3,
  [ROLES.PLANNER]: 4,
  [ROLES.INVENTORY_MANAGER]: 4,
  [ROLES.SUPERVISOR]: 5,
  [ROLES.MANAGER]: 6,
  [ROLES.ADMIN]: 7,
  [ROLES.SUPER_ADMIN]: 8
};

/**
 * Get all permissions for a role (including inherited)
 * @param {string} role - Role name
 * @returns {Array<string>} Array of permissions
 */
export function getRolePermissions(role) {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Check if a role has a specific permission
 * @param {string} role - Role name
 * @param {string} permission - Permission to check
 * @returns {boolean} True if role has permission
 */
export function roleHasPermission(role, permission) {
  const permissions = getRolePermissions(role);
  return permissions.includes(permission);
}

/**
 * Check if a role is higher in hierarchy than another
 * @param {string} role1 - First role
 * @param {string} role2 - Second role
 * @returns {boolean} True if role1 is higher than role2
 */
export function isRoleHigherThan(role1, role2) {
  return (ROLE_HIERARCHY[role1] || 0) > (ROLE_HIERARCHY[role2] || 0);
}

/**
 * Get the highest role from an array of roles
 * @param {Array<string>} roles - Array of role names
 * @returns {string} Highest role
 */
export function getHighestRole(roles) {
  return roles.reduce((highest, current) => {
    return isRoleHigherThan(current, highest) ? current : highest;
  }, ROLES.PUBLIC);
}

export default {
  ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  ROLE_HIERARCHY,
  getRolePermissions,
  roleHasPermission,
  isRoleHigherThan,
  getHighestRole
};
