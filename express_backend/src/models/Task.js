'use strict';

/**
 * Task model.
 * Represents a task belonging to a project; can be assigned to users.
 */
module.exports = (sequelize, DataTypes) => {
  const Task = sequelize.define(
    'Task',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      projectId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        field: 'project_id',
        references: { model: 'projects', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      title: {
        type: DataTypes.STRING(200),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('todo', 'in_progress', 'blocked', 'done'),
        allowNull: false,
        defaultValue: 'todo',
      },
      priority: {
        type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
        allowNull: false,
        defaultValue: 'medium',
      },
      dueDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'due_date',
      },
      createdById: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        field: 'created_by_id',
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
    },
    {
      tableName: 'tasks',
      underscored: true,
      indexes: [
        { fields: ['project_id'] },
        { fields: ['status'] },
        { fields: ['priority'] },
        { fields: ['due_date'] },
      ],
    }
  );

  // PUBLIC_INTERFACE
  Task.associate = (models) => {
    /** Associations for Task. */
    Task.belongsTo(models.Project, { foreignKey: 'project_id', as: 'project' });
    Task.belongsTo(models.User, { foreignKey: 'created_by_id', as: 'createdBy' });

    // Many-to-Many: Task <-> User (assignees) via TaskAssignment
    Task.belongsToMany(models.User, {
      through: models.TaskAssignment,
      foreignKey: 'task_id',
      otherKey: 'user_id',
      as: 'assignees',
    });
  };

  return Task;
};
