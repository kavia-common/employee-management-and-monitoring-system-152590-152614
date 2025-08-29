'use strict';

/**
 * UserRole model (join table).
 * Maps Users to Roles for RBAC (Many-to-Many).
 */
module.exports = (sequelize, DataTypes) => {
  const UserRole = sequelize.define(
    'UserRole',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        field: 'user_id',
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      roleId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        field: 'role_id',
        references: {
          model: 'roles',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      assignedBy: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
        field: 'assigned_by',
        comment: 'User ID who assigned this role (nullable)',
      },
    },
    {
      tableName: 'user_roles',
      underscored: true,
      indexes: [
        { unique: true, fields: ['user_id', 'role_id'] }, // prevent duplicates
        { fields: ['role_id'] },
      ],
    }
  );

  // PUBLIC_INTERFACE
  UserRole.associate = (models) => {
    /** Sets explicit belongsTo relations for completeness and cascade support. */
    UserRole.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    UserRole.belongsTo(models.Role, { foreignKey: 'role_id', as: 'role' });
  };

  return UserRole;
};
