# Authentication & Authorization Guide

This document explains how to use the authentication and authorization system in the application.

---

## 🎯 **Overview**

The system supports multiple authentication methods:
- **API Key**: Service-to-service authentication (current method)
- **Firebase Authentication**: User authentication via Google OAuth, email/password, etc.
- **JWT Tokens**: Custom token-based authentication (future)

Authorization is handled through:
- **Role-Based Access Control (RBAC)**: Users assigned roles with predefined permissions
- **Custom Permissions**: Additional permissions can be granted to specific users
- **Resource Ownership**: Users can access resources they own

---

## 🔑 **Authentication Methods**

### **1. API Key Authentication (Service-to-Service)**

**Use case**: Backend services, scripts, admin tools

**How it works**:
```bash
curl -X POST https://your-api.com/maintenance \
  -H "x-api-key: your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{"action": "register_incident", "data": {...}}'
```

**Features**:
- Simple header-based authentication
- Timing-attack safe comparison
- Full system access (acts as super admin)
- No user context

---

### **2. Firebase Authentication (User Authentication)**

**Use case**: Mobile apps, web apps, user-facing features

**How it works**:
```javascript
// Frontend: Get Firebase ID token after user signs in
const idToken = await firebase.auth().currentUser.getIdToken();

// Make API request with token
fetch('https://your-api.com/maintenance', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${idToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({...})
});
```

**Backend automatically**:
- Verifies the Firebase token
- Loads user profile from Firestore
- Attaches user object to request
- Checks permissions based on role

**Supported Firebase Auth providers**:
- Google OAuth ✅
- Email/Password ✅
- Phone Authentication ✅
- Custom Auth ✅

---

## 👥 **Roles & Permissions**

### **Available Roles** (in config/roles.js)

| Role | Level | Description | Use Case |
|------|-------|-------------|----------|
| `public` | 0 | No authentication | Public endpoints |
| `user` | 1 | Basic authenticated user | View-only access |
| `technician` | 2 | Maintenance staff | Create/update incidents |
| `warehouse_staff` | 2 | Logistics staff | Manage shipments |
| `hr_staff` | 2 | HR department | Manage employees |
| `production_staff` | 2 | Production floor | Create work orders |
| `supervisor` | 3 | Team supervisor | Assign incidents, close tickets |
| `manager` | 4 | Department manager | Full domain access |
| `admin` | 5 | System administrator | Almost full system access |
| `super_admin` | 6 | Super administrator | Complete system access |

### **Permission Categories**

```javascript
// Maintenance permissions
MAINTENANCE_VIEW
MAINTENANCE_CREATE
MAINTENANCE_UPDATE
MAINTENANCE_DELETE
MAINTENANCE_ASSIGN
MAINTENANCE_CLOSE

// Logistics permissions (future)
LOGISTICS_VIEW
LOGISTICS_CREATE
LOGISTICS_UPDATE
LOGISTICS_DELETE

// System permissions
USER_MANAGE
ROLE_MANAGE
SYSTEM_CONFIGURE
AUDIT_VIEW
```

---

## 🛠️ **Using Authentication in Routes**

### **Example 1: Public Endpoint (No Auth Required)**

```javascript
// routes/public.js
import express from 'express';

const router = express.Router();

// Anyone can access this
router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

export default router;
```

---

### **Example 2: API Key Only (Service-to-Service)**

```javascript
// routes/maintenance.js
import express from 'express';
import { verifyApiKey } from '../middleware/verifyApiKey.js';

const router = express.Router();

// Only API key authentication allowed
router.use(verifyApiKey);

router.post('/', handleMaintenanceAction);

export default router;
```

---

### **Example 3: User Authentication Required**

```javascript
// routes/incidents.js
import express from 'express';
import { requiredAuth } from '../middleware/authenticate.js';

const router = express.Router();

// User must be authenticated (Firebase token required)
router.use(requiredAuth);

router.get('/my-incidents', async (req, res) => {
  // req.user is automatically populated
  const incidents = await maintenanceService.query({
    reporter: req.user.email
  });

  res.json(successResponse(incidents));
});

export default router;
```

