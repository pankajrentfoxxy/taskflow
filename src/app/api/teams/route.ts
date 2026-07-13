import { getDb } from '@/lib/db';
import { getSessionUser, unauthorized, forbidden, badRequest } from '@/lib/auth';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const db = getDb();
  const teams = db.prepare(`
    SELECT tm.id, tm.name, tm.manager_id, u.name AS manager_name,
      (SELECT COUNT(*) FROM users WHERE team_id = tm.id AND is_active = 1) AS member_count
    FROM teams tm LEFT JOIN users u ON u.id = tm.manager_id ORDER BY tm.name
  `).all();
  return Response.json({ teams });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== 'ADMIN') return forbidden('Only Admin can create teams');
  const { name, managerId = null } = await req.json().catch(() => ({}));
  if (!name) return badRequest('name required');
  const db = getDb();
  const id = db.prepare('INSERT INTO teams (name, manager_id) VALUES (?, ?)').run(name, managerId).lastInsertRowid;
  if (managerId) db.prepare("UPDATE users SET team_id = ?, role = CASE WHEN role = 'MEMBER' THEN 'MANAGER' ELSE role END WHERE id = ?").run(id, managerId);
  return Response.json({ id });
}
