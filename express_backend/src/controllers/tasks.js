'use strict';

const tasksService = require('../services/tasks');

/**
 * TasksController with CRUD, assignment, and filtering.
 */
class TasksController {
  // PUBLIC_INTERFACE
  async create(req, res) {
    /** Create a task in a project; requires appropriate RBAC. */
    try {
      const data = await tasksService.createTask({ userPayload: req.user, body: req.body });
      return res.status(201).json({ status: 'ok', data });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({ status: 'error', message: err.message || 'Failed to create task' });
    }
  }

  // PUBLIC_INTERFACE
  async list(req, res) {
    /** List tasks with filters and pagination. */
    try {
      const result = await tasksService.listTasks({ userPayload: req.user, query: req.query });
      return res.status(200).json({ status: 'ok', ...result });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({ status: 'error', message: err.message || 'Failed to list tasks' });
    }
  }

  // PUBLIC_INTERFACE
  async getById(req, res) {
    /** Get a task by ID with assignees. */
    try {
      const taskId = Number(req.params.id);
      if (!Number.isInteger(taskId) || taskId <= 0) {
        return res.status(400).json({ status: 'error', message: 'Invalid task id' });
      }
      const data = await tasksService.getTask({ userPayload: req.user, taskId });
      return res.status(200).json({ status: 'ok', data });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({ status: 'error', message: err.message || 'Failed to get task' });
    }
  }

  // PUBLIC_INTERFACE
  async update(req, res) {
    /** Update a task by ID; only authorized users can update. */
    try {
      const taskId = Number(req.params.id);
      if (!Number.isInteger(taskId) || taskId <= 0) {
        return res.status(400).json({ status: 'error', message: 'Invalid task id' });
      }
      const data = await tasksService.updateTask({ userPayload: req.user, taskId, body: req.body });
      return res.status(200).json({ status: 'ok', data });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({ status: 'error', message: err.message || 'Failed to update task' });
    }
  }

  // PUBLIC_INTERFACE
  async remove(req, res) {
    /** Delete a task by ID; only authorized users can delete. */
    try {
      const taskId = Number(req.params.id);
      if (!Number.isInteger(taskId) || taskId <= 0) {
        return res.status(400).json({ status: 'error', message: 'Invalid task id' });
      }
      const result = await tasksService.deleteTask({ userPayload: req.user, taskId });
      return res.status(200).json({ status: 'ok', ...result });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({ status: 'error', message: err.message || 'Failed to delete task' });
    }
  }
}

module.exports = new TasksController();
