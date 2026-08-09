import httpStatus from "http-status";
import { Op, QueryTypes } from "sequelize";
import {
  Task,
  TaskAssignee,
  TaskStatus,
  TaskType,
  Authentication,
  ProjectMember,
  Project,
  Comment,
  ActivityLog,
} from "../models/index.js";
import * as projectService from "./projectService.js";
import ApiError from "../utils/ApiError.js";
import {
  buildTimelinePayload,
  isValidTimelineRange,
  normalizeTimelineValue,
  EMPTY_TIMELINE,
} from "../utils/taskTimeline.js";

const now = () => Date.now();

const creatorInclude = {
  model: Authentication,
  as: "creator",
  attributes: ["user_id", "email", "full_name"],
};

const assigneesInclude = {
  model: Authentication,
  as: "assignees",
  attributes: ["user_id", "email", "full_name"],
  through: { attributes: [] },
};

const statusInclude = {
  model: TaskStatus,
  as: "status",
  attributes: ["task_status_id", "name"],
};

const typeInclude = {
  model: TaskType,
  as: "type",
  attributes: ["task_type_id", "name", "description", "team_id", "alias"],
};

function mapPublicAssignees(assignees = []) {
  return assignees.map((assignee) => ({
    user_id: assignee.user_id,
    email: assignee.email,
    full_name: assignee.full_name,
  }));
}

const toPublicTask = (task, { includeNestedSubtasks = true } = {}) => ({
  task_id: task.task_id,
  project_id: task.project_id,
  task_status_id: task.task_status_id,
  task_type_id: task.task_type_id,
  parent_task_id: task.parent_task_id,
  name: task.name,
  description: task.description,
  assignee_ids: mapPublicAssignees(task.assignees).map(
    (assignee) => assignee.user_id,
  ),
  due_date: task.due_date,
  priority: task.priority,
  target: task.target ?? null,
  target_completed: task.target_completed ?? null,
  timeline: normalizeTimelineValue(task.timeline),
  scribble: task.scribble ?? null,
  created_by: task.created_by,
  created_at: task.created_at,
  updated_at: task.updated_at,
  status: task.status
    ? {
        task_status_id: task.status.task_status_id,
        name: task.status.name,
      }
    : undefined,
  type: task.type
    ? {
        task_type_id: task.type.task_type_id,
        name: task.type.name,
        description: task.type.description,
        team_id: task.type.team_id,
        alias: task.type.alias,
      }
    : undefined,
  assignees: mapPublicAssignees(task.assignees),
  creator: task.creator
    ? {
        user_id: task.creator.user_id,
        email: task.creator.email,
        full_name: task.creator.full_name,
      }
    : undefined,
  subtasks:
    includeNestedSubtasks && task.subtasks
      ? task.subtasks.map((subtask) =>
          toPublicTask(subtask, { includeNestedSubtasks: false }),
        )
      : undefined,
  comment_count: Number(
    task.getDataValue?.("comment_count") ?? task.comment_count ?? 0,
  ),
});

const defaultIncludes = [
  statusInclude,
  typeInclude,
  assigneesInclude,
  creatorInclude,
];

function normalizeScribblePayload(scribble) {
  if (scribble == null) {
    return null;
  }

  const elements = Array.isArray(scribble.elements) ? scribble.elements : [];
  if (elements.length === 0) {
    return null;
  }

  return {
    elements,
    appState: scribble.appState ?? { viewBackgroundColor: "#ffffff" },
    files: scribble.files ?? {},
  };
}

function normalizeAssigneeIds(assigneeIds) {
  if (assigneeIds == null) {
    return [];
  }

  return [...new Set(assigneeIds.map(Number).filter(Boolean))];
}

