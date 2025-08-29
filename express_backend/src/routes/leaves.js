'use strict';

const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const controller = require('../controllers/leaves');

// All leave routes require authentication
router.use(auth);

// Submit a leave request (any authenticated user)
router.post('/', controller.submit);

// My leaves list
router.get('/me', controller.listMine);

// Manager view: list leaves with filters (restricted)
router.get(
  '/',
  rbac.requireRoles(['superadmin', 'manager', 'team_leader']),
  controller.listManaged
);

// Approve a leave (restricted)
router.post(
  '/:id/approve',
  rbac.requireRoles(['superadmin', 'manager', 'team_leader']),
  controller.approve
);

// Deny a leave (restricted)
router.post(
  '/:id/deny',
  rbac.requireRoles(['superadmin', 'manager', 'team_leader']),
  controller.deny
);

module.exports = router;
