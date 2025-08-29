'use strict';
/**
 * Leave model represents employee leave requests with status tracking and manager approval metadata.
 * Fields include type, dates, reason, status, approver info, and optional comments.
 */
module.exports = (sequelize, DataTypes) => {
  const Leave = sequelize.define(
    'Leave',
    {
      // FK to Users table (requester)
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      type: {
        type: DataTypes.ENUM('annual', 'sick', 'casual', 'unpaid', 'maternity', 'paternity', 'other'),
        allowNull: false,
        defaultValue: 'annual',
        comment: 'Leave type'
      },
      startDate: {
        type: DataTypes.DATEONLY,
        allowNull: false
      },
      endDate: {
        type: DataTypes.DATEONLY,
        allowNull: false
      },
      reason: {
        type: DataTypes.STRING(1000),
        allowNull: true
      },
      status: {
        type: DataTypes.ENUM('pending', 'approved', 'denied', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending'
      },
      approvedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'User ID of the manager/team_leader who approved/denied'
      },
      approvedAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      managerComment: {
        type: DataTypes.STRING(1000),
        allowNull: true
      }
    },
    {
      tableName: 'leaves',
      underscored: true,
      timestamps: true,
      indexes: [
        { fields: ['userId'] },
        { fields: ['status'] },
        { fields: ['startDate', 'endDate'] }
      ]
    }
  );

  Leave.associate = (models) => {
    Leave.belongsTo(models.User, { as: 'user', foreignKey: 'userId' });
    Leave.belongsTo(models.User, { as: 'approver', foreignKey: 'approvedBy' });
  };

  return Leave;
};
