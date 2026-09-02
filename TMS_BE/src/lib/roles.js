/** Account-level user roles (not task collaborator/watcher). */
export const USER_ROLES = ["ADMIN", "CEO", "MANAGER", "MEMBER", "QA"];

/** Roles with assignee-only report/task scope (same as MEMBER). */
export function isMemberScopeRole(role) {
  return role === "MEMBER" || role === "QA";
}

export function isQaRole(role) {
  return role === "QA";
}

/** Done credit: assignee always; QA also gets tasks they created and assigned to others. */
export function qaDoneCreditSql(taskAlias = "t", userAlias = "u") {
  return `(${taskAlias}.assignee_id = ${userAlias}.id OR (${userAlias}.role = 'QA' AND ${taskAlias}.creator_id = ${userAlias}.id))`;
}

export function qaDoneCreditForUserIdSql(taskAlias = "t", userIdRepl = ":personId") {
  return `(
    ${taskAlias}.assignee_id = ${userIdRepl}
    OR (
      ${taskAlias}.creator_id = ${userIdRepl}
      AND EXISTS (SELECT 1 FROM users qu WHERE qu.id = ${userIdRepl} AND qu.role = 'QA')
    )
  )`;
}

export function qaDoneAssignedForUserIdSql(taskAlias = "t", userIdRepl = ":personId") {
  return `(
    ${taskAlias}.creator_id = ${userIdRepl}
    AND ${taskAlias}.assignee_id IS DISTINCT FROM ${userIdRepl}
    AND EXISTS (SELECT 1 FROM users qu WHERE qu.id = ${userIdRepl} AND qu.role = 'QA')
  )`;
}

export function qaAssignedOutForUserIdSql(taskAlias = "t", userIdRepl = ":personId") {
  return `(
    ${taskAlias}.creator_id = ${userIdRepl}
    AND ${taskAlias}.assignee_id IS DISTINCT FROM ${userIdRepl}
    AND EXISTS (SELECT 1 FROM users qu WHERE qu.id = ${userIdRepl} AND qu.role = 'QA')
  )`;
}

export default {
  USER_ROLES,
  isMemberScopeRole,
  isQaRole,
  qaDoneCreditSql,
  qaDoneCreditForUserIdSql,
  qaDoneAssignedForUserIdSql,
  qaAssignedOutForUserIdSql,
};