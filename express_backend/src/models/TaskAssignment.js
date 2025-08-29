'use strict';

/**
 * TaskAssignment model (join).
 * Assigns users to tasks with optional assignment metadata.
 */
module.exports = (sequelize, DataTypes) => {
  const TaskAssignment = sequelize.define(
    'TaskAssignment',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      taskId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        field: 'task_id',
        references: { model: 'tasks', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      userId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        field: 'user_id',
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      assignedBy: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
        field: 'assigned_by',
      },
      assignedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'assigned_at',
        defaultValue: null,
      },
    },
    {
      tableName: 'task_assignments',
      underscored: true,
      indexes: [
        { unique: true, fields: ['task_id', 'user_id'] },
        { fields: ['user_id'] },
      ],
    }
  );

  // PUBLIC_INTERFACE
  TaskAssignment.associate = (models) => {
    /** Optional belongsTo for clarity */
    TaskAssignment.belongsTo(models.Task, { foreignKey: 'task_id', as: 'task' });
    TaskAssignment.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
  };

  return TaskAssignment;
};
