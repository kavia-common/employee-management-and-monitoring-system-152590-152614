'use strict';

/**
 * Sequelize initialization and database connection management.
 * - Initializes Sequelize using configuration loaded from src/config
 * - Loads models from src/models directory (scaffolded)
 * - Exports sequelize instance and models registry for use by services
 */

const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');
const { getConfig } = require('../config');

const config = getConfig();

// Initialize Sequelize instance
const sequelize = new Sequelize(
  config.db.database,
  config.db.username,
  config.db.password,
  {
    host: config.db.host,
    port: config.db.port,
    dialect: config.db.dialect,
    logging: config.db.logging,
    pool: config.db.pool,
  }
);

// Models registry
const db = {
  sequelize,
  Sequelize,
  models: {},
};

// Dynamically load all models in src/models
const modelsDir = path.join(__dirname, '..', 'models');
if (fs.existsSync(modelsDir)) {
  fs.readdirSync(modelsDir)
    .filter((file) => file.endsWith('.js'))
    .forEach((file) => {
      // Each model should export a function: (sequelize, DataTypes) => Model
      const defineModel = require(path.join(modelsDir, file));
      const model = defineModel(sequelize, Sequelize.DataTypes);
      db.models[model.name] = model;
    });

  // Run associate if available
  Object.values(db.models).forEach((model) => {
    if (typeof model.associate === 'function') {
      model.associate(db.models);
    }
  });
}

// PUBLIC_INTERFACE
async function testConnection() {
  /** Tests the DB connection. Throws on failure. */
  await sequelize.authenticate();
  return true;
}

// PUBLIC_INTERFACE
async function syncDatabase(options = { alter: false, force: false }) {
  /**
   * Synchronizes all defined models with the database.
   * options: { alter?: boolean, force?: boolean }
   */
  await sequelize.sync(options);
  return true;
}

module.exports = {
  ...db,
  testConnection,
  syncDatabase,
};
