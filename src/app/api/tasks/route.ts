import { randomUUID } from 'crypto';
import { getDb, now } from '@/lib/db';
import { getSessionUser, unauthorized, badRequest } from '@/lib/auth';
import { taskVisibilityWhere } from '@/lib/rbac';
import { addWorkingMinutes } from '@/lib/sla';
import { notify, managerOf, logActivity } from '@/lib/notify';
import { runSlaSweep } from '@/lib/cron';

const SUB_COUNTS = `
  (SELECT COUNT(*) FROM tasks s WHERE s.parent_id = t.id) AS subtask_count,
  (SELECT COUNT(*) FROM tasks s WHERE s.parent_id = t.id AND s.status = 'DONE') AS subtask_done`;

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  runSlaSweep();
  const db = getDb();
  const url = new URL(req.url);
  const filter = url.searchParams.get('filter') || 'mine';
  const status = url.searchParams.get('status');
  const q = url.searchParams.get('q');
  const projectId = url.searchParams.get('projectId');

  const vis = taskVisibilityWhere(user);
  let where = `(${vis.sql})`;
  const params: any[] = [...vis.params];

  if (filter === 'mine') {
    where += ' AND (t.assignee_id = ?' + (user.team_id ? ' OR t.assigned_team_id = ?' : '') + ')';
    params.push(user.id);
    if (user.team_id) params.push(user.team_id);
  } else if (filter === 'created') {
    where += ' AND t.creator_id = ?';
    params.push(user.id);
  } else if (filter === 'team') {
    if (user.role === 'MANAGER' && user.team_id) {
      where += ' AND (t.assignee_id IN (SELECT id FROM users WHERE team_id = ?) OR t.assigned_team_id = ?)';
      params.push(user.team_id, user.team_id);
    } else if (!['ADMIN', 'CEO'].includes(user.role)) {
      return Response.json({ tasks: [] });
    }
  } // 'all' -> visibility only (ADMIN/CEO see everything)

  if (status) { where += ' AND t.status = ?'; params.push(status); }
  if (q) { where += ' AND (t.title LIKE ? OR t.description LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
  if (projectId) { where += ' AND t.project_id = ?'; params.push(Number(projectId)); }
  else { where += ' AND t.parent_id IS NULL'; }

  const tasks = db.prepare(`
    SELECT t.*, ${SUB_COUNTS},
      ua.name AS assignee_name, uc.name AS creator_name, tm.name AS team_name, p.name AS project_name
    FROM tasks t
    LEFT JOIN users ua ON ua.id = t.assignee_id
    LEFT JOIN users uc ON uc.id = t.creator_id
    LEFT JOIN teams tm ON tm.id = t.assigned_team_id
    LEFT JOIN projects p ON p.id = t.project_id
    WHERE ${where}
    ORDER BY CASE t.status WHEN 'ESCALATED' THEN 0 WHEN 'ASSIGNED' THEN 1 ELSE 2 END, t.due_at ASC
    LIMIT 300
  `).all(...params);

  return Response.json({ tasks });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const {
    title, description = '', assigneeId = null, teamId = null, priority = 'NORMAL',
    dueAt, projectId = null, parentId = null, multiple = false, lines = [],
    attachmentIds = [], boardId = null,
  } = body;

  if (!dueAt) return badRequest('Due date is required');
  if (!assigneeId && !teamId) return badRequest('Choose an assignee (person or team)');
  if (assigneeId && teamId) return badRequest('Assign to a person OR a team, not both');

  const db = getDb();
  const t = now();
  let effProject = projectId ? Number(projectId) : null;
  let parent: any = null;
  if (parentId) {
    parent = db.prepare('SELECT * FROM tasks WHERE id = ?').get(parentId);
    if (!parent) return badRequest('Parent task not found');
    if (parent.parent_id) return badRequest('Subtasks cannot have their own subtasks');
    effProject = parent.project_id;
  }

  const titles: string[] = multiple
    ? (lines as string[]).map((l) => l.trim()).filter(Boolean)
    : [String(title || '').trim()];
  if (titles.length === 0 || !titles[0]) return badRequest('Title is required');

  const batchId = titles.length > 1 ? randomUUID() : null;
  const sla = addWorkingMinutes(t, 30);
  const ins = db.prepare(`INSERT INTO tasks
    (title, description, priority, creator_id, assignee_id, assigned_team_id, project_id, parent_id, batch_id, board_id,
     due_at, sla_deadline_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  const created: number[] = [];
  for (const tt of titles) {
    const id = Number(
      ins.run(tt, description, priority, user.id, assigneeId, teamId, effProject, parentId, batchId, boardId, dueAt, sla, t, t).lastInsertRowid
    );
    created.push(id);
    logActivity(id, user.id, 'CREATED', batchId ? { batchId } : {});
  }

  // attach uploads to the first task
  if (attachmentIds.length && created.length) {
    const upd = db.prepare('UPDATE attachments SET task_id = ? WHERE id = ? AND uploader_id = ?');
    for (const aid of attachmentIds) upd.run(created[0], aid, user.id);
  }

  // notifications
  const label = titles.length > 1 ? `${titles.length} new tasks` : `New task: "${titles[0]}"`;
  if (assigneeId) {
    notify([Number(assigneeId)], 'ASSIGNED', label, `Assigned by ${user.name}. Acknowledge within 30 working minutes.`, created[0], user.id);
  } else if (teamId) {
    const members = (db.prepare('SELECT id FROM users WHERE team_id = ? AND is_active = 1').all(teamId) as any[]).map((r) => r.id);
    const mgr = (db.prepare('SELECT manager_id FROM teams WHERE id = ?').get(teamId) as any)?.manager_id;
    notify([...members, mgr], 'ASSIGNED', `${label} (team task)`, `Assigned by ${user.name} to your team.`, created[0], user.id);
  }
  if (parent && parent.assignee_id) {
    notify([parent.assignee_id, parent.creator_id], 'SUBTASK', `Subtask added on "${parent.title}"`, titles[0], parent.id, user.id);
  }

  return Response.json({ ids: created });
}
