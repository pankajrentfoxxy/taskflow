import { getDb, now } from '@/lib/db';
import { getSessionUser, unauthorized, forbidden, badRequest } from '@/lib/auth';
import { isProjectMember, canManageProject } from '@/lib/rbac';
import { notify } from '@/lib/notify';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const pid = Number(id);
  const db = getDb();
  const project = db.prepare('SELECT p.*, u.name AS owner_name FROM projects p JOIN users u ON u.id = p.owner_id WHERE p.id = ?').get(pid) as any;
  if (!project) return Response.json({ error: 'Not found' }, { status: 404 });
  if (!isProjectMember(user, pid)) return forbidden('You are not a member of this project');

  const members = db.prepare(`
    SELECT u.id, u.name, u.email, u.role FROM project_members pm JOIN users u ON u.id = pm.user_id
    WHERE pm.project_id = ? ORDER BY u.name
  `).all(pid);
  const notes = db.prepare(`
    SELECT n.*, u.name AS author_name FROM project_notes n JOIN users u ON u.id = n.author_id
    WHERE n.project_id = ? ORDER BY n.pinned DESC, n.id DESC
  `).all(pid);
  const tasks = db.prepare(`
    SELECT t.*, ua.name AS assignee_name, uc.name AS creator_name, tt.name AS type_name, tt.alias AS type_alias,
      (SELECT COUNT(*) FROM tasks s WHERE s.parent_id = t.id) AS subtask_count,
      (SELECT COUNT(*) FROM tasks s WHERE s.parent_id = t.id AND s.status = 'DONE') AS subtask_done
    FROM tasks t
    LEFT JOIN task_types tt ON tt.id = t.task_type_id
    LEFT JOIN users ua ON ua.id = t.assignee_id
    LEFT JOIN users uc ON uc.id = t.creator_id
    WHERE t.project_id = ? AND t.parent_id IS NULL
    ORDER BY CASE t.status WHEN 'ESCALATED' THEN 0 WHEN 'ASSIGNED' THEN 1 ELSE 2 END, t.due_at
  `).all(pid);
  const files = db.prepare(`
    SELECT a.id, a.file_name, a.mime_type, a.size, a.created_at, u.name AS uploader_name, a.task_id
    FROM attachments a JOIN users u ON u.id = a.uploader_id
    WHERE a.project_id = ? OR a.task_id IN (SELECT id FROM tasks WHERE project_id = ?)
    ORDER BY a.id DESC
  `).all(pid, pid);
  const activity = db.prepare(`
    SELECT a.*, u.name AS actor_name, t.title AS task_title
    FROM activity a LEFT JOIN users u ON u.id = a.actor_id LEFT JOIN tasks t ON t.id = a.task_id
    WHERE a.task_id IN (SELECT id FROM tasks WHERE project_id = ?)
    ORDER BY a.id DESC LIMIT 100
  `).all(pid);

  return Response.json({
    project, members, notes, tasks, files, activity,
    canManage: canManageProject(user, project),
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const pid = Number(id);
  const db = getDb();
  const t = now();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(pid) as any;
  if (!project) return Response.json({ error: 'Not found' }, { status: 404 });
  if (!isProjectMember(user, pid)) return forbidden();

  const body = await req.json().catch(() => ({}));

  if (body.addMemberId !== undefined) {
    if (!canManageProject(user, project)) return forbidden('Only the owner/Admin manages members');
    db.prepare('INSERT OR IGNORE INTO project_members (project_id, user_id) VALUES (?, ?)').run(pid, Number(body.addMemberId));
    notify([Number(body.addMemberId)], 'PROJECT', `You were added to project "${project.name}"`, '', null, user.id);
  }
  if (body.removeMemberId !== undefined) {
    if (!canManageProject(user, project)) return forbidden('Only the owner/Admin manages members');
    db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?').run(pid, Number(body.removeMemberId));
  }
  if (body.note) {
    db.prepare('INSERT INTO project_notes (project_id, author_id, body, created_at) VALUES (?, ?, ?, ?)').run(pid, user.id, String(body.note).trim(), t);
  }
  if (body.togglePinNoteId !== undefined) {
    if (!canManageProject(user, project)) return forbidden();
    db.prepare('UPDATE project_notes SET pinned = 1 - pinned WHERE id = ? AND project_id = ?').run(Number(body.togglePinNoteId), pid);
  }
  if (body.description !== undefined) {
    if (!canManageProject(user, project)) return forbidden();
    db.prepare('UPDATE projects SET description = ? WHERE id = ?').run(String(body.description), pid);
  }
  return Response.json({ ok: true });
}
