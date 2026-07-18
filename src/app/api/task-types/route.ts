import { getDb, now } from '@/lib/db';
import { getSessionUser, unauthorized, forbidden, badRequest } from '@/lib/auth';

function canManageTeamTypes(user: any, teamId: number): boolean {
  if (user.role === 'ADMIN' || user.role === 'CEO') return true;
  return user.role === 'MANAGER' && user.team_id === teamId;
}

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const db = getDb();
  const url = new URL(req.url);
  const manage = url.searchParams.get('manage') === '1';

  if (manage) {
    // Full catalogue for management screens (includes inactive)
    let where = '1=1';
    const params: any[] = [];
    if (!['ADMIN', 'CEO'].includes(user.role)) {
      if (user.role !== 'MANAGER' || !user.team_id) return forbidden('Only Heads/Admin manage task types');
      where = 'tt.team_id = ?';
      params.push(user.team_id);
    }
    const types = db.prepare(`
      SELECT tt.*, tm.name AS team_name,
        (SELECT COUNT(*) FROM tasks WHERE task_type_id = tt.id) AS used_count
      FROM task_types tt JOIN teams tm ON tm.id = tt.team_id
      WHERE ${where} ORDER BY tm.name, tt.name
    `).all(...params);
    return Response.json({ types });
  }

  // Composer feed: active types for a team (or a user's team)
  let teamId = url.searchParams.get('teamId') ? Number(url.searchParams.get('teamId')) : null;
  const userId = url.searchParams.get('userId') ? Number(url.searchParams.get('userId')) : null;
  if (!teamId && userId) {
    teamId = (db.prepare('SELECT team_id FROM users WHERE id = ?').get(userId) as any)?.team_id ?? null;
  }
  if (!teamId) return Response.json({ types: [] });
  const types = db.prepare(
    'SELECT id, team_id, name, alias, description FROM task_types WHERE team_id = ? AND is_active = 1 ORDER BY name'
  ).all(teamId);
  return Response.json({ types });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { teamId, name, alias, description = '' } = await req.json().catch(() => ({}));
  if (!teamId || !name?.trim() || !alias?.trim()) return badRequest('teamId, name and alias are required');
  if (!canManageTeamTypes(user, Number(teamId))) return forbidden('You can only manage your own team\'s task types');
  const db = getDb();
  const id = db.prepare('INSERT INTO task_types (team_id, name, alias, description, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(Number(teamId), name.trim(), alias.trim(), description, now()).lastInsertRowid;
  return Response.json({ id: Number(id) });
}

export async function PATCH(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id, name, alias, isActive } = await req.json().catch(() => ({}));
  if (!id) return badRequest('id required');
  const db = getDb();
  const type = db.prepare('SELECT * FROM task_types WHERE id = ?').get(Number(id)) as any;
  if (!type) return Response.json({ error: 'Not found' }, { status: 404 });
  if (!canManageTeamTypes(user, type.team_id)) return forbidden();
  if (name !== undefined) db.prepare('UPDATE task_types SET name = ? WHERE id = ?').run(String(name).trim(), type.id);
  if (alias !== undefined) db.prepare('UPDATE task_types SET alias = ? WHERE id = ?').run(String(alias).trim(), type.id);
  if (isActive !== undefined) db.prepare('UPDATE task_types SET is_active = ? WHERE id = ?').run(isActive ? 1 : 0, type.id);
  return Response.json({ ok: true });
}
