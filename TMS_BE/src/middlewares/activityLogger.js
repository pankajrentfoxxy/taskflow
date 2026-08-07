import { logActivityFromRequest } from "../services/activityLogService.js";
import { getRequestPath } from "../utils/requestLog.js";

const activityLogger = (req, res, next) => {
  res.on("finish", () => {
    if (!req.user?.user_id) {
      return;
    }

    const path = getRequestPath(req) || "";
    if (
      path.startsWith("/api/projects") ||
      path.startsWith("/api/teams") ||
      path.startsWith("/api/task-statuses") ||
      path.startsWith("/api/task-types")
    ) {
      return;
    }

    logActivityFromRequest(req, res).catch(() => {});
  });

  next();
};
export default activityLogger;
