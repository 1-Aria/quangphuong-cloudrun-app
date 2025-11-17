/**
 * Work Order Controller
 * HTTP request handlers for work order management
 */

import { workOrderService } from '../services/WorkOrderService.js';
import { activityLogService } from '../../../shared/services/ActivityLogService.js';
import { getSLAStatus } from '../../../shared/utils/slaCalculator.js';
import { successResponse } from '../../../shared/utils/responseFormatter.js';
import { ValidationError } from '../../../shared/errors/AppError.js';
import { PERMISSIONS } from '../../../config/roles.js';
import { hasPermission } from '../../../shared/utils/permissions.js';

/**
 * Create a new work order (draft)
 * POST /maintenance/work-orders
 */
export async function createWorkOrder(req, res, next) {
  try {
    // Check permission
    if (!hasPermission(req.user, PERMISSIONS.WO_CREATE)) {
      throw new ValidationError('You do not have permission to create work orders');
    }

    const workOrder = await workOrderService.createDraft(req.body, req.user);

    res.status(201).json(
      successResponse(workOrder, 'Work order created successfully')
    );
  } catch (err) {
    next(err);
  }
}

/**
 * Get all work orders with filters
 * GET /maintenance/work-orders?status=Draft&priority=High&assignedTo=userId
 */
export async function getWorkOrders(req, res, next) {
  try {
    // Check permission
    const canViewAll = hasPermission(req.user, PERMISSIONS.WO_VIEW_ALL);

    const filters = {
      status: req.query.status,
      priority: req.query.priority,
      equipmentId: req.query.equipmentId,
      type: req.query.type
    };

    // If user can't view all, filter to only their assigned or requested work orders
    if (!canViewAll) {
      filters.assignedTo = req.user.uid || req.user.id;
    } else if (req.query.assignedTo) {
      filters.assignedTo = req.query.assignedTo;
    }

    const options = {
      limit: parseInt(req.query.limit) || 100,
      orderBy: req.query.orderBy || 'createdAt',
      orderDirection: req.query.orderDirection || 'desc'
    };

    const workOrders = await workOrderService.getWorkOrders(filters, options);

    res.json(
      successResponse(
        workOrders,
        `Retrieved ${workOrders.length} work orders`
      )
    );
  } catch (err) {
    next(err);
  }
}

/**
 * Get a single work order by ID
 * GET /maintenance/work-orders/:id
 */
export async function getWorkOrderById(req, res, next) {
  try {
    const workOrder = await workOrderService.findById(req.params.id);

    if (!workOrder) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Work order not found'
      });
    }

    // Check permission - users can view their own work orders
    const canViewAll = hasPermission(req.user, PERMISSIONS.WO_VIEW_ALL);
    const isAssigned = workOrder.assignedTo === (req.user.uid || req.user.id);
    const isRequester = workOrder.requestedBy === (req.user.uid || req.user.id);

    if (!canViewAll && !isAssigned && !isRequester) {
      throw new ValidationError('You do not have permission to view this work order');
    }

    res.json(successResponse(workOrder, 'Work order retrieved successfully'));
  } catch (err) {
    next(err);
  }
}

/**
 * Update work order
 * PUT /maintenance/work-orders/:id
 */
export async function updateWorkOrder(req, res, next) {
  try {
    // Check permission
    if (!hasPermission(req.user, PERMISSIONS.WO_UPDATE)) {
      throw new ValidationError('You do not have permission to update work orders');
    }

    const workOrder = await workOrderService.findById(req.params.id);
    if (!workOrder) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Work order not found'
      });
    }

    // Only allow updating certain fields directly
    const allowedFields = [
      'title',
      'description',
      'priority',
      'equipmentId',
      'equipmentName',
      'location',
      'estimatedHours',
      'scheduledStartDate',
      'scheduledEndDate'
    ];

    const updates = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const updated = await workOrderService.update(req.params.id, updates);

    res.json(successResponse(updated, 'Work order updated successfully'));
  } catch (err) {
    next(err);
  }
}

