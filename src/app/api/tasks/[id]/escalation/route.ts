import { getDb, now } from '@/lib/db';
import { getSessionUser, unauthorized, forbidden, badRequest } from '@/lib/auth';
import { canSeeTask, canReviewEscalation } from '@/lib/rbac';
import { notify, managerOf, ceoIds, logActivity } from '@/lib/notify';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const db = getDb();
  const t = now();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(Number(id)) as any;
  if (!task) return Response.json({ error: 'Not found' }, { status: 404 });
  if (!canSeeTask(user, task)) return forbidden();
  const esc = db.prepare('SELECT * FROM escalations WHERE task_id = ? ORDER BY id DESC LIMIT 1').get(task.id) as any;
  if (!esc) return badRequest('Task is not escalated');

  const body = await req.json().catch(() => ({}));

  // Assignee submits mandatory explanation
  if (body.explanation !== undefined) {
    if (task.assignee_id !== user.id) return forbidden('Only the assignee submits the explanation');
    if (esc.explanation) return badRequest('Explanation already submitted');
    const text = String(body.explanation || '').trim();
    if (text.length < 20) return badRequest('Explanation must be at least 20 characters');
    if (!body.proposedEtaAt) return badRequest('Propose a new ETA along with your explanation');
    db.prepare("UPDATE escalations SET explanation = ?, explanation_at = ?, proposed_eta_at = ?, review_status = 'PENDING' WHERE id = ?")
      .run(text, t, body.proposedEtaAt, esc.id);
    logActivity(task.id, user.id, 'EXPLANATION', { proposedEtaAt: body.proposedEtaAt });
    notify(
      [task.creator_id, managerOf(task.assignee_id), ...ceoIds()],
      'EXPLANATION',
      `Explanation submitted for "${task.title}"`,
      text.slice(0, 140),
      task.id,
      user.id
    );
    return Response.json({ ok: true });
  }

  // Manager/CEO/Admin review
  if (body.review) {
    if (!canReviewEscalation(user, task)) return forbidden('Only manager/CEO/Admin can review');
    if (!esc.explanation || esc.review_status !== 'PENDING') return badRequest('No explanation pending review');
    if (!['ACCEPTED', 'REJECTED'].includes(body.review)) return badRequest('review must be ACCEPTED or REJECTED');
    db.prepare('UPDATE escalations SET review_status = ?, reviewer_id = ?, reviewed_at = ? WHERE id = ?')
      .run(body.review, user.id, t, esc.id);
    logActivity(task.id, user.id, 'REVIEW', { result: body.review });
    if (body.review === 'ACCEPTED') {
      const newDue = body.newDueAt || esc.proposed_eta_at;
      db.prepare("UPDATE tasks SET status = 'IN_PROGRESS', due_at = ?, eta_at = ?, due_soon_sent = 0, updated_at = ? WHERE id = ?")
        .run(newDue, esc.proposed_eta_at, t, task.id);
      notify([task.assignee_id], 'REVIEW', `Explanation accepted for "${task.title}"`, 'Task re-planned with the new ETA.', task.id, user.id);
    } else {
      notify([task.assignee_id], 'REVIEW', `Explanation rejected for "${task.title}"`, 'This task is flagged for review.', task.id, user.id);
    }
    return Response.json({ ok: true });
  }

  return badRequest('Nothing to do');
}
