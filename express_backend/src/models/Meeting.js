'use strict';

/**
 * Meeting model.
 * Represents scheduled meetings which can have multiple participants (users).
 * Includes basic fields for title, description, datetime, duration, location, organizer, and status.
 */
module.exports = (sequelize, DataTypes) => {
  const Meeting = sequelize.define(
    'Meeting',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      title: {
        type: DataTypes.STRING(200),
        allowNull: false,
        validate: { notEmpty: true },
        comment: 'Meeting title',
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Optional detailed description/agenda',
      },
      startTime: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'start_time',
        comment: 'Start time of the meeting',
      },
      endTime: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'end_time',
        comment: 'End time (computed or provided)',
      },
      durationMinutes: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'duration_minutes',
        comment: 'Optional duration in minutes; if provided, can be used to compute endTime',
      },
      location: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Physical/virtual location or link',
      },
      organizerId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        field: 'organizer_id',
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
        comment: 'User ID of the meeting organizer',
      },
      status: {
        type: DataTypes.ENUM('scheduled', 'cancelled', 'completed'),
        allowNull: false,
        defaultValue: 'scheduled',
        comment: 'Current status of the meeting',
      },
      isAllDay: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_all_day',
        comment: 'Whether the meeting spans the whole day',
      },
    },
    {
      tableName: 'meetings',
      underscored: true,
      indexes: [
        { fields: ['organizer_id'] },
        { fields: ['start_time'] },
        { fields: ['status'] },
      ],
    }
  );

  // PUBLIC_INTERFACE
  Meeting.associate = (models) => {
    /** Associates Meeting with User (organizer) and many-to-many participants via MeetingParticipant. */
    Meeting.belongsTo(models.User, {
      foreignKey: 'organizer_id',
      as: 'organizer',
    });

    Meeting.belongsToMany(models.User, {
      through: models.MeetingParticipant,
      foreignKey: 'meeting_id',
      otherKey: 'user_id',
      as: 'participants',
    });

    Meeting.hasMany(models.MeetingParticipant, {
      foreignKey: 'meeting_id',
      as: 'participantMappings',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });
  };

  return Meeting;
};
