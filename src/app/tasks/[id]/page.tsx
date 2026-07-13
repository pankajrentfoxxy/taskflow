'use client';
import { useEffect, useState, useCallback, use } from 'react';
import Link from 'next/link';
import Shell from '@/components/Shell';
import Modal from '@/components/Modal';
import Composer from '@/components/Composer';
import AckModal from '@/components/AckModal';
import { api, fmtDateTime, timeAgo, countdown, toLocalInput, fromLocalInput, STATUS_LABEL, STATUS_COLOR, PRIORITY_COLOR } from '@/lib/util';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start gap-3 py-2 border-b border-gray-50 last:border-0">
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-0.5">{label}</span>
      <span className="text-sm text-right">{children}</span>
    </div>
  );
}

function TaskDetailInner({ id }: { id: string }) {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState('');
  const [ackOpen, setAckOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [etaOpen, setEtaOpen] = useState(false);
  const [reasonModal, setReasonModal] = useState<{ action: string; title: string } | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [etaVal, setEtaVal] = useState('');
  const [explanation, setExplanation] = useState('');
  const [propEta, setPropEta] = useState('');
  const [comment, setComment] = useState('');
  const [showActivity, setShowActivity] = useState(false);
  const [showEtaHistory, setShowEtaHistory] = useState(false);

  const load = useCallback(() => {
    api(`/api/tasks/${id}`).then(setData).catch((e) => setErr(e.message));
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (err) return <div className="card p-8 text-center text-red-600">{err}</div>;
  if (!data) return <div className="card h-60 animate-pulse" />;

  const { task, subtasks, comments, activity, attachments, escalation, batchTasks, permissions: perm } = data;

  const act = async (body: any) => {
    setErr('');
    try {
      await api(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      load();
    } catch (e: any) {
      if (e.code === 'OPEN_SUBTASKS') {
        const reason = prompt(`${e.message}\n\nCreator/Admin override — enter a reason:`);
        if (reason) act({ ...body, overrideReason: reason });
      } else setErr(e.message);
    }
  };

  const submitReason = () => {
    if (!reasonModal) return;
    act({ action: reasonModal.action, reason: reasonText });
    setReasonModal(null); setReasonText('');
  };

  const submitExplanation = async () => {
    setErr('');
    try {
      await api(`/api/tasks/${id}/escalation`, {
        method: 'POST',
        body: JSON.stringify({ explanation, proposedEtaAt: fromLocalInput(propEta) }),
      });
      setExplanation(''); setPropEta(''); load();
    } catch (e: any) { setErr(e.message); }
  };

  const review = async (result: string) => {
    setErr('');
    try {
      await api(`/api/tasks/${id}/escalation`, { method: 'POST', body: JSON.stringify({ review: result }) });
      load();
    } catch (e: any) { setErr(e.message); }
  };

  const postComment = async () => {
    if (!comment.trim()) return;
    await api(`/api/tasks/${id}/comments`, { method: 'POST', body: JSON.stringify({ body: comment }) });
    setComment(''); load();
  };

  const submitEta = () => {
    const v = fromLocalInput(etaVal);
    if (v) { act({ action: 'update_eta', etaAt: v }); setEtaOpen(false); }
  };

  const etaHistory = activity.filter((a: any) => a.type === 'ETA_CHANGED');
  const overdue = task.due_at < Date.now() && !['DONE', 'CANCELLED'].includes(task.status);

  return (
    <div className="space-y-4">
      <Link href="/tasks" className="text-sm text-gray-400 hover:text-brand-600">← Back to tasks</Link>

      {/* Header card */}
      <div className="card p-4">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className={`pill ${STATUS_COLOR[task.status]}`}>{STATUS_LABEL[task.status]}</span>
          {task.sla_breached_at && task.status === 'ASSIGNED' && <span className="pill bg-red-600 text-white">NO RESPONSE</span>}
          {task.status === 'ASSIGNED' && !task.sla_breached_at && task.sla_deadline_at && (
            <span className="pill bg-amber-500 text-white">⏱ Respond: {countdown(task.sla_deadline_at)}</span>
          )}
          {task.blocked_reason && <span className="pill bg-purple-100 text-purple-700">Blocked</span>}
          <span className={`text-xs font-bold ${PRIORITY_COLOR[task.priority]}`}>{task.priority}</span>
          {task.reopen_count > 0 && <span className="pill bg-gray-100 text-gray-500">Reopened ×{task.reopen_count}</span>}
        </div>
        <h1 className="text-lg font-bold leading-snug">{task.title}</h1>
        {task.description && <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{task.description}</p>}
        {task.blocked_reason && (
          <div className="mt-2 text-sm bg-purple-50 text-purple-800 rounded-lg px-3 py-2">🚧 Blocked: {task.blocked_reason}</div>
        )}

        <div className="mt-3">
          <Row label="Assignee">{task.assignee_name || (task.team_name ? `Team: ${task.team_name}` : '—')}</Row>
          <Row label="Created by">{task.creator_name} · {timeAgo(task.created_at)}</Row>
          <Row label="Due">
            <span className={overdue ? 'text-red-600 font-bold' : ''}>{fmtDateTime(task.due_at)}{overdue ? ' (overdue)' : ''}</span>
          </Row>
          <Row label="ETA">
            <span>
              {fmtDateTime(task.eta_at)}
              {etaHistory.length > 0 && (
                <button className="ml-2 text-xs text-brand-600 underline" onClick={() => setShowEtaHistory(!showEtaHistory)}>
                  history ({etaHistory.length})
                </button>
              )}
            </span>
          </Row>
          {showEtaHistory && etaHistory.map((h: any) => {
            const m = JSON.parse(h.meta || '{}');
            return (
              <div key={h.id} className="text-xs text-gray-500 py-1 pl-2 border-l-2 border-brand-100">
                {h.actor_name}: {fmtDateTime(m.from)} → <strong>{fmtDateTime(m.to)}</strong> · {timeAgo(h.created_at)}
              </div>
            );
          })}
          {task.acknowledged_at && <Row label="Acknowledged">{fmtDateTime(task.acknowledged_at)}</Row>}
          {task.done_at && <Row label="Done at">{fmtDateTime(task.done_at)}</Row>}
          {task.project_name && (
            <Row label="Project"><Link className="text-brand-600 underline" href={`/projects/${task.project_id}`}>{task.project_name}</Link></Row>
          )}
          {task.parent_id && <Row label="Parent task"><Link className="text-brand-600 underline" href={`/tasks/${task.parent_id}`}>#{task.parent_id}</Link></Row>}
        </div>

        {batchTasks.length > 0 && (
          <div className="mt-2 text-xs text-gray-500">
            📎 Part of a batch: {batchTasks.map((b: any) => (
              <Link key={b.id} href={`/tasks/${b.id}`} className="text-brand-600 underline mr-2">#{b.id} {b.title}</Link>
            ))}
          </div>
        )}
      </div>

      {/* Escalation banners */}
      {perm.mustExplain && (
        <div className="card p-4 border-red-300 bg-red-50">
          <h3 className="font-bold text-red-700 mb-1">🚨 Explanation required</h3>
          <p className="text-sm text-red-600 mb-3">
            This task passed its due date. You must submit a written explanation (min 20 characters) and propose a new ETA before doing anything else.
          </p>
          <textarea className="input min-h-[80px] mb-2" placeholder="Why was this task delayed?" value={explanation} onChange={(e) => setExplanation(e.target.value)} />
          <span className="label">Proposed new ETA</span>
          <input type="datetime-local" className="input mb-3" value={propEta} onChange={(e) => setPropEta(e.target.value)} />
          <button className="btn-danger w-full" onClick={submitExplanation}>Submit explanation</button>
        </div>
      )}
      {escalation?.explanation && task.status === 'ESCALATED' && (
        <div className="card p-4 border-amber-300 bg-amber-50">
          <h3 className="font-bold text-amber-800 mb-1">Escalation explanation</h3>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{escalation.explanation}</p>
          <p className="text-xs text-gray-500 mt-1">Proposed ETA: {fmtDateTime(escalation.proposed_eta_at)} · submitted {timeAgo(escalation.explanation_at)}</p>
          {perm.canReview && (
            <div className="flex gap-2 mt-3">
              <button className="btn-primary flex-1" onClick={() => review('ACCEPTED')}>Accept & re-plan</button>
              <button className="btn-danger flex-1" onClick={() => review('REJECTED')}>Reject</button>
            </div>
          )}
          {escalation.review_status && escalation.review_status !== 'PENDING' && (
            <div className="text-xs font-bold mt-2">{escalation.review_status}</div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        {perm.canAcknowledge && <button className="btn-primary" onClick={() => setAckOpen(true)}>✓ Acknowledge + ETA</button>}
        {perm.canStart && <button className="btn-primary" onClick={() => act({ action: 'start' })}>▶ Start</button>}
        {perm.canDone && <button className="btn-primary !bg-emerald-600 hover:!bg-emerald-700" onClick={() => act({ action: 'done' })}>✔ Mark done</button>}
        {perm.canEditEta && <button className="btn-secondary" onClick={() => { setEtaVal(toLocalInput(task.eta_at || Date.now())); setEtaOpen(true); }}>Edit ETA</button>}
        {perm.canBlock && !task.blocked_reason && <button className="btn-secondary" onClick={() => setReasonModal({ action: 'block', title: 'What is blocking you?' })}>🚧 Blocked</button>}
        {task.blocked_reason && perm.isAssignee && <button className="btn-secondary" onClick={() => act({ action: 'unblock' })}>Unblock</button>}
        {perm.canReopen && <button className="btn-secondary" onClick={() => setReasonModal({ action: 'reopen', title: 'Why reopen this task?' })}>↩ Reopen</button>}
        {perm.canCancel && <button className="btn-secondary !text-red-600" onClick={() => setReasonModal({ action: 'cancel', title: 'Why cancel this task?' })}>Cancel task</button>}
      </div>
      {err && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</div>}

      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="card p-4">
          <h3 className="font-bold text-sm mb-2">Attachments</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {attachments.map((a: any) => (
              <a key={a.id} href={`/api/uploads/${a.id}`} target="_blank" className="block border border-gray-200 rounded-lg overflow-hidden hover:border-brand-500">
                {a.mime_type.startsWith('image/') ? (
                  <img src={`/api/uploads/${a.id}`} alt={a.file_name} className="w-full h-28 object-cover" />
                ) : (
                  <div className="h-28 flex items-center justify-center text-3xl bg-gray-50">📄</div>
                )}
                <div className="px-2 py-1 text-[11px] truncate text-gray-500">{a.file_name}</div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Subtasks */}
      {!task.parent_id && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-sm">
              Subtasks{subtasks.length > 0 && (
                <span className="ml-2 text-emerald-600">{subtasks.filter((s: any) => s.status === 'DONE').length} of {subtasks.length} done</span>
              )}
            </h3>
            {perm.canAddSubtask && <button className="btn-secondary !py-1 !px-2.5 text-xs" onClick={() => setSubOpen(true)}>+ Add subtask</button>}
          </div>
          {subtasks.length > 0 && (
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-3">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(100 * subtasks.filter((s: any) => s.status === 'DONE').length) / subtasks.length}%` }} />
            </div>
          )}
          <div className="space-y-2">
            {subtasks.map((s: any) => (
              <div key={s.id} className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={s.status === 'DONE'}
                  disabled={s.status === 'DONE'}
                  onChange={() => api(`/api/tasks/${s.id}`, { method: 'PATCH', body: JSON.stringify({ action: 'done' }) }).then(load).catch((e) => setErr(e.message))}
                  className="w-5 h-5 rounded accent-emerald-600"
                />
                <div className="min-w-0 flex-1">
                  <Link href={`/tasks/${s.id}`} className={`text-sm block truncate ${s.status === 'DONE' ? 'line-through text-gray-400' : 'font-medium'}`}>{s.title}</Link>
                  <div className="text-[11px] text-gray-400">
                    {s.assignee_name || 'Unassigned'}
                    {s.done_at && <> · ✔ done {fmtDateTime(s.done_at)}</>}
                  </div>
                </div>
              </div>
            ))}
            {subtasks.length === 0 && <div className="text-xs text-gray-400">No subtasks. Break this task down if it contains several items.</div>}
          </div>
        </div>
      )}

      {/* Comments */}
      <div className="card p-4">
        <h3 className="font-bold text-sm mb-3">Comments ({comments.length})</h3>
        <div className="space-y-3 mb-3">
          {comments.map((c: any) => (
            <div key={c.id}>
              <div className="text-xs text-gray-400"><strong className="text-gray-600">{c.author_name}</strong> · {timeAgo(c.created_at)}</div>
              <div className="text-sm whitespace-pre-wrap">{c.body}</div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input className="input flex-1" placeholder="Write a comment…" value={comment} onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && postComment()} />
          <button className="btn-primary" onClick={postComment}>Send</button>
        </div>
      </div>

      {/* Activity */}
      <div className="card p-4">
        <button className="font-bold text-sm w-full text-left" onClick={() => setShowActivity(!showActivity)}>
          Activity log ({activity.length}) {showActivity ? '▾' : '▸'}
        </button>
        {showActivity && (
          <div className="mt-3 space-y-1.5">
            {activity.map((a: any) => (
              <div key={a.id} className="text-xs text-gray-500">
                <span className="font-semibold text-gray-600">{a.actor_name || 'System'}</span> · {a.type.toLowerCase().replace(/_/g, ' ')} · {timeAgo(a.created_at)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <AckModal task={task} open={ackOpen} onClose={() => setAckOpen(false)} onDone={load} />
      <Composer open={subOpen} onClose={() => setSubOpen(false)} onCreated={load} presetParentId={task.id} />
      <Modal open={etaOpen} onClose={() => setEtaOpen(false)} title="Update ETA">
        <input type="datetime-local" className="input mb-3" value={etaVal} onChange={(e) => setEtaVal(e.target.value)} />
        <button className="btn-primary w-full" onClick={submitEta}>Save ETA</button>
      </Modal>
      <Modal open={!!reasonModal} onClose={() => setReasonModal(null)} title={reasonModal?.title || ''}>
        <textarea className="input min-h-[80px] mb-3" value={reasonText} onChange={(e) => setReasonText(e.target.value)} />
        <button className="btn-primary w-full" onClick={submitReason} disabled={!reasonText.trim()}>Submit</button>
      </Modal>
    </div>
  );
}

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <Shell><TaskDetailInner id={id} /></Shell>;
}
