const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const controller = require('../controllers/notifications');

// Secure all notifications endpoints
router.use(auth);

// POST /notifications -> create a new notification
router.post('/', controller.create);

// GET /notifications/me -> list my notifications
router.get('/me', controller.listMine);

// GET /notifications/user/:userId -> list notifications for a given user (RBAC guarded in service)
router.get('/user/:userId', controller.listForUser);

// POST /notifications/:id/read -> mark as read
router.post('/:id/read', controller.markRead);

module.exports = router;
