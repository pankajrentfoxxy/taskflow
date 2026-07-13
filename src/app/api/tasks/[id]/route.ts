import { getDb, now } from '@/lib/db';
import { getSessionUser, unauthorized, forbidden, badRequest } from '@/lib/auth';
import { canSeeTask, canEditEta, canReviewEscalation, isManagerOf } from '@/lib/rbac';
import { notify, managerOf, ceoIds, logActivity } from '@/lib/notify';

function loadTask(id: number) {
  const db = getDb();
  return db.prepare(`
    SELECT t.*, ua.name AS assignee_name, uc.name AS creator_name, tm.name AS team_name, p.name AS project_name
    FROM tasks t
    LEFT JOIN users ua ON ua.id = t.assignee_id
    LEFT JOIN users uc ON uc.id = t.creator_id
    LEFT JOIN teams tm ON tm.id = t.assigned_team_id
    LEFT JOIN projects p ON p.id = t.project_id
    WHERE t.id = ?
  `).get(id) as any;
}

function explanationPending(task: any): boolean {
  if (task.status !== 'ESCALATED') return false;
  const db = getDb();
  const esc = db.prepare('SELECT * FROM escalations WHERE task_id = ? ORDER BY id DESC LIMIT 1').get(task.id) as any;
  return esc && !esc.explanation;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const task = loadTask(Number(id));
  if (!task) return Response.json({ error: 'Not found' }, { status: 404 });
  if (!canSeeTask(user, task)) return forbidden();

  const db = getDb();
  const subtasks = db.prepare(`
    SELECT t.*, ua.name AS assignee_name FROM tasks t
    LEFT JOIN users ua ON ua.id = t.assignee_id
    WHERE t.parent_id = ? ORDER BY t.id
  `).all(task.id);
  const comments = db.prepare(`
    SELECT c.*, u.name AS author_name FROM comments c JOIN users u ON u.id = c.author_id
    WHERE c.task_id = ? ORDER BY c.id
  `).all(task.id);
  const activity = db.prepare(`
    SELECT a.*, u.name AS actor_name FROM activity a LEFT JOIN users u ON u.id = a.actor_id
    WHERE a.task_id = ? ORDER BY a.id DESC LIMIT 100
  `).all(task.id);
  const attachments = db.prepare(
    'SELECT id, file_name, mime_type, size, uploader_id, created_at FROM attachments WHERE task_id = ?'
  ).all(task.id);
  const escalation = db.prepare('SELECT * FROM escalations WHERE task_id = ? ORDER BY id DESC LIMIT 1').get(task.id) as any;
  const batchTasks = task.batch_id
    ? db.prepare('SELECT id, title, status FROM tasks WHERE batch_id = ? AND id != ?').all(task.batch_id, task.id)
    : [];

  const isAssignee = task.assignee_id === user.id;
  const isCreator = task.creator_id === user.id;
  const isBoss = ['ADMIN', 'CEO'].includes(user.role);
  const isMgr = isManagerOf(user, task.assignee_id);
  const expPending = explanationPending(task);
  const openSubs = (subtasks as any[]).filter((s) => !['DONE', 'CANCELLED'].includes(s.status)).length;

  const permissions = {
    isAssignee,
    canAcknowledge: task.status === 'ASSIGNED' && (isAssignee || (task.assigned_team_id && task.assigned_team_id === user.team_id)),
    canStart: task.status === 'ACKNOWLEDGED' && isAssignee && !expPending,
    canDone: ['ACKNOWLEDGED', 'IN_PROGRESS', 'ESCALATED'].includes(task.status) && (isAssignee || isBoss || isCreator) && !expPending,
    canEditEta: canEditEta(user, task) && !['DONE', 'CANCELLED'].includes(task.status) && !expPending,
    canReopen: task.status === 'DONE' && (isCreator || isBoss || isMgr) && now() - (task.done_at || 0) < 7 * 24 * 3600 * 1000,
    canCancel: !['DONE', 'CANCELLED'].includes(task.status) && (isCreator || isBoss),
    canBlock: ['ACKNOWLEDGED', 'IN_PROGRESS'].includes(task.status) && isAssignee,
    mustExplain: expPending && isAssignee,
    canReview: task.status === 'ESCALATED' && escalation?.explanation && escalation?.review_status === 'PENDING' && canReviewEscalation(user, task),
    canAddSubtask: !['DONE', 'CANCELLED'].includes(task.status) && !task.parent_id,
    openSubtasks: openSubs,
  };

  return Response.json({ task, subtasks, comments, activity, attachments, escalation, batchTasks, permissions });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const task = loadTask(Number(id));
  if (!task) return Response.json({ error: 'Not found' }, { status: 404 });
  if (!canSeeTask(user, task)) return forbidden();

  const db = getDb();
  const t = now();
  const body = await req.json().catch(() => ({}));
  const action = body.action as string;

  const isAssignee = task.assignee_id === user.id;
  const isCreator = task.creator_id === user.id;
  const isBoss = ['ADMIN', 'CEO'].includes(user.role);

  // Escalation gate: assignee cannot act until explanation submitted
  if (explanationPending(task) && isAssignee && action !== 'noop') {
    return Response.json(
      { error: 'This task is escalated. You must submit an explanation before any other action.', code: 'EXPLANATION_REQUIRED' },
      { status: 423 }
    );
  }

  const touch = () => db.prepare('UPDATE tasks SET updated_at = ? WHERE id = ?').run(t, task.id);

  switch (action) {
    case 'acknowledge': {
      if (task.status !== 'ASSIGNED') return badRequest('Task is not awaiting acknowledgment');
      const claimable = task.assigned_team_id && task.assigned_team_id === user.team_id;
      if (!isAssignee && !claimable && !isBoss) return forbidden('Only the assignee can acknowledge');
      if (!body.etaAt) return badRequest('ETA is mandatory when acknowledging');
      db.prepare(`UPDATE tasks SET status = 'ACKNOWLEDGED', acknowledged_at = ?, eta_at = ?, assignee_id = COALESCE(assignee_id, ?), assigned_team_id = CASE WHEN assignee_id IS NULL THEN NULL ELSE assigned_team_id END, updated_at = ? WHERE id = ?`)
        .run(t, body.etaAt, user.id, t, task.id);
      logActivity(task.id, user.id, 'ACKNOWLEDGED', { etaAt: body.etaAt });
      notify([task.creator_id], 'ACKNOWLEDGED', `${user.name} acknowledged "${task.title}"`, `ETA set.`, task.id, user.id);
      break;
    }
    case 'start': {
      if (task.status !== 'ACKNOWLEDGED') return badRequest('Acknowledge first');
      if (!isAssignee && !isBoss) return forbidden();
      db.prepare("UPDATE tasks SET status = 'IN_PROGRESS', started_at = ?, updated_at = ? WHERE id = ?").run(t, t, task.id);
      logActivity(task.id, user.id, 'STARTED', {});
      break;
    }
    case 'done': {
      if (['DONE', 'CANCELLED'].includes(task.status)) return badRequest('Task already closed');
      if (!isAssignee && !isCreator && !isBoss && !isManagerOf(user, task.assignee_id)) return forbidden();
      const openSubs = (db.prepare("SELECT COUNT(*) AS c FROM tasks WHERE parent_id = ? AND status NOT IN ('DONE','CANCELLED')").get(task.id) as any).c;
      if (openSubs > 0) {
        const mayOverride = (isCreator || isBoss) && body.overrideReason;
        if (!mayOverride) {
          return Response.json(
            { error: `${openSubs} subtask(s) still open. Complete them first (creator/Admin may override with a reason).`, code: 'OPEN_SUBTASKS' },
            { status: 409 }
          );
        }
        logActivity(task.id, user.id, 'DONE_OVERRIDE', { reason: body.overrideReason, openSubs });
      }
      db.prepare("UPDATE tasks SET status = 'DONE', done_at = ?, blocked_reason = NULL, updated_at = ? WHERE id = ?").run(t, t, task.id);
      logActivity(task.id, user.id, 'DONE', {});
      notify([task.creator_id, managerOf(task.assignee_id)], 'DONE', `Done: "${task.title}"`, `Marked done by ${user.name}.`, task.id, user.id);
      if (task.parent_id) {
        const parent = db.prepare('SELECT * FROM tasks WHERE id = ?').get(task.parent_id) as any;
        const counts = db.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN status='DONE' THEN 1 ELSE 0 END) AS done FROM tasks WHERE parent_id = ?").get(task.parent_id) as any;
        notify([parent.assignee_id, parent.creator_id], 'SUBTASK_DONE',
          `Subtask done on "${parent.title}" (${counts.done}/${counts.total})`, task.title, parent.id, user.id);
        logActivity(parent.id, user.id, 'SUBTASK_DONE', { subtaskId: task.id, done: counts.done, total: counts.total });
      }
      break;
    }
    case 'update_eta': {
      if (!canEditEta(user, task)) return forbidden('You cannot edit the ETA of this task');
      if (!body.etaAt) return badRequest('etaAt required');
      db.prepare('UPDATE tasks SET eta_at = ?, updated_at = ? WHERE id = ?').run(body.etaAt, t, task.id);
      logActivity(task.id, user.id, 'ETA_CHANGED', { from: task.eta_at, to: body.etaAt });
      notify([task.assignee_id, task.creator_id], 'ETA_CHANGED', `ETA updated on "${task.title}"`, `Changed by ${user.name}.`, task.id, user.id);
      break;
    }
    case 'update_due': {
      if (!isCreator && !isBoss && !isManagerOf(user, task.assignee_id)) return forbidden('Only creator/manager/CEO/Admin can change the due date');
      if (!body.dueAt) return badRequest('dueAt required');
      db.prepare('UPDATE tasks SET due_at = ?, due_soon_sent = 0, updated_at = ? WHERE id = ?').run(body.dueAt, t, task.id);
      logActivity(task.id, user.id, 'DUE_CHANGED', { from: task.due_at, to: body.dueAt });
      notify([task.assignee_id], 'DUE_CHANGED', `Due date updated on "${task.title}"`, '', task.id, user.id);
      break;
    }
    case 'reopen': {
      if (task.status !== 'DONE') return badRequest('Only done tasks can be reopened');
      if (!isCreator && !isBoss && !isManagerOf(user, task.assignee_id)) return forbidden();
      if (!body.reason) return badRequest('A reason is required to reopen');
      db.prepare("UPDATE tasks SET status = 'IN_PROGRESS', done_at = NULL, reopen_count = reopen_count + 1, updated_at = ? WHERE id = ?").run(t, task.id);
      logActivity(task.id, user.id, 'REOPENED', { reason: body.reason });
      notify([task.assignee_id], 'REOPENED', `Reopened: "${task.title}"`, body.reason, task.id, user.id);
      break;
    }
    case 'cancel': {
      if (!isCreator && user.role !== 'ADMIN') return forbidden('Only the creator or Admin can cancel');
      if (!body.reason) return badRequest('A reason is required to cancel');
      db.prepare("UPDATE tasks SET status = 'CANCELLED', cancelled_at = ?, cancel_reason = ?, updated_at = ? WHERE id = ?").run(t, body.reason, t, task.id);
      logActivity(task.id, user.id, 'CANCELLED', { reason: body.reason });
      notify([task.assignee_id], 'CANCELLED', `Cancelled: "${task.title}"`, body.reason, task.id, user.id);
      break;
    }
    case 'block': {
      if (!isAssignee) return forbidden();
      if (!body.reason) return badRequest('Describe what is blocking you');
      db.prepare('UPDATE tasks SET blocked_reason = ?, updated_at = ? WHERE id = ?').run(body.reason, t, task.id);
      logActivity(task.id, user.id, 'BLOCKED', { reason: body.reason });
      notify([task.creator_id, managerOf(task.assignee_id)], 'BLOCKED', `Blocked: "${task.title}"`, body.reason, task.id, user.id);
      break;
    }
    case 'unblock': {
      if (!isAssignee && !isBoss) return forbidden();
      db.prepare('UPDATE tasks SET blocked_reason = NULL, updated_at = ? WHERE id = ?').run(t, task.id);
      logActivity(task.id, user.id, 'UNBLOCKED', {});
      break;
    }
    default:
      return badRequest('Unknown action');
  }

  return Response.json({ ok: true, task: loadTask(task.id) });
}
