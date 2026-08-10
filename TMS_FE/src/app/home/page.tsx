'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Shell, { useMe } from '@/components/Shell';
import TaskTable from '@/components/TaskTable';
import CommentsModal from '@/components/CommentsModal';
import AckModal from '@/components/AckModal';
import Composer from '@/components/Composer';
import { api, isDueInWindow } from '@/lib/util';
import { IconZap, IconAlert, IconActivity, IconCalendar, IconPlus, IconPen, IconSend, IconCheckCircle } from '@/components/Icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

function Metric({ icon, chip, value, label, hot }: { icon: React.ReactNode; chip: string; value: number; label: string; hot?: boolean }) {
  return (
    <Card className={cn('py-0', hot && 'ring-red-200')}>
      <CardContent className="flex items-center gap-3 p-4">
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', chip)}>{icon}</span>
        <div className="min-w-0">
          <div className={cn('tnum text-xl font-bold leading-none', hot ? 'text-red-600' : 'text-gray-900')}>{value}</div>
          <div className="mt-1 truncate text-[11px] font-medium text-gray-400">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function Section({ accent, icon, title, tasks, extra, onOpenComments }: {
  accent: string; icon: React.ReactNode; title: string; tasks: any[];
  extra?: (t: any) => React.ReactNode;
  onOpenComments: (task: any) => void;
}) {
  if (!tasks.length) return null;
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center gap-2">
        <span className={cn('flex h-6 w-6 items-center justify-center rounded-md', accent)}>{icon}</span>
        <h2 className="text-[13px] font-semibold tracking-wide text-gray-600 uppercase">{title}</h2>
        <Badge variant="secondary" className="tnum text-[11px]">{tasks.length}</Badge>
        <div className="ml-1 h-px flex-1 bg-gray-200/70" />
      </div>
      <TaskTable tasks={tasks} onOpenComments={onOpenComments} renderAction={extra} />
    </section>
  );
}

function HomeInner() {
  const me = useMe();
  const [mine, setMine] = useState<any[]>([]);
  const [created, setCreated] = useState<any[]>([]);
  const [ackTask, setAckTask] = useState<any>(null);
  const [commentsTask, setCommentsTask] = useState<any>(null);
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
  const dueToday = inProgress.filter((t) => isDueInWindow(t.due_at, now, dayEnd.getTime()));
  const doneRecent = mine.filter((t) => t.status === 'DONE').slice(0, 5);
  const createdOpen = created.filter((t) => !['DONE', 'CANCELLED'].includes(t.status) && t.assignee_id !== me?.id);

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-widest text-gray-400 uppercase">{clock?.date ?? ' '}</p>
          <h1 className="mt-1 text-[24px] font-bold tracking-tight">
            {clock?.greeting ?? 'Hello'}{me ? `, ${me.name.split(' ')[0]}` : ''}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/scribble">
              <IconPen className="h-4 w-4" /> Scribble
            </Link>
          </Button>
          <Button onClick={() => setComposerOpen(true)}>
            <IconPlus className="h-4 w-4" /> New task
          </Button>
        </div>
      </div>

      {/* Focus metrics */}
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric icon={<IconZap className="h-[18px] w-[18px]" />} chip="bg-red-50 text-red-500" value={needsAck.length} label="Need response" hot={needsAck.length > 0} />
        <Metric icon={<IconAlert className="h-[18px] w-[18px]" />} chip="bg-orange-50 text-orange-500" value={escalated.length} label="Escalated" hot={escalated.length > 0} />
        <Metric icon={<IconActivity className="h-[18px] w-[18px]" />} chip="bg-brand-50 text-brand-500" value={inProgress.length} label="In progress" />
        <Metric icon={<IconCalendar className="h-[18px] w-[18px]" />} chip="bg-sky-50 text-sky-500" value={dueToday.length} label="Due today" />
      </div>

      {needsAck.length > 0 && (
        <Section
          accent="bg-red-50 text-red-500" icon={<IconZap className="h-3.5 w-3.5" />}
          title="Needs your response · 30-min SLA" tasks={needsAck}
          onOpenComments={setCommentsTask}
          extra={(t) => (
            <Button size="xs" onClick={() => setAckTask(t)}>
              Acknowledge + ETA
            </Button>
          )}
        />
      )}

      <Section accent="bg-red-50 text-red-500" icon={<IconAlert className="h-3.5 w-3.5" />} title="Escalated · explanation required" tasks={escalated} onOpenComments={setCommentsTask} />
      <Section accent="bg-orange-50 text-orange-500" icon={<IconCalendar className="h-3.5 w-3.5" />} title="Due today" tasks={dueToday} onOpenComments={setCommentsTask} />
      <Section accent="bg-brand-50 text-brand-500" icon={<IconActivity className="h-3.5 w-3.5" />} title="In progress" tasks={inProgress.filter((t) => !dueToday.includes(t))} onOpenComments={setCommentsTask} />
      <Section accent="bg-violet-50 text-violet-500" icon={<IconSend className="h-3.5 w-3.5" />} title="Assigned by me · open" tasks={createdOpen} onOpenComments={setCommentsTask} />
      <Section accent="bg-emerald-50 text-emerald-500" icon={<IconCheckCircle className="h-3.5 w-3.5" />} title="Recently done" tasks={doneRecent} onOpenComments={setCommentsTask} />

      {mine.length === 0 && created.length === 0 && (
        <Card className="py-0">
          <CardContent className="p-14 text-center">
            <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
              <IconCheckCircle className="h-7 w-7" />
            </span>
            <div className="font-bold text-gray-800">All clear</div>
            <p className="mt-1 mb-6 text-[13px] text-gray-400">Nothing on your plate. Create a task or sketch one on the board.</p>
            <div className="flex justify-center gap-2.5">
              <Button onClick={() => setComposerOpen(true)}><IconPlus className="h-4 w-4" /> New task</Button>
              <Button variant="outline" asChild>
                <Link href="/scribble"><IconPen className="h-4 w-4" /> Open Scribble</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {ackTask && <AckModal task={ackTask} open={!!ackTask} onClose={() => setAckTask(null)} onDone={load} />}
      <CommentsModal
        task={commentsTask}
        open={!!commentsTask}
        onClose={() => setCommentsTask(null)}
        onChanged={load}
      />
      <Composer open={composerOpen} onClose={() => setComposerOpen(false)} onCreated={load} />
    </>
  );
}

export default function HomePage() {
  return <Shell><HomeInner /></Shell>;
}
