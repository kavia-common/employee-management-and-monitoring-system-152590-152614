'use strict';

const Joi = require('joi');
const rolesService = require('../services/roles');

/**
 * RolesController exposes endpoints:
 * - GET /roles
 * - POST /roles/assign
 * - POST /roles/remove
 * Assignment/removal is protected via middleware and service-level checks.
 */
class RolesController {
  // PUBLIC_INTERFACE
  async list(req, res) {
    /** List all roles. */
    try {
      const roles = await rolesService.listRoles();
      return res.status(200).json({ status: 'ok', data: roles });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({ status: 'error', message: err.message || 'Failed to list roles' });
    }
  }

  // PUBLIC_INTERFACE
  async assign(req, res) {
    /** Assign a role to a user. Body: { userId: number, role: string } */
    const schema = Joi.object({
      userId: Joi.number().integer().positive().required(),
      role: Joi.string().regex(/^[a-z0-9_]+$/i).required(),
    });

    try {
      const { value, error } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({ status: 'error', message: error.message });
      }
      const result = await rolesService.assignRole({
        targetUserId: value.userId,
        roleName: value.role,
        performedByUser: req.user,
      });
      return res.status(200).json({ status: 'ok', ...result });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({ status: 'error', message: err.message || 'Failed to assign role' });
    }
  }

  // PUBLIC_INTERFACE
  async remove(req, res) {
    /** Remove a role from a user. Body: { userId: number, role: string } */
    const schema = Joi.object({
      userId: Joi.number().integer().positive().required(),
      role: Joi.string().regex(/^[a-z0-9_]+$/i).required(),
    });

    try {
      const { value, error } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({ status: 'error', message: error.message });
      }
      const result = await rolesService.removeRole({
        targetUserId: value.userId,
        roleName: value.role,
        performedByUser: req.user,
      });
      return res.status(200).json({ status: 'ok', ...result });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({ status: 'error', message: err.message || 'Failed to remove role' });
    }
  }
}

module.exports = new RolesController();
