import * as projectService from "../services/projectService.js";
import { logActivity } from "../services/activityLogService.js";

function logProjectActivity(req, res, overrides = {}) {
  logActivity({
    userId: req.user.user_id,
    req,
    statusCode: res.statusCode,
    ...overrides,
  }).catch(() => {});
}

export const createProject = async (req, res) => {
  const project = await projectService.createProject(req.user.user_id, req.body);
  res.status(201).json({ project });
  logProjectActivity(req, res, {
    action: "project.create",
    entityType: "project",
    entityId: project.project_id,
    description: `Created project "${project.name}"`,
    metadata: { name: project.name },
  });
};

export const listProjects = async (req, res) => {
  const projects = await projectService.listProjects(req.user.user_id);
  res.json({ projects });
  logProjectActivity(req, res, {
    action: "project.list",
    description: `Listed ${projects.length} project(s)`,
  });
};

export const getProject = async (req, res) => {
  const project = await projectService.getProjectById(
    req.user.user_id,
    req.params.projectId,
  );
  res.json({ project });
  logProjectActivity(req, res, {
    action: "project.view",
    entityType: "project",
    entityId: project.project_id,
    description: `Viewed project "${project.name}"`,
  });
};

export const updateProject = async (req, res) => {
  const project = await projectService.updateProject(
    req.user.user_id,
    req.params.projectId,
    req.body,
  );
  res.json({ project });
  logProjectActivity(req, res, {
    action: "project.update",
    entityType: "project",
    entityId: project.project_id,
    description: `Updated project "${project.name}"`,
    metadata: req.body,
  });
};

export const deleteProject = async (req, res) => {
  const result = await projectService.deleteProject(
    req.user.user_id,
    req.params.projectId,
  );
  res.json(result);
  logProjectActivity(req, res, {
    action: "project.delete",
    entityType: "project",
    entityId: Number(req.params.projectId),
    description: `Deleted project #${req.params.projectId}`,
  });
};

export const listProjectMembers = async (req, res) => {
  const members = await projectService.listProjectMembers(
    req.user.user_id,
    req.params.projectId,
  );
  res.json({ members });
  logProjectActivity(req, res, {
    action: "project.member.list",
    entityType: "project",
    entityId: Number(req.params.projectId),
    description: `Listed ${members.length} member(s) for project #${req.params.projectId}`,
  });
};

export const addProjectMember = async (req, res) => {
  const member = await projectService.addProjectMember(
    req.user.user_id,
    req.params.projectId,
    req.body,
  );
  res.status(201).json({ member });
  logProjectActivity(req, res, {
    action: "project.member.add",
    entityType: "project_member",
    entityId: member.project_member_id,
    description: `Added user #${member.user_id} to project #${req.params.projectId}`,
    metadata: {
      project_id: Number(req.params.projectId),
      user_id: member.user_id,
    },
  });
};

export const getProjectMember = async (req, res) => {
  const member = await projectService.getProjectMemberById(
    req.user.user_id,
    req.params.projectId,
    req.params.memberId,
  );
  res.json({ member });
  logProjectActivity(req, res, {
    action: "project.member.view",
    entityType: "project_member",
    entityId: member.project_member_id,
    description: `Viewed member #${member.project_member_id} on project #${req.params.projectId}`,
  });
};

export const updateProjectMember = async (req, res) => {
  const member = await projectService.updateProjectMember(
    req.user.user_id,
    req.params.projectId,
    req.params.memberId,
    req.body,
  );
  res.json({ member });
  logProjectActivity(req, res, {
    action: "project.member.update",
    entityType: "project_member",
    entityId: member.project_member_id,
    description: `Updated member #${member.project_member_id} on project #${req.params.projectId}`,
    metadata: req.body,
  });
};

export const deleteProjectMember = async (req, res) => {
  const result = await projectService.deleteProjectMember(
    req.user.user_id,
    req.params.projectId,
    req.params.memberId,
  );
  res.json(result);
  logProjectActivity(req, res, {
    action: "project.member.remove",
    entityType: "project_member",
    entityId: Number(req.params.memberId),
    description: `Removed member #${req.params.memberId} from project #${req.params.projectId}`,
    metadata: { project_id: Number(req.params.projectId) },
  });
};
