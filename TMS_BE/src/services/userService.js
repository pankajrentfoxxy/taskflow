import httpStatus from "http-status";
import bcrypt from "bcryptjs";
import sequelize from "../config/db.js";
import {
  Authentication,
  Role,
  Team,
  TeamMember,
} from "../models/index.js";
import ApiError from "../utils/ApiError.js";
import { getRoleByName } from "../config/roles.js";

const now = () => Date.now();

const toPublicUser = (user) => ({
  user_id: user.user_id,
  email: user.email,
  full_name: user.full_name,
  phone_number: user.phone_number,
  role_id: user.role_id,
  is_active: user.is_active,
  is_blocked: user.is_blocked,
  created_at: user.created_at,
  role: user.role
    ? {
        role_id: user.role.role_id,
        slug: user.role.slug,
      }
    : undefined,
});

async function resolveDefaultMemberRoleId() {
  const configuredRole = getRoleByName("team_member");
  if (configuredRole?.id) {
    const role = await Role.findByPk(configuredRole.id);
    if (role) return role.role_id;
  }

  const role = await Role.findOne({ where: { slug: "team_member" } });
  if (role) return role.role_id;

  throw new ApiError(
    httpStatus.INTERNAL_SERVER_ERROR,
    "Default member role is not configured",
  );
}

async function resolveRoleId(payload) {
  if (payload.role_id != null) {
    const role = await Role.findByPk(payload.role_id);
    if (!role) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid role");
    }
    return role.role_id;
  }

  return resolveDefaultMemberRoleId();
}

export async function listUsers() {
  const users = await Authentication.findAll({
    attributes: {
      exclude: ["password_hash"],
    },
    include: [
      {
        model: Role,
        as: "role",
        attributes: ["role_id", "slug"],
      },
    ],
    order: [["created_at", "DESC"]],
  });

  return users.map(toPublicUser);
}

export async function createUser(payload) {
  const email = payload.email.trim().toLowerCase();
  const existing = await Authentication.findOne({ where: { email } });

  if (existing) {
    throw new ApiError(httpStatus.CONFLICT, "Email already registered");
  }

  const roleId = await resolveRoleId(payload);
  const passwordHash = await bcrypt.hash(payload.password, 10);
  const phoneDigits = String(payload.phone_number || "").replace(/\D/g, "");

  const user = await sequelize.transaction(async (transaction) => {
    const createdUser = await Authentication.create(
      {
        email,
        full_name: payload.full_name.trim(),
        phone_number: phoneDigits || null,
        password_hash: passwordHash,
        role_id: roleId,
        is_active: true,
        is_blocked: false,
        created_at: now(),
        updated_at: now(),
      },
      { transaction },
    );

    if (payload.team_id != null) {
      const team = await Team.findByPk(payload.team_id, { transaction });
      if (!team) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Team not found");
      }

      await TeamMember.create(
        {
          team_id: payload.team_id,
          user_id: createdUser.user_id,
          created_at: now(),
          updated_at: now(),
        },
        { transaction },
      );
    }

    return createdUser;
  });

  const fullUser = await Authentication.findByPk(user.user_id, {
    attributes: {
      exclude: ["password_hash"],
    },
    include: [
      {
        model: Role,
        as: "role",
        attributes: ["role_id", "slug"],
      },
    ],
  });

  return toPublicUser(fullUser);
}
