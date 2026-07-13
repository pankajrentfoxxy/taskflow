import { getDb, now } from '@/lib/db';
import { getSessionUser, unauthorized, badRequest } from '@/lib/auth';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const db = getDb();
  const boards = db.prepare('SELECT id, name, scene, updated_at FROM boards WHERE owner_id = ? ORDER BY updated_at DESC').all(user.id);
  return Response.json({ boards });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id, name, scene } = await req.json().catch(() => ({}));
  if (!name?.trim()) return badRequest('Board name required');
  const db = getDb();
  const t = now();
  if (id) {
    const res = db.prepare('UPDATE boards SET name = ?, scene = ?, updated_at = ? WHERE id = ? AND owner_id = ?')
      .run(name.trim(), JSON.stringify(scene ?? []), t, id, user.id);
    if (res.changes === 0) return badRequest('Board not found');
    return Response.json({ id });
  }
  const newId = db.prepare('INSERT INTO boards (name, owner_id, scene, updated_at, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(name.trim(), user.id, JSON.stringify(scene ?? []), t, t).lastInsertRowid;
  return Response.json({ id: newId });
}

export async function DELETE(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const url = new URL(req.url);
  const id = Number(url.searchParams.get('id'));
  if (!id) return badRequest('id required');
  getDb().prepare('DELETE FROM boards WHERE id = ? AND owner_id = ?').run(id, user.id);
  return Response.json({ ok: true });
}
