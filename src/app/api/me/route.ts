import { getDb } from '@/lib/db';
import { getSessionUser, unauthorized } from '@/lib/auth';
import { runSlaSweep } from '@/lib/cron';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  runSlaSweep();
  const db = getDb();
  const unread = (db.prepare('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read_at IS NULL').get(user.id) as any).c;
  const team = user.team_id ? (db.prepare('SELECT name FROM teams WHERE id = ?').get(user.team_id) as any)?.name : null;
  return Response.json({ user: { ...user, team }, unread });
}
