'use client';
import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Shell, { useMe } from '@/components/Shell';
import TaskTable, { TaskTableSkeleton } from '@/components/TaskTable';
import CommentsModal from '@/components/CommentsModal';
import Composer from '@/components/Composer';
import { api, STATUS_LABEL } from '@/lib/util';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Card, CardContent } from '@/components/ui/card';

function TasksInner() {
  const me = useMe();
  const params = useSearchParams();
  const [filter, setFilter] = useState('mine');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [tasks, setTasks] = useState<any[]>([]);
  const [composerOpen, setComposerOpen] = useState(params.get('new') === '1');
  const [commentsTask, setCommentsTask] = useState<any>(null);
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
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Tasks</h1>
        <Button onClick={() => setComposerOpen(true)}>+ New task</Button>
      </div>

      <div className="mb-4 flex flex-nowrap items-center gap-2 overflow-x-auto pb-1">
        <div className="flex shrink-0 gap-1.5">
          {segments.map((s) => (
            <Button
              key={s.key}
              size="sm"
              variant={filter === s.key ? 'default' : 'outline'}
              className="rounded-full whitespace-nowrap"
              onClick={() => setFilter(s.key)}>
              {s.label}
            </Button>
          ))}
        </div>
        <Input
          className="min-w-[140px] flex-1"
          placeholder="Search tasks…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <NativeSelect className="w-auto shrink-0" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </NativeSelect>
      </div>

      {loading ? (
        <TaskTableSkeleton />
      ) : tasks.length === 0 ? (
        <Card className="py-0">
          <CardContent className="p-10 text-center text-muted-foreground">No tasks match.</CardContent>
        </Card>
      ) : (
        <TaskTable tasks={tasks} onOpenComments={setCommentsTask} />
      )}

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

export default function TasksPage() {
  return (
    <Shell>
      <Suspense fallback={null}>
        <TasksInner />
      </Suspense>
    </Shell>
  );
}
