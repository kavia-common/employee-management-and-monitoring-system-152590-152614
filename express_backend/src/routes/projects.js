'use strict';

const express = require('express');
const projectsController = require('../controllers/projects');
const { authenticateWithRoles } = require('../middleware');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Projects
 *   description: Project management endpoints
 */

/**
 * @swagger
 * /projects:
 *   post:
 *     summary: Create a new project
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [planned, active, on_hold, completed, cancelled]
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *               startDate:
 *                 type: string
 *               dueDate:
 *                 type: string
 *               members:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: integer
 *                     memberRole:
 *                       type: string
 *                       enum: [owner, manager, contributor, viewer]
 *     responses:
 *       201:
 *         description: Project created
 *       401:
 *         description: Unauthorized
 */
router.post('/', authenticateWithRoles(), projectsController.create.bind(projectsController));

/**
 * @swagger
 * /projects:
 *   get:
 *     summary: List projects
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [planned, active, on_hold, completed, cancelled]
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *       - in: query
 *         name: ownerId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *       - in: query
 *         name: withMembers
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: withTasks
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Paginated projects list
 *       401:
 *         description: Unauthorized
 */
router.get('/', authenticateWithRoles(), projectsController.list.bind(projectsController));

/**
 * @swagger
 * /projects/{id}:
 *   get:
 *     summary: Get a project by ID
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Project details
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.get('/:id', authenticateWithRoles(), projectsController.getById.bind(projectsController));

/**
 * @swagger
 * /projects/{id}:
 *   put:
 *     summary: Update a project
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               status: { type: string, enum: [planned, active, on_hold, completed, cancelled] }
 *               priority: { type: string, enum: [low, medium, high, urgent] }
 *               startDate: { type: string }
 *               dueDate: { type: string }
 *               members:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     userId: { type: integer }
 *                     memberRole: { type: string, enum: [owner, manager, contributor, viewer] }
 *     responses:
 *       200:
 *         description: Project updated
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.put('/:id', authenticateWithRoles(), projectsController.update.bind(projectsController));

/**
 * @swagger
 * /projects/{id}:
 *   delete:
 *     summary: Delete a project
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Project deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.delete('/:id', authenticateWithRoles(), projectsController.remove.bind(projectsController));

module.exports = router;
