Overview & scope

This design covers the core maintenance workflow (report → approve → assign → execute → verify → close → reopen), plus:

Asset management linkage

Inventory / parts reservation (basic)

Reassignment & escalation rules

Checklists & attachments

Audit trail & immutable activity log

SLA rules & auto-escalations

Dashboards and reporting KPIs

Mobile/offline UX behavior and minimal offline sync rules

Not included (can be phased later): IoT telemetry ingestion, predictive analytics, advanced scheduling optimization.

1. Primary actors & roles (functional)

Operator — reports problems, confirms production impact, can reopen.

Technician — executes work, updates status, logs time/parts.

Planner — approves requests, schedules work, reserves parts, assigns/reassigns.

Supervisor — verifies completion, enforces quality, closes tickets, can reopen.

Inventory Manager — manages parts inventory and adjustments.

System (Automations) — creates PM tasks, triggers notifications and SLA escalations.

Admin — configure system master data, roles, permissions, templates.

Role mapping (who can do what) is in RBAC section.

2. Key entities (full attribute list)

Each entity includes mandatory fields, types, validation rules, and description.

2.1 Ticket / WorkOrder

Represents a single maintenance job.

Core fields (suggested DB column names / keys):

{
  "id": "WO-0000123",                 // string, unique
  "createdAt": "2025-11-13T08:10:00Z",
  "createdBy": "user:operator:123",   // reference
  "reportedAt": "2025-11-13T08:05:00Z", 
  "title": "Hydraulic leak - Press #5",  // short, <= 120 chars
  "description": "Oil leaking from cylinder. Visible puddle near base.",
  "equipmentId": "EQ-PL-PR-005",       // optional but recommended
  "location": "Line A - Press Bay 2",  // auto from equipment if linked
  "category": "Mechanical/Fluid/Leak", // category taxonomy
  "subCategory": "Hydraulic Cylinder",
  "priority": "P1",                    // P1-P4 (see priority rules)
  "impact": "Production",              // Impact: Safety/Production/Quality/Maintenance
  "status": "CREATED",                 // see lifecycle states
  "assignment": {
     "assignedTo": null,               // user id or team id
     "assignedAt": null,
     "assignedBy": null
  },
  "plannedStartAt": null,
  "plannedEndAt": null,
  "actualStartAt": null,
  "actualEndAt": null,
  "laborHours": 0.0,
  "partsUsed": [ { "partId": "P-123", "qty": 2 } ],
  "estimatedDowntimeMinutes": 0,
  "downtimeMinutes": 0,
  "isSafetyCritical": false,
  "attachments": [ "fileId1", "fileId2" ],
  "checklist": [ { "id":"chk1", "label":"Is LOTO applied?", "result":"pass" } ],
  "rootCause": null,
  "resolutionSummary": null,
  "verifiedBy": null,
  "verifiedAt": null,
  "closedBy": null,
  "closedAt": null,
  "reopenCount": 0,
  "relatedTickets": [ "WO-..."],
  "sla": { "responseBy": "2025-11-13T08:30:00Z", "resolveBy": "2025-11-13T10:00:00Z" }
}


Validation rules:

title, createdBy, createdAt, status are required on create.

equipmentId recommended; if provided, location auto-fill.

priority computed from impact + urgency or allowed to be set by planner.

Dates must be ISO8601 UTC strings.

2.2 Equipment / Asset
{
  "id": "EQ-PL-PR-005",
  "name": "Hydraulic Press #5",
  "tag": "PR-05",
  "location": "Line A - Press Bay 2",
  "parentId": "EQ-PL-PR",
  "type": "Hydraulic Press",
  "manufacturer": "Acme Co",
  "model": "H-200",
  "serial": "SN-12345",
  "runtimeHours": 12540,
  "lastPMAt": "2025-10-01T00:00:00Z",
  "pmIntervalHours": 500,
  "criticality": "High", // Low/Medium/High/Critical
  "spareParts": ["P-123","P-321"], // quick lookup
  "status": "Operational", // Operational/Down/UnderMaintenance
  "history": [ "WO-0001" ]
}

2.3 User
{
  "id": "user:tech:234",
  "name": "Nguyen Van A",
  "role": "Technician",
  "teams": ["Electrical"],
  "skills": ["Hydraulics","PLC"],
  "shift": { "start":"07:00","end":"15:00","timezone":"Asia/Ho_Chi_Minh" },
  "contact": { "phone":"+84...", "email":"..." }
}

