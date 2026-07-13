import { getDb, now } from './db';
import { notify, managerOf, ceoIds, logActivity } from './notify';

/**
 * SLA sweep: flags response-SLA breaches, sends 15-min warnings, escalates
 * overdue tasks. Runs at most once per minute unless forced. Called lazily
 * from busy API routes and from /api/cron/sla-check.
 */
export function runSlaSweep(force = false): { breached: number; warned: number; escalated: number } {
  const db = getDb();
  const t = now();
  const last = (db.prepare("SELECT value FROM meta WHERE key = 'last_sweep'").get() as any)?.value;
  if (!force && last && t - Number(last) < 60_000) return { breached: 0, warned: 0, escalated: 0 };
  db.prepare("INSERT INTO meta (key, value) VALUES ('last_sweep', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(String(t));

  let breached = 0, warned = 0, escalated = 0;

  // 1) Response-SLA breaches (assigned, never acknowledged, deadline passed)
  const toBreach = db.prepare(`
    SELECT * FROM tasks
    WHERE status = 'ASSIGNED' AND acknowledged_at IS NULL
      AND sla_deadline_at IS NOT NULL AND sla_deadline_at < ? AND sla_breached_at IS NULL
  `).all(t) as any[];
  for (const task of toBreach) {
    db.prepare('UPDATE tasks SET sla_breached_at = ?, updated_at = ? WHERE id = ?').run(t, t, task.id);
    logActivity(task.id, null, 'SLA_BREACH', {});
    notify(
      [task.assignee_id, managerOf(task.assignee_id), task.creator_id],
      'SLA_BREACH',
      `No response: "${task.title}"`,
      'Task was not acknowledged within 30 working minutes.',
      task.id
    );
    breached++;
  }

  // 2) 15-minutes-left warnings
  const toWarn = db.prepare(`
    SELECT * FROM tasks
    WHERE status = 'ASSIGNED' AND acknowledged_at IS NULL AND warn_sent = 0
      AND sla_breached_at IS NULL AND sla_deadline_at IS NOT NULL
      AND sla_deadline_at > ? AND sla_deadline_at <= ?
  `).all(t, t + 15 * 60 * 1000) as any[];
  for (const task of toWarn) {
    db.prepare('UPDATE tasks SET warn_sent = 1 WHERE id = ?').run(task.id);
    notify([task.assignee_id], 'SLA_WARNING', `15 minutes left to acknowledge "${task.title}"`, '', task.id);
    warned++;
  }

  // 3) Escalate past-due open tasks
  const toEscalate = db.prepare(`
    SELECT * FROM tasks
    WHERE status NOT IN ('DONE', 'CANCELLED', 'ESCALATED') AND due_at < ?
  `).all(t) as any[];
  for (const task of toEscalate) {
    db.prepare("UPDATE tasks SET status = 'ESCALATED', escalated_at = ?, updated_at = ? WHERE id = ?").run(t, t, task.id);
    db.prepare('INSERT INTO escalations (task_id, created_at) VALUES (?, ?)').run(task.id, t);
    logActivity(task.id, null, 'ESCALATED', { dueAt: task.due_at });
    notify(
      [task.assignee_id, managerOf(task.assignee_id), task.creator_id, ...ceoIds()],
      'ESCALATED',
      `Escalated: "${task.title}" passed its due date`,
      'A written explanation from the assignee is now mandatory.',
      task.id
    );
    escalated++;
  }

  // 4) Due-soon reminders (24h window, once)
  const dueSoon = db.prepare(`
    SELECT * FROM tasks
    WHERE status NOT IN ('DONE', 'CANCELLED', 'ESCALATED') AND due_soon_sent = 0
      AND due_at > ? AND due_at <= ?
  `).all(t, t + 24 * 3600 * 1000) as any[];
  for (const task of dueSoon) {
    db.prepare('UPDATE tasks SET due_soon_sent = 1 WHERE id = ?').run(task.id);
    notify([task.assignee_id], 'DUE_SOON', `Due within 24h: "${task.title}"`, '', task.id);
  }

  return { breached, warned, escalated };
}
