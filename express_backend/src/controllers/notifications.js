const notificationService = require('../services/notifications');

/**
 * Notifications Controller
 * Provides endpoints:
 * - POST /notifications               -> create notification (admin/system endpoints, or self-send)
 * - GET /notifications/me             -> list current user's notifications
 * - GET /notifications/user/:userId   -> list notifications for specific user (admin/system)
 * - POST /notifications/:id/read      -> mark a single notification as read
 */

// PUBLIC_INTERFACE
async function create(req, res, next) {
  /** Create a new notification, optionally pushing via Firebase stub if deviceToken provided. */
  try {
    const { recipientId, title, body, data, deviceToken, createdBySystem } = req.body || {};
    const result = await notificationService.createNotification({
      recipientId,
      title,
      body,
      data,
      deviceToken,
      createdBySystem: !!createdBySystem,
    });
    return res.status(201).json(result);
  } catch (err) {
    return next(err);
  }
}

// PUBLIC_INTERFACE
async function listMine(req, res, next) {
  /** List notifications for the current authenticated user. */
  try {
    const { page, pageSize, unreadOnly } = req.query;
    const result = await notificationService.listNotifications({
      requester: req.user,
      userId: req.user.id,
      page,
      pageSize,
      unreadOnly: String(unreadOnly) === 'true',
    });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

// PUBLIC_INTERFACE
async function listForUser(req, res, next) {
  /** List notifications for a specific user (admins, superadmins, or system). */
  try {
    const { page, pageSize, unreadOnly } = req.query;
    const { userId } = req.params;
    const result = await notificationService.listNotifications({
      requester: req.user,
      userId,
      page,
      pageSize,
      unreadOnly: String(unreadOnly) === 'true',
    });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

// PUBLIC_INTERFACE
async function markRead(req, res, next) {
  /** Mark a notification as read by ID. */
  try {
    const { id } = req.params;
    const result = await notificationService.markAsRead({
      requester: req.user,
      id,
    });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  create,
  listMine,
  listForUser,
  markRead,
};
