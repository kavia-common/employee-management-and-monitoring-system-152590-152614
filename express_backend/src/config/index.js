'use strict';

/**
 * Centralized configuration loader for the backend.
 * - Loads environment variables via dotenv
 * - Validates required variables and provides sane defaults
 * - Exposes config used across the app (DB, JWT, server settings)
 */

const path = require('path');
const Joi = require('joi');

// Load .env from the project root of this container
require('dotenv').config({
  path: path.resolve(__dirname, '../../.env'),
});

// Validation schema for required environment variables
const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().integer().min(1).max(65535).default(3000),
  HOST: Joi.string().default('0.0.0.0'),

  // Database connection settings
  DB_HOST: Joi.string().required().description('Database host'),
  DB_PORT: Joi.number().integer().min(1).max(65535).required().description('Database port'),
  DB_USER: Joi.string().required().description('Database username'),
  DB_PASS: Joi.string().allow('').default('').description('Database password'),
  DB_NAME: Joi.string().required().description('Database name'),

  // Auth and security
  JWT_SECRET: Joi.string().min(16).default('dev-insecure-secret-change-me'),
  JWT_EXPIRES_IN: Joi.string().default('1d'),
  RATE_LIMIT_WINDOW_MS: Joi.number().integer().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: Joi.number().integer().default(100),
}).unknown(true);

const { value: env, error } = envSchema.validate(process.env);
if (error) {
  // Fail fast for mandatory variables
  // eslint-disable-next-line no-console
  console.error('Environment validation error:', error.message);
  throw error;
}

// PUBLIC_INTERFACE
function getConfig() {
  /** Returns the loaded and validated configuration object. */
  return {
    env: env.NODE_ENV,
    server: {
      port: env.PORT,
      host: env.HOST,
    },
    db: {
      host: env.DB_HOST,
      port: Number(env.DB_PORT),
      username: env.DB_USER,
      password: env.DB_PASS,
      database: env.DB_NAME,
      dialect: 'mysql',
      logging: env.NODE_ENV === 'development' ? console.log : false,
      pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000,
      },
    },
    auth: {
      jwtSecret: env.JWT_SECRET,
      jwtExpiresIn: env.JWT_EXPIRES_IN,
    },
    rateLimit: {
      windowMs: Number(env.RATE_LIMIT_WINDOW_MS),
      max: Number(env.RATE_LIMIT_MAX),
    },
  };
}

module.exports = {
  getConfig,
};
