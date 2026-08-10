import { getDb, now } from '@/lib/db';
import { getSessionUser, unauthorized, forbidden, badRequest } from '@/lib/auth';
import { canSeeTask } from '@/lib/rbac';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id, commentId } = await params;
  const taskId = Number(id);
  const cid = Number(commentId);

  const db = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any;
  if (!task) return Response.json({ error: 'Not found' }, { status: 404 });
  if (!canSeeTask(user, task)) return forbidden();

  const comment = db.prepare('SELECT * FROM comments WHERE id = ? AND task_id = ?').get(cid, taskId) as any;
  if (!comment) return badRequest('Comment not found');

  const { emoji } = await req.json().catch(() => ({}));
  if (!emoji || typeof emoji !== 'string' || emoji.length > 32) return badRequest('Invalid emoji');

  const existing = db.prepare(
    'SELECT id FROM comment_reactions WHERE comment_id = ? AND user_id = ? AND emoji = ?'
  ).get(cid, user.id, emoji) as any;

  if (existing) {
    db.prepare('DELETE FROM comment_reactions WHERE id = ?').run(existing.id);
    return Response.json({ toggled: 'removed', emoji });
  }

  db.prepare(
    'INSERT INTO comment_reactions (comment_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?)'
  ).run(cid, user.id, emoji, now());

  return Response.json({ toggled: 'added', emoji });
}
