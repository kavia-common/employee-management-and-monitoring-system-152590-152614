'use strict';

const express = require('express');
const meetingsController = require('../controllers/meetings');
const { authenticateWithRoles } = require('../middleware');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Meetings
 *   description: Meeting scheduler & calendar integration endpoints
 */

/**
 * @swagger
 * /meetings:
 *   post:
 *     summary: Create a new meeting
 *     description: Organizer is the authenticated user. Provide participants as an array of { userId, participantRole }.
 *     tags: [Meetings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, startTime, endTime]
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               startTime:
 *                 type: string
 *                 format: date-time
 *               endTime:
 *                 type: string
 *                 format: date-time
 *               durationMinutes:
 *                 type: integer
 *               location:
 *                 type: string
 *               isAllDay:
 *                 type: boolean
 *               participants:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: integer
 *                     participantRole:
 *                       type: string
 *                       enum: [required, optional]
 *     responses:
 *       201:
 *         description: Meeting created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post('/', authenticateWithRoles(), meetingsController.create.bind(meetingsController));

/**
 * @swagger
 * /meetings:
 *   get:
 *     summary: List meetings
 *     description: Admins see all, others see meetings they organize or participate in.
 *     tags: [Meetings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [scheduled, cancelled, completed]
 *       - in: query
 *         name: organizerId
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
 *         name: withParticipants
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Paginated meetings list
 *       401:
 *         description: Unauthorized
 */
router.get('/', authenticateWithRoles(), meetingsController.list.bind(meetingsController));

/**
 * @swagger
 * /meetings/{id}:
 *   get:
 *     summary: Get a meeting by ID
 *     tags: [Meetings]
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
 *         description: Meeting details
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.get('/:id', authenticateWithRoles(), meetingsController.getById.bind(meetingsController));

/**
 * @swagger
 * /meetings/{id}:
 *   put:
 *     summary: Update a meeting
 *     description: Organizer or admin-like roles only. You can replace participants array.
 *     tags: [Meetings]
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
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               startTime:
 *                 type: string
 *                 format: date-time
 *               endTime:
 *                 type: string
 *                 format: date-time
 *               durationMinutes:
 *                 type: integer
 *               location:
 *                 type: string
 *               isAllDay:
 *                 type: boolean
 *               status:
 *                 type: string
 *                 enum: [scheduled, cancelled, completed]
 *               participants:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: integer
 *                     participantRole:
 *                       type: string
 *                       enum: [required, optional]
 *     responses:
 *       200:
 *         description: Meeting updated
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.put('/:id', authenticateWithRoles(), meetingsController.update.bind(meetingsController));

/**
 * @swagger
 * /meetings/{id}:
 *   delete:
 *     summary: Delete a meeting
 *     description: Organizer or admin-like roles only.
 *     tags: [Meetings]
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
 *         description: Meeting deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.delete('/:id', authenticateWithRoles(), meetingsController.remove.bind(meetingsController));

/**
 * @swagger
 * /meetings/{id}/participants/response:
 *   post:
 *     summary: Set participant response for the current user
 *     tags: [Meetings]
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
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, accepted, declined, tentative]
 *     responses:
 *       200:
 *         description: Response updated
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a participant
 *       404:
 *         description: Meeting not found
 */
router.post('/:id/participants/response', authenticateWithRoles(), meetingsController.setResponse.bind(meetingsController));

/**
 * @swagger
 * /meetings/{id}/ics:
 *   get:
 *     summary: Download ICS file (placeholder)
 *     description: Returns a simple ICS file for the meeting. Replace with a robust iCal generator as needed.
 *     tags: [Meetings]
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
 *         description: Returns ICS content
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Meeting not found
 */
router.get('/:id/ics', authenticateWithRoles(), meetingsController.getIcs.bind(meetingsController));

module.exports = router;
