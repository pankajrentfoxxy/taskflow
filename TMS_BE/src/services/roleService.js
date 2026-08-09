import { Role } from "../models/index.js";
import { getRoleByName } from "../config/roles.js";

export async function listRoles() {
  const roles = await Role.findAll({
    attributes: ["role_id", "slug", "description"],
    order: [["slug", "ASC"]],
  });

  return roles.map((role) => {
    const configured = getRoleByName(role.slug);

    return {
      role_id: role.role_id,
      slug: role.slug,
      description: role.description,
      display_name: configured?.display_name || role.slug,
    };
  });
}
