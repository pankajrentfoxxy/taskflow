import { ErrorLog } from "../models/index.js";
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
