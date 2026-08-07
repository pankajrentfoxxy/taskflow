export default (sequelize, DataTypes) => {
  const ErrorLog = sequelize.define(
    "ErrorLog",
    {
      error_log_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      error_name: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      error_message: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      error_stack: {
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
      request_body: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      query_params: {
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
      tableName: "error_logs",
      timestamps: false,
    },
  );

  return ErrorLog;
};
