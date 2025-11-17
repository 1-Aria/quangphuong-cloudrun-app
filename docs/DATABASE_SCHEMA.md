# Database Schema Documentation

This document describes the Firestore database schema for the CMMS (Computerized Maintenance Management System).

## Overview

The system uses Google Cloud Firestore as the primary database. All collections follow a consistent structure with common fields and domain-specific fields.

## Common Fields

All documents in all collections include these standard fields:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Document ID (auto-generated or custom) |
| `createdAt` | timestamp | Document creation timestamp |
| `updatedAt` | timestamp | Last update timestamp |

## Collection Index

1. [work_orders](#1-work_orders) - Work order requests and tracking
2. [equipment](#2-equipment) - Equipment/asset registry
3. [inventory_items](#3-inventory_items) - Parts and materials inventory
4. [inventory_transactions](#4-inventory_transactions) - Inventory movement history
5. [checklist_templates](#5-checklist_templates) - Reusable maintenance checklists
6. [activity_logs](#6-activity_logs) - Immutable audit trail
7. [users](#7-users) - User profiles and authentication
8. [counters](#8-counters) - ID sequence generators

---

## 1. work_orders

Stores all work order requests, assignments, and execution details.

### Schema

```javascript
{
  // Identity
  id: string,                    // Firestore document ID
  workOrderId: string,           // Custom ID (e.g., "WO-0000123")

  // Basic Information
  title: string,                 // Work order title/summary
  description: string,           // Detailed description
  type: string,                  // "Breakdown", "Preventive", "Inspection", "Project", "Safety"
  priority: string,              // "Emergency", "High", "Medium", "Low"
  status: string,                // Current status (see state machine)

  // Equipment Reference
  equipmentId: string,           // Reference to equipment document
  equipmentName: string,         // Denormalized for quick access
  location: string,              // Equipment location

  // People
  requestedBy: string,           // User ID who requested
  requestedByName: string,       // Denormalized name
  assignedTo: string,            // User ID of assigned technician
  assignedToName: string,        // Denormalized name
  approvedBy: string,            // User ID who approved
  approvedByName: string,        // Denormalized name
  completedBy: string,           // User ID who completed
  completedByName: string,       // Denormalized name

  // Planning
  estimatedHours: number,        // Estimated labor hours
  actualHours: number,           // Actual labor hours
  scheduledStartDate: timestamp, // Planned start
  scheduledEndDate: timestamp,   // Planned completion

  // Execution
  actualStartDate: timestamp,    // When work actually started
  actualEndDate: timestamp,      // When work actually ended
  workPerformed: string,         // Description of work done
  rootCause: string,             // Root cause analysis
  preventiveAction: string,      // Preventive actions taken

  // Parts & Inventory
  partsRequired: [               // Array of required parts
    {
      partId: string,
      partName: string,
      quantity: number,
      quantityIssued: number,
      quantityReturned: number,
      unitCost: number
    }
  ],
  totalPartsCost: number,        // Sum of parts costs

  // Checklist
  checklistTemplateId: string,   // Reference to checklist template
  checklistItems: [              // Checklist execution
    {
      itemId: string,
      description: string,
      completed: boolean,
      completedBy: string,
      completedAt: timestamp,
      result: string,            // "Pass", "Fail", "N/A"
      notes: string
    }
  ],

  // SLA Tracking
  slaResponseDeadline: timestamp,   // When response is due
  slaCompletionDeadline: timestamp, // When completion is due
  responseTime: number,             // Actual response time (minutes)
  completionTime: number,           // Actual completion time (hours)
  slaResponseMet: boolean,          // Whether response SLA was met
  slaCompletionMet: boolean,        // Whether completion SLA was met

  // State History
  statusHistory: [               // State transition log
    {
      from: string,
      to: string,
      changedBy: string,
      changedAt: timestamp,
      reason: string
    }
  ],

  // Comments & Attachments
  comments: [
    {
      commentId: string,
      userId: string,
      userName: string,
      text: string,
      timestamp: timestamp
    }
  ],
  attachments: [
    {
      fileId: string,
      fileName: string,
      fileUrl: string,
      fileType: string,
      uploadedBy: string,
      uploadedAt: timestamp
    }
  ],

  // Metadata
  tags: [string],                // Searchable tags
  customFields: object,          // Extensible custom data

  // Timestamps
  createdAt: timestamp,
  updatedAt: timestamp,
  submittedAt: timestamp,
  approvedAt: timestamp,
  assignedAt: timestamp,
  startedAt: timestamp,
  completedAt: timestamp,
  closedAt: timestamp
}
```

### Status Flow

```
Draft → Submitted → Approved → Assigned → In Progress → Completed → Closed
                              ↓
                         On Hold / Pending Parts / Cancelled
```

### Indexes Required

```javascript
// Composite indexes for efficient querying
- status + priority (for dashboard queries)
- assignedTo + status (for technician workload)
- equipmentId + status (for equipment history)
- slaCompletionDeadline + status (for SLA monitoring)
- type + status + createdAt (for analytics)
```

---

## 2. equipment

Equipment and asset registry with maintenance history.

### Schema

```javascript
{
  // Identity
  id: string,                    // Firestore document ID
  equipmentId: string,           // Custom ID (e.g., "EQ-000456")

  // Basic Information
  name: string,                  // Equipment name
  description: string,           // Equipment description
  manufacturer: string,          // Manufacturer name
  model: string,                 // Model number
  serialNumber: string,          // Serial number
  assetTag: string,              // Asset tag number

  // Classification
  category: string,              // Equipment category
  type: string,                  // Equipment type
  criticalityLevel: string,      // "Critical", "High", "Medium", "Low"

  // Location
  location: string,              // Physical location
  department: string,            // Owning department
  building: string,              // Building name/number
  floor: string,                 // Floor level
  room: string,                  // Room number

  // Status
  status: string,                // "Operational", "Down", "Under Maintenance", "Retired"
  condition: string,             // "Excellent", "Good", "Fair", "Poor"

  // Specifications
  specifications: {
    power: string,               // Power requirements
    voltage: string,
    capacity: string,
    dimensions: string,
    weight: string,
    customSpecs: object          // Additional specs
  },

  // Dates
  installationDate: timestamp,   // When installed
  commissionDate: timestamp,     // When commissioned
  warrantyStartDate: timestamp,  // Warranty start
  warrantyEndDate: timestamp,    // Warranty end
  lastMaintenanceDate: timestamp,// Last maintenance
  nextMaintenanceDate: timestamp,// Next scheduled maintenance

  // Maintenance Tracking
  totalWorkOrders: number,       // Count of work orders
  totalDowntime: number,         // Total downtime hours
  mtbf: number,                  // Mean Time Between Failures (hours)
  mttr: number,                  // Mean Time To Repair (hours)

  // Preventive Maintenance
  pmSchedule: {
    enabled: boolean,
    frequency: string,           // "Daily", "Weekly", "Monthly", "Quarterly", "Annual"
    intervalDays: number,        // Days between PM
    lastPM: timestamp,
    nextPM: timestamp,
    checklistTemplateId: string
  },

  // Documents & Manuals
  documents: [
    {
      documentId: string,
      title: string,
      type: string,              // "Manual", "Drawing", "Certificate", "Warranty"
      fileUrl: string,
      uploadedAt: timestamp
    }
  ],

  // Parts List
  associatedParts: [             // Common parts for this equipment
    {
      partId: string,
      partName: string,
      quantity: number,          // Quantity per service
      critical: boolean
    }
  ],

  // Cost Tracking
  purchaseCost: number,
  currentValue: number,
  totalMaintenanceCost: number,

  // Metadata
  notes: string,
  tags: [string],
  customFields: object,

  // Timestamps
  createdAt: timestamp,
  updatedAt: timestamp,
  retiredAt: timestamp
}
```

### Indexes Required

```javascript
- status + location (for location-based queries)
- category + status (for category reports)
- criticalityLevel + status (for critical equipment monitoring)
- nextMaintenanceDate (for PM scheduling)
```

---

## 3. inventory_items

Parts, materials, and consumables inventory.

### Schema

```javascript
{
  // Identity
  id: string,
  partId: string,                // Custom ID (e.g., "PT-001234")

  // Basic Information
  partNumber: string,            // Manufacturer part number
  name: string,                  // Part name
  description: string,           // Part description
  category: string,              // Part category
  type: string,                  // Part type

  // Supplier Information
  manufacturer: string,
  supplier: string,
  supplierPartNumber: string,
  leadTimeDays: number,          // Lead time for ordering

  // Inventory Levels
  quantityOnHand: number,        // Current quantity
  quantityReserved: number,      // Quantity reserved for work orders
  quantityAvailable: number,     // On hand - reserved
  reorderPoint: number,          // When to reorder
  reorderQuantity: number,       // How much to reorder
  minQuantity: number,           // Minimum stock level
  maxQuantity: number,           // Maximum stock level

  // Location
  location: string,              // Storage location
  bin: string,                   // Bin number
  shelf: string,                 // Shelf location
  warehouse: string,             // Warehouse name

  // Cost
  unitCost: number,              // Cost per unit
  averageCost: number,           // Moving average cost
  lastPurchasePrice: number,     // Last purchase price
  totalValue: number,            // Quantity * average cost

  // Units
  unitOfMeasure: string,         // "Each", "Box", "Liter", etc.

  // Status
  status: string,                // "Active", "Inactive", "Discontinued"
  stockStatus: string,           // "In Stock", "Low Stock", "Out of Stock", "On Order"

  // Usage Tracking
  totalIssued: number,           // Total quantity issued
  totalReceived: number,         // Total quantity received
  averageMonthlyUsage: number,   // Average usage per month
  lastIssuedDate: timestamp,     // When last issued
  lastReceivedDate: timestamp,   // When last received

  // Equipment Associations
  usedInEquipment: [string],     // Array of equipment IDs

  // Metadata
  notes: string,
  tags: [string],
  customFields: object,

  // Timestamps
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### Indexes Required

```javascript
- status + stockStatus (for inventory monitoring)
- category + status (for category reports)
- quantityAvailable (for low stock alerts)
- partNumber (for quick lookup)
```

---

## 4. inventory_transactions

Complete history of all inventory movements.

### Schema

```javascript
{
  // Identity
  id: string,
  transactionId: string,         // Custom ID (e.g., "INV-0000789")

  // Transaction Details
  type: string,                  // "Issue", "Receive", "Adjust", "Transfer", "Return"
  partId: string,                // Reference to inventory item
  partName: string,              // Denormalized

  // Quantities
  quantity: number,              // Transaction quantity
  beforeQuantity: number,        // Quantity before transaction
  afterQuantity: number,         // Quantity after transaction

  // Cost
  unitCost: number,
  totalCost: number,             // Quantity * unit cost

  // References
  workOrderId: string,           // Related work order (if applicable)
  equipmentId: string,           // Related equipment (if applicable)

  // Location
  fromLocation: string,          // Source location (for transfers)
  toLocation: string,            // Destination location

  // People
  issuedBy: string,              // User ID who performed transaction
  issuedByName: string,
  receivedBy: string,            // User ID who received
  receivedByName: string,

  // Reason & Notes
  reason: string,                // Transaction reason
  notes: string,                 // Additional notes

  // Approval (for high-value transactions)
  requiresApproval: boolean,
  approvalStatus: string,        // "Pending", "Approved", "Rejected"
  approvedBy: string,
  approvedAt: timestamp,

  // Metadata
  transactionDate: timestamp,    // When transaction occurred

  // Timestamps
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### Indexes Required

```javascript
- partId + transactionDate (for part history)
- workOrderId (for work order parts tracking)
- type + transactionDate (for transaction reports)
- transactionDate (for time-based queries)
```

---

## 5. checklist_templates

Reusable checklist templates for maintenance procedures.

### Schema

```javascript
{
  // Identity
  id: string,
  checklistId: string,           // Custom ID (e.g., "CK-00123")

  // Basic Information
  name: string,                  // Template name
  description: string,           // Template description
  category: string,              // Checklist category
  type: string,                  // Maintenance type

  // Applicability
  equipmentTypes: [string],      // Which equipment types this applies to
  equipmentIds: [string],        // Specific equipment (optional)

  // Items
  items: [
    {
      itemId: string,            // Unique item ID
      sequence: number,          // Display order
      description: string,       // What to check
      type: string,              // "Check", "Measure", "Inspect", "Replace"
      required: boolean,         // Is this item required?
      expectedValue: string,     // Expected value/range
      unit: string,              // Unit of measurement
      passFailCriteria: string,  // When to pass/fail
      instructions: string,      // Detailed instructions
      safetyNotes: string,       // Safety considerations
      attachmentRequired: boolean // Photo/doc required?
    }
  ],

  // Estimated Time
  estimatedDurationMinutes: number,

  // Status
  status: string,                // "Active", "Draft", "Archived"
  version: number,               // Version number

  // Metadata
  createdBy: string,
  updatedBy: string,
  tags: [string],

  // Timestamps
  createdAt: timestamp,
  updatedAt: timestamp,
  lastUsedAt: timestamp
}
```

---

## 6. activity_logs

Immutable audit trail of all system activities.

### Schema

```javascript
{
  // Identity
  id: string,
  activityId: string,            // Custom ID (e.g., "AL-00000001")

  // Activity Information
  activityType: string,          // Activity type constant
  entityType: string,            // "work_order", "equipment", "inventory", etc.
  entityId: string,              // ID of affected entity

  // User Information
  userId: string,                // Who performed the action
  userName: string,              // User display name
  userRole: string,              // User's role at time of action

  // Details
  description: string,           // Human-readable description
  changes: {                     // Before/after values
    before: object,
    after: object
  },
  metadata: object,              // Additional context

  // Severity
  severity: string,              // "info", "warning", "error", "critical"

  // Request Context
  ipAddress: string,
  userAgent: string,

  // Timestamp
  timestamp: timestamp,
  createdAt: timestamp
}
```

### Indexes Required

```javascript
- entityType + entityId + timestamp (for entity history)
- userId + timestamp (for user activity)
- activityType + timestamp (for activity reports)
- severity + timestamp (for error monitoring)
```

---

## 7. users

User profiles and authentication information.

### Schema

```javascript
{
  // Identity
  id: string,                    // Firestore document ID
  userId: string,                // Custom ID (e.g., "USR-000001")
  firebaseUid: string,           // Firebase Auth UID

  // Basic Information
  email: string,
  displayName: string,
  firstName: string,
  lastName: string,
  phoneNumber: string,

  // Role & Permissions
  role: string,                  // Primary role
  roles: [string],               // Multiple roles (if applicable)
  permissions: [string],         // Explicit permissions

  // Employment
  employeeId: string,
  department: string,
  position: string,
  supervisor: string,            // User ID of supervisor

  // Status
  status: string,                // "Active", "Inactive", "Suspended"
  isVerified: boolean,

  // Skills & Certifications
  skills: [string],
  certifications: [
    {
      name: string,
      issuedDate: timestamp,
      expiryDate: timestamp,
      documentUrl: string
    }
  ],

  // Preferences
  preferences: {
    language: string,
    timezone: string,
    notifications: {
      email: boolean,
      push: boolean,
      sms: boolean
    }
  },

  // Metadata
  lastLoginAt: timestamp,
  lastActivityAt: timestamp,

  // Timestamps
  createdAt: timestamp,
  updatedAt: timestamp
}
```

---

## 8. counters

ID sequence generators for custom IDs.

### Schema

```javascript
{
  // Identity (document ID is the entity type)
  id: string,                    // e.g., "work_orders", "equipment"

  // Counter
  value: number,                 // Current counter value

  // Timestamps
  createdAt: timestamp,
  lastUpdated: timestamp,
  lastReset: timestamp           // When counter was last reset
}
```

### Documents

- `work_orders` - Counter for work order IDs
- `equipment` - Counter for equipment IDs
- `parts` - Counter for part IDs
- `inventory_transactions` - Counter for transaction IDs
- `checklists` - Counter for checklist IDs
- `users` - Counter for user IDs
- `activity_logs` - Counter for activity log IDs

---

## Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }

    function hasRole(role) {
      return isAuthenticated() &&
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == role;
    }

    function hasAnyRole(roles) {
      return isAuthenticated() &&
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in roles;
    }

    // Work Orders
    match /work_orders/{workOrderId} {
      allow read: if isAuthenticated();
      allow create: if hasAnyRole(['operator', 'technician', 'planner', 'supervisor', 'manager', 'admin']);
      allow update: if hasAnyRole(['technician', 'planner', 'supervisor', 'manager', 'admin']);
      allow delete: if hasAnyRole(['supervisor', 'manager', 'admin']);
    }

    // Equipment
    match /equipment/{equipmentId} {
      allow read: if isAuthenticated();
      allow create: if hasAnyRole(['planner', 'supervisor', 'manager', 'admin']);
      allow update: if hasAnyRole(['planner', 'supervisor', 'manager', 'admin']);
      allow delete: if hasAnyRole(['manager', 'admin']);
    }

    // Inventory Items
    match /inventory_items/{partId} {
      allow read: if isAuthenticated();
      allow create, update: if hasAnyRole(['inventory_manager', 'manager', 'admin']);
      allow delete: if hasAnyRole(['manager', 'admin']);
    }

    // Inventory Transactions (immutable)
    match /inventory_transactions/{transactionId} {
      allow read: if isAuthenticated();
      allow create: if hasAnyRole(['technician', 'inventory_manager', 'warehouse_staff', 'manager', 'admin']);
      allow update, delete: if false; // Transactions are immutable
    }

    // Activity Logs (immutable)
    match /activity_logs/{logId} {
      allow read: if hasAnyRole(['supervisor', 'manager', 'admin']);
      allow create: if isAuthenticated();
      allow update, delete: if false; // Logs are immutable
    }

    // Users
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow create, update: if hasAnyRole(['admin', 'super_admin']);
      allow delete: if hasRole('super_admin');
    }

    // Counters
    match /counters/{counterId} {
      allow read: if isAuthenticated();
      allow write: if false; // Only writable via Cloud Functions
    }
  }
}
```

---

## Migration Strategy

### Phase 1: Parallel Operation
- Keep existing `incidents` collection
- New work orders go to `work_orders` collection
- Both systems operate simultaneously

### Phase 2: Data Migration
- Migrate historical incidents to work orders
- Preserve all data and history
- Map old statuses to new state machine

### Phase 3: Cutover
- Redirect all reads to `work_orders`
- Mark `incidents` as deprecated
- Archive old collection after verification

---

## Backup & Recovery

- **Automated Backups**: Daily Firestore exports to Cloud Storage
- **Retention**: 30 days of daily backups
- **Recovery**: Point-in-time recovery within 7 days
- **Testing**: Monthly backup restoration tests

---

## Performance Considerations

1. **Denormalization**: User names, equipment names are denormalized for read performance
2. **Composite Indexes**: Create indexes for common query patterns
3. **Pagination**: Use cursor-based pagination for large result sets
4. **Document Size**: Keep documents under 1MB (Firestore limit)
5. **Collection Groups**: Not used initially, may be added for cross-domain queries

---

## Monitoring

Track these metrics:
- Document read/write operations
- Query performance
- Index usage
- Document size growth
- Collection size trends
