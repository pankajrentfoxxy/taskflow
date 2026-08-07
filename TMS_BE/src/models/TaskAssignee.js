export default (sequelize, DataTypes) => {
  const TaskAssignee = sequelize.define(
    "TaskAssignee",
    {
      task_assignee_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      task_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      created_by: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      created_at: {
        type: DataTypes.BIGINT,
        defaultValue: () => Date.now(),
      },
      updated_at: {
        type: DataTypes.BIGINT,
        defaultValue: () => Date.now(),
      },
    },
    {
      tableName: "task_assignees",
      timestamps: false,
      indexes: [
        {
          unique: true,
          fields: ["task_id", "user_id"],
        },
      ],
    },
  );

  return TaskAssignee;
};