/**
 * Execute an action on work order
 * POST /maintenance/work-orders/:id/actions
 * Body: { action: 'submit_wo', data: {...} }
 */
export async function executeWorkOrderAction(req, res, next) {
  try {
    const { action, data } = req.body;

    if (!action) {
      throw new ValidationError('Action is required');
    }

    const workOrderId = req.params.id;
    let result;

    // Route to appropriate service method based on action
    switch (action) {
      case 'submit_wo':
        if (!hasPermission(req.user, PERMISSIONS.WO_SUBMIT)) {
          throw new ValidationError('Permission denied');
        }
        result = await workOrderService.submitWorkOrder(workOrderId, req.user);
        break;

      case 'approve_wo':
        if (!hasPermission(req.user, PERMISSIONS.WO_APPROVE)) {
          throw new ValidationError('Permission denied');
        }
        result = await workOrderService.approveWorkOrder(
          workOrderId,
          req.user,
          data
        );
        break;

      case 'reject_wo':
        if (!hasPermission(req.user, PERMISSIONS.WO_REJECT)) {
          throw new ValidationError('Permission denied');
        }
        result = await workOrderService.rejectWorkOrder(
          workOrderId,
          req.user,
          data?.reason
        );
        break;

      case 'assign_wo':
        if (!hasPermission(req.user, PERMISSIONS.WO_ASSIGN)) {
          throw new ValidationError('Permission denied');
        }
        if (!data?.technicianId || !data?.technicianName) {
          throw new ValidationError('Technician ID and name are required');
        }
        result = await workOrderService.assignWorkOrder(
          workOrderId,
          req.user,
          data.technicianId,
          data.technicianName
        );
        break;

      case 'reassign_wo':
        if (!hasPermission(req.user, PERMISSIONS.WO_REASSIGN)) {
          throw new ValidationError('Permission denied');
        }
        if (!data?.technicianId || !data?.technicianName) {
          throw new ValidationError('Technician ID and name are required');
        }
        result = await workOrderService.reassignWorkOrder(
          workOrderId,
          req.user,
          data.technicianId,
          data.technicianName,
          data.reason
        );
        break;

      case 'start_work':
        if (!hasPermission(req.user, PERMISSIONS.WO_START)) {
          throw new ValidationError('Permission denied');
        }
        result = await workOrderService.startWork(workOrderId, req.user);
        break;

      case 'put_on_hold':
        if (!hasPermission(req.user, PERMISSIONS.WO_HOLD)) {
          throw new ValidationError('Permission denied');
        }
        result = await workOrderService.putOnHold(
          workOrderId,
          req.user,
          data?.reason
        );
        break;

      case 'resume_work':
        if (!hasPermission(req.user, PERMISSIONS.WO_START)) {
          throw new ValidationError('Permission denied');
        }
        result = await workOrderService.resumeWork(workOrderId, req.user);
        break;

      case 'request_parts':
        if (!hasPermission(req.user, PERMISSIONS.INVENTORY_REQUEST)) {
          throw new ValidationError('Permission denied');
        }
        if (!data?.parts || !Array.isArray(data.parts)) {
          throw new ValidationError('Parts array is required');
        }
        result = await workOrderService.requestParts(
          workOrderId,
          req.user,
          data.parts
        );
        break;

      case 'receive_parts':
        if (!hasPermission(req.user, PERMISSIONS.INVENTORY_RECEIVE)) {
          throw new ValidationError('Permission denied');
        }
        result = await workOrderService.receiveParts(workOrderId, req.user);
        break;

      case 'complete_work':
        if (!hasPermission(req.user, PERMISSIONS.WO_COMPLETE)) {
          throw new ValidationError('Permission denied');
        }
        result = await workOrderService.completeWork(
          workOrderId,
          req.user,
          data || {}
        );
        break;

      case 'close_wo':
        if (!hasPermission(req.user, PERMISSIONS.WO_CLOSE)) {
          throw new ValidationError('Permission denied');
        }
        result = await workOrderService.closeWorkOrder(workOrderId, req.user);
        break;

      case 'cancel_wo':
        if (!hasPermission(req.user, PERMISSIONS.WO_CANCEL)) {
          throw new ValidationError('Permission denied');
        }
        result = await workOrderService.cancelWorkOrder(
          workOrderId,
          req.user,
          data?.reason
        );
        break;

      case 'add_comment':
        if (!hasPermission(req.user, PERMISSIONS.WO_COMMENT)) {
          throw new ValidationError('Permission denied');
        }
        if (!data?.text) {
          throw new ValidationError('Comment text is required');
        }
        result = await workOrderService.addComment(
          workOrderId,
          req.user,
          data.text
        );
        break;

      case 'attach_file':
        if (!hasPermission(req.user, PERMISSIONS.WO_ATTACH)) {
          throw new ValidationError('Permission denied');
        }
        if (!data?.fileName || !data?.fileUrl) {
          throw new ValidationError('File name and URL are required');
        }
        result = await workOrderService.attachFile(workOrderId, req.user, data);
        break;

      default:
        throw new ValidationError(`Unknown action: ${action}`);
    }

    res.json(
      successResponse(result, `Action '${action}' executed successfully`)
    );
  } catch (err) {
    next(err);
  }
}

