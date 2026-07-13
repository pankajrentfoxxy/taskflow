import { getDb, now } from './db';

export function notify(
  userIds: (number | null | undefined)[],
  type: string,
  title: string,
  body = '',
  taskId: number | null = null,
  excludeUserId: number | null = null
) {
  const db = getDb();
  const stmt = db.prepare(
    'INSERT INTO notifications (user_id, type, title, body, task_id, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const seen = new Set<number>();
  for (const id of userIds) {
    if (!id || id === excludeUserId || seen.has(id)) continue;
    seen.add(id);
    stmt.run(id, type, title, body, taskId, now());
  }
}

/** assignee's manager's user id (via team), or null */
export function managerOf(assigneeId: number | null): number | null {
  if (!assigneeId) return null;
  const db = getDb();
  const row = db
    .prepare('SELECT tm.manager_id AS m FROM users u JOIN teams tm ON tm.id = u.team_id WHERE u.id = ?')
    .get(assigneeId) as any;
  return row?.m ?? null;
}

export function ceoIds(): number[] {
  const db = getDb();
  return (db.prepare("SELECT id FROM users WHERE role = 'CEO' AND is_active = 1").all() as any[]).map((r) => r.id);
}

export function logActivity(taskId: number | null, actorId: number | null, type: string, meta: any = {}) {
  const db = getDb();
  db.prepare('INSERT INTO activity (task_id, actor_id, type, meta, created_at) VALUES (?, ?, ?, ?, ?)').run(
    taskId,
    actorId,
    type,
    JSON.stringify(meta),
    now()
  );
}
