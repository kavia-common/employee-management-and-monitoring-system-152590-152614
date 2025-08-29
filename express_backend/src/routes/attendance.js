'use strict';

const express = require('express');
const attendanceController = require('../controllers/attendance');
const { authenticateWithRoles, requireRoles } = require('../middleware');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Attendance
 *   description: Attendance management endpoints (GPS/manual; face API placeholder)
 */

/**
 * @swagger
 * /attendance/check-in:
 *   post:
 *     summary: Register check-in for the current user
 *     description: Supports methods manual, gps (requires lat/lng), and face (placeholder for future integration).
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [method]
 *             properties:
 *               method:
 *                 type: string
 *                 enum: [manual, gps, face]
 *               lat:
 *                 type: number
 *                 format: float
 *               lng:
 *                 type: number
 *                 format: float
 *               notes:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       201:
 *         description: Check-in recorded
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: Already checked-in and not checked-out yet
 */
router.post(
  '/check-in',
  authenticateWithRoles(),
  attendanceController.checkIn.bind(attendanceController)
);

/**
 * @swagger
 * /attendance/check-out:
 *   post:
 *     summary: Register check-out for the current user
 *     description: Supports methods manual, gps (requires lat/lng), and face (placeholder for future integration).
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [method]
 *             properties:
 *               method:
 *                 type: string
 *                 enum: [manual, gps, face]
 *               lat:
 *                 type: number
 *                 format: float
 *               lng:
 *                 type: number
 *                 format: float
 *               notes:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Check-out recorded
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: No open check-in found for today
 */
router.post(
  '/check-out',
  authenticateWithRoles(),
  attendanceController.checkOut.bind(attendanceController)
);

/**
 * @swagger
 * /attendance/me:
 *   get:
 *     summary: List the current user's attendance
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           example: 2025-01-01
 *         required: false
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           example: 2025-01-31
 *         required: false
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         required: false
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *         required: false
 *     responses:
 *       200:
 *         description: Paginated attendance list
 *       401:
 *         description: Unauthorized
 */
router.get('/me', authenticateWithRoles(), attendanceController.myAttendance.bind(attendanceController));

/**
 * @swagger
 * /attendance/user/{userId}:
 *   get:
 *     summary: List attendance for a specific user (admin/manager/team_leader)
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           example: 2025-01-01
 *         required: false
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           example: 2025-01-31
 *         required: false
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         required: false
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *         required: false
 *     responses:
 *       200:
 *         description: Paginated attendance list for user
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 */
router.get(
  '/user/:userId',
  authenticateWithRoles(),
  requireRoles(['superadmin', 'manager', 'team_leader']),
  attendanceController.listForUser.bind(attendanceController)
);

module.exports = router;
