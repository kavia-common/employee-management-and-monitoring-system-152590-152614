'use strict';

const express = require('express');
const rolesController = require('../controllers/roles');
const { authenticateWithRoles, requireRoles } = require('../middleware');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Roles
 *   description: Role management and RBAC endpoints
 */

/**
 * @swagger
 * /roles:
 *   get:
 *     summary: List all roles
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of roles
 *       401:
 *         description: Unauthorized
 */
router.get('/', authenticateWithRoles(), rolesController.list.bind(rolesController));

/**
 * @swagger
 * /roles/assign:
 *   post:
 *     summary: Assign a role to a user
 *     description: Only admin users (superadmin, manager) can assign roles.
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, role]
 *             properties:
 *               userId:
 *                 type: integer
 *               role:
 *                 type: string
 *                 example: employee
 *     responses:
 *       200:
 *         description: Role assignment result
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User or Role not found
 */
router.post(
  '/assign',
  authenticateWithRoles(),
  requireRoles(['superadmin', 'manager']),
  rolesController.assign.bind(rolesController)
);

/**
 * @swagger
 * /roles/remove:
 *   post:
 *     summary: Remove a role from a user
 *     description: Only admin users (superadmin, manager) can remove roles.
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, role]
 *             properties:
 *               userId:
 *                 type: integer
 *               role:
 *                 type: string
 *                 example: employee
 *     responses:
 *       200:
 *         description: Role removal result
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User or Role not found
 */
router.post(
  '/remove',
  authenticateWithRoles(),
  requireRoles(['superadmin', 'manager']),
  rolesController.remove.bind(rolesController)
);

module.exports = router;
