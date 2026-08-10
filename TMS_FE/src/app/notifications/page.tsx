'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Shell from '@/components/Shell';
import { api, timeAgo } from '@/lib/util';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

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
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Notifications</h1>
        <Button variant="outline" onClick={markAll}>Mark all read</Button>
      </div>
      <div className="space-y-2">
        {items.map((n) => {
          const inner = (
            <Card className={cn('py-0', !n.read_at && 'border-brand-200 bg-brand-50/50')}>
              <CardContent className="flex gap-3 p-3.5">
                <span className="text-xl">{ICONS[n.type] || '🔔'}</span>
                <div className="min-w-0">
                  <div className={cn('text-sm', !n.read_at && 'font-semibold')}>{n.title}</div>
                  {n.body && <div className="truncate text-xs text-gray-500">{n.body}</div>}
                  <div className="mt-0.5 text-[11px] text-gray-400">{timeAgo(n.created_at)}</div>
                </div>
              </CardContent>
            </Card>
          );
          return n.task_id ? (
            <Link key={n.id} href={`/tasks/${n.task_id}`} className="block"
              onClick={() => api('/api/notifications', { method: 'POST', body: JSON.stringify({ ids: [n.id] }) })}>
              {inner}
            </Link>
          ) : <div key={n.id}>{inner}</div>;
        })}
        {items.length === 0 && (
          <Card className="py-0">
            <CardContent className="p-10 text-center text-gray-400">No notifications.</CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

export default function NotificationsPage() {
  return <Shell><NotificationsInner /></Shell>;
}
