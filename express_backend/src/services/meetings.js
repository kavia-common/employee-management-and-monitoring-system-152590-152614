'use strict';

const Joi = require('joi');
const { Op } = require('sequelize');
const { models, sequelize } = require('../db/sequelize');

/**
 * MeetingsService handles meeting CRUD and participant mapping with RBAC.
 * Admin-like roles (superadmin, manager, team_leader) can create/update/delete any meeting.
 * Employees can create meetings for themselves and manage those they organize.
 */
class MeetingsService {
  constructor() {
    this.adminRoles = ['superadmin', 'manager', 'team_leader'];
  }

  _hasAdminLike(userPayload) {
    const roles = Array.isArray(userPayload.roles) ? userPayload.roles : [userPayload.role].filter(Boolean);
    return roles.some((r) => this.adminRoles.includes(r));
  }

  _ensureAuthenticated(userPayload) {
    if (!userPayload || !userPayload.sub) {
      const err = new Error('Unauthorized');
      err.status = 401;
      throw err;
    }
  }

  _serializeMeeting(model, withParticipants = false) {
    const base = {
      id: model.id,
      title: model.title,
      description: model.description,
      startTime: model.startTime,
      endTime: model.endTime,
      durationMinutes: model.durationMinutes,
      location: model.location,
      organizerId: model.organizerId,
      status: model.status,
      isAllDay: model.isAllDay,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    };
    if (withParticipants) {
      const participants = Array.isArray(model.participants)
        ? model.participants.map((u) => {
            // Include join attributes
            const mp = u.MeetingParticipant || {};
            return {
              userId: u.id,
              name: u.name,
              email: u.email,
              participantRole: mp.participantRole || 'required',
              responseStatus: mp.responseStatus || 'pending',
              notifiedAt: mp.notifiedAt || null,
            };
          })
        : [];
      base.participants = participants;
    }
    return base;
  }

  _validateParticipants(participants) {
    const schema = Joi.array()
      .items(
        Joi.object({
          userId: Joi.number().integer().positive().required(),
          participantRole: Joi.string().valid('required', 'optional').default('required'),
        })
      )
      .unique((a, b) => a.userId === b.userId)
      .default([]);

    const { value, error } = schema.validate(participants || []);
    if (error) {
      const err = new Error(error.message);
      err.status = 400;
      throw err;
    }
    return value;
  }

  _validateCreatePayload(payload) {
    const schema = Joi.object({
      title: Joi.string().max(200).required(),
      description: Joi.string().allow(null, ''),
      startTime: Joi.date().required(),
      endTime: Joi.date().required(),
      durationMinutes: Joi.number().integer().min(0).allow(null),
      location: Joi.string().max(255).allow(null, ''),
      isAllDay: Joi.boolean().default(false),
      participants: Joi.array().default([]), // validated later
    });

    const { value, error } = schema.validate(payload);
    if (error) {
      const err = new Error(error.message);
      err.status = 400;
      throw err;
    }
    if (new Date(value.endTime) <= new Date(value.startTime)) {
      const err = new Error('endTime must be after startTime');
      err.status = 400;
      throw err;
    }
    return value;
  }

  _validateUpdatePayload(payload) {
    const schema = Joi.object({
      title: Joi.string().max(200),
      description: Joi.string().allow(null, ''),
      startTime: Joi.date(),
      endTime: Joi.date(),
      durationMinutes: Joi.number().integer().min(0).allow(null),
      location: Joi.string().max(255).allow(null, ''),
      isAllDay: Joi.boolean(),
      status: Joi.string().valid('scheduled', 'cancelled', 'completed'),
      participants: Joi.array(), // validated later if provided
    });

    const { value, error } = schema.validate(payload);
    if (error) {
      const err = new Error(error.message);
      err.status = 400;
      throw err;
    }
    if (value.startTime && value.endTime && new Date(value.endTime) <= new Date(value.startTime)) {
      const err = new Error('endTime must be after startTime');
      err.status = 400;
      throw err;
    }
    return value;
  }

