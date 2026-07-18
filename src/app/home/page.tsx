'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Shell, { useMe } from '@/components/Shell';
import TaskCard from '@/components/TaskCard';
import AckModal from '@/components/AckModal';
import Composer from '@/components/Composer';
import { api } from '@/lib/util';

function Section({ icon, chip, title, tasks, extra }: {
  icon: string; chip: string; title: string; tasks: any[]; extra?: (t: any) => React.ReactNode;
}) {
  if (!tasks.length) return null;
  return (
    <section className="mb-7">
      <div className="flex items-center gap-2.5 mb-3">
        <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-base ${chip}`}>{icon}</span>
        <h2 className="text-[15px] font-bold">{title}</h2>
        <span className="ml-auto text-[11px] font-bold text-gray-400 bg-gray-100 rounded-full px-2.5 py-1">{tasks.length}</span>
      </div>
      <div className="space-y-2.5">
        {tasks.map((t) => (
          <div key={t.id} className="relative">
            <TaskCard task={t} />
            {extra?.(t)}
          </div>
        ))}
      </div>
    </section>
  );
}

function HomeInner() {
  const me = useMe();
  const [mine, setMine] = useState<any[]>([]);
  const [created, setCreated] = useState<any[]>([]);
  const [ackTask, setAckTask] = useState<any>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [clock, setClock] = useState<{ greeting: string; date: string } | null>(null);

  useEffect(() => {
    const d = new Date();
    const h = d.getHours();
    setClock({
      greeting: h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening',
      date: d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }),
    });
  }, []);

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

  const heroChips = [
    { v: needsAck.length, l: 'need response', hot: needsAck.length > 0 },
    { v: escalated.length, l: 'escalated', hot: escalated.length > 0 },
    { v: inProgress.length, l: 'in progress', hot: false },
    { v: dueToday.length, l: 'due today', hot: dueToday.length > 0 },
  ];

  return (
    <>
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-500 to-violet-500 text-white p-5 sm:p-7 mb-7 shadow-xl shadow-brand-600/20">
        <div className="absolute -right-10 -top-14 w-52 h-52 rounded-full bg-white/10" />
        <div className="absolute right-16 -bottom-20 w-40 h-40 rounded-full bg-white/[0.07]" />
        <div className="relative">
          <p className="text-white/70 text-xs font-medium tracking-wide uppercase">{clock?.date ?? ' '}</p>
          <h1 className="text-2xl sm:text-[28px] font-extrabold mt-1 tracking-tight">
            {clock?.greeting ?? 'Hello'}{me ? `, ${me.name.split(' ')[0]}` : ''} 👋
          </h1>
          <div className="flex gap-2 mt-5 flex-wrap">
            {heroChips.map((c) => (
              <div key={c.l} className={`rounded-2xl px-3.5 py-2 backdrop-blur-sm ${c.hot ? 'bg-white text-brand-700' : 'bg-white/15 text-white'}`}>
                <span className="text-lg font-extrabold leading-none">{c.v}</span>
                <span className={`ml-1.5 text-[11px] font-medium ${c.hot ? 'text-brand-500' : 'text-white/70'}`}>{c.l}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2.5 mt-5">
            <button className="btn bg-white text-brand-700 hover:bg-brand-50 shadow-md" onClick={() => setComposerOpen(true)}>
              ＋ New task
            </button>
            <Link href="/scribble" className="btn bg-white/15 text-white border border-white/25 hover:bg-white/25">
              ✏️ Scribble
            </Link>
          </div>
        </div>
      </div>

      {/* Needs acknowledgment — highest urgency */}
      {needsAck.length > 0 && (
        <Section
          icon="⚡" chip="bg-red-100 text-red-600"
          title="Needs your response — 30-min SLA" tasks={needsAck}
          extra={(t) => (
            <button
              className="absolute right-3 bottom-3 btn-primary !py-1.5 !px-3 text-xs"
              onClick={(e) => { e.preventDefault(); setAckTask(t); }}>
              Acknowledge + ETA
            </button>
          )}
        />
      )}

      <Section icon="🚨" chip="bg-red-100 text-red-600" title="Escalated — explanation required" tasks={escalated} />
      <Section icon="📅" chip="bg-orange-100 text-orange-600" title="Due today" tasks={dueToday} />
      <Section icon="🔄" chip="bg-brand-100 text-brand-600" title="In progress" tasks={inProgress.filter((t) => !dueToday.includes(t))} />
      <Section icon="📤" chip="bg-violet-100 text-violet-600" title="Assigned by me (open)" tasks={createdOpen} />
      <Section icon="✅" chip="bg-emerald-100 text-emerald-600" title="Recently done" tasks={doneRecent} />

      {mine.length === 0 && created.length === 0 && (
        <div className="card p-12 text-center">
          <div className="text-5xl mb-3">🎉</div>
          <div className="font-bold text-gray-700">All clear!</div>
          <p className="text-sm text-gray-400 mt-1 mb-5">No tasks on your plate. Create one or sketch it out on the board.</p>
          <div className="flex gap-2.5 justify-center">
            <button className="btn-primary" onClick={() => setComposerOpen(true)}>＋ New task</button>
            <Link href="/scribble" className="btn-secondary">✏️ Open Scribble</Link>
          </div>
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