---

### **Example 4: Optional Authentication**

```javascript
// routes/incidents.js
import express from 'express';
import { optionalAuth } from '../middleware/authenticate.js';

const router = express.Router();

// Works for both authenticated and unauthenticated users
router.get('/public-incidents', optionalAuth, async (req, res) => {
  let incidents;

  if (req.isAuthenticated) {
    // Show more details to authenticated users
    incidents = await maintenanceService.findAll();
  } else {
    // Show limited info to public
    incidents = await maintenanceService.query({ status: 'Closed' });
  }

  res.json(successResponse(incidents));
});

export default router;
```

---

### **Example 5: Permission-Based Access**

```javascript
// routes/maintenance.js
import express from 'express';
import { requiredAuth, requirePermission } from '../middleware/authenticate.js';
import { PERMISSIONS } from '../config/roles.js';

const router = express.Router();

// All routes require authentication
router.use(requiredAuth);

// Anyone authenticated can view
router.get('/', (req, res) => {
  // ...
});

// Only users with MAINTENANCE_CREATE permission can create
router.post(
  '/',
  requirePermission(PERMISSIONS.MAINTENANCE_CREATE),
  async (req, res) => {
    // req.user has the required permission
    // ...
  }
);

// Only users with MAINTENANCE_DELETE permission can delete
router.delete(
  '/:id',
  requirePermission(PERMISSIONS.MAINTENANCE_DELETE),
  async (req, res) => {
    // ...
  }
);

export default router;
```

---

### **Example 6: Role-Based Access**

```javascript
// routes/admin.js
import express from 'express';
import { requiredAuth, requireRole } from '../middleware/authenticate.js';
import { ROLES } from '../config/roles.js';

const router = express.Router();

// Only admins and super admins can access
router.use(requiredAuth);
router.use(requireRole([ROLES.ADMIN, ROLES.SUPER_ADMIN]));

router.get('/users', async (req, res) => {
  // Only admins reach here
  const users = await UserService.getActiveUsers();
  res.json(successResponse(users));
});

export default router;
```

---

### **Example 7: Mixed Authentication (API Key OR User Auth)**

```javascript
// routes/maintenance.js
import express from 'express';
import { authenticate } from '../middleware/authenticate.js';

const router = express.Router();

// Accepts both API key and user authentication
router.use(authenticate({ required: true, allowApiKey: true }));

router.post('/', async (req, res) => {
  // Check if it's a service or user
  if (req.user.isService) {
    // API key authentication - full access
  } else {
    // User authentication - check permissions
    if (!hasPermission(req.user, PERMISSIONS.MAINTENANCE_CREATE)) {
      throw new ForbiddenError('Permission denied');
    }
  }

  // Process request
});

export default router;
```

---

## 🧪 **Using Permissions in Controllers**

### **Check Permissions Programmatically**

```javascript
// controllers/maintenanceController.js
import { hasPermission, requirePermission } from '../shared/utils/permissions.js';
import { PERMISSIONS } from '../config/roles.js';

export async function handleMaintenanceAction(req, res, next) {
  try {
    const { action, data } = req.body;

    // Option 1: Manual check
    if (action === 'delete_incident') {
      if (!hasPermission(req.user, PERMISSIONS.MAINTENANCE_DELETE)) {
        throw new ForbiddenError('You cannot delete incidents');
      }
    }

    // Option 2: Throw error if missing permission
    if (action === 'assign_incident') {
      requirePermission(req.user, PERMISSIONS.MAINTENANCE_ASSIGN);
    }

    // Process action
    const result = await maintenanceService[action](data);

    res.json(successResponse(result));
  } catch (err) {
    next(err);
  }
}
```

---

### **Check Resource Ownership**

