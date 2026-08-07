export default (sequelize, DataTypes) => {
  const CommentReaction = sequelize.define(
    "CommentReaction",
    {
      comment_reaction_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      comment_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      emoji: {
        type: DataTypes.STRING(32),
        allowNull: false,
      },
      created_at: {
        type: DataTypes.BIGINT,
        defaultValue: () => Date.now(),
      },
    },
    {
      tableName: "comment_reactions",
      timestamps: false,
      indexes: [
        {
          unique: true,
          fields: ["comment_id", "user_id", "emoji"],
        },
      ],
    },
  );

  return CommentReaction;
};