  // PUBLIC_INTERFACE
  async createMeeting({ userPayload, body }) {
    /** Create a meeting. Organizer is the authenticated user. Participants mapping created. */
    this._ensureAuthenticated(userPayload);
    const organizerId = userPayload.sub;

    const value = this._validateCreatePayload(body);
    const participants = this._validateParticipants(value.participants);

    return await sequelize.transaction(async (t) => {
      const meeting = await models.Meeting.create(
        {
          title: value.title,
          description: value.description ?? null,
          startTime: value.startTime,
          endTime: value.endTime,
          durationMinutes: value.durationMinutes ?? null,
          location: value.location ?? null,
          organizerId,
          status: 'scheduled',
          isAllDay: value.isAllDay ?? false,
        },
        { transaction: t }
      );

      // Ensure organizer is also a participant (required) unless explicitly provided
      const participantsSet = new Map(participants.map((p) => [p.userId, p.participantRole]));
      if (!participantsSet.has(organizerId)) {
        participantsSet.set(organizerId, 'required');
      }

      const mappings = Array.from(participantsSet.entries()).map(([userId, participantRole]) => ({
        meetingId: meeting.id,
        userId,
        participantRole,
        responseStatus: userId === organizerId ? 'accepted' : 'pending',
      }));
      if (mappings.length) {
        await models.MeetingParticipant.bulkCreate(mappings, { transaction: t, ignoreDuplicates: true });
      }

      const created = await models.Meeting.findByPk(meeting.id, {
        include: [
          {
            model: models.User,
            as: 'participants',
            attributes: ['id', 'name', 'email'],
            through: { attributes: ['participantRole', 'responseStatus', 'notifiedAt'] },
          },
        ],
        transaction: t,
      });

      return this._serializeMeeting(created, true);
    });
  }

  // PUBLIC_INTERFACE
  async listMeetings({ userPayload, query }) {
    /** List meetings visible to the user. Admin-like sees all; others see meetings they participate in or organize. Supports date filters and pagination. */
    this._ensureAuthenticated(userPayload);
    const isAdmin = this._hasAdminLike(userPayload);

    const schema = Joi.object({
      from: Joi.date().allow(null),
      to: Joi.date().allow(null),
      status: Joi.string().valid('scheduled', 'cancelled', 'completed').allow(null),
      page: Joi.number().integer().min(1).default(1),
      pageSize: Joi.number().integer().min(1).max(100).default(20),
      organizerId: Joi.number().integer().positive().allow(null),
      withParticipants: Joi.boolean().default(false),
    });

    const { value, error } = schema.validate(query || {});
    if (error) {
      const err = new Error(error.message);
      err.status = 400;
      throw err;
    }

    const where = {};
    if (value.status) where.status = value.status;
    if (value.from || value.to) {
      where.startTime = {};
      if (value.from) where.startTime[Op.gte] = value.from;
      if (value.to) where.startTime[Op.lte] = value.to;
    }
    if (isAdmin && value.organizerId) {
      where.organizerId = value.organizerId;
    }

    const offset = (value.page - 1) * value.pageSize;

    const include = [];
    if (!isAdmin) {
      // Restrict to meetings where the user is organizer or participant
      include.push({
        model: models.User,
        as: 'participants',
        attributes: ['id'],
        through: { attributes: [] },
        required: false,
        where: { id: userPayload.sub },
      });
      where[Op.or] = [
        { organizerId: userPayload.sub },
        // The include above handles participant linkage; to ensure OR behavior, we keep it here as an include with required false
      ];
    }
    if (value.withParticipants) {
      include.push({
        model: models.User,
        as: 'participants',
        attributes: ['id', 'name', 'email'],
        through: { attributes: ['participantRole', 'responseStatus', 'notifiedAt'] },
        required: false,
      });
    }

    // Remove duplicate includes if withParticipants + restriction added two participant includes
    const deDupedInclude = [];
    const seenAliases = new Set();
    for (const inc of include) {
      const key = inc.as || '';
      if (seenAliases.has(key)) continue;
      seenAliases.add(key);
      deDupedInclude.push(inc);
    }

    const { rows, count } = await models.Meeting.findAndCountAll({
      where,
      include: deDupedInclude,
      order: [['startTime', 'DESC'], ['id', 'DESC']],
      limit: value.pageSize,
      offset,
      distinct: true, // ensure count correct with includes
    });

    return {
      total: count,
      page: value.page,
      pageSize: value.pageSize,
      data: rows.map((r) => this._serializeMeeting(r, !!value.withParticipants)),
    };
  }

