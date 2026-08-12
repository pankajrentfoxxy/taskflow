// Client-safe formatting helpers + API client for TMS_BE

import { parseTimestamp, toDate, isTaskOverdue } from './timestamp';

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
  ASSIGNED: 'Accept response',
  DISCUSS: 'Discuss',
  ACKNOWLEDGED: 'Accepted',
  IN_PROGRESS: 'In progress',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
  REJECTED: 'Rejected',
  ESCALATED: 'Escalated',
};

export function activityTypeLabel(type: string): string {
  if (type === 'ACKNOWLEDGED') return 'accepted';
  return type.toLowerCase().replace(/_/g, ' ');
}

export const STATUS_COLOR: Record<string, string> = {
  ASSIGNED: 'status-badge status-assigned',
  DISCUSS: 'status-badge status-discuss',
  ACKNOWLEDGED: 'status-badge status-acknowledged',
  IN_PROGRESS: 'status-badge status-progress',
  DONE: 'status-badge status-done',
  CANCELLED: 'status-badge status-cancelled',
  REJECTED: 'status-badge status-rejected',
  ESCALATED: 'status-badge status-escalated',
};

export const STATUS_COLOR_FALLBACK = 'status-badge status-fallback';

export const STATUS_DOT: Record<string, string> = {
  ASSIGNED: 'status-dot-assigned',
  DISCUSS: 'status-dot-discuss',
  ACKNOWLEDGED: 'status-dot-acknowledged',
  IN_PROGRESS: 'status-dot-progress',
  DONE: 'status-dot-done',
  CANCELLED: 'status-dot-cancelled',
  REJECTED: 'status-dot-rejected',
  ESCALATED: 'status-dot-escalated',
};

/** Subtle row tint + left border per task status (matches status badge palette). */
export const TASK_ROW_HIGHLIGHT: Record<string, string> = {
  ASSIGNED:
    'border-l-[3px] border-l-status-assigned-dot bg-status-assigned-bg/45 hover:bg-status-assigned-bg/70',
  DISCUSS:
    'border-l-[3px] border-l-status-discuss-dot bg-status-discuss-bg/45 hover:bg-status-discuss-bg/70',
  ACKNOWLEDGED:
    'border-l-[3px] border-l-status-acknowledged-dot bg-status-acknowledged-bg/45 hover:bg-status-acknowledged-bg/70',
  IN_PROGRESS:
    'border-l-[3px] border-l-status-progress-dot bg-status-progress-bg/45 hover:bg-status-progress-bg/70',
  DONE:
    'border-l-[3px] border-l-status-done-dot bg-status-done-bg/30 hover:bg-status-done-bg/45',
  CANCELLED:
    'border-l-[3px] border-l-status-cancelled-dot bg-status-cancelled-bg/30 hover:bg-status-cancelled-bg/45',
  REJECTED:
    'border-l-[3px] border-l-status-rejected-dot bg-status-rejected-bg/35 hover:bg-status-rejected-bg/50',
  ESCALATED:
    'border-l-[3px] border-l-status-escalated-dot bg-status-escalated-bg/55 hover:bg-status-escalated-bg/80',
};

const TASK_ROW_OVERDUE =
  'border-l-[3px] border-l-status-assigned-dot bg-status-assigned-bg/65 hover:bg-status-assigned-bg/90';

/** Assignee flagged discuss / blocked / reject — creator should act. */
export function taskNeedsAssignerAction(task: {
  status?: string;
  blocked_reason?: string | null;
}): boolean {
  const status = task.status || '';
  if (status === 'DISCUSS') return true;
  if (status === 'REJECTED') return true;
  if (task.blocked_reason?.trim()) return true;
  return false;
}

/** Pulse only for the task creator (and Admin/CEO oversight). */
export function taskNeedsAssignerActionForViewer(
  task: { creator_id?: number; status?: string; blocked_reason?: string | null },
  viewer?: { id?: number; role?: string } | null,
): boolean {
  if (!taskNeedsAssignerAction(task)) return false;
  if (!viewer?.id) return false;
  if (task.creator_id === viewer.id) return true;
  return viewer.role === 'ADMIN' || viewer.role === 'CEO';
}

/** Row tint for task lists — status color by default; overdue active tasks get a stronger warm tint. */
export function getTaskRowHighlightClass(task: { status?: string; due_at?: unknown }): string {
  const status = task.status || '';
  if (status !== 'ESCALATED' && isTaskOverdue(task.due_at, status)) {
    return TASK_ROW_OVERDUE;
  }
  return TASK_ROW_HIGHLIGHT[status] || 'border-l-[3px] border-l-border bg-muted/20 hover:bg-muted/35';
}

export function getTaskRowClasses(
  task: {
    status?: string;
    due_at?: unknown;
    creator_id?: number;
    blocked_reason?: string | null;
  },
  viewer?: { id?: number; role?: string } | null,
): string {
  const classes = [getTaskRowHighlightClass(task)];
  if (taskNeedsAssignerActionForViewer(task, viewer)) {
    classes.push('task-row-attention');
  }
  return classes.join(' ');
}

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
