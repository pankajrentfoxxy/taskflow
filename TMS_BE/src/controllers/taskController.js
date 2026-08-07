import * as taskService from "../services/taskService.js";
import { logActivity } from "../services/activityLogService.js";

function logTaskActivity(req, res, overrides = {}) {
  logActivity({
    userId: req.user.user_id,
    req,
    statusCode: res.statusCode,
    ...overrides,
  }).catch(() => {});
}

export const createTask = async (req, res) => {
  const task = await taskService.createTask(
    req.user.user_id,
    req.params.projectId,
    req.body,
  );
  res.status(201).json({ task });
  logTaskActivity(req, res, {
    action: task.parent_task_id ? "subtask.create" : "task.create",
    entityType: "task",
    entityId: task.task_id,
    taskId: task.parent_task_id ?? task.task_id,
    description: task.parent_task_id
      ? `Created subtask "${task.name}" under task #${task.parent_task_id}`
      : `Created task "${task.name}" in project #${req.params.projectId}`,
    metadata: {
      project_id: Number(req.params.projectId),
      parent_task_id: task.parent_task_id,
      name: task.name,
      task_status_id: task.task_status_id,
      task_type_id: task.task_type_id,
      assignee_ids: task.assignee_ids,
      priority: task.priority,
      due_date: task.due_date,
    },
  });
};

export const listTasks = async (req, res) => {
  const tasks = await taskService.listTasks(
    req.user.user_id,
    req.params.projectId,
    req.query,
  );
  res.json({ tasks });
  logTaskActivity(req, res, {
    action: "task.list",
    entityType: "project",
    entityId: Number(req.params.projectId),
    description: `Listed ${tasks.length} task(s) for project #${req.params.projectId}`,
  });
};

export const listSubtasks = async (req, res) => {
  const subtasks = await taskService.listSubtasks(
    req.user.user_id,
    req.params.projectId,
    req.params.taskId,
    req.query,
  );
  res.json({ subtasks });
  logTaskActivity(req, res, {
    action: "subtask.list",
    entityType: "task",
    entityId: Number(req.params.taskId),
    description: `Listed ${subtasks.length} subtask(s) for task #${req.params.taskId}`,
  });
};

export const createSubtask = async (req, res) => {
  const task = await taskService.createSubtask(
    req.user.user_id,
    req.params.projectId,
    req.params.taskId,
    req.body,
  );
  res.status(201).json({ task });
  logTaskActivity(req, res, {
    action: "subtask.create",
    entityType: "task",
    entityId: task.task_id,
    taskId: Number(req.params.taskId),
    description: `Created subtask "${task.name}" under task #${req.params.taskId}`,
    metadata: {
      project_id: Number(req.params.projectId),
      parent_task_id: task.parent_task_id,
      name: task.name,
    },
  });
};

export const getTask = async (req, res) => {
  const task = await taskService.getTaskById(
    req.user.user_id,
    req.params.projectId,
    req.params.taskId,
  );
  res.json({ task });
  logTaskActivity(req, res, {
    action: "task.view",
    entityType: "task",
    entityId: task.task_id,
    description: `Viewed task "${task.name}"`,
  });
};

export const updateTask = async (req, res) => {
  const task = await taskService.updateTask(
    req.user.user_id,
    req.params.projectId,
    req.params.taskId,
    req.body,
  );
  res.json({ task });
  logTaskActivity(req, res, {
    action: "task.update",
    entityType: "task",
    entityId: task.task_id,
    taskId: task.task_id,
    description: `Updated task "${task.name}"`,
    metadata: req.body,
  });
};

export const deleteTask = async (req, res) => {
  const result = await taskService.deleteTask(
    req.user.user_id,
    req.params.projectId,
    req.params.taskId,
  );
  res.json(result);
  logTaskActivity(req, res, {
    action: "task.delete",
    entityType: "task",
    entityId: Number(req.params.taskId),
    taskId: Number(req.params.taskId),
    description: `Deleted task #${req.params.taskId} from project #${req.params.projectId}`,
    metadata: { project_id: Number(req.params.projectId) },
  });
};

export const getTaskActivity = async (req, res) => {
  const activities = await taskService.listTaskActivity(
    req.user.user_id,
    req.params.projectId,
    req.params.taskId,
  );
  res.json({ activities });
};