2.4 Part / InventoryItem (basic)
{
  "id": "P-123",
  "name": "Hydraulic Seal 50mm",
  "stockQty": 120,
  "reorderPoint": 10,
  "location": "Stores Bay A",
  "unitCost": 3.5
}

2.5 Checklist Template

A list of steps to be shown on job execution. Each checklist item can be required/optional and allow pass/fail/details/attachment.

2.6 Activity Log (Audit)

Immutable log entries for every action:

{
  "id": "act-0001",
  "timestamp": "...",
  "userId": "user:planner:11",
  "action": "ASSIGNED",
  "targetId": "WO-0000123",
  "details": { "from": null, "to": "user:tech:234", "reason":"planner scheduled" }
}

3. Ticket lifecycle (state machine) & transitions

Canonical states:

CREATED — new request, awaiting review.

APPROVED — planner approved and ready for scheduling.

ASSIGNED — assigned to technician (status keeps assignee).

IN_PROGRESS — technician started work.

ON_HOLD — paused for parts, vendor, or production reasons.

COMPLETED — technician finished work and marked complete (requires verification).

VERIFIED — supervisor validated fix.

CLOSED — final; ticket resolved and closed.

REOPENED — reopened after closure.

CANCELLED — request cancelled (invalid, duplicate, scheduled elsewhere).

Transitions and who may trigger them:

CREATED -> APPROVED

Trigger: Planner approves. (Auto-approve rule possible.)

Validation: Planner must set priority and plannedStartAt if required.

CREATED -> CANCELLED

Trigger: Planner or Admin (duplicate or invalid). Must include cancelReason.

APPROVED -> ASSIGNED

Trigger: Planner assigns to technician/team. Sets assignment.assignedTo.

ASSIGNED -> IN_PROGRESS

Trigger: Technician clicks “Start Work”. Sets actualStartAt.

IN_PROGRESS -> ON_HOLD

Trigger: Technician requests hold (parts, production stop). Must provide holdReason.

ON_HOLD -> IN_PROGRESS

Trigger: Technician resumes work.

IN_PROGRESS -> COMPLETED

Trigger: Technician marks complete; they must fill required checklist items and partsUsed.

COMPLETED -> VERIFIED

Trigger: Supervisor verifies (may require test run or production confirmation).

VERIFIED -> CLOSED

Trigger: System or Supervisor closes. closedAt set.

CLOSED -> REOPENED

Trigger: Operator or Supervisor reopens. Increment reopenCount. Create link to previous WO.

Any -> REASSIGNED (logical transition)

Trigger: Planner/Supervisor initiates reassignment; Technician may request reassignment (creates a note and optional reassignRequest flag) but cannot directly change assignedTo.

Business rules:

Only Planner or Supervisor can change priority (unless configured to allow automatic priority).

Reassignment must record reason, from, to, and requestedBy.

Each status transition writes an Activity Log entry.

SLA/timeouts:

responseBy (time to acknowledge / assign) and resolveBy (target resolution) computed on create.

If responseBy missed, auto-escalate to Supervisor and create ACTIVITY: ESCALATION.

If resolveBy missed, escalate to Maintenance Manager and show on dashboard.

4. Reassignment rules (detailed)

Who can initiate:

Planner / Supervisor / Admin — can directly reassign any active ticket.

Technician — can request reassignment (creates reassign request record, not immediate reassign). System notifies Planner.

When to reassign (examples):

Wrong skillset (electrical vs mechanical).

Requires vendor or spare part not available.

Schedule conflict (shift off).

Safety or permit required.

Handling:

Technician marks: "Needs Reassignment" with reason + suggested team.

Planner receives notification and either:

Reassigns immediately (preferred).

Schedules a follow-up and adds comment.

Reassignment action updates assignment block and appends audit log.

If reassigned while IN_PROGRESS, actualStopAt is set (if needed) and laborHours recorded.

Reassignment constraints:

Cannot reassign a CLOSED ticket (must reopen).

If ticket is reassigned to a vendor, create a vendor work order link and set onVendor = true.

Auto-reassign:

Optional rule: If assignedTo doesn't accept within N minutes (e.g., 30 min), auto-assign to fallback user/team in the same skill pool and step up escalation.

5. Approvals & validations

Approval flows:

