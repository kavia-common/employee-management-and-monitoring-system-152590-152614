'use strict';

const projectsService = require('../services/projects');

/**
 * ProjectsController with CRUD operations.
 */
class ProjectsController {
  // PUBLIC_INTERFACE
  async create(req, res) {
    /** Create a project. Body includes name, description, status, priority, dates, members[]. */
    try {
      const data = await projectsService.createProject({ userPayload: req.user, body: req.body });
      return res.status(201).json({ status: 'ok', data });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({ status: 'error', message: err.message || 'Failed to create project' });
    }
  }

  // PUBLIC_INTERFACE
  async list(req, res) {
    /** List projects with filters and pagination. */
    try {
      const result = await projectsService.listProjects({ userPayload: req.user, query: req.query });
      return res.status(200).json({ status: 'ok', ...result });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({ status: 'error', message: err.message || 'Failed to list projects' });
    }
  }

  // PUBLIC_INTERFACE
  async getById(req, res) {
    /** Get a project by ID with members and tasks. */
    try {
      const projectId = Number(req.params.id);
      if (!Number.isInteger(projectId) || projectId <= 0) {
        return res.status(400).json({ status: 'error', message: 'Invalid project id' });
      }
      const data = await projectsService.getProject({ userPayload: req.user, projectId });
      return res.status(200).json({ status: 'ok', data });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({ status: 'error', message: err.message || 'Failed to get project' });
    }
  }

  // PUBLIC_INTERFACE
  async update(req, res) {
    /** Update a project by ID. */
    try {
      const projectId = Number(req.params.id);
      if (!Number.isInteger(projectId) || projectId <= 0) {
        return res.status(400).json({ status: 'error', message: 'Invalid project id' });
      }
      const data = await projectsService.updateProject({ userPayload: req.user, projectId, body: req.body });
      return res.status(200).json({ status: 'ok', data });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({ status: 'error', message: err.message || 'Failed to update project' });
    }
  }

  // PUBLIC_INTERFACE
  async remove(req, res) {
    /** Delete a project by ID. */
    try {
      const projectId = Number(req.params.id);
      if (!Number.isInteger(projectId) || projectId <= 0) {
        return res.status(400).json({ status: 'error', message: 'Invalid project id' });
      }
      const result = await projectsService.deleteProject({ userPayload: req.user, projectId });
      return res.status(200).json({ status: 'ok', ...result });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({ status: 'error', message: err.message || 'Failed to delete project' });
    }
  }
}

module.exports = new ProjectsController();
