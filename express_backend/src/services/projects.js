'use strict';

const Joi = require('joi');
const { Op } = require('sequelize');
const { models, sequelize } = require('../db/sequelize');

/**
 * ProjectsService
 * Handles CRUD for projects, membership management, and RBAC.
 */
class ProjectsService {
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

  _serialize(project, withMembers = false, withTasks = false) {
    const base = {
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      priority: project.priority,
      startDate: project.startDate,
      dueDate: project.dueDate,
      ownerId: project.ownerId,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };

    if (withMembers && Array.isArray(project.members)) {
      base.members = project.members.map((u) => {
        const pm = u.ProjectMember || {};
        return {
          userId: u.id,
          name: u.name,
          email: u.email,
          memberRole: pm.memberRole || 'contributor',
        };
      });
    }

    if (withTasks && Array.isArray(project.tasks)) {
      base.tasks = project.tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate,
      }));
    }

    return base;
  }

  _validateMembers(members) {
    const schema = Joi.array()
      .items(
        Joi.object({
          userId: Joi.number().integer().positive().required(),
          memberRole: Joi.string().valid('owner', 'manager', 'contributor', 'viewer').default('contributor'),
        })
      )
      .unique((a, b) => a.userId === b.userId)
      .default([]);

    const { value, error } = schema.validate(members || []);
    if (error) {
      const err = new Error(error.message);
      err.status = 400;
      throw err;
    }
    return value;
  }

  _validateCreate(payload) {
    const schema = Joi.object({
      name: Joi.string().max(200).required(),
      description: Joi.string().allow(null, ''),
      status: Joi.string().valid('planned', 'active', 'on_hold', 'completed', 'cancelled').default('planned'),
      priority: Joi.string().valid('low', 'medium', 'high', 'urgent').default('medium'),
      startDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow(null),
      dueDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow(null),
      members: Joi.array().default([]),
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
      name: Joi.string().max(200),
      description: Joi.string().allow(null, ''),
      status: Joi.string().valid('planned', 'active', 'on_hold', 'completed', 'cancelled'),
      priority: Joi.string().valid('low', 'medium', 'high', 'urgent'),
      startDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow(null),
      dueDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow(null),
      members: Joi.array(),
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
  async createProject({ userPayload, body }) {
    /** Create a new project; creator becomes owner and member. */
    this._ensureAuthenticated(userPayload);
    const ownerId = userPayload.sub;
    const value = this._validateCreate(body);
    const members = this._validateMembers(value.members);

    return await sequelize.transaction(async (t) => {
      const project = await models.Project.create(
        {
          name: value.name,
          description: value.description ?? null,
          status: value.status,
          priority: value.priority,
          startDate: value.startDate ?? null,
          dueDate: value.dueDate ?? null,
          ownerId,
        },
        { transaction: t }
      );

      const membersMap = new Map(members.map((m) => [m.userId, m.memberRole]));
      // Ensure owner is member with owner role
      membersMap.set(ownerId, 'owner');

      const rows = Array.from(membersMap.entries()).map(([userId, memberRole]) => ({
        projectId: project.id,
        userId,
        memberRole,
      }));
      if (rows.length) {
        await models.ProjectMember.bulkCreate(rows, { transaction: t, ignoreDuplicates: true });
      }

      const created = await models.Project.findByPk(project.id, {
        include: [
          { model: models.User, as: 'members', attributes: ['id', 'name', 'email'], through: { attributes: ['memberRole'] } },
        ],
        transaction: t,
      });
      return this._serialize(created, true, false);
    });
  }

  // PUBLIC_INTERFACE
  async listProjects({ userPayload, query }) {
    /** List projects visible to the user; admin-like sees all; others see those they own or are members of. */
    this._ensureAuthenticated(userPayload);
    const isAdmin = this._hasAdminLike(userPayload);

    const schema = Joi.object({
      status: Joi.string().valid('planned', 'active', 'on_hold', 'completed', 'cancelled').allow(null),
      priority: Joi.string().valid('low', 'medium', 'high', 'urgent').allow(null),
      ownerId: Joi.number().integer().positive().allow(null),
      page: Joi.number().integer().min(1).default(1),
      pageSize: Joi.number().integer().min(1).max(100).default(20),
      withMembers: Joi.boolean().default(false),
      withTasks: Joi.boolean().default(false),
      search: Joi.string().max(200).allow(null, ''),
    });

    const { value, error } = schema.validate(query || {});
    if (error) {
      const err = new Error(error.message);
      err.status = 400;
      throw err;
    }

    const where = {};
    if (value.status) where.status = value.status;
    if (value.priority) where.priority = value.priority;
    if (isAdmin && value.ownerId) where.ownerId = value.ownerId;
    if (value.search) {
      where.name = { [Op.like]: `%${value.search}%` };
    }

    const include = [];
    if (!isAdmin) {
      include.push({
        model: models.User,
        as: 'members',
        attributes: ['id'],
        through: { attributes: [] },
        required: false,
        where: { id: userPayload.sub },
      });
      where[Op.or] = [{ ownerId: userPayload.sub }];
    }
    if (value.withMembers) {
      include.push({
        model: models.User,
        as: 'members',
        attributes: ['id', 'name', 'email'],
        through: { attributes: ['memberRole'] },
        required: false,
      });
    }
    if (value.withTasks) {
      include.push({
        model: models.Task,
        as: 'tasks',
        attributes: ['id', 'title', 'status', 'priority', 'dueDate'],
        required: false,
      });
    }

    // dedupe include aliases
    const seen = new Set();
    const includes = [];
    for (const inc of include) {
      const key = inc.as || '';
      if (seen.has(key)) continue;
      seen.add(key);
      includes.push(inc);
    }

    const offset = (value.page - 1) * value.pageSize;
    const { rows, count } = await models.Project.findAndCountAll({
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
      data: rows.map((p) => this._serialize(p, !!value.withMembers, !!value.withTasks)),
    };
  }

  // PUBLIC_INTERFACE
  async getProject({ userPayload, projectId }) {
    /** Get a single project with members and tasks if the user has access. */
    this._ensureAuthenticated(userPayload);
    const include = [
      { model: models.User, as: 'members', attributes: ['id', 'name', 'email'], through: { attributes: ['memberRole'] } },
      { model: models.Task, as: 'tasks', attributes: ['id', 'title', 'status', 'priority', 'dueDate'] },
    ];

    const project = await models.Project.findByPk(projectId, { include });
    if (!project) {
      const err = new Error('Project not found');
      err.status = 404;
      throw err;
    }

    if (!this._hasAdminLike(userPayload) && project.ownerId !== userPayload.sub) {
      const isMember = Array.isArray(project.members) && project.members.some((m) => m.id === userPayload.sub);
      if (!isMember) {
        const err = new Error('Forbidden');
        err.status = 403;
        throw err;
      }
    }

    return this._serialize(project, true, true);
  }

  // PUBLIC_INTERFACE
  async updateProject({ userPayload, projectId, body }) {
    /** Update project fields and optionally reset members. Owner or admin-like can update. */
    this._ensureAuthenticated(userPayload);
    const value = this._validateUpdate(body);

    return await sequelize.transaction(async (t) => {
      const project = await models.Project.findByPk(projectId, {
        include: [{ model: models.User, as: 'members', attributes: ['id'], through: { attributes: ['memberRole'] } }],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!project) {
        const err = new Error('Project not found');
        err.status = 404;
        throw err;
      }

      const isAdmin = this._hasAdminLike(userPayload);
      if (!isAdmin && project.ownerId !== userPayload.sub) {
        const err = new Error('Forbidden');
        err.status = 403;
        throw err;
      }

      const fields = ['name', 'description', 'status', 'priority', 'startDate', 'dueDate'];
      for (const f of fields) {
        if (Object.prototype.hasOwnProperty.call(value, f)) {
          project[f] = value[f];
        }
      }
      await project.save({ transaction: t });

      if (Array.isArray(value.members)) {
        const members = this._validateMembers(value.members);
        // ensure owner remains member with owner role
        const target = new Map(members.map((m) => [m.userId, m.memberRole]));
        target.set(project.ownerId, 'owner');

        const existing = await models.ProjectMember.findAll({ where: { projectId: project.id }, transaction: t });
        const existingMap = new Map(existing.map((m) => [m.userId, m]));

        // upsert target
        for (const [userId, memberRole] of target.entries()) {
          const current = existingMap.get(userId);
          if (!current) {
            await models.ProjectMember.create({ projectId: project.id, userId, memberRole }, { transaction: t });
          } else if (current.memberRole !== memberRole) {
            current.memberRole = memberRole;
            await current.save({ transaction: t });
          }
        }
        // remove extras except owner
        for (const [userId, current] of existingMap.entries()) {
          if (userId === project.ownerId) continue;
          if (!target.has(userId)) {
            await models.ProjectMember.destroy({ where: { projectId: project.id, userId }, transaction: t });
          }
        }
      }

      const updated = await models.Project.findByPk(project.id, {
        include: [
          { model: models.User, as: 'members', attributes: ['id', 'name', 'email'], through: { attributes: ['memberRole'] } },
          { model: models.Task, as: 'tasks', attributes: ['id', 'title', 'status', 'priority', 'dueDate'] },
        ],
        transaction: t,
      });
      return this._serialize(updated, true, true);
    });
  }

  // PUBLIC_INTERFACE
  async deleteProject({ userPayload, projectId }) {
    /** Delete a project. Owner or admin-like only. */
    this._ensureAuthenticated(userPayload);

    return await sequelize.transaction(async (t) => {
      const project = await models.Project.findByPk(projectId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!project) {
        const err = new Error('Project not found');
        err.status = 404;
        throw err;
      }
      const isAdmin = this._hasAdminLike(userPayload);
      if (!isAdmin && project.ownerId !== userPayload.sub) {
        const err = new Error('Forbidden');
        err.status = 403;
        throw err;
      }

      // Cascades will remove members and tasks; still clean joins explicitly for safety
      await models.ProjectMember.destroy({ where: { projectId }, transaction: t });
      const tasks = await models.Task.findAll({ where: { projectId }, transaction: t });
      for (const task of tasks) {
        await models.TaskAssignment.destroy({ where: { taskId: task.id }, transaction: t });
      }
      await models.Task.destroy({ where: { projectId }, transaction: t });
      await project.destroy({ transaction: t });

      return { deleted: true, id: projectId };
    });
  }
}

module.exports = new ProjectsService();
