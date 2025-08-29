'use strict';

/**
 * Leaves Service encapsulates business rules for submitting, approving, denying, and listing leaves.
 * It uses Sequelize models defined in the db connection.
 */

const db = require('../db/sequelize');
const { Op } = require('sequelize');
const { Leave, User, Role, UserRole } = db.models;

/**
 * Check if the user has any of the roles in allowedRoles.
 * @param {object} userPayload - JWT user payload (id, roles?)
 * @param {string[]} allowedRoles
 * @returns {Promise<boolean>}
 */
async function hasAnyRole(userPayload, allowedRoles) {
  // If roles are embedded in token as array, prefer that for speed.
  if (userPayload && Array.isArray(userPayload.roles)) {
    return userPayload.roles.some((r) => allowedRoles.includes(r));
  }
  // Otherwise query DB associations
  const roles = await Role.findAll({
    include: [{ model: UserRole, where: { userId: userPayload.id } }]
  });
  return roles.some((r) => allowedRoles.includes(r.name));
}

/**
 * Validate that startDate <= endDate and dates are valid.
 */
function validateDates(startDate, endDate) {
  const s = new Date(startDate);
  const e = new Date(endDate);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) {
    const err = new Error('Invalid startDate or endDate');
    err.status = 400;
    throw err;
  }
  if (s > e) {
    const err = new Error('startDate must be before or equal to endDate');
    err.status = 400;
    throw err;
  }
}

// PUBLIC_INTERFACE
async function submitLeave({ requester, payload }) {
  /** Submit a new leave request for the current user. */
  validateDates(payload.startDate, payload.endDate);

  const leave = await Leave.create({
    userId: requester.id,
    type: payload.type || 'annual',
    startDate: payload.startDate,
    endDate: payload.endDate,
    reason: payload.reason || null,
    status: 'pending'
  });
  return leave;
}

// PUBLIC_INTERFACE
async function approveLeave({ approver, leaveId, comment }) {
  /** Approve a leave; only manager or team_leader (or superadmin) can approve. */
  const allowed = await hasAnyRole(approver, ['superadmin', 'manager', 'team_leader']);
  if (!allowed) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
  const leave = await Leave.findByPk(leaveId);
  if (!leave) {
    const err = new Error('Leave not found');
    err.status = 404;
    throw err;
  }
  if (leave.status !== 'pending') {
    const err = new Error('Only pending leaves can be approved');
    err.status = 409;
    throw err;
  }
  leave.status = 'approved';
  leave.approvedBy = approver.id;
  leave.approvedAt = new Date();
  leave.managerComment = comment || null;
  await leave.save();
  return leave;
}

// PUBLIC_INTERFACE
async function denyLeave({ approver, leaveId, comment }) {
  /** Deny a leave; only manager or team_leader (or superadmin) can deny. */
  const allowed = await hasAnyRole(approver, ['superadmin', 'manager', 'team_leader']);
  if (!allowed) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
  const leave = await Leave.findByPk(leaveId);
  if (!leave) {
    const err = new Error('Leave not found');
    err.status = 404;
    throw err;
  }
  if (leave.status !== 'pending') {
    const err = new Error('Only pending leaves can be denied');
    err.status = 409;
    throw err;
  }
  leave.status = 'denied';
  leave.approvedBy = approver.id;
  leave.approvedAt = new Date();
  leave.managerComment = comment || null;
  await leave.save();
  return leave;
}

// PUBLIC_INTERFACE
async function listMyLeaves({ user, query }) {
  /** List leaves for the current authenticated user with optional filters and pagination. */
  const page = Number(query.page) || 1;
  const pageSize = Math.min(Number(query.pageSize) || 20, 100);
  const where = { userId: user.id };
  if (query.status) where.status = query.status;
  if (query.from || query.to) {
    where.startDate = {};
    if (query.from) where.startDate[Op.gte] = query.from;
    if (query.to) where.startDate[Op.lte] = query.to;
  }

  const { rows, count } = await Leave.findAndCountAll({
    where,
    order: [['startDate', 'DESC']],
    offset: (page - 1) * pageSize,
    limit: pageSize
  });
  return { data: rows, total: count, page, pageSize };
}

// PUBLIC_INTERFACE
async function listManagedLeaves({ manager, query }) {
  /** List leaves for team members; restricted to admin-like roles. */
  const allowed = await hasAnyRole(manager, ['superadmin', 'manager', 'team_leader']);
  if (!allowed) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }

  const page = Number(query.page) || 1;
  const pageSize = Math.min(Number(query.pageSize) || 20, 100);
  const where = {};
  if (query.status) where.status = query.status;
  if (query.userId) where.userId = query.userId;
  if (query.from || query.to) {
    where.startDate = {};
    if (query.from) where.startDate[Op.gte] = query.from;
    if (query.to) where.startDate[Op.lte] = query.to;
  }

  const { rows, count } = await Leave.findAndCountAll({
    where,
    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }],
    order: [['startDate', 'DESC']],
    offset: (page - 1) * pageSize,
    limit: pageSize
  });
  return { data: rows, total: count, page, pageSize };
}

module.exports = {
  submitLeave,
  approveLeave,
  denyLeave,
  listMyLeaves,
  listManagedLeaves
};