async function attachSubtasks(tasks) {
  if (!tasks.length) {
    return;
  }

  const parentTaskIds = tasks.map((task) => task.task_id);
  const subtasks = await Task.findAll({
    where: { parent_task_id: parentTaskIds, deleted: false },
    include: defaultIncludes,
    order: [["created_at", "ASC"]],
  });

  const subtasksByParentId = new Map();
  for (const subtask of subtasks) {
    const siblings = subtasksByParentId.get(subtask.parent_task_id) ?? [];
    siblings.push(subtask);
    subtasksByParentId.set(subtask.parent_task_id, siblings);
  }

  for (const task of tasks) {
    task.setDataValue("subtasks", subtasksByParentId.get(task.task_id) ?? []);
  }
}

async function attachCommentCounts(tasks) {
  if (!tasks.length) {
    return;
  }

  const taskIds = [
    ...new Set(tasks.map((task) => Number(task.task_id)).filter(Boolean)),
  ];

  if (!taskIds.length) {
    return;
  }

  const rows = await Comment.sequelize.query(
    `SELECT task_id, COUNT(*)::int AS count
     FROM comments
     WHERE task_id IN (:taskIds)
     GROUP BY task_id`,
    {
      replacements: { taskIds },
      type: QueryTypes.SELECT,
    },
  );

  const countByTaskId = new Map(
    rows.map((row) => [Number(row.task_id), Number(row.count)]),
  );

  for (const task of tasks) {
    task.setDataValue(
      "comment_count",
      countByTaskId.get(Number(task.task_id)) ?? 0,
    );
  }
}

function collectTasksWithSubtasks(tasks, includeSubtasks) {
  if (!includeSubtasks) {
    return tasks;
  }

  const collected = [...tasks];
  for (const task of tasks) {
    collected.push(...(task.getDataValue("subtasks") ?? []));
  }
  return collected;
}

async function getTaskRecord(taskId, projectId) {
  const task = await Task.findOne({
    where: { task_id: taskId, project_id: projectId, deleted: false },
  });

  if (!task) {
    throw new ApiError(httpStatus.NOT_FOUND, "Task not found");
  }

  return task;
}

async function getTaskAssigneeIds(taskId) {
  const rows = await TaskAssignee.findAll({
    where: { task_id: taskId },
    attributes: ["user_id"],
    order: [["user_id", "ASC"]],
  });

  return rows.map((row) => row.user_id);
}

async function replaceTaskAssignees(taskId, assigneeIds, createdBy) {
  const uniqueAssigneeIds = normalizeAssigneeIds(assigneeIds);
  const timestamp = now();

  await TaskAssignee.destroy({ where: { task_id: taskId } });

  if (uniqueAssigneeIds.length === 0) {
    return [];
  }

  await TaskAssignee.bulkCreate(
    uniqueAssigneeIds.map((userId) => ({
      task_id: taskId,
      user_id: userId,
      created_by: createdBy,
      created_at: timestamp,
      updated_at: timestamp,
    })),
  );

  return uniqueAssigneeIds;
}

async function assertTaskStatusExists(taskStatusId) {
  const status = await TaskStatus.findByPk(taskStatusId);
  if (!status) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Task status not found");
  }
  return status;
}

async function assertTaskTypeExists(taskTypeId) {
  if (taskTypeId == null) {
    return;
  }

  const taskType = await TaskType.findByPk(taskTypeId);
  if (!taskType) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Task type not found");
  }
  return taskType;
}

async function assertAssigneeInProject(projectId, assigneeId) {
  if (assigneeId == null) {
    return;
  }

  const project = await Project.findOne({
    where: { project_id: projectId, deleted: false },
  });
  if (!project) {
    throw new ApiError(httpStatus.NOT_FOUND, "Project not found");
  }

  if (project.created_by === assigneeId) {
    return;
  }

  const membership = await ProjectMember.findOne({
    where: { project_id: projectId, user_id: assigneeId },
  });

  if (!membership) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Assignee must be a member of this project",
    );
  }
}

async function assertAssigneesInProject(projectId, assigneeIds) {
  const uniqueAssigneeIds = normalizeAssigneeIds(assigneeIds);
  for (const assigneeId of uniqueAssigneeIds) {
    await assertAssigneeInProject(projectId, assigneeId);
  }
}

