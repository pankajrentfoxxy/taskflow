import { getDb, now } from '@/lib/db';
import { getSessionUser, unauthorized, forbidden, badRequest } from '@/lib/auth';
import { canSeeTask } from '@/lib/rbac';
import { notify, logActivity } from '@/lib/notify';

function loadComments(taskId: number, userId: number) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT c.id, c.task_id, c.author_id, c.parent_comment_id, c.body AS content,
           c.edited, c.edited_at, c.created_at, c.updated_at,
           u.name AS author_name
    FROM comments c
    JOIN users u ON u.id = c.author_id
    WHERE c.task_id = ?
    ORDER BY c.created_at ASC, c.id ASC
  `).all(taskId) as any[];

  const reactionRows = db.prepare(`
    SELECT comment_id, emoji, COUNT(*) AS count,
           SUM(CASE WHEN user_id = ? THEN 1 ELSE 0 END) AS mine
    FROM comment_reactions
    WHERE comment_id IN (SELECT id FROM comments WHERE task_id = ?)
    GROUP BY comment_id, emoji
  `).all(userId, taskId) as any[];

  const reactionsByComment: Record<number, { emoji: string; count: number; mine: boolean }[]> = {};
  for (const r of reactionRows) {
    if (!reactionsByComment[r.comment_id]) reactionsByComment[r.comment_id] = [];
    reactionsByComment[r.comment_id].push({
      emoji: r.emoji,
      count: r.count,
      mine: r.mine > 0,
    });
  }

  return rows.map((c) => ({
    ...c,
    reactions: reactionsByComment[c.id] || [],
  }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const db = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(Number(id)) as any;
  if (!task) return Response.json({ error: 'Not found' }, { status: 404 });
  if (!canSeeTask(user, task)) return forbidden();

  const comments = loadComments(task.id, user.id);
  return Response.json({ comments });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const db = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(Number(id)) as any;
  if (!task) return Response.json({ error: 'Not found' }, { status: 404 });
  if (!canSeeTask(user, task)) return forbidden();

  const body = await req.json().catch(() => ({}));
  const content = String(body.content || body.body || '').trim();
  const parentCommentId = body.parentCommentId ? Number(body.parentCommentId) : null;

  if (!content) return badRequest('Comment cannot be empty');

  if (parentCommentId) {
    const parent = db.prepare('SELECT * FROM comments WHERE id = ? AND task_id = ?').get(parentCommentId, task.id) as any;
    if (!parent) return badRequest('Parent comment not found');
  }

  const t = now();
  const cid = db.prepare(`
    INSERT INTO comments (task_id, author_id, parent_comment_id, body, edited, created_at, updated_at)
    VALUES (?, ?, ?, ?, 0, ?, ?)
  `).run(task.id, user.id, parentCommentId, content, t, t).lastInsertRowid;

  logActivity(task.id, user.id, 'COMMENT', { commentId: cid, parentCommentId });
  notify([task.assignee_id, task.creator_id], 'COMMENT', `Comment on "${task.title}"`, content.slice(0, 120), task.id, user.id);

  const comment = loadComments(task.id, user.id).find((c) => c.id === Number(cid));
  return Response.json({ comment });
}
