export default (sequelize, DataTypes) => {
  const Task = sequelize.define(
    "Task",
    {
      task_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      project_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      task_status_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      task_type_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      parent_task_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      due_date: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      priority: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "medium",
      },
      target: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      target_completed: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      timeline: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: { start_date: null, end_date: null },
      },
      scribble: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: null,
      },
      deleted: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
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
      tableName: "tasks",
      timestamps: false,
    },
  );

  return Task;
};
