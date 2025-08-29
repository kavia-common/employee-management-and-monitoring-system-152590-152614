const { authenticate, authorize } = require('./auth');
const { authenticateWithRoles, requireRoles } = require('./rbac');

// This file exports middleware utilities
module.exports = {
  authenticate,
  authorize,
  authenticateWithRoles,
  requireRoles,
};
