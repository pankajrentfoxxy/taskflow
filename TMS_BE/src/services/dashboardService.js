import { Op } from "sequelize";
import {
  Project,
  ProjectMember,
  Task,
  TaskStatus,
  TaskType,
  Team,
  TeamMember,
  TaskAssignee,
  Comment,
  Authentication,
  Role,
} from "../models/index.js";
import { isSuperAdminUser } from "../utils/userAccess.js";
import { getRoleByName } from "../config/roles.js";

function normalizeStatusName(name) {
  return String(name || "").trim().toLowerCase();
}

function isDoneStatus(statusName) {
  const normalized = normalizeStatusName(statusName);
  return /done|complete|completed|closed|resolved|finished/.test(normalized);
}

function isPendingReviewStatus(statusName) {
  const normalized = normalizeStatusName(statusName);
  return /pending review|in review|review/.test(normalized);
}

function isAwaitingExplanationStatus(statusName) {
  const normalized = normalizeStatusName(statusName);
  return /awaiting explanation|explanation|clarification|needs info/.test(
    normalized,
  );
}

function isEscalatedTask(task) {
  const statusName = normalizeStatusName(task.status?.name);
  if (/escalat/.test(statusName)) {
    return true;
  }

  const priority = normalizeStatusName(task.priority);
  const isHighPriority = priority === "high" || priority === "urgent";
  return isHighPriority && isOverdueTask(task);
}

function isOverdueTask(task) {
  if (isDoneStatus(task.status?.name)) {
    return false;
  }

  return task.due_date != null && Number(task.due_date) < Date.now();
}

function isOpenTask(task) {
  return !isDoneStatus(task.status?.name);
}

function isTodoStatus(statusName) {
  const normalized = normalizeStatusName(statusName);
  return normalized === "todo" || normalized === "to do" || normalized === "to-do";
}

function isDueThisWeek(task) {
  if (!isOpenTask(task) || task.due_date == null) {
    return false;
  }

  const dueDate = new Date(Number(task.due_date));
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(now.getDate() + diffToMonday);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  return dueDate >= weekStart && dueDate < weekEnd;
}

function getPeriodStart(period) {
  const now = Date.now();

  if (period === "week") {
    return now - 7 * 24 * 60 * 60 * 1000;
  }

  if (period === "month") {
    return now - 30 * 24 * 60 * 60 * 1000;
  }

  return null;
}

function taskMatchesPeriod(task, period) {
  if (period === "all" || !period) {
    return true;
  }

  if (period === "this_week") {
    return isDueThisWeek(task) || isOpenTask(task);
  }

  const periodStart = getPeriodStart(period);
  if (periodStart == null) {
    return true;
  }

  return Number(task.created_at) >= periodStart;
}

function taskMatchesTeam(task, teamId, assigneeTeamMap) {
  if (!teamId) {
    return true;
  }

  const parsedTeamId = Number(teamId);
  if (task.type?.team_id === parsedTeamId) {
    return true;
  }

  const assigneeIds = (task.assignees || []).map((assignee) => assignee.user_id);
  return assigneeIds.some((userId) =>
    (assigneeTeamMap.get(userId) || []).includes(parsedTeamId),
  );
}

function getFirstAssigneeResponseMs(task, commentsByTaskId, assigneeIds) {
  const comments = commentsByTaskId.get(task.task_id) || [];
  if (comments.length === 0 || assigneeIds.length === 0) {
    return null;
  }

  const assigneeIdSet = new Set(assigneeIds);
  const firstAssigneeComment = comments.find((comment) =>
    assigneeIdSet.has(comment.user_id),
  );

  if (!firstAssigneeComment) {
    return null;
  }

  return Number(firstAssigneeComment.created_at) - Number(task.created_at);
}

function isOnTimeCompletion(task) {
  if (!isDoneStatus(task.status?.name)) {
    return null;
  }

  const completionTime =
    task.timeline?.end_date ??
    task.timeline?.updated_at ??
    task.updated_at ??
    task.created_at;

  if (task.due_date == null) {
    return true;
  }

  return Number(completionTime) <= Number(task.due_date);
}

