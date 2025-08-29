const { DataTypes } = require('sequelize');
const sequelize = require('../db/sequelize');
const User = require('./User');

/**
 * Notification model represents a message sent to a specific user.
 * Includes optional deviceToken to trigger push notifications (stubbed Firebase integration).
 */
const Notification = sequelize.define('Notification', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  recipientId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  body: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  data: {
    // Arbitrary JSON payload
    type: DataTypes.JSON,
    allowNull: true,
  },
  readAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  deviceToken: {
    // Optional FCM device token for push delivery
    type: DataTypes.STRING(512),
    allowNull: true,
  },
  createdBySystem: {
    // Flag to indicate a system process originated this notification
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
}, {
  tableName: 'notifications',
  timestamps: true,
  paranoid: false,
  indexes: [
    { fields: ['recipientId'] },
    { fields: ['readAt'] },
    { fields: ['createdAt'] },
  ],
});

// Associations
Notification.belongsTo(User, { as: 'recipient', foreignKey: 'recipientId' });

module.exports = Notification;
