'use client';
import Link from 'next/link';
import { fmtDateTime, countdown, STATUS_LABEL, STATUS_COLOR, PRIORITY_COLOR } from '@/lib/util';

export default function TaskCard({ task }: { task: any }) {
  const overdue = task.due_at < Date.now() && !['DONE', 'CANCELLED'].includes(task.status);
  const slaRunning = task.status === 'ASSIGNED' && !task.sla_breached_at && task.sla_deadline_at;
  return (
    <Link href={`/tasks/${task.id}`} className="card block p-4 hover:border-brand-500 transition">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`pill ${STATUS_COLOR[task.status] || 'bg-gray-100'}`}>{STATUS_LABEL[task.status] || task.status}</span>
            {task.sla_breached_at && task.status === 'ASSIGNED' && <span className="pill bg-red-600 text-white">NO RESPONSE</span>}
            {slaRunning && <span className="pill bg-amber-500 text-white">⏱ {countdown(task.sla_deadline_at)}</span>}
            {task.blocked_reason && <span className="pill bg-purple-100 text-purple-700">Blocked</span>}
            {task.type_name && <span className="pill bg-gray-100 text-gray-600">{task.type_name}</span>}
            {task.priority !== 'NORMAL' && (
              <span className={`text-[11px] font-bold ${PRIORITY_COLOR[task.priority]}`}>{task.priority}</span>
            )}
          </div>
          <div className="font-semibold text-[15px] leading-snug truncate">{task.title}</div>
          <div className="text-xs text-gray-500 mt-1">
            {task.assignee_name || (task.team_name ? `Team: ${task.team_name}` : 'Unassigned')}
            {' · by '}{task.creator_name}
            {task.project_name && <> · <span className="text-brand-600">{task.project_name}</span></>}
          </div>
        </div>
        <div className={`text-right text-xs shrink-0 ${overdue ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
          <div>{overdue ? 'OVERDUE' : 'Due'}</div>
          <div>{fmtDateTime(task.due_at)}</div>
        </div>
      </div>
      {task.target_count != null && (
        <div className="mt-2.5">
          <div className="flex justify-between text-[11px] text-gray-500 mb-1">
            <span>Delivery</span>
            <span className={`font-semibold ${task.delivered_count >= task.target_count ? 'text-emerald-600' : ''}`}>
              {task.delivered_count}/{task.target_count} {task.type_alias}{task.delivered_count >= task.target_count ? ' \u2713' : ''}
            </span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${task.delivered_count >= task.target_count ? 'bg-emerald-500' : 'bg-brand-500'}`}
              style={{ width: `${Math.min(100, (100 * task.delivered_count) / task.target_count)}%` }} />
          </div>
        </div>
      )}
      {task.subtask_count > 0 && (
        <div className="mt-2.5">
          <div className="flex justify-between text-[11px] text-gray-500 mb-1">
            <span>{task.subtask_count} subtask{task.subtask_count > 1 ? 's' : ''}</span>
            <span className="font-semibold">{task.subtask_done} of {task.subtask_count} done</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(100 * task.subtask_done) / task.subtask_count}%` }} />
          </div>
        </div>
      )}
    </Link>
  );
}
