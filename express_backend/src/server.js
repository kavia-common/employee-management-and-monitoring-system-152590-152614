'use strict';

const app = require('./app');
const { getConfig } = require('./config');
const { testConnection, syncDatabase } = require('./db/sequelize');

const { port: PORT, host: HOST } = getConfig().server;

// Test DB connection on startup (non-blocking for server start)
(async () => {
  try {
    await testConnection();
    // eslint-disable-next-line no-console
    console.log('Database connection established successfully.');
    // Sync models (safe default: no force/alter)
    await syncDatabase({ alter: false, force: false });
    // eslint-disable-next-line no-console
    console.log('Database schemas synchronized.');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Unable to connect to the database:', err && err.message ? err.message : err);
  }
})();

const server = app.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running at http://${HOST}:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  // eslint-disable-next-line no-console
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    // eslint-disable-next-line no-console
    console.log('HTTP server closed');
    process.exit(0);
  });
});

module.exports = server;
