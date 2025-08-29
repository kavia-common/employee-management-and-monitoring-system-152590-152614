'use strict';

/**
 * Role model.
 * Represents a system role (e.g., superadmin, manager, team_leader, employee).
 * Each role has a unique name and optional description.
 */
module.exports = (sequelize, DataTypes) => {
  const Role = sequelize.define(
    'Role',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        validate: {
          notEmpty: true,
          is: /^[a-z0-9_]+$/i, // slug-like role name
        },
        comment:
          'Unique role identifier (e.g., superadmin, manager, team_leader, employee)',
      },
      description: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      isSystem: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'is_system',
        comment: 'Marks system default roles which should not be freely deleted',
      },
    },
    {
      tableName: 'roles',
      underscored: true,
      indexes: [{ unique: true, fields: ['name'] }],
    }
  );

  // PUBLIC_INTERFACE
  Role.associate = (models) => {
    /** Establishes many-to-many association with User through UserRole. */
    Role.belongsToMany(models.User, {
      through: models.UserRole,
      foreignKey: 'role_id',
      otherKey: 'user_id',
      as: 'users',
    });
  };

  return Role;
};
