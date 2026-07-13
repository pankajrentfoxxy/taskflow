import bcrypt from 'bcryptjs';
import { getDb, now } from '@/lib/db';
import { getSessionUser, unauthorized, forbidden, badRequest } from '@/lib/auth';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const db = getDb();
  const users = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.team_id, u.is_active, tm.name AS team_name
    FROM users u LEFT JOIN teams tm ON tm.id = u.team_id
    ORDER BY u.name
  `).all();
  return Response.json({ users });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== 'ADMIN') return forbidden('Only Admin can create users');
  const { name, email, password, role = 'MEMBER', teamId = null } = await req.json().catch(() => ({}));
  if (!name || !email || !password) return badRequest('name, email, password required');
  if (!['ADMIN', 'CEO', 'MANAGER', 'MEMBER'].includes(role)) return badRequest('Invalid role');
  const db = getDb();
  try {
    const id = db.prepare('INSERT INTO users (name, email, password_hash, role, team_id, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(name, String(email).toLowerCase().trim(), bcrypt.hashSync(password, 10), role, teamId, now()).lastInsertRowid;
    if (role === 'MANAGER' && teamId) db.prepare('UPDATE teams SET manager_id = ? WHERE id = ?').run(id, teamId);
    return Response.json({ id });
  } catch (e: any) {
    return badRequest(e.message?.includes('UNIQUE') ? 'Email already exists' : 'Could not create user');
  }
}

export async function PATCH(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== 'ADMIN') return forbidden('Only Admin can edit users');
  const { id, role, teamId, isActive, password } = await req.json().catch(() => ({}));
  if (!id) return badRequest('id required');
  const db = getDb();
  if (role !== undefined) db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
  if (teamId !== undefined) db.prepare('UPDATE users SET team_id = ? WHERE id = ?').run(teamId, id);
  if (isActive !== undefined) db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(isActive ? 1 : 0, id);
  if (password) db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(password, 10), id);
  return Response.json({ ok: true });
}
