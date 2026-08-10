export function isSuperAdmin(roleSlug) {
  return roleSlug === "super_admin";
}

export function isAdmin(roleSlug) {
  return roleSlug === "admin";
}

export function canAccessAdmin(roleSlug) {
  return isSuperAdmin(roleSlug) || isAdmin(roleSlug);
}

export function canViewOrgDashboard(roleSlug) {
  return canAccessAdmin(roleSlug);
}

export function canViewAllProjectTasks(roleSlug) {
  return canAccessAdmin(roleSlug);
}
