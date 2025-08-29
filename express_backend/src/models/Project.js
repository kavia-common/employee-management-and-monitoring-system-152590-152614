'use strict';

/**
 * Project model.
 * Represents a project that can have many tasks and user associations.
 */
module.exports = (sequelize, DataTypes) => {
  const Project = sequelize.define(
    'Project',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(200),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('planned', 'active', 'on_hold', 'completed', 'cancelled'),
        allowNull: false,
        defaultValue: 'planned',
      },
      priority: {
        type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
        allowNull: false,
        defaultValue: 'medium',
      },
      startDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'start_date',
      },
      dueDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'due_date',
      },
      ownerId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        field: 'owner_id',
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
        comment: 'User ID of the project owner/creator',
      },
    },
    {
      tableName: 'projects',
      underscored: true,
      indexes: [
        { fields: ['owner_id'] },
        { fields: ['status'] },
        { fields: ['priority'] },
      ],
    }
  );

  // PUBLIC_INTERFACE
  Project.associate = (models) => {
    /** Associations for Project. */
    Project.belongsTo(models.User, { foreignKey: 'owner_id', as: 'owner' });

    // Many-to-Many: Project <-> User (members) via ProjectMember
    Project.belongsToMany(models.User, {
      through: models.ProjectMember,
      foreignKey: 'project_id',
      otherKey: 'user_id',
      as: 'members',
    });

    // One-to-Many: Project has many tasks
    Project.hasMany(models.Task, {
      foreignKey: 'project_id',
      as: 'tasks',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });
  };

  return Project;
};
