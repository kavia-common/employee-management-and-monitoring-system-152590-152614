const express = require('express');
const healthController = require('../controllers/health');
const authRoutes = require('./auth');
const roleRoutes = require('./roles');
const attendanceRoutes = require('./attendance');

const router = express.Router();
// Health endpoint

/**
 * @swagger
 * /:
 *   get:
 *     summary: Health endpoint
 *     responses:
 *       200:
 *         description: Service health check passed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 message:
 *                   type: string
 *                   example: Service is healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 environment:
 *                   type: string
 *                   example: development
 */
router.get('/', healthController.check.bind(healthController));

// Mount auth routes
router.use('/auth', authRoutes);

// Mount role management routes
router.use('/roles', roleRoutes);

// Mount attendance routes
router.use('/attendance', attendanceRoutes);

module.exports = router;
