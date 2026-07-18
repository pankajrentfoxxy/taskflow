'use client';
import Link from 'next/link';
import { fmtDateTime, countdown, STATUS_LABEL, STATUS_COLOR } from '@/lib/util';
import { IconClock, IconFlag, IconTag } from './Icons';

const initials = (n?: string) => (n || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export default function TaskCard({ task }: { task: any }) {
  const overdue = task.due_at < Date.now() && !['DONE', 'CANCELLED'].includes(task.status);
  const slaRunning = task.status === 'ASSIGNED' && !task.sla_breached_at && task.sla_deadline_at;
  const who = task.assignee_name || (task.team_name ? `Team ${task.team_name}` : 'Unassigned');
  return (
    <Link href={`/tasks/${task.id}`}
      className="card group block p-4 transition-all hover:border-gray-300 hover:shadow-[0_4px_12px_rgba(16,24,40,0.07)] hover:-translate-y-px">
      {/* badges */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`pill ${STATUS_COLOR[task.status] || 'bg-gray-100'}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
          {STATUS_LABEL[task.status] || task.status}
        </span>
        {task.sla_breached_at && task.status === 'ASSIGNED' && (
          <span className="pill bg-red-600 text-white">No response</span>
        )}
        {slaRunning && (
          <span className="pill bg-amber-50 text-amber-700 border border-amber-200">
            <IconClock className="w-3 h-3" /> {countdown(task.sla_deadline_at)}
          </span>
        )}
        {task.blocked_reason && <span className="pill bg-purple-50 text-purple-700 border border-purple-200">Blocked</span>}
        {task.type_name && (
          <span className="pill bg-gray-50 text-gray-500 border border-gray-200">
            <IconTag className="w-3 h-3" /> {task.type_name}
          </span>
        )}
        {['URGENT', 'HIGH'].includes(task.priority) && (
          <span className={`pill ${task.priority === 'URGENT' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-orange-50 text-orange-600 border border-orange-200'}`}>
            <IconFlag className="w-3 h-3" /> {task.priority.toLowerCase()}
          </span>
        )}
      </div>

      {/* title */}
      <div className="font-semibold text-[14.5px] leading-snug mt-2 text-gray-900 group-hover:text-brand-700 transition-colors truncate">
        {task.title}
      </div>

      {/* meta */}
      <div className="flex items-center justify-between gap-3 mt-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-100 to-violet-100 text-brand-700 text-[9px] font-bold flex items-center justify-center shrink-0">
            {initials(task.assignee_name || task.team_name)}
          </span>
          <span className="text-xs text-gray-500 truncate">
            {who}
            <span className="text-gray-300 mx-1">·</span>
            <span className="text-gray-400">by {String(task.creator_name || '').split(' (')[0]}</span>
            {task.project_name && <><span className="text-gray-300 mx-1">·</span><span className="text-brand-600 font-medium">{task.project_name}</span></>}
          </span>
        </div>
        <span className={`flex items-center gap-1 text-[11px] shrink-0 tnum ${overdue ? 'text-red-600 font-bold' : 'text-gray-400'}`}>
          <IconClock className="w-3.5 h-3.5" />
          {overdue ? 'Overdue · ' : ''}{fmtDateTime(task.due_at)}
        </span>
      </div>

      {/* delivery target */}
      {task.target_count != null && (
        <div className="mt-3">
          <div className="flex justify-between text-[11px] mb-1">
            <span className="text-gray-400 font-medium">Delivery</span>
            <span className={`font-semibold tnum ${task.delivered_count >= task.target_count ? 'text-emerald-600' : 'text-gray-600'}`}>
              {task.delivered_count}/{task.target_count} {task.type_alias}
            </span>
          </div>
          <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${task.delivered_count >= task.target_count ? 'bg-emerald-500' : 'bg-brand-500'}`}
              style={{ width: `${Math.min(100, (100 * task.delivered_count) / task.target_count)}%` }} />
          </div>
        </div>
      )}

      {/* subtasks */}
      {task.subtask_count > 0 && (
        <div className="mt-3">
          <div className="flex justify-between text-[11px] mb-1">
            <span className="text-gray-400 font-medium">{task.subtask_count} subtask{task.subtask_count > 1 ? 's' : ''}</span>
            <span className="font-semibold text-gray-600 tnum">{task.subtask_done} of {task.subtask_count} done</span>
          </div>
          <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(100 * task.subtask_done) / task.subtask_count}%` }} />
          </div>
        </div>
      )}
    </Link>
  );
}