```javascript
// controllers/maintenanceController.js
import { isOwner, requireOwnership } from '../shared/utils/permissions.js';
import { PERMISSIONS } from '../config/roles.js';

export async function updateIncident(req, res, next) {
  try {
    const { id } = req.params;
    const incident = await maintenanceService.findById(id);

    if (!incident) {
      throw new NotFoundError('Incident');
    }

    // Option 1: Check if user owns the incident OR has permission
    if (!isOwner(req.user, incident, 'reporter') &&
        !hasPermission(req.user, PERMISSIONS.MAINTENANCE_UPDATE)) {
      throw new ForbiddenError('You can only update your own incidents');
    }

    // Option 2: Require ownership (throws error if not owner)
    requireOwnership(req.user, incident, 'reporter');

    // Update incident
    const result = await maintenanceService.update(id, req.body);

    res.json(successResponse(result));
  } catch (err) {
    next(err);
  }
}
```

---

## 👤 **User Management**

### **Create User Profile** (when user first authenticates)

```javascript
import UserService from '../shared/services/UserService.js';
import { ROLES } from '../config/roles.js';

// When user signs up via Firebase Auth
const userProfile = await UserService.createUser({
  uid: firebaseUser.uid,
  email: firebaseUser.email,
  role: ROLES.TECHNICIAN,  // Assign appropriate role
  displayName: firebaseUser.displayName,
  photoURL: firebaseUser.photoURL
});
```

### **Update User Role**

```javascript
// Promote user to supervisor
await UserService.updateUserRole(uid, ROLES.SUPERVISOR);
```

### **Add Custom Permission**

```javascript
// Give user a special permission
await UserService.addPermission(uid, PERMISSIONS.MAINTENANCE_DELETE);
```

---

## 🔒 **Security Best Practices**

### **1. Always Use HTTPS in Production**
```javascript
if (config.server.isProduction && req.protocol !== 'https') {
  return res.redirect(`https://${req.hostname}${req.url}`);
}
```

### **2. Never Log Sensitive Data**
```javascript
// ❌ BAD
logInfo('User login', { password: user.password });

// ✅ GOOD
logInfo('User login', { uid: user.uid, email: user.email });
```

### **3. Validate Input Before Permission Checks**
```javascript
// Validate first
if (!data.incidentId) {
  throw new ValidationError('Incident ID is required');
}

// Then check permissions
requirePermission(req.user, PERMISSIONS.MAINTENANCE_UPDATE);
```

### **4. Use Least Privilege Principle**
```javascript
// Give users the minimum role needed
// Don't make everyone an admin!
const newUser = await UserService.createUser({
  uid,
  email,
  role: ROLES.USER  // Start with basic role
});
```

---

## 📊 **Migration Path**

### **Phase 1: Current (API Key Only)**
```javascript
// routes/maintenance.js
router.use(verifyApiKey);  // Only API key works
```

### **Phase 2: Add User Auth (Backward Compatible)**
```javascript
// routes/maintenance.js
router.use(authenticate({ allowApiKey: true }));  // Both work
```

### **Phase 3: Separate Public vs Protected Routes**
```javascript
// routes/maintenance/public.js
router.use(optionalAuth);  // Public endpoints

// routes/maintenance/protected.js
router.use(requiredAuth);  // User auth required
router.use(requirePermission(PERMISSIONS.MAINTENANCE_CREATE));
```

### **Phase 4: Remove API Key for User Endpoints**
```javascript
// routes/maintenance/user.js
router.use(userAuthOnly);  // No API keys allowed
```

---

## 🧪 **Testing**

### **Test with API Key**
```bash
curl -X GET https://your-api.com/maintenance \
  -H "x-api-key: your-api-key"
```

### **Test with Firebase Token**
```bash
# Get token from Firebase
TOKEN=$(firebase auth:login)

curl -X GET https://your-api.com/maintenance \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🎓 **Summary**

| Scenario | Middleware | Example |
|----------|-----------|---------|
| Public endpoint | None | `/health` |
| Service-to-service | `verifyApiKey` | Admin scripts |
| User required | `requiredAuth` | User dashboard |
| Optional auth | `optionalAuth` | Public listings |
| Permission check | `requirePermission` | Delete actions |
| Role check | `requireRole` | Admin panel |
| No API keys | `userAuthOnly` | Profile settings |

---

**Need help?** Check the example routes in `examples/authExamples.js`
