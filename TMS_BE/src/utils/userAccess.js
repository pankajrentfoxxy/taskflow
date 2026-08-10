import { Authentication, Role } from "../models/index.js";

const SUPER_ADMIN_SLUG = "super_admin";
const ADMIN_SLUG = "admin";

export function isSuperAdminRole(role) {
  return role?.slug === SUPER_ADMIN_SLUG;
}

export function isAdminRole(role) {
  return role?.slug === ADMIN_SLUG;
}

export function canViewAllProjectTasksRole(role) {
  return isSuperAdminRole(role) || isAdminRole(role);
}

export async function canViewAllProjectTasks(userId) {
  if (await isSuperAdminUser(userId)) {
    return true;
  }

  const user = await Authentication.findByPk(userId, {
    attributes: ["user_id"],
    include: [
      {
        model: Role,
        as: "role",
        attributes: ["slug"],
      },
    ],
  });

  return isAdminRole(user?.role);
}

export function userCanAccessTask(userId, task, assigneeIds = []) {
  if (Number(task.created_by) === Number(userId)) {
    return true;
  }

  return assigneeIds.some((assigneeId) => Number(assigneeId) === Number(userId));
}

export async function isSuperAdminUser(userId) {
  const user = await Authentication.findByPk(userId, {
    attributes: ["user_id"],
    include: [
      {
        model: Role,
        as: "role",
        attributes: ["slug"],
      },
    ],
  });

  return isSuperAdminRole(user?.role);
}

export async function canManageProject(userId, project) {
  if (!project) {
    return false;
  }

  if (await isSuperAdminUser(userId)) {
    return true;
  }

  return Number(project.created_by) === Number(userId);
}
