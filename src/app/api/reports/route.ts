import { getDb, now } from '@/lib/db';
import { getSessionUser, unauthorized } from '@/lib/auth';
import { runSlaSweep } from '@/lib/cron';

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  runSlaSweep();
  const db = getDb();
  const url = new URL(req.url);
  const days = Number(url.searchParams.get('days') || 0); // 0 = all time
  const t = now();
  const since = days > 0 ? t - days * 24 * 3600 * 1000 : 0;

  // Scope: member -> own; manager -> team; CEO/Admin -> all
  let scope = '1=1';
  const sp: any[] = [];
  if (user.role === 'MEMBER') {
    scope = 't.assignee_id = ?';
    sp.push(user.id);
  } else if (user.role === 'MANAGER' && user.team_id) {
    scope = '(t.assignee_id IN (SELECT id FROM users WHERE team_id = ?) OR t.assigned_team_id = ?)';
    sp.push(user.team_id, user.team_id);
  }

  const one = (sql: string, ...p: any[]) => (db.prepare(sql).get(...p) as any);

  const overdue = one(`SELECT COUNT(*) AS c FROM tasks t WHERE ${scope} AND t.status NOT IN ('DONE','CANCELLED') AND t.due_at < ? AND t.created_at >= ?`, ...sp, t, since).c;
  const noResponse = one(`SELECT COUNT(*) AS c FROM tasks t WHERE ${scope} AND t.status = 'ASSIGNED' AND t.sla_breached_at IS NOT NULL AND t.created_at >= ?`, ...sp, since).c;
  const escalatedAwaiting = one(`SELECT COUNT(*) AS c FROM tasks t JOIN escalations e ON e.task_id = t.id AND e.id = (SELECT MAX(id) FROM escalations WHERE task_id = t.id) WHERE ${scope} AND t.status = 'ESCALATED' AND e.explanation IS NULL AND t.created_at >= ?`, ...sp, since).c;
  const escalatedPendingReview = one(`SELECT COUNT(*) AS c FROM tasks t JOIN escalations e ON e.task_id = t.id AND e.id = (SELECT MAX(id) FROM escalations WHERE task_id = t.id) WHERE ${scope} AND t.status = 'ESCALATED' AND e.explanation IS NOT NULL AND e.review_status = 'PENDING' AND t.created_at >= ?`, ...sp, since).c;
  const open = one(`SELECT COUNT(*) AS c FROM tasks t WHERE ${scope} AND t.status NOT IN ('DONE','CANCELLED') AND t.created_at >= ?`, ...sp, since).c;
  const dueThisWeek = one(`SELECT COUNT(*) AS c FROM tasks t WHERE ${scope} AND t.status NOT IN ('DONE','CANCELLED') AND t.due_at BETWEEN ? AND ?`, ...sp, t, t + 7 * 24 * 3600 * 1000).c;
  const doneRow = one(`SELECT COUNT(*) AS c, SUM(CASE WHEN t.done_at <= t.due_at THEN 1 ELSE 0 END) AS ontime FROM tasks t WHERE ${scope} AND t.status = 'DONE' AND t.created_at >= ?`, ...sp, since);
  const respRow = one(`SELECT AVG((t.acknowledged_at - t.created_at) / 60000.0) AS m FROM tasks t WHERE ${scope} AND t.acknowledged_at IS NOT NULL AND t.created_at >= ?`, ...sp, since);

  const summary = {
    open,
    overdue,
    noResponse,
    escalatedAwaiting,
    escalatedPendingReview,
    dueThisWeek,
    done: doneRow.c,
    onTimePct: doneRow.c ? Math.round((100 * (doneRow.ontime || 0)) / doneRow.c) : null,
    avgResponseMin: respRow.m != null ? Math.round(respRow.m) : null,
  };

  // Per-person breakdown (manager+ only)
  let people: any[] = [];
  if (user.role !== 'MEMBER') {
    people = db.prepare(`
      SELECT u.id, u.name, tm.name AS team_name,
        SUM(CASE WHEN t.status NOT IN ('DONE','CANCELLED') THEN 1 ELSE 0 END) AS open,
        SUM(CASE WHEN t.status NOT IN ('DONE','CANCELLED') AND t.due_at < ? THEN 1 ELSE 0 END) AS overdue,
        SUM(CASE WHEN t.status = 'ASSIGNED' AND t.sla_breached_at IS NOT NULL THEN 1 ELSE 0 END) AS no_response,
        SUM(CASE WHEN t.escalated_at IS NOT NULL THEN 1 ELSE 0 END) AS escalations,
        SUM(CASE WHEN t.status = 'DONE' THEN 1 ELSE 0 END) AS done,
        SUM(CASE WHEN t.status = 'DONE' AND t.done_at <= t.due_at THEN 1 ELSE 0 END) AS done_ontime,
        ROUND(AVG(CASE WHEN t.acknowledged_at IS NOT NULL THEN (t.acknowledged_at - t.created_at) / 60000.0 END)) AS avg_response_min
      FROM users u
      LEFT JOIN teams tm ON tm.id = u.team_id
      JOIN tasks t ON t.assignee_id = u.id AND t.created_at >= ? AND ${scope.replace(/t\./g, 't.')}
      WHERE u.is_active = 1
      GROUP BY u.id ORDER BY overdue DESC, open DESC
    `).all(t, since, ...sp);
  }

  return Response.json({ summary, people, scope: user.role });
}
