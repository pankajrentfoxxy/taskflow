import * as taskStatusService from "../services/taskStatusService.js";
import { logActivity } from "../services/activityLogService.js";

function logTaskStatusActivity(req, res, overrides = {}) {
  logActivity({
    userId: req.user.user_id,
    req,
    statusCode: res.statusCode,
    ...overrides,
  }).catch(() => {});
}

export const createTaskStatus = async (req, res) => {
  const taskStatus = await taskStatusService.createTaskStatus(
    req.user.user_id,
    req.body,
  );
  res.status(201).json({ taskStatus });
  logTaskStatusActivity(req, res, {
    action: "task_status.create",
    entityType: "task_status",
    entityId: taskStatus.task_status_id,
    description: `Created task status "${taskStatus.name}"`,
    metadata: { name: taskStatus.name },
  });
};

export const listTaskStatuses = async (req, res) => {
  const taskStatuses = await taskStatusService.listTaskStatuses();
  res.json({ taskStatuses });
  logTaskStatusActivity(req, res, {
    action: "task_status.list",
    description: `Listed ${taskStatuses.length} task status(es)`,
  });
};

export const getTaskStatus = async (req, res) => {
  const taskStatus = await taskStatusService.getTaskStatusById(
    req.params.taskStatusId,
  );
  res.json({ taskStatus });
  logTaskStatusActivity(req, res, {
    action: "task_status.view",
    entityType: "task_status",
    entityId: taskStatus.task_status_id,
    description: `Viewed task status "${taskStatus.name}"`,
  });
};

export const updateTaskStatus = async (req, res) => {
  const taskStatus = await taskStatusService.updateTaskStatus(
    req.user.user_id,
    req.params.taskStatusId,
    req.body,
  );
  res.json({ taskStatus });
  logTaskStatusActivity(req, res, {
    action: "task_status.update",
    entityType: "task_status",
    entityId: taskStatus.task_status_id,
    description: `Updated task status "${taskStatus.name}"`,
    metadata: req.body,
  });
};

export const deleteTaskStatus = async (req, res) => {
  const result = await taskStatusService.deleteTaskStatus(
    req.user.user_id,
    req.params.taskStatusId,
  );
  res.json(result);
  logTaskStatusActivity(req, res, {
    action: "task_status.delete",
    entityType: "task_status",
    entityId: Number(req.params.taskStatusId),
    description: `Deleted task status #${req.params.taskStatusId}`,
  });
};
