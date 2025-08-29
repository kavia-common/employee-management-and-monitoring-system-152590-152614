'use strict';

const Joi = require('joi');
const meetingsService = require('../services/meetings');

/**
 * MeetingsController exposing endpoints:
 * - POST /meetings (create)
 * - GET /meetings (list)
 * - GET /meetings/:id (get by id)
 * - PUT /meetings/:id (update)
 * - DELETE /meetings/:id (delete)
 * - POST /meetings/:id/participants/response (set participant response)
 * - GET /meetings/:id/ics (download ICS placeholder)
 */
class MeetingsController {
  // PUBLIC_INTERFACE
  async create(req, res) {
    /** Create a meeting with participants. Organizer is current user. */
    try {
      const data = await meetingsService.createMeeting({ userPayload: req.user, body: req.body });
      return res.status(201).json({ status: 'ok', data });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({ status: 'error', message: err.message || 'Failed to create meeting' });
    }
  }

  // PUBLIC_INTERFACE
  async list(req, res) {
    /** List meetings, supports filters and pagination. */
    try {
      const result = await meetingsService.listMeetings({ userPayload: req.user, query: req.query });
      return res.status(200).json({ status: 'ok', ...result });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({ status: 'error', message: err.message || 'Failed to list meetings' });
    }
  }

  // PUBLIC_INTERFACE
  async getById(req, res) {
    /** Fetch a meeting by ID if user has access. */
    try {
      const meetingId = Number(req.params.id);
      if (!Number.isInteger(meetingId) || meetingId <= 0) {
        return res.status(400).json({ status: 'error', message: 'Invalid meeting id' });
      }
      const data = await meetingsService.getMeeting({ userPayload: req.user, meetingId });
      return res.status(200).json({ status: 'ok', data });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({ status: 'error', message: err.message || 'Failed to get meeting' });
    }
  }

  // PUBLIC_INTERFACE
  async update(req, res) {
    /** Update meeting by ID (organizer/admin only). */
    try {
      const meetingId = Number(req.params.id);
      if (!Number.isInteger(meetingId) || meetingId <= 0) {
        return res.status(400).json({ status: 'error', message: 'Invalid meeting id' });
      }
      const data = await meetingsService.updateMeeting({ userPayload: req.user, meetingId, body: req.body });
      return res.status(200).json({ status: 'ok', data });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({ status: 'error', message: err.message || 'Failed to update meeting' });
    }
  }

  // PUBLIC_INTERFACE
  async remove(req, res) {
    /** Delete meeting by ID (organizer/admin only). */
    try {
      const meetingId = Number(req.params.id);
      if (!Number.isInteger(meetingId) || meetingId <= 0) {
        return res.status(400).json({ status: 'error', message: 'Invalid meeting id' });
      }
      const result = await meetingsService.deleteMeeting({ userPayload: req.user, meetingId });
      return res.status(200).json({ status: 'ok', ...result });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({ status: 'error', message: err.message || 'Failed to delete meeting' });
    }
  }

  // PUBLIC_INTERFACE
  async setResponse(req, res) {
    /** Set participant responseStatus for the current user. */
    try {
      const meetingId = Number(req.params.id);
      if (!Number.isInteger(meetingId) || meetingId <= 0) {
        return res.status(400).json({ status: 'error', message: 'Invalid meeting id' });
      }
      const schema = Joi.object({ status: Joi.string().valid('pending', 'accepted', 'declined', 'tentative').required() });
      const { value, error } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({ status: 'error', message: error.message });
      }
      const data = await meetingsService.setParticipantResponse({ userPayload: req.user, meetingId, status: value.status });
      return res.status(200).json({ status: 'ok', data });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({ status: 'error', message: err.message || 'Failed to set response' });
    }
  }

  // PUBLIC_INTERFACE
  async getIcs(req, res) {
    /** Returns ICS content for a meeting (placeholder). */
    try {
      const meetingId = Number(req.params.id);
      if (!Number.isInteger(meetingId) || meetingId <= 0) {
        return res.status(400).json({ status: 'error', message: 'Invalid meeting id' });
      }
      const file = await meetingsService.generateIcs({ userPayload: req.user, meetingId });
      res.setHeader('Content-Type', file.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
      return res.status(200).send(file.content);
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({ status: 'error', message: err.message || 'Failed to generate ICS' });
    }
  }
}

module.exports = new MeetingsController();
