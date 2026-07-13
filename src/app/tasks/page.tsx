'use client';
import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Shell, { useMe } from '@/components/Shell';
import TaskCard from '@/components/TaskCard';
import Composer from '@/components/Composer';
import { api, STATUS_LABEL } from '@/lib/util';

function TasksInner() {
  const me = useMe();
  const params = useSearchParams();
  const [filter, setFilter] = useState('mine');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [tasks, setTasks] = useState<any[]>([]);
  const [composerOpen, setComposerOpen] = useState(params.get('new') === '1');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const sp = new URLSearchParams({ filter });
    if (status) sp.set('status', status);
    if (q) sp.set('q', q);
    api(`/api/tasks?${sp}`).then((d) => { setTasks(d.tasks); setLoading(false); });
  }, [filter, status, q]);
  useEffect(() => { load(); }, [load]);

  const segments = [
    { key: 'mine', label: 'My tasks' },
    { key: 'created', label: 'Created by me' },
    ...(me && me.role === 'MANAGER' ? [{ key: 'team', label: 'Team' }] : []),
    ...(me && ['ADMIN', 'CEO'].includes(me.role) ? [{ key: 'all', label: 'All' }] : []),
  ];

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Tasks</h1>
        <button className="btn-primary" onClick={() => setComposerOpen(true)}>+ New task</button>
      </div>

      <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
        {segments.map((s) => (
          <button key={s.key}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${filter === s.key ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
            onClick={() => setFilter(s.key)}>
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        <input className="input flex-1" placeholder="Search tasks…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input !w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="card h-24 animate-pulse" />)}</div>
      ) : tasks.length === 0 ? (
        <div className="card p-10 text-center text-gray-400">No tasks match.</div>
      ) : (
        <div className="space-y-2">{tasks.map((t) => <TaskCard key={t.id} task={t} />)}</div>
      )}

      <Composer open={composerOpen} onClose={() => setComposerOpen(false)} onCreated={load} />
    </>
  );
}

export default function TasksPage() {
  return (
    <Shell>
      <Suspense fallback={null}>
        <TasksInner />
      </Suspense>
    </Shell>
  );
}