Safety-critical or high-cost repairs (above configurable cost threshold) require Supervisor approval before ASSIGNED → enforce APPROVED state.

Optional: multi-level approvals for CAPEX.

Validation rules:

Safety-critical job cannot move to IN_PROGRESS without LOTO confirmation checkbox checked.

COMPLETED requires all mandatory checklist items to be answered.

partsUsed cannot exceed available stockQty unless allowNegativeStock is permitted.

plannedStartAt must be within shift hours and not overlap with planned downtime unless approved.

6. UI / Screen design (functional spec for each screen)

I describe screen, fields, required UX behavior and acceptance.

6.1 Create Ticket (mobile-first)

Accessible via big “+ Create” CTA.

Pre-fill equipment by scanning barcode, QR, or selecting from recent list.

Fields:

Title (required, auto-suggest from templates)

Equipment (required if operator selects) — autolink to equipment

Location (auto)

Category / subCategory (suggest top 3 based on equipment history)

Priority (auto computed; operator can select Low/Medium/High visually)

Urgency (radio: Immediate / Next Shift / Routine)

Description (multiline)

Attach photos/video (max file size & count)

Safety checkbox: "Is it a safety issue?" (if yes, mark isSafetyCritical)

Estimated impact: dropdown (Production / Quality / Safety / None)

Submit behavior:

Minimal required fields checked (title, createdBy, createdAt).

On submit, show success toast and go to Ticket Detail screen.

Offline:

If offline, queue locally and sync when online. Mark ticket with syncPending and show local temporary id.

Acceptance:

Operator can create ticket in <= 30 seconds on mobile.

Attachments upload progress visible.

6.2 Ticket Detail (primary workspace)

Top area: Title, equipment, status badge, priority, location, assignedTo, SLA counters (time to response/resolution).

Tabs/sections:

Overview (description, attachments)

Timeline (activity log — chronological)

Checklist & Tasks

Parts & Inventory

Comments (chat-style messages)

Related tickets

Actions (visible by role & state):

Operator: Add comment, confirm operational (post-close), reopen (if closed).

Technician: Accept / Start Work / Pause / Complete / Request Reassignment / Add parts / Log labor / Upload attachment / Add checklist result.

Planner: Approve / Assign / Reassign / Change priority / Add plannedStartAt / Reserve parts.

Supervisor: Verify / Close / Reopen.

Inline validations:

Prevent "Complete" unless required checklists passed.

Prevent "Start" if LOTO not completed (if safetyCritical & LOTO required).

Acceptance:

All actions append to Activity Log with timestamp and user.

SLA timers update live.

6.3 Assignment modal

Fields:

Assign to (user or team)

Planned start/end

Estimated downtime

Parts to reserve

Priority override (if needed)

Notes (visible to assignee)

Business rules:

List only technicians with required skills (filter by skill tag).

Show technician availability & current workload score (computed).

Planner must confirm reservation of required parts or mark parts backordered.

6.4 Technician Workpad (mobile/field UI)

Visible large buttons: START | PAUSE | COMPLETE

Checklist with toggles and optional inputs

Parts picklist; allow scanning parts to consume from inventory

Time logger: auto-timer when START pressed (option to manually log)

Photo before/after and comment box

Safety/LOTO checklist with mandatory confirmation

Acceptance:

START sets actualStartAt; timer continues until COMPLETE/PAUSE.

Pausing records pauseReason and pauseAt.

6.5 Supervisor Verification modal

Displays completed checklist, photos, parts used, labor, test logs.

"Verify" button requires comment and final status (Operational / Limited / Failed).

If not verified, use "Return to Technician" with remarks.

6.6 Dashboard (Planner / Supervisor)

Widgets:

Open tickets by priority

Overdue & SLA breach list

Downtime by equipment

Technician workload heatmap

Quick filters: By line, by equipment type, by team

Acceptance:

Dashboard filters persist between sessions.

Clicking item navigates to ticket.

7. Notifications & templates

Channels: In-app push, email, SMS (optional), webhook.

Key events & recipients:

Ticket created → Planner (and optionally team supervisor) — subject: [NEW] WO-000123: title

Ticket assigned → Assignee

Assignment acceptance overdue → Planner & Supervisor (escalation)

Ticket status changed → Creator & relevant watchers

SLA near breach (T minus 30 min) → Assignee & Supervisor

