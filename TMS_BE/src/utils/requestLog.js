const SENSITIVE_KEY_PATTERN =
  /password|token|secret|authorization|cookie|otp|refresh/i;

export function sanitizePayload(value) {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizePayload(item));
  }

  if (typeof value !== "object") {
    return value;
  }

  return Object.entries(value).reduce((acc, [key, item]) => {
    acc[key] = SENSITIVE_KEY_PATTERN.test(key)
      ? "[REDACTED]"
      : sanitizePayload(item);
    return acc;
  }, {});
}

export function getClientIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    null
  );
}

export function getRequestPath(req) {
  return req.originalUrl || req.url || null;
}
