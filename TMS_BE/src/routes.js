import express from "express";
import authRoutes from "./routes/auth.routes.js";
import projectRoutes from "./routes/project.routes.js";
import teamRoutes from "./routes/team.routes.js";
import taskStatusRoutes from "./routes/taskStatus.routes.js";
import taskTypeRoutes from "./routes/taskType.routes.js";
import scribbleRoutes from "./routes/scribble.routes.js";
import configRoutes from "./routes/config.routes.js";
import userRoutes from "./routes/user.routes.js";
import roleRoutes from "./routes/role.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import errorLogRoutes from "./routes/errorLog.routes.js";
import dbQueryRoutes from "./routes/dbQuery.routes.js";
import notificationRoutes from "./routes/notification.routes.js";

const router = express.Router();

const defaultRoutes = [
  { path: "/auth", route: authRoutes },
  { path: "/projects", route: projectRoutes },
  { path: "/teams", route: teamRoutes },
  { path: "/task-statuses", route: taskStatusRoutes },
  { path: "/task-types", route: taskTypeRoutes },
  { path: "/scribble", route: scribbleRoutes },
  { path: "/config", route: configRoutes },
  { path: "/users", route: userRoutes },
  { path: "/roles", route: roleRoutes },
  { path: "/dashboard", route: dashboardRoutes },
  { path: "/error-logs", route: errorLogRoutes },
  { path: "/db-query", route: dbQueryRoutes },
  { path: "/notifications", route: notificationRoutes },
];

defaultRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

export default router;
