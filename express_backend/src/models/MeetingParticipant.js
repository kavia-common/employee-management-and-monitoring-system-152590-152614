'use strict';

/**
 * MeetingParticipant model (join table).
 * Maps users to meetings with participant-specific status and role.
 */
module.exports = (sequelize, DataTypes) => {
  const MeetingParticipant = sequelize.define(
    'MeetingParticipant',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      meetingId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        field: 'meeting_id',
        references: {
          model: 'meetings',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
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
      participantRole: {
        type: DataTypes.ENUM('required', 'optional'),
        allowNull: false,
        defaultValue: 'required',
        field: 'participant_role',
        comment: 'Indicates whether participant is required or optional',
      },
      responseStatus: {
        type: DataTypes.ENUM('pending', 'accepted', 'declined', 'tentative'),
        allowNull: false,
        defaultValue: 'pending',
        field: 'response_status',
        comment: 'RSVP / response of the participant',
      },
      notifiedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'notified_at',
        comment: 'When notification/invite was sent (placeholder)',
      },
    },
    {
      tableName: 'meeting_participants',
      underscored: true,
      indexes: [
        { unique: true, fields: ['meeting_id', 'user_id'] },
        { fields: ['user_id'] },
        { fields: ['response_status'] },
      ],
    }
  );

  // PUBLIC_INTERFACE
  MeetingParticipant.associate = (models) => {
    /** Belongs to Meeting and User. */
    MeetingParticipant.belongsTo(models.Meeting, { foreignKey: 'meeting_id', as: 'meeting' });
    MeetingParticipant.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
  };

  return MeetingParticipant;
};
