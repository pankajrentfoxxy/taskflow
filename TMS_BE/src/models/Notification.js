export default (sequelize, DataTypes) => {
  const Notification = sequelize.define(
    "Notification",
    {
      notification_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      recipient_user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      actor_user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      type: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      task_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      project_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      is_read: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      read_at: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      created_at: {
        type: DataTypes.BIGINT,
        defaultValue: () => Date.now(),
      },
    },
    {
      tableName: "notifications",
      timestamps: false,
      indexes: [
        { fields: ["recipient_user_id", "created_at"] },
        { fields: ["recipient_user_id", "is_read"] },
        { fields: ["task_id"] },
      ],
    },
  );

  return Notification;
};