  // PUBLIC_INTERFACE
  async getMeeting({ userPayload, meetingId }) {
    /** Get a single meeting by ID if user can view it. */
    this._ensureAuthenticated(userPayload);

    const meeting = await models.Meeting.findByPk(meetingId, {
      include: [
        { model: models.User, as: 'participants', attributes: ['id', 'name', 'email'], through: { attributes: ['participantRole', 'responseStatus', 'notifiedAt'] } },
      ],
    });
    if (!meeting) {
      const err = new Error('Meeting not found');
      err.status = 404;
      throw err;
    }

    if (!this._hasAdminLike(userPayload) && meeting.organizerId !== userPayload.sub) {
      const isParticipant = Array.isArray(meeting.participants) && meeting.participants.some((p) => p.id === userPayload.sub);
      if (!isParticipant) {
        const err = new Error('Forbidden');
        err.status = 403;
        throw err;
      }
    }

    return this._serializeMeeting(meeting, true);
  }

  // PUBLIC_INTERFACE
  async updateMeeting({ userPayload, meetingId, body }) {
    /** Update meeting fields and optionally reset participants. Organizer or admin-like can update. */
    this._ensureAuthenticated(userPayload);
    const value = this._validateUpdatePayload(body);

    return await sequelize.transaction(async (t) => {
      const meeting = await models.Meeting.findByPk(meetingId, {
        include: [{ model: models.User, as: 'participants', attributes: ['id'], through: { attributes: ['participantRole'] } }],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!meeting) {
        const err = new Error('Meeting not found');
        err.status = 404;
        throw err;
      }

      const isAdmin = this._hasAdminLike(userPayload);
      if (!isAdmin && meeting.organizerId !== userPayload.sub) {
        const err = new Error('Forbidden');
        err.status = 403;
        throw err;
      }

      const fields = ['title', 'description', 'startTime', 'endTime', 'durationMinutes', 'location', 'isAllDay', 'status'];
      for (const f of fields) {
        if (Object.prototype.hasOwnProperty.call(value, f)) {
          meeting[f] = value[f];
        }
      }
      await meeting.save({ transaction: t });

      if (Array.isArray(value.participants)) {
        const participants = this._validateParticipants(value.participants);
        // Build a target map and ensure organizer is present
        const target = new Map(participants.map((p) => [p.userId, p.participantRole]));
        if (!target.has(meeting.organizerId)) target.set(meeting.organizerId, 'required');

        // Fetch current mappings
        const existingMappings = await models.MeetingParticipant.findAll({
          where: { meetingId: meeting.id },
          transaction: t,
        });
        const existingMap = new Map(existingMappings.map((m) => [m.userId, m]));

        // Upsert needed
        for (const [userId, participantRole] of target.entries()) {
          const current = existingMap.get(userId);
          if (!current) {
            await models.MeetingParticipant.create(
              { meetingId: meeting.id, userId, participantRole, responseStatus: userId === meeting.organizerId ? 'accepted' : 'pending' },
              { transaction: t }
            );
          } else if (current.participantRole !== participantRole) {
            current.participantRole = participantRole;
            await current.save({ transaction: t });
          }
        }
        // Remove extras
        for (const [userId, current] of existingMap.entries()) {
          if (!target.has(userId)) {
            await models.MeetingParticipant.destroy({ where: { meetingId: meeting.id, userId }, transaction: t });
          }
        }
      }

      const updated = await models.Meeting.findByPk(meeting.id, {
        include: [
          { model: models.User, as: 'participants', attributes: ['id', 'name', 'email'], through: { attributes: ['participantRole', 'responseStatus', 'notifiedAt'] } },
        ],
        transaction: t,
      });
      return this._serializeMeeting(updated, true);
    });
  }

  // PUBLIC_INTERFACE
  async deleteMeeting({ userPayload, meetingId }) {
    /** Delete a meeting. Organizer or admin-like only. */
    this._ensureAuthenticated(userPayload);

    return await sequelize.transaction(async (t) => {
      const meeting = await models.Meeting.findByPk(meetingId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!meeting) {
        const err = new Error('Meeting not found');
        err.status = 404;
        throw err;
      }
      const isAdmin = this._hasAdminLike(userPayload);
      if (!isAdmin && meeting.organizerId !== userPayload.sub) {
        const err = new Error('Forbidden');
        err.status = 403;
        throw err;
      }

      await models.MeetingParticipant.destroy({ where: { meetingId: meeting.id }, transaction: t });
      await meeting.destroy({ transaction: t });
      return { deleted: true, id: meetingId };
    });
  }

  // PUBLIC_INTERFACE
  async setParticipantResponse({ userPayload, meetingId, status }) {
    /** Participant sets their RSVP/responseStatus for a meeting. */
    this._ensureAuthenticated(userPayload);
    const schema = Joi.object({
      status: Joi.string().valid('pending', 'accepted', 'declined', 'tentative').required(),
    });
    const { value, error } = schema.validate({ status });
    if (error) {
      const err = new Error(error.message);
      err.status = 400;
      throw err;
    }

    const mp = await models.MeetingParticipant.findOne({
      where: { meetingId, userId: userPayload.sub },
    });
    if (!mp) {
      const err = new Error('Not a participant of this meeting');
      err.status = 403;
      throw err;
    }
    mp.responseStatus = value.status;
    await mp.save();

    // Return latest meeting snapshot
    const meeting = await models.Meeting.findByPk(meetingId, {
      include: [{ model: models.User, as: 'participants', attributes: ['id', 'name', 'email'], through: { attributes: ['participantRole', 'responseStatus', 'notifiedAt'] } }],
    });
    return this._serializeMeeting(meeting, true);
  }

  // PUBLIC_INTERFACE
  async generateIcs({ userPayload, meetingId }) {
    /** Placeholder: Generate ICS content for a meeting. Returns a simple string; can be extended to use ics library. */
    this._ensureAuthenticated(userPayload);

    const meeting = await models.Meeting.findByPk(meetingId, {
      include: [{ model: models.User, as: 'participants', attributes: ['id', 'name', 'email'], through: { attributes: ['participantRole'] } }],
    });
    if (!meeting) {
      const err = new Error('Meeting not found');
      err.status = 404;
      throw err;
    }

    // Access control: must be organizer/participant/admin-like
    const isAdmin = this._hasAdminLike(userPayload);
    const isOrganizer = meeting.organizerId === userPayload.sub;
    const isParticipant = Array.isArray(meeting.participants) && meeting.participants.some((p) => p.id === userPayload.sub);
    if (!isAdmin && !isOrganizer && !isParticipant) {
      const err = new Error('Forbidden');
      err.status = 403;
      throw err;
    }

    // Minimal ICS placeholder content (not fully RFC5545-compliant). Replace with a library if needed.
    const uid = `meeting-${meeting.id}@ems.local`;
    const dtStart = new Date(meeting.startTime).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const dtEnd = new Date(meeting.endTime).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//EMS//Meetings//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${(meeting.title || '').replace(/\n/g, ' ')}`,
      `DESCRIPTION:${(meeting.description || '').replace(/\n/g, ' ')}`,
      `LOCATION:${(meeting.location || '').replace(/\n/g, ' ')}`,
      `STATUS:${meeting.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ];
    const content = lines.join('\r\n');

    return { filename: `meeting-${meeting.id}.ics`, contentType: 'text/calendar', content };
  }
}

module.exports = new MeetingsService();
