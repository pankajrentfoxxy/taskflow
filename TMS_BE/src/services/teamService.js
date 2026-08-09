import httpStatus from "http-status";
import { Op } from "sequelize";
import {
  Team,
  TeamMember,
  Authentication,
  sequelize,
} from "../models/index.js";
import ApiError from "../utils/ApiError.js";

const now = () => Date.now();

const toPublicMember = (member) => ({
  team_member_id: member.team_member_id,
  team_id: member.team_id,
  user_id: member.user_id,
  created_at: member.created_at,
  updated_at: member.updated_at,
  user: member.user
    ? {
        user_id: member.user.user_id,
        email: member.user.email,
        full_name: member.user.full_name,
      }
    : undefined,
});

const toPublicTeam = (team) => ({
  team_id: team.team_id,
  name: team.name,
  description: team.description,
  created_by: team.created_by,
  created_at: team.created_at,
  updated_at: team.updated_at,
  creator: team.creator
    ? {
        user_id: team.creator.user_id,
        email: team.creator.email,
        full_name: team.creator.full_name,
      }
    : undefined,
  members: team.members ? team.members.map(toPublicMember) : undefined,
});

async function getTeamRecord(teamId) {
  const team = await Team.findByPk(teamId);
  if (!team) {
    throw new ApiError(httpStatus.NOT_FOUND, "Team not found");
  }
  return team;
}

async function assertTeamAccess(userId, teamId, { requireCreator = false } = {}) {
  const team = await getTeamRecord(teamId);

  if (requireCreator) {
    if (team.created_by !== userId) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Only the team creator can perform this action",
      );
    }
    return team;
  }

  if (team.created_by === userId) {
    return team;
  }

  const membership = await TeamMember.findOne({
    where: { team_id: teamId, user_id: userId },
  });

  if (!membership) {
    throw new ApiError(httpStatus.FORBIDDEN, "You do not have access to this team");
  }

  return team;
}

export async function createTeam(userId, payload) {
  const memberIds = [
    ...new Set(
      (payload.member_ids || [])
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0 && id !== userId),
    ),
  ];

  const result = await sequelize.transaction(async (transaction) => {
    const team = await Team.create(
      {
        name: payload.name,
        description: payload.description ?? null,
        created_by: userId,
        created_at: now(),
        updated_at: now(),
      },
      { transaction },
    );

    await TeamMember.create(
      {
        team_id: team.team_id,
        user_id: userId,
        created_at: now(),
        updated_at: now(),
      },
      { transaction },
    );

    for (const memberUserId of memberIds) {
      const targetUser = await Authentication.findByPk(memberUserId, {
        transaction,
      });

      if (!targetUser) {
        throw new ApiError(httpStatus.NOT_FOUND, `User #${memberUserId} not found`);
      }

      await TeamMember.create(
        {
          team_id: team.team_id,
          user_id: memberUserId,
          created_at: now(),
          updated_at: now(),
        },
        { transaction },
      );
    }

    return team;
  });

  return getTeamById(userId, result.team_id);
}

export async function listTeams(userId) {
  const memberships = await TeamMember.findAll({
    where: { user_id: userId },
    attributes: ["team_id"],
  });

  const memberTeamIds = memberships.map((item) => item.team_id);

  const accessFilter = memberTeamIds.length
    ? {
        [Op.or]: [{ created_by: userId }, { team_id: memberTeamIds }],
      }
    : { created_by: userId };

  const teams = await Team.findAll({
    where: accessFilter,
    include: [
      {
        model: Authentication,
        as: "creator",
        attributes: ["user_id", "email", "full_name"],
      },
      {
        model: TeamMember,
        as: "members",
        include: [
          {
            model: Authentication,
            as: "user",
            attributes: ["user_id", "email", "full_name"],
          },
        ],
      },
    ],
    order: [["created_at", "DESC"]],
  });

  return teams.map(toPublicTeam);
}

export async function getTeamById(userId, teamId) {
  await assertTeamAccess(userId, teamId);

  const team = await Team.findByPk(teamId, {
    include: [
      {
        model: Authentication,
        as: "creator",
        attributes: ["user_id", "email", "full_name"],
      },
      {
        model: TeamMember,
        as: "members",
        include: [
          {
            model: Authentication,
            as: "user",
            attributes: ["user_id", "email", "full_name"],
          },
        ],
      },
    ],
  });

  return toPublicTeam(team);
}

