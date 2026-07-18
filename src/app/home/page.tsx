'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Shell, { useMe } from '@/components/Shell';
import TaskCard from '@/components/TaskCard';
import AckModal from '@/components/AckModal';
import Composer from '@/components/Composer';
import { api } from '@/lib/util';
import { IconZap, IconAlert, IconActivity, IconCalendar, IconPlus, IconPen, IconSend, IconCheckCircle } from '@/components/Icons';

function Metric({ icon, chip, value, label, hot }: { icon: React.ReactNode; chip: string; value: number; label: string; hot?: boolean }) {
  return (
    <div className={`card p-4 flex items-center gap-3 ${hot ? 'ring-1 ring-red-200' : ''}`}>
      <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${chip}`}>{icon}</span>
      <div className="min-w-0">
        <div className={`text-xl font-bold leading-none tnum ${hot ? 'text-red-600' : 'text-gray-900'}`}>{value}</div>
        <div className="text-[11px] text-gray-400 font-medium mt-1 truncate">{label}</div>
      </div>
    </div>
  );
}

function Section({ accent, icon, title, tasks, extra }: {
  accent: string; icon: React.ReactNode; title: string; tasks: any[]; extra?: (t: any) => React.ReactNode;
}) {
  if (!tasks.length) return null;
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-6 h-6 rounded-md flex items-center justify-center ${accent}`}>{icon}</span>
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-600">{title}</h2>
        <span className="text-[11px] font-bold text-gray-400 tnum">{tasks.length}</span>
        <div className="flex-1 h-px bg-gray-200/70 ml-1" />
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

  return (
    <>
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">{clock?.date ?? ' '}</p>
          <h1 className="text-[24px] font-bold tracking-tight mt-1">
            {clock?.greeting ?? 'Hello'}{me ? `, ${me.name.split(' ')[0]}` : ''}
          </h1>
        </div>
        <div className="flex gap-2">
          <Link href="/scribble" className="btn-secondary">
            <IconPen className="w-4 h-4" /> Scribble
          </Link>
          <button className="btn-primary" onClick={() => setComposerOpen(true)}>
            <IconPlus className="w-4 h-4" /> New task
          </button>
        </div>
      </div>

      {/* Focus metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <Metric icon={<IconZap className="w-[18px] h-[18px]" />} chip="bg-red-50 text-red-500" value={needsAck.length} label="Need response" hot={needsAck.length > 0} />
        <Metric icon={<IconAlert className="w-[18px] h-[18px]" />} chip="bg-orange-50 text-orange-500" value={escalated.length} label="Escalated" hot={escalated.length > 0} />
        <Metric icon={<IconActivity className="w-[18px] h-[18px]" />} chip="bg-brand-50 text-brand-500" value={inProgress.length} label="In progress" />
        <Metric icon={<IconCalendar className="w-[18px] h-[18px]" />} chip="bg-sky-50 text-sky-500" value={dueToday.length} label="Due today" />
      </div>

      {needsAck.length > 0 && (
        <Section
          accent="bg-red-50 text-red-500" icon={<IconZap className="w-3.5 h-3.5" />}
          title="Needs your response · 30-min SLA" tasks={needsAck}
          extra={(t) => (
            <button
              className="absolute right-3 bottom-3 btn-primary !py-1.5 !px-3 !text-xs"
              onClick={(e) => { e.preventDefault(); setAckTask(t); }}>
              Acknowledge + ETA
            </button>
          )}
        />
      )}

      <Section accent="bg-red-50 text-red-500" icon={<IconAlert className="w-3.5 h-3.5" />} title="Escalated · explanation required" tasks={escalated} />
      <Section accent="bg-orange-50 text-orange-500" icon={<IconCalendar className="w-3.5 h-3.5" />} title="Due today" tasks={dueToday} />
      <Section accent="bg-brand-50 text-brand-500" icon={<IconActivity className="w-3.5 h-3.5" />} title="In progress" tasks={inProgress.filter((t) => !dueToday.includes(t))} />
      <Section accent="bg-violet-50 text-violet-500" icon={<IconSend className="w-3.5 h-3.5" />} title="Assigned by me · open" tasks={createdOpen} />
      <Section accent="bg-emerald-50 text-emerald-500" icon={<IconCheckCircle className="w-3.5 h-3.5" />} title="Recently done" tasks={doneRecent} />

      {mine.length === 0 && created.length === 0 && (
        <div className="card p-14 text-center">
          <span className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center mx-auto mb-4">
            <IconCheckCircle className="w-7 h-7" />
          </span>
          <div className="font-bold text-gray-800">All clear</div>
          <p className="text-[13px] text-gray-400 mt-1 mb-6">Nothing on your plate. Create a task or sketch one on the board.</p>
          <div className="flex gap-2.5 justify-center">
            <button className="btn-primary" onClick={() => setComposerOpen(true)}><IconPlus className="w-4 h-4" /> New task</button>
            <Link href="/scribble" className="btn-secondary"><IconPen className="w-4 h-4" /> Open Scribble</Link>
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
