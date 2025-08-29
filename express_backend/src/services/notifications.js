const Notification = require('../models/Notification');
const User = require('../models/User');

/**
 * Determine if a requester can access another user's notifications.
 * Allowed: recipient themselves, admin-like roles (superadmin, manager), or a system flag passed from internal flows.
 */
function canAccessNotifications(requester, targetUserId, isSystem = false) {
  if (!requester) return false;
  if (isSystem) return true;
  if (requester.id === Number(targetUserId)) return true;

  const roles = (requester.roles || []).map((r) => r.name || r); // supports {name} or string
  if (roles.includes('superadmin') || roles.includes('manager')) return true;

  return false;
}

/**
 * Stubbed Firebase push function.
 * Replace with actual Firebase Admin SDK integration and ensure env variables are configured.
 */
async function sendPushStub({ deviceToken, title, body, data }) {
  if (!deviceToken) return { pushed: false, reason: 'no_device_token' };
  // Here we would use Firebase Admin SDK: admin.messaging().send({...})
  // For now we log and simulate success
  // eslint-disable-next-line no-console
  console.log('[Notifications] Push (stub):', { deviceToken, title, body, data });
  return { pushed: true };
}

// PUBLIC_INTERFACE
async function createNotification({ recipientId, title, body, data, deviceToken, createdBySystem = false }) {
  /** Create a notification and trigger a push if deviceToken is provided. */
  if (!recipientId || !title || !body) {
    const err = new Error('recipientId, title and body are required');
    err.status = 400;
    throw err;
  }
  const recipient = await User.findByPk(recipientId);
  if (!recipient) {
    const err = new Error('Recipient not found');
    err.status = 404;
    throw err;
  }

  const notification = await Notification.create({
    recipientId,
    title,
    body,
    data: data || null,
    deviceToken: deviceToken || null,
    createdBySystem: !!createdBySystem,
  });

  // Fire-and-forget push stub
  try {
    if (deviceToken) {
      await sendPushStub({ deviceToken, title, body, data });
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Failed to push notification (stub):', e);
  }

  return notification;
}

// PUBLIC_INTERFACE
async function listNotifications({ requester, userId, page = 1, pageSize = 20, unreadOnly = false, isSystem = false }) {
  /** List notifications for a user with RBAC enforcement. */
  if (!canAccessNotifications(requester, userId, isSystem)) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
  const where = { recipientId: Number(userId) };
  if (unreadOnly) where.readAt = null;

  const limit = Math.min(Number(pageSize) || 20, 100);
  const offset = ((Number(page) || 1) - 1) * limit;

  const { rows, count } = await Notification.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });

  return {
    items: rows,
    total: count,
    page: Number(page) || 1,
    pageSize: limit,
    totalPages: Math.ceil(count / limit),
  };
}

// PUBLIC_INTERFACE
async function markAsRead({ requester, id, isSystem = false }) {
  /** Mark a notification as read (RBAC: recipient, admins, or system). */
  const notification = await Notification.findByPk(id);
  if (!notification) {
    const err = new Error('Notification not found');
    err.status = 404;
    throw err;
  }

  if (!canAccessNotifications(requester, notification.recipientId, isSystem)) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }

  if (!notification.readAt) {
    notification.readAt = new Date();
    await notification.save();
  }
  return notification;
}

module.exports = {
  createNotification,
  listNotifications,
  markAsRead,
};
