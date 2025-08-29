'use strict';

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { getConfig } = require('../config');
const { models } = require('../db/sequelize');

const config = getConfig();

/**
 * AuthService encapsulates registration, login and token generation logic.
 */
class AuthService {
  // PUBLIC_INTERFACE
  async register({ email, password, name = null, role = 'employee' }) {
    /** Create a new user with hashed password. Throws if email exists. Returns safe user and token. */
    const existing = await models.User.findOne({ where: { email } });
    if (existing) {
      const error = new Error('Email already registered');
      error.status = 409;
      throw error;
    }

    // We are storing into passwordHash, model hook will hash if not hashed
    const user = await models.User.create({
      email,
      passwordHash: password,
      name,
      role,
    });

    const token = this._generateToken(user);
    return { user: this._safeUser(user), token };
  }

  // PUBLIC_INTERFACE
  async login({ email, password }) {
    /** Authenticate a user by email and password. Returns safe user and token. */
    const user = await models.User.findOne({ where: { email } });
    if (!user) {
      const error = new Error('Invalid credentials');
      error.status = 401;
      throw error;
    }
    if (!user.isActive) {
      const error = new Error('Account is deactivated');
      error.status = 403;
      throw error;
    }

    const valid = await user.verifyPassword(password);
    if (!valid) {
      const error = new Error('Invalid credentials');
      error.status = 401;
      throw error;
    }

    const token = this._generateToken(user);
    return { user: this._safeUser(user), token };
  }

  // PUBLIC_INTERFACE
  verifyToken(token) {
    /** Verify a JWT token and return its payload. Throws on invalid/expired token. */
    return jwt.verify(token, config.auth.jwtSecret);
  }

  _generateToken(user) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    return jwt.sign(payload, config.auth.jwtSecret, { expiresIn: config.auth.jwtExpiresIn });
  }

  _safeUser(user) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}

module.exports = new AuthService();
