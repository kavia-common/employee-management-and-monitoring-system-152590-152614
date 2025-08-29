'use strict';

const Joi = require('joi');
const { Op } = require('sequelize');
const { models, sequelize } = require('../db/sequelize');

/**
 * TasksService
 * Handles CRUD for tasks, assignments, and RBAC per project visibility.
 */
class TasksService {
  constructor() {
    this.adminRoles = ['superadmin', 'manager', 'team_leader'];
  }

  _hasAdminLike(userPayload) {
    const roles = Array.isArray(userPayload.roles) ? userPayload.roles : [userPayload.role].filter(Boolean);
    return roles.some((r) => this.adminRoles.includes(r));
  }

  _ensureAuthenticated(userPayload) {
    if (!userPayload || !userPayload.sub) {
      const err = new Error('Unauthorized');
      err.status = 401;
      throw err;
    }
  }

  async _ensureProjectAccess(userPayload, projectId) {
    const isAdmin = this._hasAdminLike(userPayload);
    if (isAdmin) return { isAdmin, isOwnerOrManager: true };

    const project = await models.Project.findByPk(projectId, {
      include: [{ model: models.User, as: 'members', attributes: ['id'], through: { attributes: ['memberRole'] } }],
    });
    if (!project) {
      const err = new Error('Project not found');
      err.status = 404;
      throw err;
    }
    const isOwner = project.ownerId === userPayload.sub;
    const member = Array.isArray(project.members) ? project.members.find((m) => m.id === userPayload.sub) : null;
    const memberRole = member && member.ProjectMember ? member.ProjectMember.memberRole : null;
    const isManager = memberRole === 'manager' || memberRole === 'owner';
    const isMember = !!member;

    if (!isOwner && !isMember) {
      const err = new Error('Forbidden');
      err.status = 403;
      throw err;
    }
    return { isAdmin, isOwnerOrManager: isOwner || isManager, isMember, project };
  }

