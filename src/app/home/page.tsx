'use client';
import { useEffect, useState, useCallback } from 'react';
import Shell, { useMe } from '@/components/Shell';
import TaskCard from '@/components/TaskCard';
import AckModal from '@/components/AckModal';
import Composer from '@/components/Composer';
import { api } from '@/lib/util';

function Section({ title, tasks, tone }: { title: string; tasks: any[]; tone?: string }) {
  if (!tasks.length) return null;
  return (
    <section className="mb-6">
      <h2 className={`text-sm font-bold mb-2 ${tone || 'text-gray-700'}`}>{title} <span className="text-gray-400 font-normal">({tasks.length})</span></h2>
      <div className="space-y-2">{tasks.map((t) => <TaskCard key={t.id} task={t} />)}</div>
    </section>
  );
}

function HomeInner() {
  const me = useMe();
  const [mine, setMine] = useState<any[]>([]);
  const [created, setCreated] = useState<any[]>([]);
  const [ackTask, setAckTask] = useState<any>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  const load = useCallback(() => {
    api('/api/tasks?filter=mine').then((d) => setMine(d.tasks));
    api('/api/tasks?filter=created').then((d) => setCreated(d.tasks));
  }, []);
  useEffect(() => { load(); const iv = setInterval(load, 30000); return () => clearInterval(iv); }, [load]);

  const now = Date.now();
  const dayEnd = new Date(); dayEnd.setHours(23, 59, 59, 999);
  const needsAck = mine.filter((t) => t.status === 'ASSIGNED');
  const escalated = mine.filter((t) => t.status === 'ESCALATED');
  const inProgress = mine.filter((t) => ['ACKNOWLEDGED', 'IN_PROGRESS'].includes(t.status));
  const dueToday = inProgress.filter((t) => t.due_at <= dayEnd.getTime() && t.due_at >= now);
  const doneRecent = mine.filter((t) => t.status === 'DONE').slice(0, 5);
  const createdOpen = created.filter((t) => !['DONE', 'CANCELLED'].includes(t.status) && t.assignee_id !== me?.id);

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">Hi{me ? `, ${me.name.split(' ')[0]}` : ''} 👋</h1>
          <p className="text-sm text-gray-500">Here&apos;s what needs your attention.</p>
        </div>
        <button className="btn-primary" onClick={() => setComposerOpen(true)}>+ New task</button>
      </div>

      {needsAck.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-bold text-red-600 mb-2">⚠ Needs acknowledgment ({needsAck.length}) — 30-min SLA</h2>
          <div className="space-y-2">
            {needsAck.map((t) => (
              <div key={t.id} className="relative">
                <TaskCard task={t} />
                <button
                  className="absolute right-3 bottom-3 btn-primary !py-1.5 !px-3 text-xs"
                  onClick={(e) => { e.preventDefault(); setAckTask(t); }}>
                  Acknowledge + ETA
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <Section title="🚨 Escalated — explanation required" tasks={escalated} tone="text-red-600" />
      <Section title="Due today" tasks={dueToday} tone="text-orange-600" />
      <Section title="In progress" tasks={inProgress.filter((t) => !dueToday.includes(t))} />
      <Section title="Assigned by me (open)" tasks={createdOpen} />
      <Section title="Recently done" tasks={doneRecent} tone="text-emerald-700" />

      {mine.length === 0 && created.length === 0 && (
        <div className="card p-10 text-center text-gray-400">
          <div className="text-4xl mb-2">🎉</div>
          No tasks yet. Create one with the button above.
        </div>
      )}

      {ackTask && <AckModal task={ackTask} open={!!ackTask} onClose={() => setAckTask(null)} onDone={load} />}
      <Composer open={composerOpen} onClose={() => setComposerOpen(false)} onCreated={load} />
    </>
  );
}

export default function HomePage() {
  return <Shell><HomeInner /></Shell>;
}
