import * as roleService from "../services/roleService.js";

export const listRoles = async (req, res) => {
  const roles = await roleService.listRoles();
  res.json({ roles });
};
