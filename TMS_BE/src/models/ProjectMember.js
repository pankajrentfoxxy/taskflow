export default (sequelize, DataTypes) => {
  const ProjectMember = sequelize.define(
    "ProjectMember",
    {
      project_member_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      project_id: {
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
      tableName: "project_members",
      timestamps: false,
      indexes: [
        {
          unique: true,
          fields: ["project_id", "user_id"],
        },
      ],
    },
  );

  return ProjectMember;
};
