'use strict';

/**
 * ProjectMember model (join).
 * Associates users to projects as members with optional roles.
 */
module.exports = (sequelize, DataTypes) => {
  const ProjectMember = sequelize.define(
    'ProjectMember',
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
      userId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        field: 'user_id',
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      memberRole: {
        type: DataTypes.ENUM('owner', 'manager', 'contributor', 'viewer'),
        allowNull: false,
        defaultValue: 'contributor',
        field: 'member_role',
      },
    },
    {
      tableName: 'project_members',
      underscored: true,
      indexes: [
        { unique: true, fields: ['project_id', 'user_id'] },
        { fields: ['user_id'] },
      ],
    }
  );

  // PUBLIC_INTERFACE
  ProjectMember.associate = (models) => {
    /** Optional belongsTo for clarity */
    ProjectMember.belongsTo(models.Project, { foreignKey: 'project_id', as: 'project' });
    ProjectMember.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
  };

  return ProjectMember;
};
