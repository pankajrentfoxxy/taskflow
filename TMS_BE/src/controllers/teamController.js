import * as teamService from "../services/teamService.js";
import { logActivity } from "../services/activityLogService.js";

function logTeamActivity(req, res, overrides = {}) {
  logActivity({
    userId: req.user.user_id,
    req,
    statusCode: res.statusCode,
    ...overrides,
  }).catch(() => {});
}

export const createTeam = async (req, res) => {
  const team = await teamService.createTeam(req.user.user_id, req.body);
  res.status(201).json({ team });
  logTeamActivity(req, res, {
    action: "team.create",
    entityType: "team",
    entityId: team.team_id,
    description: `Created team "${team.name}"`,
    metadata: { name: team.name },
  });
};

export const listTeams = async (req, res) => {
  const teams = await teamService.listTeams(req.user.user_id);
  res.json({ teams });
  logTeamActivity(req, res, {
    action: "team.list",
    description: `Listed ${teams.length} team(s)`,
  });
};

export const getTeam = async (req, res) => {
  const team = await teamService.getTeamById(
    req.user.user_id,
    req.params.teamId,
  );
  res.json({ team });
  logTeamActivity(req, res, {
    action: "team.view",
    entityType: "team",
    entityId: team.team_id,
    description: `Viewed team "${team.name}"`,
  });
};

export const updateTeam = async (req, res) => {
  const team = await teamService.updateTeam(
    req.user.user_id,
    req.params.teamId,
    req.body,
  );
  res.json({ team });
  logTeamActivity(req, res, {
    action: "team.update",
    entityType: "team",
    entityId: team.team_id,
    description: `Updated team "${team.name}"`,
    metadata: req.body,
  });
};

export const deleteTeam = async (req, res) => {
  const result = await teamService.deleteTeam(
    req.user.user_id,
    req.params.teamId,
  );
  res.json(result);
  logTeamActivity(req, res, {
    action: "team.delete",
    entityType: "team",
    entityId: Number(req.params.teamId),
    description: `Deleted team #${req.params.teamId}`,
  });
};

export const listTeamMembers = async (req, res) => {
  const members = await teamService.listTeamMembers(
    req.user.user_id,
    req.params.teamId,
  );
  res.json({ members });
  logTeamActivity(req, res, {
    action: "team.member.list",
    entityType: "team",
    entityId: Number(req.params.teamId),
    description: `Listed ${members.length} member(s) for team #${req.params.teamId}`,
  });
};

export const addTeamMember = async (req, res) => {
  const member = await teamService.addTeamMember(
    req.user.user_id,
    req.params.teamId,
    req.body,
  );
  res.status(201).json({ member });
  logTeamActivity(req, res, {
    action: "team.member.add",
    entityType: "team_member",
    entityId: member.team_member_id,
    description: `Added user #${member.user_id} to team #${req.params.teamId}`,
    metadata: {
      team_id: Number(req.params.teamId),
      user_id: member.user_id,
    },
  });
};

export const getTeamMember = async (req, res) => {
  const member = await teamService.getTeamMemberById(
    req.user.user_id,
    req.params.teamId,
    req.params.memberId,
  );
  res.json({ member });
  logTeamActivity(req, res, {
    action: "team.member.view",
    entityType: "team_member",
    entityId: member.team_member_id,
    description: `Viewed member #${member.team_member_id} on team #${req.params.teamId}`,
  });
};

export const updateTeamMember = async (req, res) => {
  const member = await teamService.updateTeamMember(
    req.user.user_id,
    req.params.teamId,
    req.params.memberId,
    req.body,
  );
  res.json({ member });
  logTeamActivity(req, res, {
    action: "team.member.update",
    entityType: "team_member",
    entityId: member.team_member_id,
    description: `Updated member #${member.team_member_id} on team #${req.params.teamId}`,
    metadata: req.body,
  });
};

export const deleteTeamMember = async (req, res) => {
  const result = await teamService.deleteTeamMember(
    req.user.user_id,
    req.params.teamId,
    req.params.memberId,
  );
  res.json(result);
  logTeamActivity(req, res, {
    action: "team.member.remove",
    entityType: "team_member",
    entityId: Number(req.params.memberId),
    description: `Removed member #${req.params.memberId} from team #${req.params.teamId}`,
    metadata: { team_id: Number(req.params.teamId) },
  });
};
