'use strict';

const Joi = require('joi');
const { Op } = require('sequelize');
const { models, sequelize } = require('../db/sequelize');

/**
 * AttendanceService encapsulates attendance operations:
 * - checkIn (manual/gps/face placeholder)
 * - checkOut (manual/gps/face placeholder)
 * - list my attendance
 * - admin/manager listing per user
 */
class AttendanceService {
  constructor() {
    this.adminRoles = ['superadmin', 'manager', 'team_leader'];
  }

  _validateMethodAndLocation({ method, lat, lng }) {
    const schema = Joi.object({
      method: Joi.string().valid('manual', 'gps', 'face').required(),
      lat: Joi.number().min(-90).max(90).allow(null),
      lng: Joi.number().min(-180).max(180).allow(null),
    });
    const { value, error } = schema.validate({ method, lat, lng });
    if (error) {
      const err = new Error(error.message);
      err.status = 400;
      throw err;
    }
    if (value.method === 'gps' && (value.lat == null || value.lng == null)) {
      const err = new Error('lat and lng are required for gps method');
      err.status = 400;
      throw err;
    }
    return value;
  }

  _ensureActiveUser(userPayload) {
    if (!userPayload || !userPayload.sub) {
      const err = new Error('Unauthorized');
      err.status = 401;
      throw err;
    }
  }

  _ensureAdminLike(userPayload) {
    const roles = Array.isArray(userPayload.roles) ? userPayload.roles : [userPayload.role].filter(Boolean);
    const allowed = roles.some((r) => this.adminRoles.includes(r));
    if (!allowed) {
      const err = new Error('Forbidden');
      err.status = 403;
      throw err;
    }
  }

