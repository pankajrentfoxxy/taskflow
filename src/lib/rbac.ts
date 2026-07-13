import { getDb } from './db';
import type { SessionUser } from './auth';

/** SQL fragment (aliased t) restricting tasks to what `user` may see, with params. */
export function taskVisibilityWhere(user: SessionUser): { sql: string; params: any[] } {
  if (user.role === 'ADMIN' || user.role === 'CEO') return { sql: '1=1', params: [] };
  const base = `(t.assignee_id = ? OR t.creator_id = ?
    OR t.project_id IN (SELECT project_id FROM project_members WHERE user_id = ?)
    OR t.project_id IN (SELECT id FROM projects WHERE owner_id = ?)
    ${user.team_id ? 'OR t.assigned_team_id = ?' : ''})`;
  const params: any[] = [user.id, user.id, user.id, user.id];
  if (user.team_id) params.push(user.team_id);
  if (user.role === 'MANAGER' && user.team_id) {
    return {
      sql: `(${base} OR t.assignee_id IN (SELECT id FROM users WHERE team_id = ?) OR t.assigned_team_id = ?)`,
      params: [...params, user.team_id, user.team_id],
    };
  }
  return { sql: base, params };
}

export function canSeeTask(user: SessionUser, task: any): boolean {
  const db = getDb();
  const { sql, params } = taskVisibilityWhere(user);
  const row = db.prepare(`SELECT 1 FROM tasks t WHERE t.id = ? AND ${sql}`).get(task.id, ...params);
  return !!row;
}

export function isManagerOf(user: SessionUser, otherUserId: number | null): boolean {
  if (user.role !== 'MANAGER' || !user.team_id || !otherUserId) return false;
  const db = getDb();
  const row = db.prepare('SELECT 1 FROM users WHERE id = ? AND team_id = ?').get(otherUserId, user.team_id);
  return !!row;
}

/** ETA editable by: assignee, assignee's manager, CEO, Admin. */
export function canEditEta(user: SessionUser, task: any): boolean {
  if (user.role === 'ADMIN' || user.role === 'CEO') return true;
  if (task.assignee_id === user.id) return true;
  return isManagerOf(user, task.assignee_id);
}

export function canReviewEscalation(user: SessionUser, task: any): boolean {
  if (user.role === 'ADMIN' || user.role === 'CEO') return true;
  return isManagerOf(user, task.assignee_id);
}

export function canManageProject(user: SessionUser, project: any): boolean {
  return user.role === 'ADMIN' || project.owner_id === user.id;
}

export function isProjectMember(user: SessionUser, projectId: number): boolean {
  if (user.role === 'ADMIN' || user.role === 'CEO') return true;
  const db = getDb();
  const row = db
    .prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ? UNION SELECT 1 FROM projects WHERE id = ? AND owner_id = ?')
    .get(projectId, user.id, projectId, user.id);
  return !!row;
}
