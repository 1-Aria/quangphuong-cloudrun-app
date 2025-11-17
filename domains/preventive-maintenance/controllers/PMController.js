/**
 * Preventive Maintenance Controller
 * HTTP request handlers for PM schedules and checklists
 */

import { pmScheduleService } from '../services/PMScheduleService.js';
import { checklistTemplateService } from '../services/ChecklistTemplateService.js';
import { pmWorkOrderGenerator } from '../services/PMWorkOrderGenerator.js';
import { PERMISSIONS } from '../../../config/roles.js';
import { hasPermission } from '../../../shared/utils/permissions.js';
import {
  ValidationError,
  ForbiddenError
} from '../../../shared/errors/AppError.js';
import { successResponse } from '../../../shared/utils/responseFormatter.js';

// ==================== PM Schedule Endpoints ====================

/**
 * Create PM schedule
 * POST /pm/schedules
 */
export async function createSchedule(req, res, next) {
  try {
    if (!hasPermission(req.user, PERMISSIONS.PM_CREATE)) {
      throw new ForbiddenError(
        'You do not have permission to create PM schedules'
      );
    }

    const schedule = await pmScheduleService.createSchedule(req.body, req.user);

    res
      .status(201)
      .json(successResponse(schedule, 'PM schedule created successfully'));
  } catch (error) {
    next(error);
  }
}

/**
 * Get PM schedules with filters
 * GET /pm/schedules
 */
