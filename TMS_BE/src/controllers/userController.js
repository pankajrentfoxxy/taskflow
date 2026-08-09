import * as userService from "../services/userService.js";
import { logActivity } from "../services/activityLogService.js";

function logUserActivity(req, res, overrides = {}) {
  logActivity({
    userId: req.user.user_id,
    req,
    statusCode: res.statusCode,
    ...overrides,
  }).catch(() => {});
}

export const listUsers = async (req, res) => {
  const users = await userService.listUsers();
  res.json({ users });
  logUserActivity(req, res, {
    action: "user.list",
    description: `Listed ${users.length} user(s)`,
  });
};

export const createUser = async (req, res) => {
  const user = await userService.createUser(req.body);
  res.status(201).json({ user });
  logUserActivity(req, res, {
    action: "user.create",
    entityType: "user",
    entityId: user.user_id,
    description: `Created user "${user.full_name || user.email}"`,
    metadata: { email: user.email },
  });
};
