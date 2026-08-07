import httpStatus from "http-status";
import { Op } from "sequelize";
import {
  Project,
  ProjectMember,
  Authentication,
  sequelize,
} from "../models/index.js";
import ApiError from "../utils/ApiError.js";

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
  attributes: ["user_id", "email", "full_name"],
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
  const project = await Project.findByPk(projectId);
  if (!project) {
    throw new ApiError(httpStatus.NOT_FOUND, "Project not found");
  }
  return project;
}

async function assertProjectAccess(userId, projectId, { requireCreator = false } = {}) {
  const project = await getProjectRecord(projectId);

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
    where: accessFilter,
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

  const project = await Project.findByPk(projectId, {
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

  await sequelize.transaction(async (transaction) => {
    await ProjectMember.destroy({
      where: { project_id: projectId },
      transaction,
    });
    await project.destroy({ transaction });
  });

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

  const targetUser = await Authentication.findByPk(payload.user_id);
  if (!targetUser) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  const existing = await ProjectMember.findOne({
    where: { project_id: projectId, user_id: payload.user_id },
  });

  if (existing) {
    throw new ApiError(httpStatus.CONFLICT, "User is already a member of this project");
  }

  const member = await ProjectMember.create({
    project_id: projectId,
    user_id: payload.user_id,
    created_by: userId,
    created_at: now(),
    updated_at: now(),
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