export async function getSchedules(req, res, next) {
  try {
    if (!hasPermission(req.user, PERMISSIONS.PM_VIEW)) {
      throw new ForbiddenError(
        'You do not have permission to view PM schedules'
      );
    }

    const filters = {
      status: req.query.status,
      frequency: req.query.frequency,
      equipmentType: req.query.equipmentType,
      assignedToId: req.query.assignedToId,
      searchTerm: req.query.search
    };

    const options = {
      limit: parseInt(req.query.limit) || 100,
      offset: parseInt(req.query.offset) || 0
    };

    const result = await pmScheduleService.searchSchedules(filters, options);

    res.json(
      successResponse(
        result.schedules,
        'PM schedules retrieved successfully',
        {
          total: result.total,
          limit: result.limit,
          offset: result.offset
        }
      )
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Get PM schedule by ID
 * GET /pm/schedules/:id
 */
export async function getScheduleById(req, res, next) {
  try {
    if (!hasPermission(req.user, PERMISSIONS.PM_VIEW)) {
      throw new ForbiddenError(
        'You do not have permission to view PM schedules'
      );
    }

    const schedule = await pmScheduleService.findById(req.params.id);

    if (!schedule) {
      throw new ValidationError('PM schedule not found');
    }

    res.json(successResponse(schedule, 'PM schedule retrieved successfully'));
  } catch (error) {
    next(error);
  }
}

/**
 * Update PM schedule
 * PUT /pm/schedules/:id
 */
export async function updateSchedule(req, res, next) {
  try {
    if (!hasPermission(req.user, PERMISSIONS.PM_EDIT)) {
      throw new ForbiddenError(
        'You do not have permission to edit PM schedules'
      );
    }

    const schedule = await pmScheduleService.update(req.params.id, req.body);

    res.json(successResponse(schedule, 'PM schedule updated successfully'));
  } catch (error) {
    next(error);
  }
}

/**
 * Delete PM schedule
 * DELETE /pm/schedules/:id
 */
export async function deleteSchedule(req, res, next) {
  try {
    if (!hasPermission(req.user, PERMISSIONS.PM_DELETE)) {
      throw new ForbiddenError(
        'You do not have permission to delete PM schedules'
      );
    }

    await pmScheduleService.delete(req.params.id);

    res.json(successResponse(null, 'PM schedule deleted successfully'));
  } catch (error) {
    next(error);
  }
}

/**
 * Get schedules by equipment
 * GET /pm/schedules/by-equipment/:equipmentId
 */
export async function getSchedulesByEquipment(req, res, next) {
  try {
    if (!hasPermission(req.user, PERMISSIONS.PM_VIEW)) {
      throw new ForbiddenError(
        'You do not have permission to view PM schedules'
      );
    }

    const schedules = await pmScheduleService.getByEquipment(
      req.params.equipmentId
    );

    res.json(successResponse(schedules, 'Schedules retrieved successfully'));
  } catch (error) {
    next(error);
  }
}

/**
 * Get schedules by assignee
 * GET /pm/schedules/by-assignee/:assignedToId
 */
export async function getSchedulesByAssignee(req, res, next) {
  try {
    if (!hasPermission(req.user, PERMISSIONS.PM_VIEW)) {
      throw new ForbiddenError(
        'You do not have permission to view PM schedules'
      );
    }

    const schedules = await pmScheduleService.getByAssignee(
      req.params.assignedToId
    );

    res.json(successResponse(schedules, 'Schedules retrieved successfully'));
  } catch (error) {
    next(error);
  }
}

/**
 * Get due schedules
 * GET /pm/schedules/due
 */
export async function getDueSchedules(req, res, next) {
  try {
    if (!hasPermission(req.user, PERMISSIONS.PM_VIEW)) {
      throw new ForbiddenError(
        'You do not have permission to view PM schedules'
      );
    }

    const options = {
      limit: parseInt(req.query.limit) || 100,
      includeOverdue: req.query.includeOverdue !== 'false'
    };

    const schedules = await pmScheduleService.getDueSchedules(options);

    res.json(successResponse(schedules, 'Due schedules retrieved successfully'));
  } catch (error) {
    next(error);
  }
}

/**
 * Get overdue schedules
 * GET /pm/schedules/overdue
 */
export async function getOverdueSchedules(req, res, next) {
  try {
    if (!hasPermission(req.user, PERMISSIONS.PM_VIEW)) {
      throw new ForbiddenError(
        'You do not have permission to view PM schedules'
      );
    }

    const limit = parseInt(req.query.limit) || 100;
    const schedules = await pmScheduleService.getOverdueSchedules(limit);

    res.json(
      successResponse(schedules, 'Overdue schedules retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Update schedule status
 * PUT /pm/schedules/:id/status
 */
export async function updateScheduleStatus(req, res, next) {
  try {
    if (!hasPermission(req.user, PERMISSIONS.PM_EDIT)) {
      throw new ForbiddenError(
        'You do not have permission to edit PM schedules'
      );
    }

    const { status } = req.body;

    if (!status) {
      throw new ValidationError('Status is required');
    }

    const schedule = await pmScheduleService.updateStatus(
      req.params.id,
      status,
      req.user
    );

    res.json(successResponse(schedule, 'Schedule status updated successfully'));
  } catch (error) {
    next(error);
  }
}

/**
 * Skip schedule execution
 * POST /pm/schedules/:id/skip
 */
export async function skipExecution(req, res, next) {
  try {
    if (!hasPermission(req.user, PERMISSIONS.PM_EDIT)) {
      throw new ForbiddenError(
        'You do not have permission to skip PM executions'
      );
    }

    const { reason } = req.body;

    if (!reason) {
      throw new ValidationError('Skip reason is required');
    }

    const schedule = await pmScheduleService.skipExecution(
      req.params.id,
      reason,
      req.user
    );

    res.json(
      successResponse(schedule, 'Schedule execution skipped successfully')
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Get PM statistics
 * GET /pm/schedules/stats
 */
export async function getStatistics(req, res, next) {
  try {
    if (!hasPermission(req.user, PERMISSIONS.PM_VIEW)) {
      throw new ForbiddenError('You do not have permission to view PM statistics');
    }

    const stats = await pmScheduleService.getStatistics();

    res.json(successResponse(stats, 'Statistics retrieved successfully'));
  } catch (error) {
    next(error);
  }
}

// ==================== Work Order Generation Endpoints ====================

/**
 * Generate work order from schedule
 * POST /pm/schedules/:id/generate-work-order
 */
export async function generateWorkOrder(req, res, next) {
  try {
    if (!hasPermission(req.user, PERMISSIONS.PM_EXECUTE)) {
      throw new ForbiddenError(
        'You do not have permission to generate PM work orders'
      );
    }

    const workOrder = await pmWorkOrderGenerator.generateForSchedule(
      req.params.id,
      req.user
    );

    res
      .status(201)
      .json(successResponse(workOrder, 'Work order generated successfully'));
  } catch (error) {
    next(error);
  }
}

/**
 * Process due schedules (batch generation)
 * POST /pm/schedules/process-due
 */
export async function processDueSchedules(req, res, next) {
  try {
    if (!hasPermission(req.user, PERMISSIONS.PM_EXECUTE)) {
      throw new ForbiddenError(
        'You do not have permission to process PM schedules'
      );
    }

    const options = {
      limit: parseInt(req.body.limit) || 50,
      dryRun: req.body.dryRun === true
    };

    const results = await pmWorkOrderGenerator.processDueSchedules(
      req.user,
      options
    );

    res.json(successResponse(results, 'Due schedules processed successfully'));
  } catch (error) {
    next(error);
  }
}

// ==================== Checklist Template Endpoints ====================

/**
 * Create checklist template
 * POST /pm/templates
 */
export async function createTemplate(req, res, next) {
  try {
    if (!hasPermission(req.user, PERMISSIONS.PM_CREATE)) {
      throw new ForbiddenError(
        'You do not have permission to create checklist templates'
      );
    }

    const template = await checklistTemplateService.createTemplate(
      req.body,
      req.user
    );

    res
      .status(201)
      .json(successResponse(template, 'Checklist template created successfully'));
  } catch (error) {
    next(error);
  }
}

/**
 * Get checklist templates
 * GET /pm/templates
 */
export async function getTemplates(req, res, next) {
  try {
    if (!hasPermission(req.user, PERMISSIONS.PM_VIEW)) {
      throw new ForbiddenError(
        'You do not have permission to view checklist templates'
      );
    }

    const filters = {
      category: req.query.category,
      equipmentType: req.query.equipmentType,
      searchTerm: req.query.search,
      isActive: req.query.isActive !== 'false'
    };

    const templates = await checklistTemplateService.searchTemplates(filters);

    res.json(
      successResponse(templates, 'Checklist templates retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Get checklist template by ID
 * GET /pm/templates/:id
 */
export async function getTemplateById(req, res, next) {
  try {
    if (!hasPermission(req.user, PERMISSIONS.PM_VIEW)) {
      throw new ForbiddenError(
        'You do not have permission to view checklist templates'
      );
    }

    const template = await checklistTemplateService.findById(req.params.id);

    if (!template) {
      throw new ValidationError('Checklist template not found');
    }

    res.json(
      successResponse(template, 'Checklist template retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Update checklist template
 * PUT /pm/templates/:id
 */
export async function updateTemplate(req, res, next) {
  try {
    if (!hasPermission(req.user, PERMISSIONS.PM_EDIT)) {
      throw new ForbiddenError(
        'You do not have permission to edit checklist templates'
      );
    }

    const template = await checklistTemplateService.updateTemplate(
      req.params.id,
      req.body
    );

    res.json(
      successResponse(template, 'Checklist template updated successfully')
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Delete checklist template
 * DELETE /pm/templates/:id
 */
export async function deleteTemplate(req, res, next) {
  try {
    if (!hasPermission(req.user, PERMISSIONS.PM_DELETE)) {
      throw new ForbiddenError(
        'You do not have permission to delete checklist templates'
      );
    }

    await checklistTemplateService.delete(req.params.id);

    res.json(
      successResponse(null, 'Checklist template deleted successfully')
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Get templates by category
 * GET /pm/templates/by-category/:category
 */
export async function getTemplatesByCategory(req, res, next) {
  try {
    if (!hasPermission(req.user, PERMISSIONS.PM_VIEW)) {
      throw new ForbiddenError(
        'You do not have permission to view checklist templates'
      );
    }

    const templates = await checklistTemplateService.getByCategory(
      req.params.category
    );

    res.json(successResponse(templates, 'Templates retrieved successfully'));
  } catch (error) {
    next(error);
  }
}

/**
 * Get template categories
 * GET /pm/templates/categories
 */
export async function getCategories(req, res, next) {
  try {
    if (!hasPermission(req.user, PERMISSIONS.PM_VIEW)) {
      throw new ForbiddenError(
        'You do not have permission to view template categories'
      );
    }

    const categories = await checklistTemplateService.getCategories();

    res.json(successResponse(categories, 'Categories retrieved successfully'));
  } catch (error) {
    next(error);
  }
}

/**
 * Duplicate template
 * POST /pm/templates/:id/duplicate
 */
export async function duplicateTemplate(req, res, next) {
  try {
    if (!hasPermission(req.user, PERMISSIONS.PM_CREATE)) {
      throw new ForbiddenError(
        'You do not have permission to duplicate templates'
      );
    }

    const { newName } = req.body;

    if (!newName) {
      throw new ValidationError('New template name is required');
    }

    const template = await checklistTemplateService.duplicateTemplate(
      req.params.id,
      newName,
      req.user
    );

    res
      .status(201)
      .json(successResponse(template, 'Template duplicated successfully'));
  } catch (error) {
    next(error);
  }
}

export default {
  // PM Schedules
  createSchedule,
  getSchedules,
  getScheduleById,
  updateSchedule,
  deleteSchedule,
  getSchedulesByEquipment,
  getSchedulesByAssignee,
  getDueSchedules,
  getOverdueSchedules,
  updateScheduleStatus,
  skipExecution,
  getStatistics,

  // Work Order Generation
  generateWorkOrder,
  processDueSchedules,

  // Checklist Templates
  createTemplate,
  getTemplates,
  getTemplateById,
  updateTemplate,
  deleteTemplate,
  getTemplatesByCategory,
  getCategories,
  duplicateTemplate
};