async function assertParentTask(projectId, parentTaskId, { taskId = null } = {}) {
  if (parentTaskId == null) {
    return null;
  }

  if (taskId != null && Number(parentTaskId) === Number(taskId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "A task cannot be its own parent");
  }

  const parentTask = await Task.findOne({
    where: { task_id: parentTaskId, project_id: projectId, deleted: false },
  });

  if (!parentTask) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Parent task not found in this project");
  }

  if (parentTask.parent_task_id != null) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Subtasks can only be added to top-level tasks",
    );
  }

  if (taskId != null) {
    const childCount = await Task.count({
      where: { parent_task_id: taskId, deleted: false },
    });

    if (childCount > 0) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Tasks with subtasks cannot be moved under another task",
      );
    }
  }

  return parentTask;
}

function assertTimelinePayload(timeline) {
  if (timeline === undefined) {
    return;
  }

  if (!isValidTimelineRange(timeline)) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Timeline start date must be before or equal to end date",
    );
  }
}

function buildTaskWhere(projectId, options = {}) {
  const where = { project_id: projectId, deleted: false };

  if (options.parent_task_id !== undefined) {
    where.parent_task_id =
      options.parent_task_id === null || options.parent_task_id === "null"
        ? null
        : Number(options.parent_task_id);
  } else {
    where.parent_task_id = null;
  }

  return where;
}

export async function createTask(userId, projectId, payload) {
  await projectService.getProjectById(userId, projectId);
  await assertTaskStatusExists(payload.task_status_id);
  await assertTaskTypeExists(payload.task_type_id ?? null);
  await assertAssigneesInProject(projectId, payload.assignee_ids ?? []);
  await assertParentTask(projectId, payload.parent_task_id ?? null);

  const timestamp = now();
  const assigneeIds = normalizeAssigneeIds(payload.assignee_ids ?? []);
  assertTimelinePayload(payload.timeline);

  const timeline =
    payload.timeline !== undefined
      ? buildTimelinePayload(payload.timeline, userId, timestamp)
      : buildTimelinePayload(EMPTY_TIMELINE, userId, timestamp);

  const task = await Task.create({
    project_id: projectId,
    task_status_id: payload.task_status_id,
    task_type_id: payload.task_type_id ?? null,
    parent_task_id: payload.parent_task_id ?? null,
    name: payload.name,
    description: payload.description ?? null,
    due_date: payload.due_date ?? null,
    priority: payload.priority ?? "medium",
    target: payload.target ?? null,
    target_completed: payload.target_completed ?? null,
    timeline,
    created_by: userId,
    created_at: timestamp,
    updated_at: timestamp,
  });

  await replaceTaskAssignees(task.task_id, assigneeIds, userId);

  return getTaskById(userId, projectId, task.task_id);
}

export async function listTasks(userId, projectId, options = {}) {
  await projectService.getProjectById(userId, projectId);

  const limit = Math.min(Math.max(Number(options.limit) || 200, 1), 200);
  const order = options.order === "desc" ? "DESC" : "ASC";
  const includeSubtasks =
    options.include_subtasks === true ||
    options.include_subtasks === "true";

  const where = buildTaskWhere(projectId, options);

  const tasks = await Task.findAll({
    where,
    include: defaultIncludes,
    order: [["created_at", order]],
    limit,
  });

  if (includeSubtasks) {
    await attachSubtasks(tasks);
  }

  await attachCommentCounts(collectTasksWithSubtasks(tasks, includeSubtasks));

  return tasks.map((task) => toPublicTask(task, { includeNestedSubtasks: true }));
}

export async function listSubtasks(userId, projectId, parentTaskId, options = {}) {
  await getTaskRecord(parentTaskId, projectId);

  return listTasks(userId, projectId, {
    ...options,
    parent_task_id: parentTaskId,
    include_subtasks: false,
  });
}

export async function createSubtask(userId, projectId, parentTaskId, payload) {
  return createTask(userId, projectId, {
    ...payload,
    parent_task_id: parentTaskId,
  });
}

