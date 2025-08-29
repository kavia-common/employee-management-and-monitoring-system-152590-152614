'use strict';

const Joi = require('joi');
const attendanceService = require('../services/attendance');

/**
 * AttendanceController exposing endpoints:
 * - POST /attendance/check-in
 * - POST /attendance/check-out
 * - GET /attendance/me
 * - GET /attendance/user/:userId (admin/manager/team_leader)
 */
class AttendanceController {
  // PUBLIC_INTERFACE
  async checkIn(req, res) {
    /** Check-in endpoint with support for method: manual|gps|face and optional coordinates and notes. */
    const schema = Joi.object({
      method: Joi.string().valid('manual', 'gps', 'face').required(),
      lat: Joi.number().min(-90).max(90).allow(null),
      lng: Joi.number().min(-180).max(180).allow(null),
      notes: Joi.string().max(500).allow(null, ''),
    });
    try {
      const { value, error } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({ status: 'error', message: error.message });
      }
      const data = await attendanceService.checkIn({
        userPayload: req.user,
        method: value.method,
        lat: value.lat ?? null,
        lng: value.lng ?? null,
        notes: value.notes ?? null,
      });
      return res.status(201).json({ status: 'ok', data });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({ status: 'error', message: err.message || 'Check-in failed' });
    }
  }

  // PUBLIC_INTERFACE
  async checkOut(req, res) {
    /** Check-out endpoint with method support and optional coordinates and notes. */
    const schema = Joi.object({
      method: Joi.string().valid('manual', 'gps', 'face').required(),
      lat: Joi.number().min(-90).max(90).allow(null),
      lng: Joi.number().min(-180).max(180).allow(null),
      notes: Joi.string().max(500).allow(null, ''),
    });
    try {
      const { value, error } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({ status: 'error', message: error.message });
      }
      const data = await attendanceService.checkOut({
        userPayload: req.user,
        method: value.method,
        lat: value.lat ?? null,
        lng: value.lng ?? null,
        notes: value.notes ?? null,
      });
      return res.status(200).json({ status: 'ok', data });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({ status: 'error', message: err.message || 'Check-out failed' });
    }
  }

  // PUBLIC_INTERFACE
  async myAttendance(req, res) {
    /** List current user's attendance with optional date range and pagination. */
    const schema = Joi.object({
      from: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow(null),
      to: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow(null),
      page: Joi.number().integer().min(1).default(1),
      pageSize: Joi.number().integer().min(1).max(100).default(20),
    });
    try {
      const { value, error } = schema.validate(req.query);
      if (error) {
        return res.status(400).json({ status: 'error', message: error.message });
      }
      const result = await attendanceService.myAttendance({
        userPayload: req.user,
        from: value.from ?? null,
        to: value.to ?? null,
        page: value.page,
        pageSize: value.pageSize,
      });
      return res.status(200).json({ status: 'ok', ...result });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({ status: 'error', message: err.message || 'Failed to list attendance' });
    }
  }

  // PUBLIC_INTERFACE
  async listForUser(req, res) {
    /** Admin/Manager endpoint to list attendance for a given userId. */
    const schema = Joi.object({
      userId: Joi.number().integer().positive().required(),
      from: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow(null),
      to: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow(null),
      page: Joi.number().integer().min(1).default(1),
      pageSize: Joi.number().integer().min(1).max(100).default(20),
    });
    try {
      const { value, error } = schema.validate({ ...req.query, userId: Number(req.params.userId) });
      if (error) {
        return res.status(400).json({ status: 'error', message: error.message });
      }
      const result = await attendanceService.listForUser({
        requester: req.user,
        userId: value.userId,
        from: value.from ?? null,
        to: value.to ?? null,
        page: value.page,
        pageSize: value.pageSize,
      });
      return res.status(200).json({ status: 'ok', ...result });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({ status: 'error', message: err.message || 'Failed to list attendance for user' });
    }
  }
}

module.exports = new AttendanceController();
