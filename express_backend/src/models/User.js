'use strict';

const bcrypt = require('bcrypt');

/**
 * User model.
 * Note: This is a minimal scaffold to enable future auth implementation.
 * Fields and associations can be extended as the project grows.
 */
module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    'User',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        validate: { isEmail: true },
      },
      passwordHash: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: 'password_hash',
      },
      name: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      role: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'employee',
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'is_active',
      },
    },
    {
      tableName: 'users',
      underscored: true,
      indexes: [{ unique: true, fields: ['email'] }],
      hooks: {
        beforeSave: async (user) => {
          // If a virtual plainPassword property is set, hash and assign
          if (user.changed('passwordHash') && user.passwordHash && user.passwordHash.length < 60) {
            const saltRounds = 10;
            user.passwordHash = await bcrypt.hash(user.passwordHash, saltRounds);
          }
        },
      },
    }
  );

  // Instance method to verify password against stored hash
  // PUBLIC_INTERFACE
  User.prototype.verifyPassword = function verifyPassword(plain) {
    /** Compare plain text password with stored hash for this user. */
    return bcrypt.compare(plain, this.passwordHash);
  };

  // Placeholder for associations
  User.associate = (models) => {
    // Define associations like: User.hasMany(models.Task)
  };

  return User;
};
