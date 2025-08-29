'use strict';

const authService = require('../services/auth');
const { models } = require('../db/sequelize');

/**
 * RBAC Middleware utilities.
 * - authenticateWithRoles: Verifies JWT and attaches req.user with roles array.
 * - requireRoles: Enforces that the authenticated user has at least one of the required roles.
 */

// PUBLIC_INTERFACE
function authenticateWithRoles() {
  /** 
   * Express middleware that:
   * 1) Validates Bearer JWT in Authorization header,
   * 2) Loads the corresponding user and their roles from the DB,
   * 3) Attaches normalized user payload to req.user: { id, email, role, roles: [strings], name, isActive }
   */
  return async (req, res, next) => {
    try {
      const header = req.headers['authorization'] || '';
      const [type, token] = header.split(' ');
      if (type !== 'Bearer' || !token) {
        return res.status(401).json({ status: 'error', message: 'Missing or invalid Authorization header' });
      }

      // Verify token and get payload
      const payload = authService.verifyToken(token);
      if (!payload || !payload.sub) {
        return res.status(401).json({ status: 'error', message: 'Invalid token payload' });
      }

      // Load user and include their many-to-many roles
      const user = await models.User.findByPk(payload.sub, {
        include: [
          {
            model: models.Role,
            as: 'roles',
            attributes: ['name'],
            through: { attributes: [] },
          },
        ],
      });

      if (!user || !user.isActive) {
        return res.status(401).json({ status: 'error', message: 'Unauthorized' });
      }

      // Normalize roles list (include primary string role as well for backward compatibility)
      const m2mRoles = Array.isArray(user.roles) ? user.roles.map((r) => r.name) : [];
      const rolesSet = new Set(m2mRoles.concat(user.role).filter(Boolean));
      const roles = Array.from(rolesSet);

      // Attach a safe user to the request
      req.user = {
        id: user.id,
        sub: user.id,
        email: user.email,
        name: user.name,
        isActive: user.isActive,
        role: user.role, // primary role string retained
        roles, // full set of roles from M2M + primary
      };

      return next();
    } catch (err) {
      return res.status(401).json({ status: 'error', message: 'Invalid or expired token' });
    }
  };
}

// PUBLIC_INTERFACE
function requireRoles(required = []) {
  /**
   * Express middleware factory to enforce RBAC.
   * required may be a string or array of strings (role names).
   * The user must have at least one of the required roles in req.user.roles.
   */
  const requiredList = Array.isArray(required) ? required : [required];
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }
    if (!requiredList.length) {
      // No roles required -> allow
      return next();
    }
    const userRoles = Array.isArray(req.user.roles) ? req.user.roles : [req.user.role].filter(Boolean);
    const hasRole = userRoles.some((r) => requiredList.includes(r));
    if (!hasRole) {
      return res.status(403).json({ status: 'error', message: 'Forbidden' });
    }
    return next();
  };
}

module.exports = {
  authenticateWithRoles,
  requireRoles,
};