export async function getTaskById(userId, projectId, taskId) {
  await projectService.getProjectById(userId, projectId);

  const task = await Task.findOne({
    where: { task_id: taskId, project_id: projectId, deleted: false },
    include: defaultIncludes,
  });

  if (!task) {
    throw new ApiError(httpStatus.NOT_FOUND, "Task not found");
  }

  await attachSubtasks([task]);
  await attachCommentCounts(collectTasksWithSubtasks([task], true));

  return toPublicTask(task, { includeNestedSubtasks: true });
}

export async function updateTask(userId, projectId, taskId, payload) {
  await projectService.getProjectById(userId, projectId);
  const task = await getTaskRecord(taskId, projectId);

  if (payload.task_status_id !== undefined) {
    await assertTaskStatusExists(payload.task_status_id);
  }

  if (payload.task_type_id !== undefined) {
    await assertTaskTypeExists(payload.task_type_id);
  }

  if (payload.assignee_ids !== undefined) {
    await assertAssigneesInProject(projectId, payload.assignee_ids);
  }

  if (payload.parent_task_id !== undefined) {
    await assertParentTask(projectId, payload.parent_task_id, { taskId });
  }

  if (payload.timeline !== undefined) {
    assertTimelinePayload(payload.timeline);
  }

  await task.update({
    ...(payload.name !== undefined ? { name: payload.name } : {}),
    ...(payload.description !== undefined
      ? { description: payload.description }
      : {}),
    ...(payload.task_status_id !== undefined
      ? { task_status_id: payload.task_status_id }
      : {}),
    ...(payload.task_type_id !== undefined
      ? { task_type_id: payload.task_type_id }
      : {}),
    ...(payload.parent_task_id !== undefined
      ? { parent_task_id: payload.parent_task_id }
      : {}),
    ...(payload.due_date !== undefined ? { due_date: payload.due_date } : {}),
    ...(payload.priority !== undefined ? { priority: payload.priority } : {}),
    ...(payload.target !== undefined ? { target: payload.target } : {}),
    ...(payload.target_completed !== undefined
      ? { target_completed: payload.target_completed }
      : {}),
    ...(payload.timeline !== undefined
      ? { timeline: buildTimelinePayload(payload.timeline, userId) }
      : {}),
    ...(payload.scribble !== undefined
      ? { scribble: normalizeScribblePayload(payload.scribble) }
      : {}),
    updated_at: now(),
  });

  if (payload.assignee_ids !== undefined) {
    await replaceTaskAssignees(task.task_id, payload.assignee_ids, userId);
  }

  return getTaskById(userId, projectId, taskId);
}

export async function deleteTask(userId, projectId, taskId) {
  await projectService.getProjectById(userId, projectId);
  const task = await getTaskRecord(taskId, projectId);

  await task.update({ deleted: true, updated_at: now() });
  return { message: "Task deleted" };
}

const activityUserInclude = {
  model: Authentication,
  as: "user",
  attributes: ["user_id", "email", "full_name"],
};

function toPublicActivityUser(user) {
  if (!user) return null;
  return {
    user_id: user.user_id,
    email: user.email,
    full_name: user.full_name,
  };
}

export async function listTaskActivity(userId, projectId, taskId) {
  await projectService.getProjectById(userId, projectId);
  await getTaskRecord(taskId, projectId);

  const logs = await ActivityLog.findAll({
    where: {
      task_id: taskId,
      action: {
        [Op.notIn]: [
          "task.list",
          "task.view",
          "subtask.list",
          "comment.list",
          "comment.view",
        ],
      },
    },
    include: [activityUserInclude],
    order: [["created_at", "DESC"]],
    limit: 50,
  });

  return logs.map((log) => ({
    activity_id: `log-${log.activity_log_id}`,
    type: log.action?.startsWith("comment.") ? "comment" : "log",
    action: log.action,
    description: log.description,
    created_at: log.created_at,
    user: toPublicActivityUser(log.user),
  }));
}
