export default (sequelize, DataTypes) => {
  const TeamMember = sequelize.define(
    "TeamMember",
    {
      team_member_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      team_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      user_id: {
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
      tableName: "team_members",
      timestamps: false,
      indexes: [
        {
          unique: true,
          fields: ["team_id", "user_id"],
        },
      ],
    },
  );

  return TeamMember;
};
