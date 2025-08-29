'use strict';

const Joi = require('joi');
const { models, sequelize } = require('../db/sequelize');

/**
 * RolesService handles listing roles and assigning/removing roles from users.
 * It enforces RBAC such that only authorized admin roles can perform assignments.
 */
class RolesService {
  constructor() {
    // Define which roles are allowed to manage roles
    this.adminRoles = ['superadmin', 'manager']; // adjust as needed
  }

  // PUBLIC_INTERFACE
  async listRoles() {
    /** Returns all available roles in the system. */
    const roles = await models.Role.findAll({
      order: [['name', 'ASC']],
      attributes: ['id', 'name', 'description', ['is_system', 'isSystem'], 'createdAt', 'updatedAt'],
    });
    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isSystem: r.getDataValue('isSystem'),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  // PUBLIC_INTERFACE
  async assignRole({ targetUserId, roleName, performedByUser }) {
    /**
     * Assigns roleName to targetUserId.
     * Only users with an admin role can perform this operation.
     * If role already assigned, it is a no-op.
     */
    this._ensureAdmin(performedByUser);

    const validated = this._validateAssignRemove({ userId: targetUserId, roleName });
    const { user, role } = await this._loadUserAndRole(validated.userId, validated.roleName);

    // Run in a transaction to ensure atomic operation
    return await sequelize.transaction(async (t) => {
      // Ensure join exists
      const [userRole, created] = await models.UserRole.findOrCreate({
        where: { userId: user.id, roleId: role.id },
        defaults: { assignedBy: performedByUser.sub || performedByUser.id || null },
        transaction: t,
      });

      // Also maintain convenience string role on User if desired:
      // For this system, keep primary user.role as-is, but if the new role is "higher" we might update.
      // We won't automatically change user.role to avoid side effects. Admins can manage primary role elsewhere.

      return {
        assigned: created,
        userId: user.id,
        role: role.name,
      };
    });
  }

  // PUBLIC_INTERFACE
  async removeRole({ targetUserId, roleName, performedByUser }) {
    /**
     * Removes roleName from targetUserId.
     * Only users with an admin role can perform this operation.
     * If role is not assigned, it is a no-op removal with removed=false.
     */
    this._ensureAdmin(performedByUser);

    const validated = this._validateAssignRemove({ userId: targetUserId, roleName });
    const { user, role } = await this._loadUserAndRole(validated.userId, validated.roleName);

    // Protect against removing their last role or critical roles if needed
    // Here we permit removal, but prevent removing superadmin from themselves accidentally:
    if (performedByUser.sub === user.id && role.name === 'superadmin') {
      const err = new Error('Admins cannot remove their own superadmin role');
      err.status = 400;
      throw err;
    }

    const removedCount = await models.UserRole.destroy({
      where: { userId: user.id, roleId: role.id },
    });
    return {
      removed: removedCount > 0,
      userId: user.id,
      role: role.name,
    };
  }

  _ensureAdmin(performedByUser) {
    // performedByUser is from JWT payload. It contains role as string.
    if (!performedByUser || !performedByUser.role || !this.adminRoles.includes(performedByUser.role)) {
      const err = new Error('Forbidden: admin role required');
      err.status = 403;
      throw err;
    }
  }

  _validateAssignRemove({ userId, roleName }) {
    const schema = Joi.object({
      userId: Joi.number().integer().positive().required(),
      roleName: Joi.string().regex(/^[a-z0-9_]+$/i).required(),
    });
    const { value, error } = schema.validate({ userId, roleName });
    if (error) {
      const err = new Error(error.message);
      err.status = 400;
      throw err;
    }
    return { userId: value.userId, roleName: value.roleName };
    }

  async _loadUserAndRole(userId, roleName) {
    const user = await models.User.findByPk(userId);
    if (!user) {
      const err = new Error('User not found');
      err.status = 404;
      throw err;
    }
    const role = await models.Role.findOne({ where: { name: roleName } });
    if (!role) {
      const err = new Error('Role not found');
      err.status = 404;
      throw err;
    }
    return { user, role };
  }
}

module.exports = new RolesService();
