import httpStatus from "http-status";
import bcrypt from "bcryptjs";
import { Op } from "sequelize";
import {
  Project,
  ProjectMember,
  Authentication,
  Role,
  sequelize,
} from "../models/index.js";
import ApiError from "../utils/ApiError.js";
import { getRoleByName } from "../config/roles.js";
import { isSuperAdminUser } from "../utils/userAccess.js";

const now = () => Date.now();

const toPublicProject = (project) => ({
  project_id: project.project_id,
  name: project.name,
  description: project.description,
  created_by: project.created_by,
  is_active: project.is_active,
  created_at: project.created_at,
  updated_at: project.updated_at,
  creator: project.creator
    ? {
        user_id: project.creator.user_id,
        email: project.creator.email,
        full_name: project.creator.full_name,
      }
    : undefined,
  members: project.members
    ? project.members.map(toPublicMember)
    : undefined,
});

const memberUserInclude = {
  model: Authentication,
  as: "user",
  attributes: ["user_id", "email", "full_name", "phone_number"],
};

const memberAddedByInclude = {
  model: Authentication,
  as: "addedBy",
  attributes: ["user_id", "email", "full_name"],
};

const toPublicMember = (member) => ({
  project_member_id: member.project_member_id,
  project_id: member.project_id,
  user_id: member.user_id,
  created_by: member.created_by,
  created_at: member.created_at,
  updated_at: member.updated_at,
  user: member.user
    ? {
        user_id: member.user.user_id,
        email: member.user.email,
        full_name: member.user.full_name,
        phone_number: member.user.phone_number,
      }
    : undefined,
  added_by: member.addedBy
    ? {
        user_id: member.addedBy.user_id,
        email: member.addedBy.email,
        full_name: member.addedBy.full_name,
      }
    : undefined,
});

async function getProjectRecord(projectId) {
  const project = await Project.findOne({
    where: { project_id: projectId, deleted: false },
  });
  if (!project) {
    throw new ApiError(httpStatus.NOT_FOUND, "Project not found");
  }
  return project;
}

async function assertProjectAccess(userId, projectId, { requireCreator = false } = {}) {
  const project = await getProjectRecord(projectId);

  if (await isSuperAdminUser(userId)) {
    return project;
  }

  if (requireCreator) {
    if (project.created_by !== userId) {
      throw new ApiError(httpStatus.FORBIDDEN, "Only the project creator can perform this action");
    }
    return project;
  }

  if (project.created_by === userId) {
    return project;
  }

  const membership = await ProjectMember.findOne({
    where: { project_id: projectId, user_id: userId },
  });

  if (!membership) {
    throw new ApiError(httpStatus.FORBIDDEN, "You do not have access to this project");
  }

  return project;
}

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

async function resolveOrCreateMemberUser(payload, transaction) {
  if (payload.user_id) {
    const user = await Authentication.findByPk(payload.user_id, { transaction });
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, "User not found");
    }
    return user;
  }

  const email = payload.email.trim().toLowerCase();
  const existing = await Authentication.findOne({
    where: { email },
    transaction,
  });
  if (existing) {
    throw new ApiError(httpStatus.CONFLICT, "Email already registered");
  }

  const roleId = await resolveDefaultMemberRoleId();
  const passwordHash = await bcrypt.hash(payload.password, 10);
  const phoneDigits = String(payload.phone_number || "").replace(/\D/g, "");

  return Authentication.create(
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
}

export async function createProject(userId, payload) {
  const result = await sequelize.transaction(async (transaction) => {
    const project = await Project.create(
      {
        name: payload.name,
        description: payload.description ?? null,
        created_by: userId,
        is_active: payload.is_active ?? true,
        created_at: now(),
        updated_at: now(),
      },
      { transaction },
    );

    await ProjectMember.create(
      {
        project_id: project.project_id,
        user_id: userId,
        created_by: userId,
        created_at: now(),
        updated_at: now(),
      },
      { transaction },
    );

    return project;
  });

  return getProjectById(userId, result.project_id);
}

