'use client';

import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { fmtShortDate, countdown, STATUS_LABEL, STATUS_COLOR, isTaskOverdue } from '@/lib/util';
import { IconClock, IconFlag, IconTag } from './Icons';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const initials = (n?: string) => (n || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export default function TaskCard({
  task,
  onOpenComments,
  renderAction,
}: {
  task: any;
  onOpenComments?: (task: any) => void;
  renderAction?: (task: any) => React.ReactNode;
}) {
  const overdue = isTaskOverdue(task.due_at, task.status);
  const slaRunning = task.status === 'ASSIGNED' && !task.sla_breached_at && task.sla_deadline_at;
  const who = task.assignee_name || (task.team_name ? `Team ${task.team_name}` : 'Unassigned');

  return (
    <Card className="gap-0 py-0 transition-all hover:shadow-[0_4px_12px_rgba(16,24,40,0.07)]">
      <CardContent className="p-4">
        <Link href={`/tasks/${task.id}`} className="group block">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge className={cn('border-0', STATUS_COLOR[task.status] || 'bg-gray-100')}>
              <span className="size-1.5 rounded-full bg-current opacity-60" />
              {STATUS_LABEL[task.status] || task.status}
            </Badge>
            {task.sla_breached_at && task.status === 'ASSIGNED' && (
              <Badge className="border-0 bg-red-600 text-white hover:bg-red-600">No response</Badge>
            )}
            {slaRunning && (
              <Badge className="border-amber-200 bg-amber-50 text-amber-700">
                <IconClock className="size-3" /> {countdown(task.sla_deadline_at)}
              </Badge>
            )}
            {task.blocked_reason && (
              <Badge className="border-purple-200 bg-purple-50 text-purple-700">Blocked</Badge>
            )}
            {task.type_name && (
              <Badge className="border-gray-200 bg-gray-50 text-gray-500">
                <IconTag className="size-3" /> {task.type_name}
              </Badge>
            )}
            {['URGENT', 'HIGH'].includes(task.priority) && (
              <Badge
                className={
                  task.priority === 'URGENT'
                    ? 'border-red-200 bg-red-50 text-red-600'
                    : 'border-orange-200 bg-orange-50 text-orange-600'
                }
              >
                <IconFlag className="size-3" /> {task.priority.toLowerCase()}
              </Badge>
            )}
          </div>

          <div className="mt-2 truncate text-[14.5px] font-semibold leading-snug text-gray-900 group-hover:text-brand-700">
            {task.title}
          </div>

          <div className="mt-2.5 flex items-center gap-2">
            <Avatar size="sm" className="bg-gradient-to-br from-brand-100 to-violet-100">
              <AvatarFallback className="bg-transparent text-[9px] font-bold text-brand-700">
                {initials(task.assignee_name || task.team_name)}
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0 truncate text-xs text-gray-500">
              {who}
              <span className="mx-1 text-gray-300">·</span>
              <span className="text-gray-400">by {String(task.creator_name || '').split(' (')[0]}</span>
              {task.project_name && (
                <>
                  <span className="mx-1 text-gray-300">·</span>
                  <span className="font-medium text-brand-600">{task.project_name}</span>
                </>
              )}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Due </span>
              <span className={cn('font-medium', overdue ? 'text-red-600' : 'text-foreground')}>
                {fmtShortDate(task.due_at)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">ETA </span>
              <span className="font-medium text-foreground">{fmtShortDate(task.eta_at)}</span>
            </div>
          </div>

          {task.subtask_count > 0 && (
            <div className="mt-3">
              <div className="mb-1 flex justify-between text-[11px]">
                <span className="font-medium text-gray-400">
                  {task.subtask_count} subtask{task.subtask_count > 1 ? 's' : ''}
                </span>
                <span className="tnum font-semibold text-gray-600">
                  {task.subtask_done} of {task.subtask_count} done
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${(100 * task.subtask_done) / task.subtask_count}%` }}
                />
              </div>
            </div>
          )}
        </Link>

        {(onOpenComments || renderAction) && (
          <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
            {onOpenComments ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="relative h-8 px-2 text-muted-foreground hover:text-foreground"
                onClick={() => onOpenComments(task)}
              >
                <MessageSquare className="size-4" />
                <span className="ml-1.5">Comments</span>
                {task.comment_count > 0 && (
                  <span className="ml-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {task.comment_count > 9 ? '9+' : task.comment_count}
                  </span>
                )}
              </Button>
            ) : (
              <span />
            )}
            {renderAction?.(task)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
