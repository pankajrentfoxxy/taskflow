import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Attachment = sequelize.define(
  "Attachment",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    task_id: { type: DataTypes.INTEGER, allowNull: true },
    project_id: { type: DataTypes.INTEGER, allowNull: true },
    comment_id: { type: DataTypes.INTEGER, allowNull: true },
    uploader_id: { type: DataTypes.INTEGER, allowNull: false },
    file_name: { type: DataTypes.STRING, allowNull: false },
    mime_type: { type: DataTypes.STRING, allowNull: false },
    size: { type: DataTypes.INTEGER, allowNull: false },
    file_path: { type: DataTypes.STRING, allowNull: false },
    created_at: { type: DataTypes.BIGINT, allowNull: false },
  },
  { tableName: "attachments" }
);

export default Attachment;
