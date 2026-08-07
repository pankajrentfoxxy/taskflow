import express from "express";
import cookieParser from "cookie-parser";
import xss from "xss-clean";
import compression from "compression";
import cors from "cors";
import passport from "passport";
import helmet from "helmet";
import httpStatus from "http-status";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

import config from "./config/config.js";
import morgan from "./config/morgan.js";
import { jwtStrategy, jwtAdminStrategy } from "./config/passport.js";
import routes from "./routes.js";
import activityLogger from "./middlewares/activityLogger.js";
import { errorConverter, errorHandler } from "./middlewares/error.js";
import ApiError from "./utils/ApiError.js";
import { db } from "./models/index.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(helmet());

// Logging (skip during test)
if (config.env !== "test") {
  app.use(morgan.successHandler);
  app.use(morgan.errorHandler);
}

// CORS
const corsOptions = {
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
    : ["http://localhost:3000"],
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  exposedHeaders: ["Set-Cookie"],
};
app.use(cors(corsOptions));

// Static files
const publicDir = path.join(__dirname, "../Public");
if (fs.existsSync(publicDir)) {
  app.use("/Public", express.static(publicDir));
}

// Cookies
app.use(cookieParser());

// Body parsers
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Sanitize input
app.use(xss());

// GZIP compression
app.use(compression());

// Passport (JWT)
app.use(passport.initialize());
passport.use("jwt", jwtStrategy);
passport.use("jwtAdmin", jwtAdminStrategy);

// Health check
app.get("/health", (req, res) => res.json({ ok: true }));

// Main API routes
app.use("/api", activityLogger, routes);

// 404
app.use((req, res, next) => {
  next(new ApiError(httpStatus.NOT_FOUND, "Not found"));
});

// Error converter and handler
app.use(errorConverter);
app.use(errorHandler);

// Sync DB — parent tables (FK targets) must exist before child tables.
(async () => {
  try {
    await db.Role.sync();
    await db.Authentication.sync();
    await db.Project.sync();
    try {
      await db.sequelize.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'project_members' AND column_name = 'created_by'
          ) THEN
            ALTER TABLE project_members ADD COLUMN created_by INTEGER;
          END IF;
        END $$;
      `);
      await db.sequelize.query(`
        UPDATE project_members pm
        SET created_by = p.created_by
        FROM projects p
        WHERE pm.project_id = p.project_id
          AND pm.created_by IS NULL;
      `);
    } catch (_) {
      // ignore migration errors in environments where backfill is not needed
    }
    await db.ProjectMember.sync({ alter: true });
    await db.Team.sync();
    await db.TeamMember.sync();
    await db.ActivityLog.sync();
    await db.ErrorLog.sync();
    await db.TaskStatus.sync();
    await db.TaskType.sync();
    try {
      await db.sequelize.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'tasks' AND column_name = 'title'
          ) AND NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'tasks' AND column_name = 'name'
          ) THEN
            ALTER TABLE tasks RENAME COLUMN title TO name;
          END IF;
        END $$;
      `);
    } catch (_) {
      // ignore migration errors in environments where rename is not needed
    }
    await db.TaskAssignee.sync({ alter: true });
    try {
      await db.sequelize.query(`
        UPDATE tasks
        SET timeline = '{"start_date": null, "end_date": null}'::jsonb
        WHERE jsonb_typeof(timeline) = 'array';
      `);
    } catch (_) {
      // ignore migration errors when timeline is already object-shaped
    }
    try {
      await db.sequelize.query(`
        INSERT INTO task_assignees (task_id, user_id, created_by, created_at, updated_at)
        SELECT t.task_id, t.assignee_id, t.created_by, t.created_at, t.updated_at
        FROM tasks t
        WHERE t.assignee_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM task_assignees ta
            WHERE ta.task_id = t.task_id
              AND ta.user_id = t.assignee_id
          );
      `);
    } catch (_) {
      // ignore migration errors when legacy assignee_id column is already removed
    }
    await db.Task.sync({ alter: true });
    try {
      await db.sequelize.query(`
        ALTER TABLE tasks DROP COLUMN IF EXISTS assignee_id;
      `);
    } catch (_) {
      // ignore migration errors when legacy assignee_id column is already removed
    }
    await db.Comment.sync();
    await db.CommentReaction.sync();
    console.log("✅ Database connected");
  } catch (err) {
    console.error("❌ Unable to connect to the database:", err);
  }
})();

export default app;