export async function listProjects(userId) {
  if (await isSuperAdminUser(userId)) {
    const projects = await Project.findAll({
      where: { deleted: false },
      include: [
        {
          model: Authentication,
          as: "creator",
          attributes: ["user_id", "email", "full_name"],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    return projects.map(toPublicProject);
  }

  const memberships = await ProjectMember.findAll({
    where: { user_id: userId },
    attributes: ["project_id"],
  });

  const memberProjectIds = memberships.map((item) => item.project_id);

  const accessFilter = memberProjectIds.length
    ? {
        [Op.or]: [
          { created_by: userId },
          { project_id: { [Op.in]: memberProjectIds } },
        ],
      }
    : { created_by: userId };

  const projects = await Project.findAll({
    where: {
      deleted: false,
      ...accessFilter,
    },
    include: [
      {
        model: Authentication,
        as: "creator",
        attributes: ["user_id", "email", "full_name"],
      },
    ],
    order: [["created_at", "DESC"]],
  });

  return projects.map(toPublicProject);
}

export async function getProjectById(userId, projectId) {
  await assertProjectAccess(userId, projectId);

  const project = await Project.findOne({
    where: { project_id: projectId, deleted: false },
    include: [
      {
        model: Authentication,
        as: "creator",
        attributes: ["user_id", "email", "full_name"],
      },
      {
        model: ProjectMember,
        as: "members",
        include: [memberUserInclude, memberAddedByInclude],
      },
    ],
  });

  if (!project) {
    throw new ApiError(httpStatus.NOT_FOUND, "Project not found");
  }

  return toPublicProject(project);
}

export async function updateProject(userId, projectId, payload) {
  const project = await assertProjectAccess(userId, projectId, {
    requireCreator: true,
  });

  await project.update({
    ...(payload.name !== undefined ? { name: payload.name } : {}),
    ...(payload.description !== undefined
      ? { description: payload.description }
      : {}),
    ...(payload.is_active !== undefined ? { is_active: payload.is_active } : {}),
    updated_at: now(),
  });

  return getProjectById(userId, project.project_id);
}

export async function deleteProject(userId, projectId) {
  const project = await assertProjectAccess(userId, projectId, {
    requireCreator: true,
  });

  await project.update({ deleted: true, updated_at: now() });

  return { message: "Project deleted" };
}

export async function listProjectMembers(userId, projectId) {
  await assertProjectAccess(userId, projectId);

  const members = await ProjectMember.findAll({
    where: { project_id: projectId },
    include: [memberUserInclude, memberAddedByInclude],
    order: [["created_at", "ASC"]],
  });

  return members.map(toPublicMember);
}

export async function addProjectMember(userId, projectId, payload) {
  await assertProjectAccess(userId, projectId, { requireCreator: true });

  const member = await sequelize.transaction(async (transaction) => {
    const targetUser = await resolveOrCreateMemberUser(payload, transaction);

    const existing = await ProjectMember.findOne({
      where: { project_id: projectId, user_id: targetUser.user_id },
      transaction,
    });

    if (existing) {
      throw new ApiError(
        httpStatus.CONFLICT,
        "User is already a member of this project",
      );
    }

    return ProjectMember.create(
      {
        project_id: projectId,
        user_id: targetUser.user_id,
        created_by: userId,
        created_at: now(),
        updated_at: now(),
      },
      { transaction },
    );
  });

  const fullMember = await ProjectMember.findByPk(member.project_member_id, {
    include: [memberUserInclude, memberAddedByInclude],
  });

  return toPublicMember(fullMember);
}

export async function getProjectMemberById(userId, projectId, memberId) {
  await assertProjectAccess(userId, projectId);

  const member = await ProjectMember.findOne({
    where: { project_member_id: memberId, project_id: projectId },
    include: [memberUserInclude, memberAddedByInclude],
  });

  if (!member) {
    throw new ApiError(httpStatus.NOT_FOUND, "Project member not found");
  }

  return toPublicMember(member);
}

export async function updateProjectMember(userId, projectId, memberId, payload) {
  await assertProjectAccess(userId, projectId, { requireCreator: true });

  const member = await ProjectMember.findOne({
    where: { project_member_id: memberId, project_id: projectId },
  });

  if (!member) {
    throw new ApiError(httpStatus.NOT_FOUND, "Project member not found");
  }

  if (payload.user_id !== undefined && payload.user_id !== member.user_id) {
    const targetUser = await Authentication.findByPk(payload.user_id);
    if (!targetUser) {
      throw new ApiError(httpStatus.NOT_FOUND, "User not found");
    }

    const duplicate = await ProjectMember.findOne({
      where: {
        project_id: projectId,
        user_id: payload.user_id,
        project_member_id: { [Op.ne]: memberId },
      },
    });

    if (duplicate) {
      throw new ApiError(httpStatus.CONFLICT, "User is already a member of this project");
    }

    await member.update({
      user_id: payload.user_id,
      updated_at: now(),
    });
  }

  return getProjectMemberById(userId, projectId, memberId);
}

export async function deleteProjectMember(userId, projectId, memberId) {
  const project = await assertProjectAccess(userId, projectId, {
    requireCreator: true,
  });

  const member = await ProjectMember.findOne({
    where: { project_member_id: memberId, project_id: projectId },
  });

  if (!member) {
    throw new ApiError(httpStatus.NOT_FOUND, "Project member not found");
  }

  if (member.user_id === project.created_by) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Cannot remove the project creator from members",
    );
  }

  await member.destroy();
  return { message: "Project member removed" };
}
