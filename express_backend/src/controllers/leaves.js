'use strict';

const leavesService = require('../services/leaves');

/**
 * Controller for Leaves endpoints.
 * Applies minimal validation and delegates to service for business logic.
 */

function respond(res, payload, status = 200) {
  return res.status(status).json(payload);
}

function handleError(res, error) {
  const status = error.status || 500;
  return res.status(status).json({ error: error.message || 'Internal Server Error' });
}

// PUBLIC_INTERFACE
async function submit(req, res) {
  /** Submit a leave request for the authenticated user. */
  try {
    const { type, startDate, endDate, reason } = req.body || {};
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }
    const leave = await leavesService.submitLeave({
      requester: req.user,
      payload: { type, startDate, endDate, reason }
    });
    return respond(res, leave, 201);
  } catch (err) {
    return handleError(res, err);
  }
}

// PUBLIC_INTERFACE
async function approve(req, res) {
  /** Approve a leave request. Restricted to manager/team_leader/superadmin. */
  try {
    const leaveId = req.params.id;
    const { comment } = req.body || {};
    const leave = await leavesService.approveLeave({
      approver: req.user,
      leaveId,
      comment
    });
    return respond(res, leave);
  } catch (err) {
    return handleError(res, err);
  }
}

// PUBLIC_INTERFACE
async function deny(req, res) {
  /** Deny a leave request. Restricted to manager/team_leader/superadmin. */
  try {
    const leaveId = req.params.id;
    const { comment } = req.body || {};
    const leave = await leavesService.denyLeave({
      approver: req.user,
      leaveId,
      comment
    });
    return respond(res, leave);
  } catch (err) {
    return handleError(res, err);
  }
}

// PUBLIC_INTERFACE
async function listMine(req, res) {
  /** List leaves for the current authenticated user. */
  try {
    const result = await leavesService.listMyLeaves({ user: req.user, query: req.query });
    return respond(res, result);
  } catch (err) {
    return handleError(res, err);
  }
}

// PUBLIC_INTERFACE
async function listManaged(req, res) {
  /** List leaves visible to manager/team_leader/superadmin. */
  try {
    const result = await leavesService.listManagedLeaves({ manager: req.user, query: req.query });
    return respond(res, result);
  } catch (err) {
    return handleError(res, err);
  }
}

module.exports = {
  submit,
  approve,
  deny,
  listMine,
  listManaged
};
