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
    await db.Project.sync({ alter: true });
    await db.ProjectMember.sync({ alter: true });
    await db.Team.sync();
    await db.TeamMember.sync();
    await db.ErrorLog.sync();
    await db.TaskStatus.sync();
    await db.TaskType.sync({ alter: true });
    await db.TaskAssignee.sync({ alter: true });
    await db.Task.sync({ alter: true });
    await db.ActivityLog.sync();
    await db.Comment.sync();
    await db.CommentReaction.sync();
    await db.Scribble.sync({ alter: true });
    console.log("✅ Database connected");
  } catch (err) {
    console.error("❌ Unable to connect to the database:", err);
  }
})();

export default app;
