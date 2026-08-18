import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import compression from "compression";
import xss from "xss-clean";
import passport from "passport";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import httpStatus from "http-status";

import config from "./config/config.js";
import morgan from "./config/morgan.js";
import { jwtStrategy } from "./config/passport.js";
import routes from "./routes.js";
import { errorConverter, errorHandler } from "./middlewares/error.js";
import ApiError from "./utils/ApiError.js";
import {
  sequelize,
  Meta,
  Team,
  User,
  TaskType,
  Project,
  ProjectMember,
  ProjectNote,
  Board,
  Task,
  Comment,
  CommentReaction,
  Activity,
  Escalation,
  Notification,
  Attachment,
  Otp,
  TaskMember,
  ChatConversation,
  ChatMessage,
  ChatMessageReaction,
  ChatGroupMember,
} from "./models/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadPath = path.isAbsolute(config.uploadDir)
  ? config.uploadDir
  : path.join(__dirname, "..", config.uploadDir);

fs.mkdirSync(uploadPath, { recursive: true });

const app = express();

if (config.env === "production") {
  app.set("trust proxy", 1);
}

if (config.env !== "test") {
  app.use(morgan.successHandler);
  app.use(morgan.errorHandler);
}

app.use(helmet());
app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(xss());
app.use(compression());

passport.use(jwtStrategy);
app.use(passport.initialize());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "taskflow-api" });
});

app.use("/api", routes);

app.use((_req, _res, next) => {
  next(new ApiError(httpStatus.NOT_FOUND, "Not found"));
});

app.use(errorConverter);
app.use(errorHandler);

const syncModels = async () => {
  await sequelize.authenticate();
  // Order respects FK dependencies (users/teams have no cross-FK — see models/index.js).
  await Meta.sync();
  await User.sync();
  await Team.sync();
  await TaskType.sync();
  await Project.sync();
  await Board.sync();
  await ProjectMember.sync();
  await ProjectNote.sync();
  await Task.sync();
  await Comment.sync();
  await CommentReaction.sync();
  await Activity.sync();
  await Escalation.sync();
  await Notification.sync();
  await Attachment.sync();
  await Otp.sync();
  await TaskMember.sync();
  await ChatConversation.sync();
  await ChatGroupMember.sync();
  await ChatMessage.sync();
  await ChatMessageReaction.sync();
  await sequelize.query(
    `CREATE TABLE IF NOT EXISTS task_members (
      task_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role VARCHAR(32) NOT NULL DEFAULT 'COLLABORATOR',
      added_by INTEGER,
      created_at BIGINT NOT NULL,
      PRIMARY KEY (task_id, user_id)
    )`
  );
  await sequelize.query(
    "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_visible BOOLEAN NOT NULL DEFAULT true"
  );
  await sequelize.query(
    "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS discuss_reason TEXT"
  );
  await sequelize.query(
    "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS input_request_note TEXT"
  );
  await sequelize.query(
    "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS input_requested_at BIGINT"
  );
  await sequelize.query(
    "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS input_provided_at BIGINT"
  );
  await sequelize.query(
    "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS input_provided_by INTEGER"
  );
  await sequelize.query(
    "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS input_payload TEXT"
  );
  await sequelize.query(
    "ALTER TABLE attachments ADD COLUMN IF NOT EXISTS chat_message_id INTEGER"
  );
  await sequelize.query(
    "ALTER TABLE attachments ADD COLUMN IF NOT EXISTS context VARCHAR(32) NOT NULL DEFAULT 'file'"
  );
  // await sequelize.query(
  //   "ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS user_one_id INTEGER"
  // );
  // await sequelize.query(
  //   "ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS user_two_id INTEGER"
  // );
  // await sequelize.query(
  //   "ALTER TABLE chat_conversations ALTER COLUMN member_user_id DROP NOT NULL"
  // );
  // await sequelize.query(
  //   "ALTER TABLE chat_conversations DROP CONSTRAINT IF EXISTS chat_conversations_member_user_id_key"
  // );
  // await sequelize.query(
  //   `UPDATE chat_conversations c
  //    SET user_one_id = LEAST(
  //          c.member_user_id,
  //          COALESCE((SELECT MIN(u.id) FROM users u WHERE u.role IN ('ADMIN', 'CEO') AND u.is_active = true), c.member_user_id)
  //        ),
  //        user_two_id = GREATEST(
  //          c.member_user_id,
  //          COALESCE((SELECT MIN(u.id) FROM users u WHERE u.role IN ('ADMIN', 'CEO') AND u.is_active = true), c.member_user_id)
  //        )
  //    WHERE c.user_one_id IS NULL
  //      AND c.user_two_id IS NULL
  //      AND c.member_user_id IS NOT NULL`
  // );
  // await sequelize.query(
  //   `CREATE UNIQUE INDEX IF NOT EXISTS chat_conversations_user_pair_unique
  //    ON chat_conversations (user_one_id, user_two_id)
  //    WHERE user_one_id IS NOT NULL AND user_two_id IS NOT NULL`
  // );
  // await sequelize.query(
  //   "ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS kind VARCHAR(16) NOT NULL DEFAULT 'direct'"
  // );
  // await sequelize.query(
  //   "ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS name VARCHAR(140)"
  // );
  // await sequelize.query(
  //   "ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS created_by INTEGER"
  // );
  // await sequelize.query(
  //   `CREATE TABLE IF NOT EXISTS chat_group_members (
  //     conversation_id INTEGER NOT NULL,
  //     user_id INTEGER NOT NULL,
  //     added_by INTEGER,
  //     created_at BIGINT NOT NULL,
  //     PRIMARY KEY (conversation_id, user_id)
  //   )`
  // );
};

export const initApp = async () => {
  await syncModels();
  const userCount = await User.count();
  if (userCount === 0) {
    const { seedDatabase } = await import("../scripts/seed.js");
    await seedDatabase();
  }
};

export default app;