export async function updateTeam(userId, teamId, payload) {
  const team = await assertTeamAccess(userId, teamId, { requireCreator: true });

  await team.update({
    ...(payload.name !== undefined ? { name: payload.name } : {}),
    ...(payload.description !== undefined
      ? { description: payload.description }
      : {}),
    updated_at: now(),
  });

  return getTeamById(userId, team.team_id);
}

export async function deleteTeam(userId, teamId) {
  const team = await assertTeamAccess(userId, teamId, { requireCreator: true });

  await sequelize.transaction(async (transaction) => {
    await TeamMember.destroy({
      where: { team_id: teamId },
      transaction,
    });
    await team.destroy({ transaction });
  });

  return { message: "Team deleted" };
}

export async function listTeamMembers(userId, teamId) {
  await assertTeamAccess(userId, teamId);

  const members = await TeamMember.findAll({
    where: { team_id: teamId },
    include: [
      {
        model: Authentication,
        as: "user",
        attributes: ["user_id", "email", "full_name"],
      },
    ],
    order: [["created_at", "ASC"]],
  });

  return members.map(toPublicMember);
}

export async function addTeamMember(userId, teamId, payload) {
  await assertTeamAccess(userId, teamId, { requireCreator: true });

  const targetUser = await Authentication.findByPk(payload.user_id);
  if (!targetUser) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  const existing = await TeamMember.findOne({
    where: { team_id: teamId, user_id: payload.user_id },
  });

  if (existing) {
    throw new ApiError(httpStatus.CONFLICT, "User is already a member of this team");
  }

  const member = await TeamMember.create({
    team_id: teamId,
    user_id: payload.user_id,
    created_at: now(),
    updated_at: now(),
  });

  const fullMember = await TeamMember.findByPk(member.team_member_id, {
    include: [
      {
        model: Authentication,
        as: "user",
        attributes: ["user_id", "email", "full_name"],
      },
    ],
  });

  return toPublicMember(fullMember);
}

export async function getTeamMemberById(userId, teamId, memberId) {
  await assertTeamAccess(userId, teamId);

  const member = await TeamMember.findOne({
    where: { team_member_id: memberId, team_id: teamId },
    include: [
      {
        model: Authentication,
        as: "user",
        attributes: ["user_id", "email", "full_name"],
      },
    ],
  });

  if (!member) {
    throw new ApiError(httpStatus.NOT_FOUND, "Team member not found");
  }

  return toPublicMember(member);
}

export async function updateTeamMember(userId, teamId, memberId, payload) {
  await assertTeamAccess(userId, teamId, { requireCreator: true });

  const member = await TeamMember.findOne({
    where: { team_member_id: memberId, team_id: teamId },
  });

  if (!member) {
    throw new ApiError(httpStatus.NOT_FOUND, "Team member not found");
  }

  if (payload.user_id !== undefined && payload.user_id !== member.user_id) {
    const targetUser = await Authentication.findByPk(payload.user_id);
    if (!targetUser) {
      throw new ApiError(httpStatus.NOT_FOUND, "User not found");
    }

    const duplicate = await TeamMember.findOne({
      where: {
        team_id: teamId,
        user_id: payload.user_id,
        team_member_id: { [Op.ne]: memberId },
      },
    });

    if (duplicate) {
      throw new ApiError(httpStatus.CONFLICT, "User is already a member of this team");
    }

    await member.update({
      user_id: payload.user_id,
      updated_at: now(),
    });
  }

  return getTeamMemberById(userId, teamId, memberId);
}

export async function deleteTeamMember(userId, teamId, memberId) {
  const team = await assertTeamAccess(userId, teamId, { requireCreator: true });

  const member = await TeamMember.findOne({
    where: { team_member_id: memberId, team_id: teamId },
  });

  if (!member) {
    throw new ApiError(httpStatus.NOT_FOUND, "Team member not found");
  }

  if (member.user_id === team.created_by) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Cannot remove the team creator from members",
    );
  }

  await member.destroy();
  return { message: "Team member removed" };
}