SLA breached → Supervisor & Maintenance Manager

Parts backordered → Planner & Inventory Manager

Ticket completed → Supervisor (for verification)

Ticket closed → Creator & watchers

Notification payload example (JSON):

{
  "type":"ticket_assigned",
  "to":["user:tech:234"],
  "ticketId":"WO-0000123",
  "title":"Hydraulic leak - Press #5",
  "summary":"Assigned by planner Nguyen",
  "link":"/tickets/WO-0000123"
}


Templates should include:

Short summary

Priority label

Direct link to ticket

ETA or SLA counters if relevant

8. Inventory / Parts functional behavior

Basic flows:

Planner reserves parts when assigning a job. Reservation reduces availableForReservation but not stockQty until consumed.

Technician consumes parts when marking COMPLETE; consumption reduces stockQty.

If stockQty < required qty at reservation time, the planner can:

Reserve partial and create PO (out of scope), OR

Mark backordered and set expectedRestockAt.

Constraints:

Options to allow negative stock (config).

Auto notify Inventory Manager when stockQty <= reorderPoint.

Fields to track at ticket level:

partsReserved: list with reservedQty and reservationId.

partsConsumed: actual used qty.

Acceptance:

Reservation shows in Inventory UI; consumption reconciles reservation.

If consumed more than reserved, create adjustment entry in inventory log.

9. Checklists & templates

Checklists can be created per equipment type or per ticket template.

Each checklist item:

id, label, required(true/false), inputType (boolean/text/number/photo), passCriteria

Technician must complete required items before completing job.

Checklist results stored on ticket with user, timestamp, and attachments.

Use cases:

Safety LOTO steps as required checklist for safetyCritical tickets.

10. SLA & Escalation engine (functional spec)

SLA types:

Response SLA: time from createdAt to assignment.acceptedAt.

Resolution SLA: time from assignedAt to closedAt.

SLA configuration per priority:

Priority	Response SLA	Resolution SLA
P1	15 minutes	2 hours
P2	1 hour	8 hours
P3	4 hours	48 hours
P4	1 business day	5 business days

Rules:

On create, ticket gets sla.responseBy and sla.resolveBy computed (consider working hours/shifts).

On SLA breach, create ACTIVITY: SLA_BREACH and escalate to configured role(s).

Allow SLA pause when ticket is ON_HOLD.

SLA timers visible on ticket and dashboard.

Escalation chain:

T+0 miss: notify Supervisor.

T+1 escalationWindow miss: notify Plant Manager and auto-create "escalation ticket" if not responded.

11. Search, filters, and sorting (UX functional)

Global search: ticket id, equipment tag, part id, user name.

Filters: status, priority, equipment, team, date range, verified/unverified, safetyCritical.

Saved filters for Planner roles.

Sorting options: SLA urgency (default), createdAt, plannedStartAt.

12. Data quality & automations

Smart defaults:

Priority suggestion from equipment criticality + impact.

Auto-suggest categories from last 3 similar tickets on same equipment.

Duplicate detection:

If same equipment has open ticket with same category in last X minutes, warn creator and suggest linking.

Auto-close policy:

If COMPLETED and no verification after configurable grace period (e.g., 3 days), auto-close and notify stakeholders. Alternatively require Supervisor to close in safetyCritical jobs.

Retention:

Activity logs and closed tickets retained per company policy; provide archiving APIs.

13. API-like functional endpoints (logical, not prescriptive)

Provide developers with typical endpoints to implement.

POST /workorders — create ticket (payload: Ticket create payload)

GET /workorders/:id — get ticket detail

PATCH /workorders/:id — update (limited fields, status transitions validated by backend)

POST /workorders/:id/assign — assign to user/team (payload: assignee, plannedStartAt)

POST /workorders/:id/start — technician start work

POST /workorders/:id/pause — pause with reason

POST /workorders/:id/complete — complete with partsUsed, checklist results, laborHours

POST /workorders/:id/verify — supervisor verify (payload: status, comment)

POST /workorders/:id/reopen — reopen (payload: reason, reopenedBy)

POST /workorders/:id/reassign-request — technician request reassign

POST /workorders/:id/attachments — upload files

GET /workorders — list with filters

POST /equipment / GET /equipment/:id

POST /inventory/reserve — reserve parts for a ticket

POST /sla/escalate — internal webhook for SLA actions (system use)

