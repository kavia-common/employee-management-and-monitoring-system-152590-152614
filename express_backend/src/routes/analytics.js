'use strict';

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireRoles } = require('../middleware/rbac');
const controller = require('../controllers/analytics');

/**
 * Analytics routes
 * All routes require authentication; org-wide endpoints further restricted via RBAC in controller.
 */

// Attendance summary
// GET /analytics/attendance/summary?from=YYYY-MM-DD&to=YYYY-MM-DD&groupBy=day|month&scope=self|user|team|org&userId=123
router.get(
  '/attendance/summary',
  authenticate,
  controller.attendanceSummary
);

// Project and Task status breakdowns
// GET /analytics/projects/tasks?from=YYYY-MM-DD&to=YYYY-MM-DD&projectId=1&withPerProject=true&scope=org|team|self
router.get(
  '/projects/tasks',
  authenticate,
  controller.projectTaskBreakdown
);

// Leave statistics
// GET /analytics/leaves/stats?from=YYYY-MM-DD&to=YYYY-MM-DD&scope=self|user|team|org&userId=123&includeUsers=true
router.get(
  '/leaves/stats',
  authenticate,
  controller.leaveStats
);

module.exports = router;
