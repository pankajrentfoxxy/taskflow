import httpStatus from "http-status";
import { TaskType, Task, Authentication } from "../models/index.js";
import ApiError from "../utils/ApiError.js";

const now = () => Date.now();

const toPublicTaskType = (taskType) => ({
  task_type_id: taskType.task_type_id,
  name: taskType.name,
  description: taskType.description,
  created_by: taskType.created_by,
  created_at: taskType.created_at,
  updated_at: taskType.updated_at,
  creator: taskType.creator
    ? {
        user_id: taskType.creator.user_id,
        email: taskType.creator.email,
        full_name: taskType.creator.full_name,
      }
    : undefined,
});

const creatorInclude = {
  model: Authentication,
  as: "creator",
  attributes: ["user_id", "email", "full_name"],
};

async function getTaskTypeRecord(taskTypeId) {
  const taskType = await TaskType.findByPk(taskTypeId);
  if (!taskType) {
    throw new ApiError(httpStatus.NOT_FOUND, "Task type not found");
  }
  return taskType;
}

function assertCreator(userId, taskType) {
  if (taskType.created_by !== userId) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Only the creator can perform this action",
    );
  }
}

export async function createTaskType(userId, payload) {
  const existing = await TaskType.findOne({ where: { name: payload.name } });
  if (existing) {
    throw new ApiError(httpStatus.CONFLICT, "Task type name already exists");
  }

  const taskType = await TaskType.create({
    name: payload.name,
    description: payload.description ?? null,
    created_by: userId,
    created_at: now(),
    updated_at: now(),
  });

  return getTaskTypeById(taskType.task_type_id);
}

export async function listTaskTypes() {
  const taskTypes = await TaskType.findAll({
    include: [creatorInclude],
    order: [["task_type_id", "ASC"]],
  });

  return taskTypes.map(toPublicTaskType);
}

export async function getTaskTypeById(taskTypeId) {
  const taskType = await TaskType.findByPk(taskTypeId, {
    include: [creatorInclude],
  });

  if (!taskType) {
    throw new ApiError(httpStatus.NOT_FOUND, "Task type not found");
  }

  return toPublicTaskType(taskType);
}

export async function updateTaskType(userId, taskTypeId, payload) {
  const taskType = await getTaskTypeRecord(taskTypeId);
  assertCreator(userId, taskType);

  if (payload.name && payload.name !== taskType.name) {
    const duplicate = await TaskType.findOne({ where: { name: payload.name } });
    if (duplicate) {
      throw new ApiError(httpStatus.CONFLICT, "Task type name already exists");
    }
  }

  await taskType.update({
    ...(payload.name !== undefined ? { name: payload.name } : {}),
    ...(payload.description !== undefined
      ? { description: payload.description }
      : {}),
    updated_at: now(),
  });

  return getTaskTypeById(taskTypeId);
}

export async function deleteTaskType(userId, taskTypeId) {
  const taskType = await getTaskTypeRecord(taskTypeId);
  assertCreator(userId, taskType);

  const linkedTasks = await Task.count({ where: { task_type_id: taskTypeId } });
  if (linkedTasks > 0) {
    throw new ApiError(
      httpStatus.CONFLICT,
      "Cannot delete task type while tasks are linked to it",
    );
  }

  await taskType.destroy();
  return { message: "Task type deleted" };
}