function formatMinutes(ms) {
  if (ms == null || ms < 0) {
    return null;
  }

  const minutes = Math.round(ms / 60000);
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function getInitials(name) {
  return String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function getRoleLabel(roleSlug) {
  const configured = getRoleByName(roleSlug);
  return configured?.display_name || roleSlug || "Member";
}

async function getAccessibleProjectIds(userId) {
  if (await isSuperAdminUser(userId)) {
    const projects = await Project.findAll({
      where: { deleted: false },
      attributes: ["project_id"],
    });
    return projects.map((project) => project.project_id);
  }

  const memberships = await ProjectMember.findAll({
    where: { user_id: userId },
    attributes: ["project_id"],
  });

  const memberProjectIds = memberships.map((item) => item.project_id);
  const accessFilter = memberProjectIds.length
    ? {
        [Op.or]: [{ created_by: userId }, { project_id: memberProjectIds }],
      }
    : { created_by: userId };

  const projects = await Project.findAll({
    where: { deleted: false, ...accessFilter },
    attributes: ["project_id"],
  });

  return projects.map((project) => project.project_id);
}

function isDueToday(task) {
  if (!isOpenTask(task) || task.due_date == null) {
    return false;
  }

  const dueDate = new Date(Number(task.due_date));
  const now = new Date();

  return (
    dueDate.getFullYear() === now.getFullYear() &&
    dueDate.getMonth() === now.getMonth() &&
    dueDate.getDate() === now.getDate()
  );
}

function isInProgressStatus(statusName) {
  return /in progress|in-progress/.test(normalizeStatusName(statusName));
}

function isEscalatedSectionTask(task) {
  return (
    isEscalatedTask(task) || isAwaitingExplanationStatus(task.status?.name)
  );
}

function formatDueLabel(task) {
  if (task.due_date == null) {
    return null;
  }

  const dueDate = new Date(Number(task.due_date));
  const formatted = dueDate.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

  if (isOverdueTask(task)) {
    return `Overdue · ${formatted}`;
  }

  return formatted;
}

function toPublicMyTask(task) {
  return {
    task_id: task.task_id,
    project_id: task.project_id,
    project_name: task.project?.name ?? "Project",
    name: task.name,
    priority: task.priority,
    due_date: task.due_date,
    due_label: formatDueLabel(task),
    is_overdue: isOverdueTask(task),
    target: task.target ?? null,
    target_completed: task.target_completed ?? null,
    status: task.status
      ? {
          task_status_id: task.status.task_status_id,
          name: task.status.name,
        }
      : null,
    type: task.type
      ? {
          task_type_id: task.type.task_type_id,
          name: task.type.name,
          alias: task.type.alias,
        }
      : null,
    assignees: (task.assignees || []).map((assignee) => ({
      user_id: assignee.user_id,
      full_name: assignee.full_name,
      email: assignee.email,
      initials: getInitials(assignee.full_name || assignee.email),
    })),
    creator: task.creator
      ? {
          user_id: task.creator.user_id,
          full_name: task.creator.full_name,
        }
      : null,
  };
}

export async function getMyDashboard(userId) {
  const projectIds = await getAccessibleProjectIds(userId);

  if (projectIds.length === 0) {
    return {
      summary: {
        need_response: 0,
        escalated: 0,
        in_progress: 0,
        due_today: 0,
      },
      sections: [],
    };
  }

  const tasks = await Task.findAll({
    where: {
      project_id: projectIds,
      deleted: false,
      parent_task_id: null,
    },
    include: [
      {
        model: TaskStatus,
        as: "status",
        attributes: ["task_status_id", "name"],
      },
      {
        model: TaskType,
        as: "type",
        attributes: ["task_type_id", "name", "alias"],
      },
      {
        model: Authentication,
        as: "assignees",
        attributes: ["user_id", "full_name", "email"],
        through: { attributes: [] },
      },
      {
        model: Authentication,
        as: "creator",
        attributes: ["user_id", "full_name", "email"],
      },
      {
        model: Project,
        as: "project",
        attributes: ["project_id", "name"],
      },
    ],
    order: [["due_date", "ASC"], ["created_at", "DESC"]],
  });

  const myTasks = tasks.filter((task) =>
    (task.assignees || []).some((assignee) => assignee.user_id === userId),
  );

  let needResponse = 0;
  let escalated = 0;
  let inProgress = 0;
  let dueToday = 0;

  const escalatedTasks = [];
  const dueTodayTasks = [];
  const inProgressTasks = [];
  const needResponseTasks = [];

  for (const task of myTasks) {
    const statusName = task.status?.name;
    const taskNeedResponse = isTodoStatus(statusName);
    const taskEscalated = isEscalatedSectionTask(task);
    const taskInProgress = isInProgressStatus(statusName) && isOpenTask(task);
    const taskDueToday = isDueToday(task);

    if (taskNeedResponse) needResponse += 1;
    if (taskEscalated) escalated += 1;
    if (taskInProgress) inProgress += 1;
    if (taskDueToday) dueToday += 1;

    const publicTask = toPublicMyTask(task);

    if (taskEscalated) escalatedTasks.push(publicTask);
    if (taskDueToday) dueTodayTasks.push(publicTask);
    if (taskInProgress) inProgressTasks.push(publicTask);
    if (taskNeedResponse) needResponseTasks.push(publicTask);
  }

  const sections = [
    {
      id: "escalated",
      label: "Escalated · Explanation required",
      count: escalatedTasks.length,
      tasks: escalatedTasks,
    },
    {
      id: "due_today",
      label: "Due today",
      count: dueTodayTasks.length,
      tasks: dueTodayTasks,
    },
    {
      id: "in_progress",
      label: "In progress",
      count: inProgressTasks.length,
      tasks: inProgressTasks,
    },
    {
      id: "need_response",
      label: "Need response",
      count: needResponseTasks.length,
      tasks: needResponseTasks,
    },
  ].filter((section) => section.count > 0);

  return {
    summary: {
      need_response: needResponse,
      escalated,
      in_progress: inProgress,
      due_today: dueToday,
    },
    sections,
  };
}

function createEmptyBucket() {
  return {
    total: 0,
    open: 0,
    overdue: 0,
    no_response: 0,
    done: 0,
    target_completed: 0,
    target: 0,
  };
}

function incrementBucket(bucket, task) {
  bucket.total += 1;

  const open = isOpenTask(task);
  const done = isDoneStatus(task.status?.name);
  const overdue = isOverdueTask(task);
  const needResponse = isTodoStatus(task.status?.name);

  if (open) bucket.open += 1;
  if (done) bucket.done += 1;
  if (overdue) bucket.overdue += 1;
  if (needResponse) bucket.no_response += 1;

  if (task.target != null) {
    bucket.target += Number(task.target) || 0;
  }
  if (task.target_completed != null) {
    bucket.target_completed += Number(task.target_completed) || 0;
  }
}

export async function getDashboardReports(userId, { teamId = null, period = "all" } = {}) {
  const projectIds = await getAccessibleProjectIds(userId);

  if (projectIds.length === 0) {
    return {
      summary: {
        open_tasks: 0,
        overdue: 0,
        no_response: 0,
        awaiting_explanation: 0,
        pending_review: 0,
        due_this_week: 0,
        done: 0,
        on_time_completion_pct: null,
        avg_response_time: null,
        need_attention: 0,
      },
      by_task_type: [],
      by_person: [],
    };
  }

  const tasks = await Task.findAll({
    where: {
      project_id: projectIds,
      deleted: false,
      parent_task_id: null,
    },
    include: [
      {
        model: TaskStatus,
        as: "status",
        attributes: ["task_status_id", "name"],
      },
      {
        model: TaskType,
        as: "type",
        attributes: ["task_type_id", "name", "alias", "team_id"],
        include: [
          {
            model: Team,
            as: "team",
            attributes: ["team_id", "name"],
          },
        ],
      },
      {
        model: Authentication,
        as: "assignees",
        attributes: ["user_id", "full_name", "email"],
        through: { attributes: [] },
        include: [
          {
            model: Role,
            as: "role",
            attributes: ["role_id", "slug"],
          },
        ],
      },
    ],
    order: [["created_at", "DESC"]],
  });

  const taskIds = tasks.map((task) => task.task_id);
  const comments =
    taskIds.length > 0
      ? await Comment.findAll({
          where: { task_id: taskIds },
          attributes: ["comment_id", "task_id", "user_id", "created_at"],
          order: [["created_at", "ASC"]],
        })
      : [];

  const commentsByTaskId = new Map();
  for (const comment of comments) {
    const bucket = commentsByTaskId.get(comment.task_id) || [];
    bucket.push(comment);
    commentsByTaskId.set(comment.task_id, bucket);
  }

  const teamMemberships = await TeamMember.findAll({
    attributes: ["team_id", "user_id"],
    include: [
      {
        model: Team,
        as: "team",
        attributes: ["team_id", "name"],
      },
    ],
  });

  const assigneeTeamMap = new Map();
  const userTeamNameMap = new Map();

  for (const membership of teamMemberships) {
    const userTeams = assigneeTeamMap.get(membership.user_id) || [];
    userTeams.push(membership.team_id);
    assigneeTeamMap.set(membership.user_id, userTeams);

    if (!userTeamNameMap.has(membership.user_id) && membership.team?.name) {
      userTeamNameMap.set(membership.user_id, membership.team.name);
    }
  }

  const filteredTasks = tasks.filter(
    (task) =>
      taskMatchesPeriod(task, period) && taskMatchesTeam(task, teamId, assigneeTeamMap),
  );

  let openTasks = 0;
  let overdue = 0;
  let noResponse = 0;
  let awaitingExplanation = 0;
  let pendingReview = 0;
  let dueThisWeek = 0;
  let done = 0;
  let onTimeDone = 0;
  let onTimeTotal = 0;
  const responseTimes = [];

  const taskTypeBuckets = new Map();
  const personBuckets = new Map();
  const personProfiles = new Map();

  for (const task of filteredTasks) {
    const statusName = task.status?.name;
    const assigneeIds = (task.assignees || []).map((assignee) => assignee.user_id);
    const open = isOpenTask(task);
    const taskDone = isDoneStatus(statusName);
    const taskOverdue = isOverdueTask(task);
    const taskNeedResponse = isTodoStatus(statusName);

    if (open) openTasks += 1;
    if (taskOverdue) overdue += 1;
    if (taskNeedResponse) noResponse += 1;
    if (isAwaitingExplanationStatus(statusName)) awaitingExplanation += 1;
    if (isPendingReviewStatus(statusName)) pendingReview += 1;
    if (isDueThisWeek(task)) dueThisWeek += 1;
    if (taskDone) done += 1;

    const onTime = isOnTimeCompletion(task);
    if (onTime != null) {
      onTimeTotal += 1;
      if (onTime) onTimeDone += 1;
    }

    const responseMs = getFirstAssigneeResponseMs(
      task,
      commentsByTaskId,
      assigneeIds,
    );
    if (responseMs != null) {
      responseTimes.push(responseMs);
    }

    const typeKey = task.task_type_id ?? "untyped";
    if (!taskTypeBuckets.has(typeKey)) {
      taskTypeBuckets.set(typeKey, {
        team_id: task.type?.team?.team_id ?? null,
        team_name: task.type?.team?.name ?? "General",
        task_type_id: task.type?.task_type_id ?? null,
        task_type_name: task.type?.name ?? "Untyped",
        alias: task.type?.alias ?? task.type?.name ?? "Item",
        ...createEmptyBucket(),
      });
    }
    incrementBucket(taskTypeBuckets.get(typeKey), task);

    for (const assignee of task.assignees || []) {
      const userIdKey = assignee.user_id;
      if (!personBuckets.has(userIdKey)) {
        personBuckets.set(userIdKey, {
          ...createEmptyBucket(),
          escalated: 0,
          on_time_done: 0,
          on_time_total: 0,
          response_times: [],
        });
      }

      const personBucket = personBuckets.get(userIdKey);
      personBucket.total += 1;
      if (open) personBucket.open += 1;
      if (taskOverdue) personBucket.overdue += 1;
      if (taskNeedResponse) personBucket.no_response += 1;
      if (taskDone) personBucket.done += 1;
      if (isEscalatedTask(task)) personBucket.escalated += 1;

      if (onTime != null) {
        personBucket.on_time_total += 1;
        if (onTime) personBucket.on_time_done += 1;
      }

      if (responseMs != null) {
        personBucket.response_times.push(responseMs);
      }

      personProfiles.set(userIdKey, {
        user_id: assignee.user_id,
        full_name: assignee.full_name,
        email: assignee.email,
        department:
          userTeamNameMap.get(assignee.user_id) ||
          getRoleLabel(assignee.role?.slug),
        initials: getInitials(assignee.full_name || assignee.email),
      });
    }
  }

  const avgResponseMs =
    responseTimes.length > 0
      ? responseTimes.reduce((sum, value) => sum + value, 0) /
        responseTimes.length
      : null;

  const byTaskType = Array.from(taskTypeBuckets.values())
    .sort((a, b) => {
      const teamCompare = a.team_name.localeCompare(b.team_name);
      if (teamCompare !== 0) return teamCompare;
      return a.task_type_name.localeCompare(b.task_type_name);
    })
    .map((row) => ({
      team_id: row.team_id,
      team_name: row.team_name,
      task_type_id: row.task_type_id,
      task_type_name: row.task_type_name,
      alias: row.alias,
      total: row.total,
      open: row.open,
      overdue: row.overdue,
      no_response: row.no_response,
      done: row.done,
      delivered: {
        completed: row.target_completed,
        target: row.target,
        unit: row.alias,
      },
    }));

  const byPerson = Array.from(personBuckets.entries())
    .map(([userIdKey, bucket]) => {
      const profile = personProfiles.get(userIdKey);
      const personAvgResponseMs =
        bucket.response_times.length > 0
          ? bucket.response_times.reduce((sum, value) => sum + value, 0) /
            bucket.response_times.length
          : null;

      return {
        user_id: userIdKey,
        full_name: profile?.full_name ?? "Unknown",
        email: profile?.email ?? "",
        department: profile?.department ?? "Member",
        initials: profile?.initials ?? "?",
        open: bucket.open,
        overdue: bucket.overdue,
        no_response: bucket.no_response,
        escalated: bucket.escalated,
        done: bucket.done,
        on_time_pct:
          bucket.on_time_total > 0
            ? Math.round((bucket.on_time_done / bucket.on_time_total) * 100)
            : null,
        avg_response_time: formatMinutes(personAvgResponseMs),
      };
    })
    .sort((a, b) => b.open - a.open || a.full_name.localeCompare(b.full_name));

  return {
    summary: {
      open_tasks: openTasks,
      overdue,
      no_response: noResponse,
      awaiting_explanation: awaitingExplanation,
      pending_review: pendingReview,
      due_this_week: dueThisWeek,
      done,
      on_time_completion_pct:
        onTimeTotal > 0 ? Math.round((onTimeDone / onTimeTotal) * 100) : null,
      avg_response_time: formatMinutes(avgResponseMs),
      need_attention: overdue + awaitingExplanation,
    },
    by_task_type: byTaskType,
    by_person: byPerson,
  };
}
