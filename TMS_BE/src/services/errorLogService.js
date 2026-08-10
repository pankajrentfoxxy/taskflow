import { ErrorLog, Authentication } from "../models/index.js";
import {
  getClientIp,
  getRequestPath,
  sanitizePayload,
} from "../utils/requestLog.js";

const now = () => Date.now();

export async function logError({
  error,
  req = null,
  statusCode = 500,
  userId = null,
}) {
  const err = error instanceof Error ? error : new Error(String(error));

  return ErrorLog.create({
    user_id: userId ?? req?.user?.user_id ?? null,
    error_name: err.name || "Error",
    error_message: err.message || "Unknown error",
    error_stack: err.stack || null,
    method: req?.method || null,
    path: req ? getRequestPath(req) : null,
    status_code: statusCode,
    request_body: req?.body ? sanitizePayload(req.body) : null,
    query_params: req?.query ? sanitizePayload(req.query) : null,
    ip_address: req ? getClientIp(req) : null,
    user_agent: req?.headers?.["user-agent"] || null,
    created_at: now(),
  });
}

export function logErrorFromRequest(err, req, statusCode) {
  return logError({
    error: err,
    req,
    statusCode,
    userId: req?.user?.user_id ?? null,
  });
}

const toPublicErrorLog = (log) => ({
  error_log_id: log.error_log_id,
  user_id: log.user_id,
  error_name: log.error_name,
  error_message: log.error_message,
  error_stack: log.error_stack,
  method: log.method,
  path: log.path,
  status_code: log.status_code,
  request_body: log.request_body,
  query_params: log.query_params,
  ip_address: log.ip_address,
  user_agent: log.user_agent,
  created_at: log.created_at,
  user: log.user
    ? {
        user_id: log.user.user_id,
        email: log.user.email,
        full_name: log.user.full_name,
      }
    : undefined,
});

export async function listErrorLogs({ limit = 50, offset = 0 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  const { rows, count } = await ErrorLog.findAndCountAll({
    include: [
      {
        model: Authentication,
        as: "user",
        attributes: ["user_id", "email", "full_name"],
        required: false,
      },
    ],
    order: [["created_at", "DESC"]],
    limit: safeLimit,
    offset: safeOffset,
  });

  return {
    errorLogs: rows.map(toPublicErrorLog),
    total: count,
    limit: safeLimit,
    offset: safeOffset,
  };
}
