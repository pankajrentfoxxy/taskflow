'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Shell from '@/components/Shell';
import { api, timeAgo } from '@/lib/util';

const ICONS: Record<string, string> = {
  ASSIGNED: '📥', SLA_WARNING: '⏰', SLA_BREACH: '🚨', ESCALATED: '🔺', EXPLANATION: '📝',
  REVIEW: '⚖️', DONE: '✅', SUBTASK_DONE: '☑️', COMMENT: '💬', ETA_CHANGED: '🕒',
  DUE_CHANGED: '📅', DUE_SOON: '⏳', REOPENED: '↩️', CANCELLED: '🚫', BLOCKED: '🚧',
  ACKNOWLEDGED: '👍', PROJECT: '📁', SUBTASK: '➕',
};

function NotificationsInner() {
  const [items, setItems] = useState<any[]>([]);
  const load = () => api('/api/notifications').then((d) => setItems(d.notifications));
  useEffect(() => { load(); }, []);

  const markAll = () => api('/api/notifications', { method: 'POST', body: JSON.stringify({ all: true }) }).then(load);

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Notifications</h1>
        <button className="btn-secondary" onClick={markAll}>Mark all read</button>
      </div>
      <div className="space-y-2">
        {items.map((n) => {
          const inner = (
            <div className={`card p-3.5 flex gap-3 ${!n.read_at ? 'border-brand-200 bg-brand-50/50' : ''}`}>
              <span className="text-xl">{ICONS[n.type] || '🔔'}</span>
              <div className="min-w-0">
                <div className={`text-sm ${!n.read_at ? 'font-semibold' : ''}`}>{n.title}</div>
                {n.body && <div className="text-xs text-gray-500 truncate">{n.body}</div>}
                <div className="text-[11px] text-gray-400 mt-0.5">{timeAgo(n.created_at)}</div>
              </div>
            </div>
          );
          return n.task_id ? (
            <Link key={n.id} href={`/tasks/${n.task_id}`} className="block"
              onClick={() => api('/api/notifications', { method: 'POST', body: JSON.stringify({ ids: [n.id] }) })}>
              {inner}
            </Link>
          ) : <div key={n.id}>{inner}</div>;
        })}
        {items.length === 0 && <div className="card p-10 text-center text-gray-400">No notifications.</div>}
      </div>
    </>
  );
}

export default function NotificationsPage() {
  return <Shell><NotificationsInner /></Shell>;
}
