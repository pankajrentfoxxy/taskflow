// Client-safe formatting helpers + API client for TMS_BE

import { parseTimestamp, toDate, isTaskOverdue } from './timestamp';

export { parseTimestamp, toDate, isTaskOverdue, isDueInWindow } from './timestamp';
export { toast, getErrorMessage, TASK_ACTION_TOAST } from './toast';
/** @deprecated use parseTimestamp */
export const toTimestamp = parseTimestamp;

export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/$/, '');

export function apiUrl(path: string): string {
  const normalized = path.startsWith('/api') ? path.slice(4) : path;
  return `${API_BASE}${normalized.startsWith('/') ? normalized : `/${normalized}`}`;
}

export function uploadUrl(id: number | string): string {
  return `${API_BASE}/uploads/${id}`;
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

export type TaskDueDateFilterMode = 'all' | 'today' | 'range';

export type ReportsDateFilterMode = 'all' | '7' | '30' | '90' | 'range';

export function getTodayDueBounds(): { dueFrom: number; dueTo: number } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { dueFrom: start.getTime(), dueTo: end.getTime() };
}

export function getDateRangeDueBounds(fromDate: string, toDate: string): { dueFrom: number; dueTo: number } | null {
  if (!fromDate || !toDate) return null;
  const start = new Date(`${fromDate}T00:00:00`);
  const end = new Date(`${toDate}T23:59:59.999`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start.getTime() > end.getTime()) {
    return null;
  }
  return { dueFrom: start.getTime(), dueTo: end.getTime() };
}

/** Query params for GET /api/tasks due-date filtering. */
export function taskDueDateQueryParams(
  mode: TaskDueDateFilterMode,
  fromDate = '',
  toDate = '',
): Record<string, string> {
  if (mode === 'all') return {};
  if (mode === 'today') {
    const { dueFrom, dueTo } = getTodayDueBounds();
    return { dueFrom: String(dueFrom), dueTo: String(dueTo) };
  }
  const bounds = getDateRangeDueBounds(fromDate, toDate);
  if (!bounds) return {};
  return { dueFrom: String(bounds.dueFrom), dueTo: String(bounds.dueTo) };
}

/** Query params for GET /api/reports created-date filtering. */
export function reportsDateQueryParams(
  mode: ReportsDateFilterMode,
  fromDate = '',
  toDate = '',
): Record<string, string> {
  if (mode === 'all') return {};
  if (mode === '7' || mode === '30' || mode === '90') return { days: mode };
  const bounds = getDateRangeDueBounds(fromDate, toDate);
  if (!bounds) return {};
  return { createdFrom: String(bounds.dueFrom), createdTo: String(bounds.dueTo) };
}

export const STATUS_LABEL: Record<string, string> = {
  ASSIGNED: 'Accept response',
  DISCUSS: 'Discuss',
  ACKNOWLEDGED: 'Accepted',
  IN_PROGRESS: 'In progress',
  WAITING_FOR_INPUT: 'Waiting for input',
  INPUT_PROVIDED: 'Data provided',
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
  WAITING_FOR_INPUT: 'status-badge status-waiting-input',
  INPUT_PROVIDED: 'status-badge status-input-provided',
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
  WAITING_FOR_INPUT: 'status-dot-waiting-input',
  INPUT_PROVIDED: 'status-dot-input-provided',
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
  WAITING_FOR_INPUT:
    'border-l-[3px] border-l-status-waiting-input-dot bg-status-waiting-input-bg/50 hover:bg-status-waiting-input-bg/75',
  INPUT_PROVIDED:
    'border-l-[3px] border-l-status-input-provided-dot bg-status-input-provided-bg/50 hover:bg-status-input-provided-bg/75',
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
  if (status === 'WAITING_FOR_INPUT') return true;
  if (status === 'REJECTED') return true;
  if (task.blocked_reason?.trim()) return true;
  return false;
}

/** Escalation explanation submitted and awaiting Admin/CEO review. */
export function taskNeedsEscalationReview(task: {
  status?: string;
  escalation_review_pending?: boolean | string | null;
}): boolean {
  if (task.status !== 'ESCALATED') return false;
  const pending = task.escalation_review_pending;
  if (pending === true || pending === 'true' || pending === 't') return true;
  if (pending === false || pending === 'false' || pending === 'f' || pending == null) return false;
  return Boolean(pending);
}

/** Creator, Admin, or CEO may change assignee from the task list (managers via API). */
export function canReassignTask(
  task: { creator_id?: number; status?: string },
  viewer?: { id?: number; role?: string } | null,
): boolean {
  if (!viewer?.id) return false;
  if (['DONE', 'CANCELLED', 'REJECTED'].includes(task.status || '')) return false;
  if (viewer.role === 'ADMIN' || viewer.role === 'CEO') return true;
  return task.creator_id === viewer.id;
}

/** Pulse + badge for creator (discuss/block/reject) or Admin/CEO (escalation review). */
export function taskNeedsAssignerActionForViewer(
  task: {
    creator_id?: number;
    status?: string;
    blocked_reason?: string | null;
    escalation_review_pending?: boolean | string | null;
  },
  viewer?: { id?: number; role?: string } | null,
): boolean {
  if (!viewer?.id) return false;

  if (
    (viewer.role === 'ADMIN' || viewer.role === 'CEO') &&
    taskNeedsEscalationReview(task)
  ) {
    return true;
  }

  if (!taskNeedsAssignerAction(task)) return false;
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
    escalation_review_pending?: boolean | string | null;
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

const AUTH_NO_RETRY = new Set([
  '/auth/login',
  '/auth/logout',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/refresh',
]);

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

export async function deleteUpload(id: number): Promise<void> {
  await api(`/api/uploads/${id}`, { method: 'DELETE' });
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
