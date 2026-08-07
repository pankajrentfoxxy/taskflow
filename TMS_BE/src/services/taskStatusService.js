import httpStatus from "http-status";
import { TaskStatus, Authentication } from "../models/index.js";
import ApiError from "../utils/ApiError.js";

const now = () => Date.now();

const toPublicTaskStatus = (status) => ({
  task_status_id: status.task_status_id,
  name: status.name,
  created_by: status.created_by,
  created_at: status.created_at,
  updated_at: status.updated_at,
  creator: status.creator
    ? {
        user_id: status.creator.user_id,
        email: status.creator.email,
        full_name: status.creator.full_name,
      }
    : undefined,
});

const creatorInclude = {
  model: Authentication,
  as: "creator",
  attributes: ["user_id", "email", "full_name"],
};

async function getTaskStatusRecord(taskStatusId) {
  const status = await TaskStatus.findByPk(taskStatusId);
  if (!status) {
    throw new ApiError(httpStatus.NOT_FOUND, "Task status not found");
  }
  return status;
}

function assertCreator(userId, status) {
  if (status.created_by !== userId) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Only the creator can perform this action",
    );
  }
}

export async function createTaskStatus(userId, payload) {
  const existing = await TaskStatus.findOne({ where: { name: payload.name } });
  if (existing) {
    throw new ApiError(httpStatus.CONFLICT, "Task status name already exists");
  }

  const status = await TaskStatus.create({
    name: payload.name,
    created_by: userId,
    created_at: now(),
    updated_at: now(),
  });

  return getTaskStatusById(status.task_status_id);
}

export async function listTaskStatuses() {
  const statuses = await TaskStatus.findAll({
    include: [creatorInclude],
    order: [["task_status_id", "ASC"]],
  });

  return statuses.map(toPublicTaskStatus);
}

export async function getTaskStatusById(taskStatusId) {
  const status = await TaskStatus.findByPk(taskStatusId, {
    include: [creatorInclude],
  });

  if (!status) {
    throw new ApiError(httpStatus.NOT_FOUND, "Task status not found");
  }

  return toPublicTaskStatus(status);
}

export async function updateTaskStatus(userId, taskStatusId, payload) {
  const status = await getTaskStatusRecord(taskStatusId);
  assertCreator(userId, status);

  if (payload.name && payload.name !== status.name) {
    const duplicate = await TaskStatus.findOne({ where: { name: payload.name } });
    if (duplicate) {
      throw new ApiError(httpStatus.CONFLICT, "Task status name already exists");
    }
  }

  await status.update({
    ...(payload.name !== undefined ? { name: payload.name } : {}),
    updated_at: now(),
  });

  return getTaskStatusById(taskStatusId);
}

export async function deleteTaskStatus(userId, taskStatusId) {
  const status = await getTaskStatusRecord(taskStatusId);
  assertCreator(userId, status);

  await status.destroy();
  return { message: "Task status deleted" };
}
