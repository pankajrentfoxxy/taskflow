import * as taskTypeService from "../services/taskTypeService.js";
import { logActivity } from "../services/activityLogService.js";

function logTaskTypeActivity(req, res, overrides = {}) {
  logActivity({
    userId: req.user.user_id,
    req,
    statusCode: res.statusCode,
    ...overrides,
  }).catch(() => {});
}

export const createTaskType = async (req, res) => {
  const taskType = await taskTypeService.createTaskType(
    req.user.user_id,
    req.body,
  );
  res.status(201).json({ taskType });
  logTaskTypeActivity(req, res, {
    action: "task_type.create",
    entityType: "task_type",
    entityId: taskType.task_type_id,
    description: `Created task type "${taskType.name}"`,
    metadata: { name: taskType.name },
  });
};

export const listTaskTypes = async (req, res) => {
  const taskTypes = await taskTypeService.listTaskTypes();
  res.json({ taskTypes });
  logTaskTypeActivity(req, res, {
    action: "task_type.list",
    description: `Listed ${taskTypes.length} task type(s)`,
  });
};

export const getTaskType = async (req, res) => {
  const taskType = await taskTypeService.getTaskTypeById(req.params.taskTypeId);
  res.json({ taskType });
  logTaskTypeActivity(req, res, {
    action: "task_type.view",
    entityType: "task_type",
    entityId: taskType.task_type_id,
    description: `Viewed task type "${taskType.name}"`,
  });
};

export const updateTaskType = async (req, res) => {
  const taskType = await taskTypeService.updateTaskType(
    req.user.user_id,
    req.params.taskTypeId,
    req.body,
  );
  res.json({ taskType });
  logTaskTypeActivity(req, res, {
    action: "task_type.update",
    entityType: "task_type",
    entityId: taskType.task_type_id,
    description: `Updated task type "${taskType.name}"`,
    metadata: req.body,
  });
};

export const deleteTaskType = async (req, res) => {
  const result = await taskTypeService.deleteTaskType(
    req.user.user_id,
    req.params.taskTypeId,
  );
  res.json(result);
  logTaskTypeActivity(req, res, {
    action: "task_type.delete",
    entityType: "task_type",
    entityId: Number(req.params.taskTypeId),
    description: `Deleted task type #${req.params.taskTypeId}`,
  });
};