  _getWorkDate(now = new Date()) {
    // For simplicity, use local date string as work date
    const iso = new Date(now);
    const yyyy = iso.getFullYear();
    const mm = String(iso.getMonth() + 1).padStart(2, '0');
    const dd = String(iso.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // PUBLIC_INTERFACE
  async checkIn({ userPayload, method, lat = null, lng = null, notes = null }) {
    /** Perform check-in for the authenticated user with method validation and single open-session rule. */
    this._ensureActiveUser(userPayload);
    const validated = this._validateMethodAndLocation({ method, lat, lng });

    // Ensure user exists and is active
    const user = await models.User.findByPk(userPayload.sub);
    if (!user || !user.isActive) {
      const err = new Error('Unauthorized');
      err.status = 401;
      throw err;
    }

    const now = new Date();
    const workDate = this._getWorkDate(now);

    return await sequelize.transaction(async (t) => {
      // Prevent multiple open attendance entries for same day (no checkout yet)
      const existingOpen = await models.Attendance.findOne({
        where: { userId: user.id, workDate, checkInAt: { [Op.ne]: null }, checkOutAt: { [Op.is]: null } },
        transaction: t,
      });
      if (existingOpen) {
        const err = new Error('Already checked-in and not checked-out yet');
        err.status = 409;
        throw err;
      }

      // Check if a record already exists for the day with both timestamps; allow new record only if closed
      const attendance = await models.Attendance.create(
        {
          userId: user.id,
          checkInAt: now,
          checkInMethod: validated.method,
          checkInLat: validated.method === 'gps' ? validated.lat : null,
          checkInLng: validated.method === 'gps' ? validated.lng : null,
          notes,
          faceVerified: validated.method === 'face' ? false : null, // placeholder
          isLate: false, // future enhancement: compare against shift start
          isOvertime: false,
          workDate,
        },
        { transaction: t }
      );

      // Placeholder for face API integration: update faceVerified after external API call

      return this._serialize(attendance);
    });
  }

  // PUBLIC_INTERFACE
  async checkOut({ userPayload, method, lat = null, lng = null, notes = null }) {
    /** Perform check-out for the authenticated user ensuring there is an open attendance record. */
    this._ensureActiveUser(userPayload);
    const validated = this._validateMethodAndLocation({ method, lat, lng });

    const user = await models.User.findByPk(userPayload.sub);
    if (!user || !user.isActive) {
      const err = new Error('Unauthorized');
      err.status = 401;
      throw err;
    }

    const now = new Date();
    const workDate = this._getWorkDate(now);

    return await sequelize.transaction(async (t) => {
      const open = await models.Attendance.findOne({
        where: { userId: user.id, workDate, checkInAt: { [Op.ne]: null }, checkOutAt: { [Op.is]: null } },
        order: [['checkInAt', 'DESC']],
        transaction: t,
      });

      if (!open) {
        const err = new Error('No open check-in found for today');
        err.status = 409;
        throw err;
      }

      open.checkOutAt = now;
      open.checkOutMethod = validated.method;
      open.checkOutLat = validated.method === 'gps' ? validated.lat : null;
      open.checkOutLng = validated.method === 'gps' ? validated.lng : null;
      if (notes) {
        open.notes = open.notes ? `${open.notes}\n${notes}` : notes;
      }

      // Placeholder: determine overtime flag based on policies (e.g., shift hours)
      open.isOvertime = false;

      await open.save({ transaction: t });
      return this._serialize(open);
    });
  }

  // PUBLIC_INTERFACE
  async myAttendance({ userPayload, from, to, page = 1, pageSize = 20 }) {
    /** List attendance of the current user with optional date filtering and pagination. */
    this._ensureActiveUser(userPayload);

    const filterSchema = Joi.object({
      from: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow(null),
      to: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow(null),
      page: Joi.number().integer().min(1).default(1),
      pageSize: Joi.number().integer().min(1).max(100).default(20),
    });

    const { value, error } = filterSchema.validate({ from, to, page, pageSize });
    if (error) {
      const err = new Error(error.message);
      err.status = 400;
      throw err;
    }

    const where = { userId: userPayload.sub };
    if (value.from || value.to) {
      where.workDate = {};
      if (value.from) where.workDate[Op.gte] = value.from;
      if (value.to) where.workDate[Op.lte] = value.to;
    }

    const offset = (value.page - 1) * value.pageSize;

    const { rows, count } = await models.Attendance.findAndCountAll({
      where,
      order: [['workDate', 'DESC'], ['checkInAt', 'DESC']],
      limit: value.pageSize,
      offset,
    });

    return {
      total: count,
      page: value.page,
      pageSize: value.pageSize,
      data: rows.map((r) => this._serialize(r)),
    };
  }

  // PUBLIC_INTERFACE
  async listForUser({ requester, userId, from, to, page = 1, pageSize = 20 }) {
    /** Admin/Manager endpoint to list attendance for a given user. */
    this._ensureAdminLike(requester);

    const schema = Joi.object({
      userId: Joi.number().integer().positive().required(),
      from: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow(null),
      to: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow(null),
      page: Joi.number().integer().min(1).default(1),
      pageSize: Joi.number().integer().min(1).max(100).default(20),
    });

    const { value, error } = schema.validate({ userId, from, to, page, pageSize });
    if (error) {
      const err = new Error(error.message);
      err.status = 400;
      throw err;
    }

    const target = await models.User.findByPk(value.userId);
    if (!target) {
      const err = new Error('User not found');
      err.status = 404;
      throw err;
    }

    const where = { userId: value.userId };
    if (value.from || value.to) {
      where.workDate = {};
      if (value.from) where.workDate[Op.gte] = value.from;
      if (value.to) where.workDate[Op.lte] = value.to;
    }

    const offset = (value.page - 1) * value.pageSize;
    const { rows, count } = await models.Attendance.findAndCountAll({
      where,
      order: [['workDate', 'DESC'], ['checkInAt', 'DESC']],
      limit: value.pageSize,
      offset,
    });

    return {
      total: count,
      page: value.page,
      pageSize: value.pageSize,
      data: rows.map((r) => this._serialize(r)),
    };
  }

  _serialize(model) {
    return {
      id: model.id,
      userId: model.userId,
      workDate: model.workDate,
      checkInAt: model.checkInAt,
      checkInMethod: model.checkInMethod,
      checkInLat: model.checkInLat,
      checkInLng: model.checkInLng,
      checkOutAt: model.checkOutAt,
      checkOutMethod: model.checkOutMethod,
      checkOutLat: model.checkOutLat,
      checkOutLng: model.checkOutLng,
      isLate: model.isLate,
      isOvertime: model.isOvertime,
      faceVerified: model.faceVerified,
      notes: model.notes,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    };
  }
}

module.exports = new AttendanceService();
