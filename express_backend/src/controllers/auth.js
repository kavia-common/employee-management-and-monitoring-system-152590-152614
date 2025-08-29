'use strict';

const Joi = require('joi');
const authService = require('../services/auth');

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(100).required(),
  name: Joi.string().max(120).allow(null, '').optional(),
  role: Joi.string().valid('superadmin', 'manager', 'team_leader', 'employee').default('employee'),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(100).required(),
});

class AuthController {
  // PUBLIC_INTERFACE
  async register(req, res) {
    /** Register a new user and return JWT token. */
    try {
      const { value, error } = registerSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ status: 'error', message: error.message });
      }
      const result = await authService.register(value);
      return res.status(201).json({ status: 'ok', ...result });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({ status: 'error', message: err.message || 'Registration failed' });
    }
  }

  // PUBLIC_INTERFACE
  async login(req, res) {
    /** Login user and return JWT token. */
    try {
      const { value, error } = loginSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ status: 'error', message: error.message });
      }
      const result = await authService.login(value);
      return res.status(200).json({ status: 'ok', ...result });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({ status: 'error', message: err.message || 'Login failed' });
    }
  }

  // PUBLIC_INTERFACE
  async me(req, res) {
    /** Return payload info for authenticated user. */
    return res.status(200).json({ status: 'ok', user: req.user });
  }
}

module.exports = new AuthController();