  _serialize(task, withAssignees = false) {
    const base = {
      id: task.id,
      projectId: task.projectId,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
      createdById: task.createdById,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
    if (withAssignees && Array.isArray(task.assignees)) {
      base.assignees = task.assignees.map((u) => ({
        userId: u.id,
        name: u.name,
        email: u.email,
      }));
    }
    return base;
  }

  _validateCreate(payload) {
    const schema = Joi.object({
      projectId: Joi.number().integer().positive().required(),
      title: Joi.string().max(200).required(),
      description: Joi.string().allow(null, ''),
      status: Joi.string().valid('todo', 'in_progress', 'blocked', 'done').default('todo'),
      priority: Joi.string().valid('low', 'medium', 'high', 'urgent').default('medium'),
      dueDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow(null),
      assignees: Joi.array()
        .items(Joi.number().integer().positive())
        .unique()
        .default([]),
    });

    const { value, error } = schema.validate(payload || {});
    if (error) {
      const err = new Error(error.message);
      err.status = 400;
      throw err;
    }
    return value;
  }

  _validateUpdate(payload) {
    const schema = Joi.object({
      title: Joi.string().max(200),
      description: Joi.string().allow(null, ''),
      status: Joi.string().valid('todo', 'in_progress', 'blocked', 'done'),
      priority: Joi.string().valid('low', 'medium', 'high', 'urgent'),
      dueDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow(null),
      assignees: Joi.array().items(Joi.number().integer().positive()).unique(),
    });

    const { value, error } = schema.validate(payload || {});
    if (error) {
      const err = new Error(error.message);
      err.status = 400;
      throw err;
    }
    return value;
  }

  // PUBLIC_INTERFACE
  async createTask({ userPayload, body }) {
    /** Create a task in a project; only project owner/manager/admin can create. */
    this._ensureAuthenticated(userPayload);
    const value = this._validateCreate(body);

    const access = await this._ensureProjectAccess(userPayload, value.projectId);
    if (!access.isOwnerOrManager) {
      const err = new Error('Forbidden: only project owner/manager can create tasks');
      err.status = 403;
      throw err;
    }

    return await sequelize.transaction(async (t) => {
      const task = await models.Task.create(
        {
          projectId: value.projectId,
          title: value.title,
          description: value.description ?? null,
          status: value.status,
          priority: value.priority,
          dueDate: value.dueDate ?? null,
          createdById: userPayload.sub,
        },
        { transaction: t }
      );

      if (value.assignees && value.assignees.length) {
        const rows = value.assignees.map((userId) => ({
          taskId: task.id,
          userId,
          assignedBy: userPayload.sub,
          assignedAt: new Date(),
        }));
        await models.TaskAssignment.bulkCreate(rows, { transaction: t, ignoreDuplicates: true });
      }

      const created = await models.Task.findByPk(task.id, {
        include: [{ model: models.User, as: 'assignees', attributes: ['id', 'name', 'email'], through: { attributes: [] } }],
        transaction: t,
      });
      return this._serialize(created, true);
    });
  }

  // PUBLIC_INTERFACE
  async listTasks({ userPayload, query }) {
    /** List tasks visible to the user; admin-like sees all; others see tasks in projects they belong to. */
    this._ensureAuthenticated(userPayload);
    const isAdmin = this._hasAdminLike(userPayload);

    const schema = Joi.object({
      projectId: Joi.number().integer().positive().allow(null),
      status: Joi.string().valid('todo', 'in_progress', 'blocked', 'done').allow(null),
      priority: Joi.string().valid('low', 'medium', 'high', 'urgent').allow(null),
      dueFrom: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow(null),
      dueTo: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow(null),
      assigneeId: Joi.number().integer().positive().allow(null),
      page: Joi.number().integer().min(1).default(1),
      pageSize: Joi.number().integer().min(1).max(100).default(20),
      withAssignees: Joi.boolean().default(false),
      search: Joi.string().max(200).allow(null, ''),
    });

    const { value, error } = schema.validate(query || {});
    if (error) {
      const err = new Error(error.message);
      err.status = 400;
      throw err;
    }

    const where = {};
    if (value.projectId) where.projectId = value.projectId;
    if (value.status) where.status = value.status;
    if (value.priority) where.priority = value.priority;
    if (value.dueFrom || value.dueTo) {
      where.dueDate = {};
      if (value.dueFrom) where.dueDate[Op.gte] = value.dueFrom;
      if (value.dueTo) where.dueDate[Op.lte] = value.dueTo;
    }
    if (value.search) {
      where.title = { [Op.like]: `%${value.search}%` };
    }

    const include = [];
    if (!isAdmin) {
      // Restrict to tasks where the user is project member or owner
      include.push({
        model: models.Project,
        as: 'project',
        required: true,
        include: [
          {
            model: models.User,
            as: 'members',
            attributes: ['id'],
            through: { attributes: [] },
            required: false,
            where: { id: userPayload.sub },
          },
        ],
        where: {
          [Op.or]: [{ ownerId: userPayload.sub }],
        },
      });
    }
    if (value.assigneeId || value.withAssignees) {
      include.push({
        model: models.User,
        as: 'assignees',
        attributes: value.withAssignees ? ['id', 'name', 'email'] : ['id'],
        through: { attributes: [] },
        required: !!value.assigneeId,
        where: value.assigneeId ? { id: value.assigneeId } : undefined,
      });
    }

    // de-dupe includes by alias
    const seen = new Set();
    const includes = [];
    for (const inc of include) {
      const key = inc.as || '';
      if (seen.has(key)) continue;
      seen.add(key);
      includes.push(inc);
    }

    const offset = (value.page - 1) * value.pageSize;
    const { rows, count } = await models.Task.findAndCountAll({
      where,
      include: includes,
      order: [['updatedAt', 'DESC'], ['id', 'DESC']],
      limit: value.pageSize,
      offset,
      distinct: true,
    });

    return {
      total: count,
      page: value.page,
      pageSize: value.pageSize,
      data: rows.map((t) => this._serialize(t, !!value.withAssignees)),
    };
  }

  // PUBLIC_INTERFACE
  async getTask({ userPayload, taskId }) {
    /** Get a single task if user has access via project membership or admin-like. */
    this._ensureAuthenticated(userPayload);
    const task = await models.Task.findByPk(taskId, {
      include: [
        { model: models.Project, as: 'project', include: [{ model: models.User, as: 'members', attributes: ['id'], through: { attributes: [] } }] },
        { model: models.User, as: 'assignees', attributes: ['id', 'name', 'email'], through: { attributes: [] } },
      ],
    });
    if (!task) {
      const err = new Error('Task not found');
      err.status = 404;
      throw err;
    }

    const isAdmin = this._hasAdminLike(userPayload);
    const project = task.project;
    const isOwner = project.ownerId === userPayload.sub;
    const isMember = Array.isArray(project.members) && project.members.some((m) => m.id === userPayload.sub);

    if (!isAdmin && !isOwner && !isMember) {
      const err = new Error('Forbidden');
      err.status = 403;
      throw err;
    }

    return this._serialize(task, true);
  }

  // PUBLIC_INTERFACE
  async updateTask({ userPayload, taskId, body }) {
    /** Update a task; only project owner/manager/admin or task creator can update. */
    this._ensureAuthenticated(userPayload);
    const value = this._validateUpdate(body);

    return await sequelize.transaction(async (t) => {
      const task = await models.Task.findByPk(taskId, {
        include: [{ model: models.Project, as: 'project', include: [{ model: models.User, as: 'members', attributes: ['id'], through: { attributes: ['memberRole'] } }] }],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!task) {
        const err = new Error('Task not found');
        err.status = 404;
        throw err;
      }

      // Access check
      const isAdmin = this._hasAdminLike(userPayload);
      const project = task.project;
      const isOwner = project.ownerId === userPayload.sub;
      const member = Array.isArray(project.members) ? project.members.find((m) => m.id === userPayload.sub) : null;
      const memberRole = member && member.ProjectMember ? member.ProjectMember.memberRole : null;
      const isManager = memberRole === 'manager' || memberRole === 'owner';
      const isCreator = task.createdById === userPayload.sub;

      if (!isAdmin && !isOwner && !isManager && !isCreator) {
        const err = new Error('Forbidden');
        err.status = 403;
        throw err;
      }

      const fields = ['title', 'description', 'status', 'priority', 'dueDate'];
      for (const f of fields) {
        if (Object.prototype.hasOwnProperty.call(value, f)) {
          task[f] = value[f];
        }
      }
      await task.save({ transaction: t });

      if (Array.isArray(value.assignees)) {
        // Upsert assignment list
        const target = new Set(value.assignees);
        const existing = await models.TaskAssignment.findAll({ where: { taskId: task.id }, transaction: t });
        const existingSet = new Set(existing.map((a) => a.userId));

        // Add new
        for (const userId of target) {
          if (!existingSet.has(userId)) {
            await models.TaskAssignment.create(
              { taskId: task.id, userId, assignedBy: userPayload.sub, assignedAt: new Date() },
              { transaction: t }
            );
          }
        }
        // Remove missing
        for (const userId of existingSet) {
          if (!target.has(userId)) {
            await models.TaskAssignment.destroy({ where: { taskId: task.id, userId }, transaction: t });
          }
        }
      }

      const updated = await models.Task.findByPk(task.id, {
        include: [{ model: models.User, as: 'assignees', attributes: ['id', 'name', 'email'], through: { attributes: [] } }],
        transaction: t,
      });
      return this._serialize(updated, true);
    });
  }

  // PUBLIC_INTERFACE
  async deleteTask({ userPayload, taskId }) {
    /** Delete a task; only project owner/manager/admin or task creator can delete. */
    this._ensureAuthenticated(userPayload);

    return await sequelize.transaction(async (t) => {
      const task = await models.Task.findByPk(taskId, {
        include: [{ model: models.Project, as: 'project', include: [{ model: models.User, as: 'members', attributes: ['id'], through: { attributes: ['memberRole'] } }] }],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!task) {
        const err = new Error('Task not found');
        err.status = 404;
        throw err;
      }

      const isAdmin = this._hasAdminLike(userPayload);
      const project = task.project;
      const isOwner = project.ownerId === userPayload.sub;
      const member = Array.isArray(project.members) ? project.members.find((m) => m.id === userPayload.sub) : null;
      const memberRole = member && member.ProjectMember ? member.ProjectMember.memberRole : null;
      const isManager = memberRole === 'manager' || memberRole === 'owner';
      const isCreator = task.createdById === userPayload.sub;

      if (!isAdmin && !isOwner && !isManager && !isCreator) {
        const err = new Error('Forbidden');
        err.status = 403;
        throw err;
      }

      await models.TaskAssignment.destroy({ where: { taskId: task.id }, transaction: t });
      await task.destroy({ transaction: t });
      return { deleted: true, id: taskId };
    });
  }
}

module.exports = new TasksService();
