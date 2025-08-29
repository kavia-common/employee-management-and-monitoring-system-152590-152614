const { sequelize } = require('../db/sequelize');

class HealthService {
  getStatus() {
    const dbHealthy = sequelize ? sequelize.options.host : 'unknown';
    return {
      status: 'ok',
      message: 'Service is healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      db: {
        connectedTo: dbHealthy,
        dialect: 'mysql'
      }
    };
  }
}

module.exports = new HealthService();
