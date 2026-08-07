export default (sequelize, DataTypes) => {
  const ActivityLog = sequelize.define(
    "ActivityLog",
    {
      activity_log_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      action: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      entity_type: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      entity_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      task_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      method: {
        type: DataTypes.STRING(10),
        allowNull: true,
      },
      path: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      status_code: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      ip_address: {
        type: DataTypes.STRING(45),
        allowNull: true,
      },
      user_agent: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      created_at: {
        type: DataTypes.BIGINT,
        defaultValue: () => Date.now(),
      },
    },
    {
      tableName: "activity_logs",
      timestamps: false,
    },
  );

  return ActivityLog;
};
