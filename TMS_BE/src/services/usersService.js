import bcrypt from "bcryptjs";
import { QueryTypes } from "sequelize";
import httpStatus from "http-status";
import sequelize from "../config/db.js";
import { User, Team } from "../models/index.js";
import ApiError from "../utils/ApiError.js";
import { now } from "../lib/time.js";

export const listUsers = async () => {
  const users = await sequelize.query(
    `SELECT u.id, u.name, u.email, u.role, u.team_id, u.is_active, tm.name AS team_name
     FROM users u LEFT JOIN teams tm ON tm.id = u.team_id
     ORDER BY u.name`,
    { type: QueryTypes.SELECT }
  );
  return { users };
};

export const createUser = async ({ name, email, password, role = "MEMBER", teamId = null }) => {
  if (!name || !email || !password) {
    throw new ApiError(httpStatus.BAD_REQUEST, "name, email, password required");
  }
  if (!["ADMIN", "CEO", "MANAGER", "MEMBER"].includes(role)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid role");
  }

  try {
    const user = await User.create({
      name,
      email: String(email).toLowerCase().trim(),
      password_hash: bcrypt.hashSync(password, 10),
      role,
      team_id: teamId,
      created_at: now(),
    });

    if (role === "MANAGER" && teamId) {
      await Team.update({ manager_id: user.id }, { where: { id: teamId } });
    }

    return { id: user.id };
  } catch (e) {
    const msg = e.message?.includes("unique") || e.name === "SequelizeUniqueConstraintError"
      ? "Email already exists"
      : "Could not create user";
    throw new ApiError(httpStatus.BAD_REQUEST, msg);
  }
};

export const updateUser = async ({ id, role, teamId, isActive, password }) => {
  if (!id) throw new ApiError(httpStatus.BAD_REQUEST, "id required");

  const user = await User.findByPk(id);
  if (!user) throw new ApiError(httpStatus.NOT_FOUND, "Not found");

  if (role !== undefined) await user.update({ role });
  if (teamId !== undefined) await user.update({ team_id: teamId });
  if (isActive !== undefined) await user.update({ is_active: !!isActive });
  if (password) await user.update({ password_hash: bcrypt.hashSync(password, 10) });

  return { ok: true };
};

export const deleteUser = async (actorId, id) => {
  if (!id) throw new ApiError(httpStatus.BAD_REQUEST, "id required");
  if (Number(id) === Number(actorId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "You cannot delete your own account");
  }

  const user = await User.findByPk(Number(id));
  if (!user) throw new ApiError(httpStatus.NOT_FOUND, "Not found");

  if (user.role === "ADMIN") {
    const adminCount = await User.count({ where: { role: "ADMIN", is_active: true } });
    if (adminCount <= 1) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Cannot delete the last active admin");
    }
  }

  const [{ task_count: taskCount }] = await sequelize.query(
    "SELECT COUNT(*)::int AS task_count FROM tasks WHERE (creator_id = :id OR assignee_id = :id) AND deleted = false",
    { replacements: { id: user.id }, type: QueryTypes.SELECT }
  );

  if (taskCount > 0) {
    await user.update({ is_active: false });
    return { ok: true, deactivated: true };
  }

  if (user.role === "MANAGER") {
    await Team.update({ manager_id: null }, { where: { manager_id: user.id } });
  }
  await user.update({ team_id: null });
  await user.destroy();
  return { ok: true };
};

export default { listUsers, createUser, updateUser, deleteUser };
