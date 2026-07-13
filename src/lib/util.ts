// Client-safe formatting helpers
export function fmtDateTime(ms?: number | null): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

export function fmtDate(ms?: number | null): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function timeAgo(ms?: number | null): string {
  if (!ms) return '';
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function countdown(deadline: number): string {
  const diff = deadline - Date.now();
  if (diff <= 0) return 'breached';
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m left`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${m % 60}m left`;
  return `${Math.floor(h / 24)}d left`;
}

export function toLocalInput(ms?: number | null): string {
  if (!ms) return '';
  const d = new Date(ms);
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
  ASSIGNED: 'bg-amber-100 text-amber-800',
  ACKNOWLEDGED: 'bg-sky-100 text-sky-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  DONE: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-gray-200 text-gray-600',
  ESCALATED: 'bg-red-100 text-red-800',
};

export const PRIORITY_COLOR: Record<string, string> = {
  URGENT: 'text-red-600',
  HIGH: 'text-orange-600',
  NORMAL: 'text-gray-500',
  LOW: 'text-gray-400',
};

export async function api(path: string, opts?: RequestInit) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { code: data.code, status: res.status });
  return data;
}
