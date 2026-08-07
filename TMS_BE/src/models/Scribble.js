export default (sequelize, DataTypes) => {
  const Scribble = sequelize.define(
    "Scribble",
    {
      scribble_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: "untitled board",
      },
      scene: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {
          elements: [],
          appState: { viewBackgroundColor: "#ffffff" },
          files: {},
        },
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
      tableName: "scribbles",
      timestamps: false,
    },
  );

  return Scribble;
};
