'use strict';

/**
 * Attendance model.
 * Tracks employee check-ins and check-outs with support for GPS/manual methods and optional face verification placeholder.
 */
module.exports = (sequelize, DataTypes) => {
  const Attendance = sequelize.define(
    'Attendance',
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
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
        comment: 'Employee/User ID associated with this attendance record',
      },
      checkInAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'check_in_at',
      },
      checkOutAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'check_out_at',
      },
      checkInMethod: {
        type: DataTypes.ENUM('manual', 'gps', 'face'),
        allowNull: true,
        field: 'check_in_method',
        comment: 'Method used for check-in',
      },
      checkOutMethod: {
        type: DataTypes.ENUM('manual', 'gps', 'face'),
        allowNull: true,
        field: 'check_out_method',
        comment: 'Method used for check-out',
      },
      checkInLat: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: true,
        field: 'check_in_lat',
      },
      checkInLng: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: true,
        field: 'check_in_lng',
      },
      checkOutLat: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: true,
        field: 'check_out_lat',
      },
      checkOutLng: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: true,
        field: 'check_out_lng',
      },
      notes: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      isLate: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_late',
      },
      isOvertime: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_overtime',
      },
      faceVerified: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        field: 'face_verified',
        comment: 'Placeholder flag for face verification result',
      },
      workDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        field: 'work_date',
        comment: 'Logical work date of the attendance entry (helps querying by day)',
      },
    },
    {
      tableName: 'attendance',
      underscored: true,
      indexes: [
        { fields: ['user_id'] },
        { fields: ['work_date'] },
        { fields: ['user_id', 'work_date'], unique: false },
      ],
    }
  );

  // PUBLIC_INTERFACE
  Attendance.associate = (models) => {
    /** Establishes belongsTo association with User. */
    Attendance.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });
  };

  return Attendance;
};
