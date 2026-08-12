// Client-safe formatting helpers + API client for TMS_BE

import { parseTimestamp, toDate } from './timestamp';

export { parseTimestamp, toDate, isTaskOverdue, isDueInWindow } from './timestamp';
export { toast, getErrorMessage, TASK_ACTION_TOAST } from './toast';
/** @deprecated use parseTimestamp */
export const toTimestamp = parseTimestamp;

export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/$/, '');

const LOGGED_IN_COOKIE = 'tf_logged_in';

export function apiUrl(path: string): string {
  const normalized = path.startsWith('/api') ? path.slice(4) : path;
  return `${API_BASE}${normalized.startsWith('/') ? normalized : `/${normalized}`}`;
}

export function uploadUrl(id: number | string): string {
  return `${API_BASE}/uploads/${id}`;
}

export function setLoggedIn(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${LOGGED_IN_COOKIE}=1; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax`;
}

export function clearLoggedIn(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${LOGGED_IN_COOKIE}=; path=/; max-age=0`;
}

export function fmtDateTime(value?: unknown): string {
  const d = toDate(value);
  if (!d) return '—';
  return d.toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

export function fmtTime(value?: unknown): string {
  const d = toDate(value);
  if (!d) return '—';
  return d.toLocaleTimeString('en-IN', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

export function fmtDate(value?: unknown): string {
  const d = toDate(value);
  if (!d) return '—';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtShortDate(value?: unknown): string {
  const d = toDate(value);
  if (!d) return '—';
  return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });
}

export function timeAgo(value?: unknown): string {
  const ts = parseTimestamp(value);
  if (ts == null) return '';
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function countdown(value: unknown): string {
  const deadline = parseTimestamp(value);
  if (deadline == null) return '';
  const diff = deadline - Date.now();
  if (diff <= 0) return 'breached';
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m left`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${m % 60}m left`;
  return `${Math.floor(h / 24)}d left`;
}

export function toLocalInput(value?: unknown): string {
  const d = toDate(value);
  if (!d) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(v: string): number | null {
  if (!v) return null;
  const ms = new Date(v).getTime();
  return Number.isNaN(ms) ? null : ms;
}

export const STATUS_LABEL: Record<string, string> = {
  ASSIGNED: 'Awaiting response',
  ACKNOWLEDGED: 'Acknowledged',
  IN_PROGRESS: 'In progress',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
  ESCALATED: 'Escalated',
};

export const STATUS_COLOR: Record<string, string> = {
  ASSIGNED: 'status-badge status-assigned',
  ACKNOWLEDGED: 'status-badge status-acknowledged',
  IN_PROGRESS: 'status-badge status-progress',
  DONE: 'status-badge status-done',
  CANCELLED: 'status-badge status-cancelled',
  ESCALATED: 'status-badge status-escalated',
};

export const STATUS_COLOR_FALLBACK = 'status-badge status-fallback';

export const STATUS_DOT: Record<string, string> = {
  ASSIGNED: 'status-dot-assigned',
  ACKNOWLEDGED: 'status-dot-acknowledged',
  IN_PROGRESS: 'status-dot-progress',
  DONE: 'status-dot-done',
  CANCELLED: 'status-dot-cancelled',
  ESCALATED: 'status-dot-escalated',
};

export const SLA_BREACH_BADGE = 'status-badge status-sla';

export const PRIORITY_COLOR: Record<string, string> = {
  URGENT: 'text-red-600',
  HIGH: 'text-orange-600',
  NORMAL: 'text-gray-500',
  LOW: 'text-gray-400',
};

const AUTH_NO_RETRY = new Set(['/auth/login', '/auth/logout', '/auth/reset-password', '/auth/refresh']);

function normalizeApiPath(path: string): string {
  const normalized = path.startsWith('/api') ? path.slice(4) : path;
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

function shouldRetryAuth(path: string): boolean {
  return !AUTH_NO_RETRY.has(normalizeApiPath(path));
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch(apiUrl('/auth/refresh'), {
        method: 'POST',
        credentials: 'include',
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function logoutClient() {
  clearLoggedIn();
  try {
    await fetch(apiUrl('/auth/logout'), { method: 'POST', credentials: 'include' });
  } catch {
    // ignore
  }
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    window.location.href = '/login';
  }
}

type ApiResult = { res: Response; data: Record<string, unknown> };

async function request(path: string, opts?: RequestInit): Promise<ApiResult> {
  const headers = new Headers(opts?.headers);
  if (!headers.has('Content-Type') && opts?.body && typeof opts.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(apiUrl(path), {
    credentials: 'include',
    ...opts,
    headers,
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

function throwApiError(res: Response, data: Record<string, unknown>): never {
  throw Object.assign(new Error(String(data.error || `Request failed (${res.status})`)), {
    code: data.code,
    status: res.status,
  });
}

async function requestWithRefresh(path: string, opts?: RequestInit): Promise<ApiResult> {
  let result = await request(path, opts);

  if (result.res.status === 401 && shouldRetryAuth(path)) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      result = await request(path, opts);
      if (result.res.status === 401) {
        await logoutClient();
        throwApiError(result.res, result.data);
      }
    } else {
      await logoutClient();
      throwApiError(result.res, result.data);
    }
  }

  return result;
}

export async function api<T = any>(path: string, opts?: RequestInit): Promise<T> {
  const { res, data } = await requestWithRefresh(path, opts);
  if (!res.ok) throwApiError(res, data);
  return data as T;
}

export async function apiUpload<T = any>(path: string, formData: FormData): Promise<T> {
  let result = await request(path, { method: 'POST', body: formData });

  if (result.res.status === 401 && shouldRetryAuth(path)) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      result = await request(path, { method: 'POST', body: formData });
      if (result.res.status === 401) {
        await logoutClient();
        throwApiError(result.res, result.data);
      }
    } else {
      await logoutClient();
      throwApiError(result.res, result.data);
    }
  }

  const { res, data } = result;
  if (!res.ok) throwApiError(res, data);
  return data as T;
}
