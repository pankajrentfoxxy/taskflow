import { Authentication, Role } from "../models/index.js";

const SUPER_ADMIN_SLUG = "super_admin";

export function isSuperAdminRole(role) {
  return role?.slug === SUPER_ADMIN_SLUG;
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