/**
 * Get work order activity history
 * GET /maintenance/work-orders/:id/history
 */
export async function getWorkOrderHistory(req, res, next) {
  try {
    const workOrder = await workOrderService.findById(req.params.id);

    if (!workOrder) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Work order not found'
      });
    }

    // Get activity logs
    const activityLogs = await activityLogService.getEntityActivityLogs(
      'work_order',
      req.params.id,
      { limit: 200 }
    );

    res.json(
      successResponse(
        {
          statusHistory: workOrder.statusHistory || [],
          activityLogs
        },
        'Work order history retrieved successfully'
      )
    );
  } catch (err) {
    next(err);
  }
}

/**
 * Get work order SLA status
 * GET /maintenance/work-orders/:id/sla-status
 */
export async function getWorkOrderSLAStatus(req, res, next) {
  try {
    const workOrder = await workOrderService.findById(req.params.id);

    if (!workOrder) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Work order not found'
      });
    }

    const slaStatus = {
      response: null,
      completion: null
    };

    // Check response SLA
    if (workOrder.slaResponseDeadline) {
      const responseDeadline = new Date(workOrder.slaResponseDeadline);
      slaStatus.response = getSLAStatus(responseDeadline);
      slaStatus.response.deadline = responseDeadline;
      slaStatus.response.met = workOrder.slaResponseMet;
    }

    // Check completion SLA
    if (workOrder.slaCompletionDeadline) {
      const completionDeadline = new Date(workOrder.slaCompletionDeadline);
      slaStatus.completion = getSLAStatus(completionDeadline);
      slaStatus.completion.deadline = completionDeadline;
      slaStatus.completion.met = workOrder.slaCompletionMet;
    }

    res.json(
      successResponse(slaStatus, 'SLA status retrieved successfully')
    );
  } catch (err) {
    next(err);
  }
}

/**
 * Delete work order
 * DELETE /maintenance/work-orders/:id
 */
export async function deleteWorkOrder(req, res, next) {
  try {
    // Check permission
    if (!hasPermission(req.user, PERMISSIONS.WO_DELETE)) {
      throw new ValidationError('You do not have permission to delete work orders');
    }

    const workOrder = await workOrderService.findById(req.params.id);
    if (!workOrder) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Work order not found'
      });
    }

    // Only allow deletion of Draft or Cancelled work orders
    if (workOrder.status !== 'Draft' && workOrder.status !== 'Cancelled') {
      throw new ValidationError('Only Draft or Cancelled work orders can be deleted');
    }

    await workOrderService.delete(req.params.id);

    res.json(successResponse(null, 'Work order deleted successfully'));
  } catch (err) {
    next(err);
  }
}

export default {
  createWorkOrder,
  getWorkOrders,
  getWorkOrderById,
  updateWorkOrder,
  executeWorkOrderAction,
  getWorkOrderHistory,
  getWorkOrderSLAStatus,
  deleteWorkOrder
};
