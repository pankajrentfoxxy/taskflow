'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Flag, MessageSquare, Plus, User } from 'lucide-react';
import Composer from '@/components/Composer';
import CommentsModal from '@/components/CommentsModal';
import TaskStatusModal from '@/components/TaskStatusModal';
import TaskAssignerUrgentBadge from '@/components/TaskAssignerUrgentBadge';
import { api, fmtShortDate, STATUS_LABEL, STATUS_COLOR, STATUS_COLOR_FALLBACK, STATUS_DOT, PRIORITY_COLOR, isTaskOverdue, getTaskRowClasses } from '@/lib/util';
import { useMe } from '@/components/Shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

const initials = (n?: string | null) =>
  (n || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

function StatusButton({ task, onStatusClick }: { task: any; onStatusClick: (task: any) => void }) {
  return (
    <button
      type="button"
      className="rounded-md outline-none ring-offset-background transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
      title="Change status"
      onClick={() => onStatusClick(task)}
    >
      <Badge className={cn('cursor-pointer', STATUS_COLOR[task.status] || STATUS_COLOR_FALLBACK)}>
        <span className="mr-1.5 size-1.5 rounded-full bg-current opacity-70" />
        {STATUS_LABEL[task.status] || task.status}
      </Badge>
    </button>
  );
}

function CommentsButton({ task, onOpenComments }: { task: any; onOpenComments: (task: any) => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="relative text-muted-foreground hover:text-foreground"
      onClick={() => onOpenComments(task)}
      title="Comments"
    >
      <MessageSquare className="size-4" />
      {task.comment_count > 0 && (
        <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
          {task.comment_count > 9 ? '9+' : task.comment_count}
        </span>
      )}
    </Button>
  );
}

function SubtaskTable({
  subtasks,
  onStatusClick,
  onOpenComments,
  viewer,
}: {
  subtasks: any[];
  onStatusClick: (task: any) => void;
  onOpenComments: (task: any) => void;
  viewer?: { id?: number; role?: string } | null;
}) {
  return (
    <>
      <div className="space-y-2 md:hidden">
        {subtasks.map((s) => {
          const overdue = isTaskOverdue(s.due_at, s.status);
          const rowHighlight = getTaskRowClasses(s, viewer);
          const assignee = s.assignee_name || (s.team_name ? `Team ${s.team_name}` : null);
          return (
            <div key={s.id} className={cn('rounded-lg border p-3', rowHighlight)}>
              <Link href={`/tasks/${s.id}`} className="flex items-center gap-2">
                <span className={cn('size-2 shrink-0 rounded-full', STATUS_DOT[s.status] || 'status-dot-cancelled')} />
                <span className={cn('min-w-0 flex-1 truncate text-sm font-medium', s.status === 'DONE' && 'text-muted-foreground line-through')}>
                  {s.title}
                </span>
              </Link>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <div><span className="text-muted-foreground">Assignee </span>{assignee || '—'}</div>
                <div><span className="text-muted-foreground">Type </span>{s.type_name || '—'}</div>
                <div>
                  <span className="text-muted-foreground">Due </span>
                  <span className={cn(overdue && 'font-medium text-red-600')}>{fmtShortDate(s.due_at)}</span>
                </div>
                <div><span className="text-muted-foreground">ETA </span>{fmtShortDate(s.eta_at)}</div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusButton task={s} onStatusClick={onStatusClick} />
                <TaskAssignerUrgentBadge task={s} viewer={viewer} />
                <div className="ml-auto flex items-center gap-2">
                  <CommentsButton task={s} onOpenComments={onOpenComments} />
                  <span className={cn('text-xs capitalize', PRIORITY_COLOR[s.priority])}>{s.priority?.toLowerCase()}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="hidden overflow-hidden rounded-lg border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-9 pl-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Name</TableHead>
              <TableHead className="h-9 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Assignee</TableHead>
              <TableHead className="h-9 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Due date</TableHead>
              <TableHead className="h-9 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">ETA</TableHead>
              <TableHead className="h-9 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Task type</TableHead>
              <TableHead className="h-9 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Priority</TableHead>
              <TableHead className="h-9 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
              <TableHead className="h-9 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Comments</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subtasks.map((s) => {
              const overdue = isTaskOverdue(s.due_at, s.status);
              const rowHighlight = getTaskRowClasses(s, viewer);
              const assignee = s.assignee_name || (s.team_name ? `Team ${s.team_name}` : null);
              return (
                <TableRow key={s.id} className={cn('group', rowHighlight)}>
                  <TableCell className="max-w-[220px] py-2.5 pl-3">
                    <Link href={`/tasks/${s.id}`} className="flex items-center gap-2">
                      <span className={cn('size-2 shrink-0 rounded-full', STATUS_DOT[s.status] || 'status-dot-cancelled')} />
                      <span className={cn('truncate text-sm font-medium', s.status === 'DONE' && 'text-muted-foreground line-through')}>
                        {s.title}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="py-2.5">
                    {assignee ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="size-6 bg-muted">
                          <AvatarFallback className="bg-muted text-[9px] font-semibold text-muted-foreground">
                            {initials(s.assignee_name || s.team_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="max-w-[100px] truncate text-xs text-muted-foreground">
                          {assignee.split(' (')[0]}
                        </span>
                      </div>
                    ) : (
                      <User className="size-4 text-muted-foreground/60" />
                    )}
                  </TableCell>
                  <TableCell className={cn('py-2.5 text-xs', overdue ? 'font-medium text-red-600' : 'text-muted-foreground')}>
                    {fmtShortDate(s.due_at)}
                  </TableCell>
                  <TableCell className="py-2.5 text-xs text-muted-foreground">{fmtShortDate(s.eta_at)}</TableCell>
                  <TableCell className="max-w-[120px] truncate py-2.5 text-xs text-muted-foreground">
                    {s.type_name || '—'}
                  </TableCell>
                  <TableCell className="py-2.5">
                    <span className={cn('inline-flex items-center gap-1 text-xs font-medium capitalize', PRIORITY_COLOR[s.priority])}>
                      <Flag className="size-3 fill-current" />
                      {s.priority?.toLowerCase()}
                    </span>
                  </TableCell>
                  <TableCell className="py-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusButton task={s} onStatusClick={onStatusClick} />
                      <TaskAssignerUrgentBadge task={s} viewer={viewer} />
                    </div>
                  </TableCell>
                  <TableCell className="py-2.5 pr-3">
                    <CommentsButton task={s} onOpenComments={onOpenComments} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

export default function TaskDetailAccordion({
  taskId,
  onUpdated,
}: {
  taskId: number;
  onUpdated?: () => void;
}) {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [subOpen, setSubOpen] = useState(false);
  const [statusTask, setStatusTask] = useState<any>(null);
  const [commentsTask, setCommentsTask] = useState<any>(null);
  const me = useMe();
  const viewer = me ? { id: me.id, role: me.role } : null;

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    return api(`/api/tasks/${taskId}`)
      .then(setData)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [taskId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) {
    return (
      <div className="border-t bg-muted/20 px-4 py-6">
        <div className="h-24 animate-pulse rounded-lg bg-muted/60" />
      </div>
    );
  }

  if (err && !data) {
    return (
      <div className="border-t bg-muted/20 px-4 py-4 text-sm text-red-600">{err}</div>
    );
  }

  if (!data) return null;

  const { task, subtasks, attachments, permissions } = data;
  const doneCount = subtasks.filter((s: any) => s.status === 'DONE').length;
  const canAddSubtask = permissions?.canAddSubtask && !task.parent_id;

  const handleStatusDone = () => {
    load();
    onUpdated?.();
  };

  return (
    <div className="border-t bg-muted/20 px-4 py-4">
      {!task.parent_id && (
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Subtasks
                {subtasks.length > 0 && (
                  <span className="ml-2 normal-case text-emerald-600">
                    {doneCount} of {subtasks.length} done
                  </span>
                )}
              </h3>
            </div>
            {canAddSubtask && (
              <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setSubOpen(true)}>
                <Plus className="size-3.5" />
                Create subtask
              </Button>
            )}
          </div>

          {subtasks.length > 0 && (
            <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${(100 * doneCount) / subtasks.length}%` }}
              />
            </div>
          )}

          {subtasks.length > 0 ? (
            <SubtaskTable subtasks={subtasks} onStatusClick={setStatusTask} onOpenComments={setCommentsTask} viewer={viewer} />
          ) : (
            <div className="rounded-lg border border-dashed bg-card px-4 py-6 text-center text-sm text-muted-foreground">
              No subtasks yet.
              {canAddSubtask && ' Use Create subtask to add one.'}
            </div>
          )}
        </div>
      )}

      {attachments?.length > 0 && (
        <div className="mt-3 text-sm text-muted-foreground">
          {attachments.length} attachment{attachments.length > 1 ? 's' : ''}
        </div>
      )}

      <div className="mt-4">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/tasks/${task.id}`}>View full details</Link>
        </Button>
      </div>

      <Composer
        open={subOpen}
        onClose={() => setSubOpen(false)}
        onCreated={() => {
          setSubOpen(false);
          load();
          onUpdated?.();
        }}
        presetParentId={task.id}
        presetProjectId={task.project_id ?? null}
      />

      <TaskStatusModal
        task={statusTask}
        open={!!statusTask}
        onClose={() => setStatusTask(null)}
        onDone={handleStatusDone}
      />

      <CommentsModal
        task={commentsTask}
        open={!!commentsTask}
        onClose={() => setCommentsTask(null)}
        onChanged={() => {
          load();
          onUpdated?.();
        }}
      />
    </div>
  );
}