Each API must validate state transitions and create an Activity log entry. All endpoints should return updated ticket and activity entries.

14. Acceptance criteria / test cases (QA-ready)

Provide sample tests for each major flow:

TC-001 Create Ticket

Given an operator with mobile app, when they submit Title + Equipment, then ticket is created with CREATED status and planner receives notification.

TC-002 Approve and Assign

Given ticket CREATED, planner approves and assigns to tech A, ticket moves to ASSIGNED, SLA responseBy set.

TC-003 Technician Start & Complete

Tech accepts, starts, fills checklist, uses parts (stock reduces), marks complete. Ticket moves to COMPLETED and actualStartAt/actualEndAt set.

TC-004 Supervisor Verify

Supervisor verifies, ticket moves to VERIFIED then CLOSED on final close. Dashboard counts update.

TC-005 Reassignment

Tech requests reassignment. Planner reassigns to Tech B. Audits show reassign entry with reason and from/to.

TC-006 SLA Escalation

Create P1 ticket and do not assign within response SLA → system escalates to Supervisor and marks ACTIVITY: SLA_BREACH.

TC-007 Reopen

After closure, operator reopens within policy, ticket status goes REOPENED and reopenCount increments.

TC-008 Inventory Reservation

Planner reserves 2 units; stock reduces to availableForReservation, consumes on completion; stockQty updated.

TC-009 Mandatory Checklist

Attempt to complete when mandatory checklist item is unanswered → system rejects completion and shows required item.

TC-010 Offline Create & Sync

Device offline creates ticket; once online, ticket appears in system with createdAt approximate and syncPending cleared.

15. Monitoring & Reporting (functional)

Provide these out-of-the-box reports / endpoints:

GET /reports/mttr?from=&to=&equipmentId= — mean time to repair

GET /reports/downtime?groupBy=equipment|line|week — downtime minutes

Overdue tickets list

Open tickets per technician (workload)

Parts consumption report by period

SLA breach summary (top offenders)
Reports should allow CSV export and scheduled automated email delivery.

16. Edge cases & behavior

Duplicate tickets: Link new ticket to existing open ticket if same equipment & same category created within X minutes — optional warning.

Partial parts availability: Allow partial reservation; second reservation allowed to cover remainder.

Multiple assignees: Support team assignment where ticket is owned by a team queue; any team member can accept.

Shift boundaries: If a job spans shift boundary and ActualEndAt beyond shift, allow overtime logging or split labor hours per shift.

Vendor jobs: When a ticket assigned to external vendor, mark onVendor = true and capture vendor PO/id.

Data loss prevention: Save drafts locally on mobile and auto-upload attachments after create.

17. Security & data governance (functional)

RBAC enforcement on all actions; e.g., only Supervisors can close safetyCritical jobs.

Immutable Activity Log entries: cannot be deleted (except admin soft-delete with audit trail).

Attachments access controlled by ticket permissions.

Export of sensitive fields restricted by role (e.g., cost fields restricted to Planner/Admin).

Retention rules: closed tickets archived after N years (configurable).

18. Minimal configuration panel (Admin functional)

Manage Priorities & SLA values by priority

Equipment criticality & PM intervals

Team definitions and skill tags

User-role assignment, shift times

Parts list and reorder points

Approval thresholds (cost/safety)

Business hours & holiday calendar for SLA calculations

Notification templates and escalation chains

19. Data migrations and seeding (practical)

Seed: default teams, priorities, a few checklist templates, sample equipment, sample parts.

Migration note: If moving from legacy, keep original ticket IDs in legacyId and maintain createdAt.

20. Implementation notes for developers (functional guidance)

Backend must enforce state transitions (not just the UI).

All write actions must create Activity Log entries.

Business rules must be configurable (SLA times, approval thresholds).

Provide robust APIs for search & filters (server-side filtering).

API responses should include allowedActions based on current user role and ticket state (helpful for UI).

Example: { allowedActions: ["start","request_reassign"] }

21. Deliverables you can hand to development

ER diagram and normalized schema (based on entities above).

API contract (endpoints above + request/response JSON schemas).

UI wireframes for screens described (Create, Detail, Workpad, Assignment Modal, Dashboard).

Acceptance test cases (listed above).

RBAC matrix (role → allowed actions per state).

Admin configuration page spec.

Example dataset for integration tests (10 equipments, 5 users, 20 sample tickets).