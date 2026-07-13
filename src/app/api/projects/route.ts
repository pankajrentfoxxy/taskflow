import { getDb, now } from '@/lib/db';
import { getSessionUser, unauthorized, badRequest } from '@/lib/auth';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const db = getDb();
  const isBoss = ['ADMIN', 'CEO'].includes(user.role);
  const where = isBoss
    ? '1=1'
    : '(p.owner_id = ? OR p.id IN (SELECT project_id FROM project_members WHERE user_id = ?))';
  const params = isBoss ? [] : [user.id, user.id];
  const projects = db.prepare(`
    SELECT p.*, u.name AS owner_name,
      (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) AS member_count,
      (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status NOT IN ('DONE','CANCELLED')) AS open_tasks
    FROM projects p JOIN users u ON u.id = p.owner_id
    WHERE ${where} ORDER BY p.created_at DESC
  `).all(...params);
  return Response.json({ projects });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { name, description = '' } = await req.json().catch(() => ({}));
  if (!name?.trim()) return badRequest('Project name required');
  const db = getDb();
  const t = now();
  const id = Number(
    db.prepare('INSERT INTO projects (name, description, owner_id, created_at) VALUES (?, ?, ?, ?)')
      .run(name.trim(), description, user.id, t).lastInsertRowid
  );
  db.prepare('INSERT INTO project_members (project_id, user_id) VALUES (?, ?)').run(id, user.id);
  return Response.json({ id });
}
