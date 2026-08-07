const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

const AUTH_NO_REFRESH_PATHS = new Set([
  "/auth/login",
  "/auth/signup",
  "/auth/refresh-token",
  "/auth/logout",
]);

let refreshPromise = null;

function shouldSkipRefresh(path) {
  return AUTH_NO_REFRESH_PATHS.has(path);
}

async function getAuthStore() {
  const { store } = await import("@/store");
  return store;
}

async function refreshAccessToken() {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const store = await getAuthStore();
    const { setAuthSession, clearAuthSession } = await import(
      "@/store/authSlice"
    );
    const refreshToken = store.getState().auth.tokens?.refreshToken;

    const response = await fetch(`${API_BASE}/auth/refresh-token`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(refreshToken ? { Authorization: `Bearer ${refreshToken}` } : {}),
      },
      body: refreshToken ? JSON.stringify({ refreshToken }) : undefined,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      store.dispatch(clearAuthSession());
      const error = new Error(data.message || "Session expired");
      error.status = response.status;
      throw error;
    }

    store.dispatch(
      setAuthSession({
        tokens: data.tokens,
        user: data.user,
      }),
    );

    return data.tokens.accessToken;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function apiRequest(path, options = {}) {
  const { token, body, headers, method = "GET", _retried = false, ...rest } =
    options;

  const response = await fetch(`${API_BASE}${path}`, {
    ...rest,
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    credentials: "include",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401 && !_retried && !shouldSkipRefresh(path)) {
    const store = await getAuthStore();
    const hasRefreshToken = Boolean(
      store.getState().auth.tokens?.refreshToken,
    );

    if (token || hasRefreshToken) {
      const newAccessToken = await refreshAccessToken();
      return apiRequest(path, {
        ...options,
        token: newAccessToken,
        _retried: true,
      });
    }
  }

  if (!response.ok) {
    const error = new Error(data.message || "Request failed");
    error.status = response.status;
    throw error;
  }

  return data;
}

export function apiGet(path, options = {}) {
  return apiRequest(path, { ...options, method: "GET" });
}

export function apiPost(path, body, options = {}) {
  return apiRequest(path, { ...options, method: "POST", body });
}

export function apiPut(path, body, options = {}) {
  return apiRequest(path, { ...options, method: "PUT", body });
}

export function apiPatch(path, body, options = {}) {
  return apiRequest(path, { ...options, method: "PATCH", body });
}

export function apiDelete(path, options = {}) {
  return apiRequest(path, { ...options, method: "DELETE" });
}

export { API_BASE };
