import { getDb, now } from '@/lib/db';
import { getSessionUser, unauthorized, forbidden, badRequest } from '@/lib/auth';
import { canSeeTask } from '@/lib/rbac';
import { notify, logActivity } from '@/lib/notify';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const db = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(Number(id)) as any;
  if (!task) return Response.json({ error: 'Not found' }, { status: 404 });
  if (!canSeeTask(user, task)) return forbidden();
  const { body } = await req.json().catch(() => ({}));
  if (!body?.trim()) return badRequest('Comment cannot be empty');
  const cid = db.prepare('INSERT INTO comments (task_id, author_id, body, created_at) VALUES (?, ?, ?, ?)')
    .run(task.id, user.id, body.trim(), now()).lastInsertRowid;
  logActivity(task.id, user.id, 'COMMENT', {});
  notify([task.assignee_id, task.creator_id], 'COMMENT', `Comment on "${task.title}"`, body.slice(0, 120), task.id, user.id);
  return Response.json({ id: cid });
}
