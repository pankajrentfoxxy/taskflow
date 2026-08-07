import { ActivityLog } from "../models/index.js";
import {
  getClientIp,
  getRequestPath,
  sanitizePayload,
} from "../utils/requestLog.js";

const now = () => Date.now();

function deriveAction(req) {
  const method = req.method?.toUpperCase() || "UNKNOWN";
  const path = getRequestPath(req) || "";

  if (path.startsWith("/api/auth/login")) return "auth.login";
  if (path.startsWith("/api/auth/logout")) return "auth.logout";
  if (path.startsWith("/api/projects") && method === "POST") return "project.create";
  if (/^\/api\/projects\/\d+$/.test(path) && method === "PATCH") return "project.update";
  if (/^\/api\/projects\/\d+$/.test(path) && method === "DELETE") return "project.delete";
  if (/^\/api\/projects\/\d+\/members$/.test(path) && method === "POST") {
    return "project.member.add";
  }
  if (/^\/api\/projects\/\d+\/members\/\d+$/.test(path) && method === "DELETE") {
    return "project.member.remove";
  }

  return `${method} ${path}`;
}

function deriveEntity(req) {
  const params = req.params || {};

  if (params.projectId) {
    return { entity_type: "project", entity_id: Number(params.projectId) };
  }

  if (params.memberId) {
    return { entity_type: "project_member", entity_id: Number(params.memberId) };
  }

  return { entity_type: null, entity_id: null };
}

export async function logActivity({
  userId = null,
  action,
  entityType = null,
  entityId = null,
  taskId = null,
  description = null,
  req = null,
  statusCode = null,
  metadata = null,
}) {
  const requestPath = req ? getRequestPath(req) : null;
  const entity = req ? deriveEntity(req) : { entity_type: entityType, entity_id: entityId };
  const resolvedTaskId =
    taskId ??
    (req?.params?.taskId != null ? Number(req.params.taskId) : null);

  return ActivityLog.create({
    user_id: userId,
    action: action || (req ? deriveAction(req) : "unknown"),
    entity_type: entityType ?? entity.entity_type,
    entity_id: entityId ?? entity.entity_id,
    task_id: resolvedTaskId,
    description,
    method: req?.method || null,
    path: requestPath,
    status_code: statusCode,
    metadata:
      metadata ??
      (req?.method?.toUpperCase() === "GET"
        ? null
        : req?.body
          ? sanitizePayload(req.body)
          : null),
    ip_address: req ? getClientIp(req) : null,
    user_agent: req?.headers?.["user-agent"] || null,
    created_at: now(),
  });
}

export function logActivityFromRequest(req, res, overrides = {}) {
  if (!req.user?.user_id) {
    return Promise.resolve(null);
  }

  return logActivity({
    userId: req.user.user_id,
    req,
    statusCode: res.statusCode,
    ...overrides,
  });
}
