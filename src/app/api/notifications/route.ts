import { getDb, now } from '@/lib/db';
import { getSessionUser, unauthorized } from '@/lib/auth';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const db = getDb();
  const notifications = db.prepare(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 50'
  ).all(user.id);
  const unread = (db.prepare('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read_at IS NULL').get(user.id) as any).c;
  return Response.json({ notifications, unread });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { ids, all } = await req.json().catch(() => ({}));
  const db = getDb();
  const t = now();
  if (all) {
    db.prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL').run(t, user.id);
  } else if (Array.isArray(ids)) {
    const stmt = db.prepare('UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ?');
    for (const id of ids) stmt.run(t, id, user.id);
  }
  return Response.json({ ok: true });
}
