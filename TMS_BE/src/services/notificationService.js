import httpStatus from "http-status";
import { Op } from "sequelize";
import { Notification, Authentication, Task } from "../models/index.js";
import ApiError from "../utils/ApiError.js";
import { getIo, getUserRoom } from "../config/socket.js";

const now = () => Date.now();

const actorInclude = {
  model: Authentication,
  as: "actor",
  attributes: ["user_id", "email", "full_name"],
};

const taskInclude = {
  model: Task,
  as: "task",
  attributes: ["task_id", "name", "project_id"],
};

const toPublicNotification = (notification) => ({
  notification_id: notification.notification_id,
  recipient_user_id: notification.recipient_user_id,
  actor_user_id: notification.actor_user_id,
  type: notification.type,
  title: notification.title,
  message: notification.message,
  task_id: notification.task_id,
  project_id: notification.project_id,
  metadata: notification.metadata ?? null,
  is_read: notification.is_read,
  read_at: notification.read_at,
  created_at: notification.created_at,
  actor: notification.actor
    ? {
        user_id: notification.actor.user_id,
        email: notification.actor.email,
        full_name: notification.actor.full_name,
      }
    : undefined,
  task: notification.task
    ? {
        task_id: notification.task.task_id,
        name: notification.task.name,
        project_id: notification.task.project_id,
      }
    : undefined,
});

function emitNotification(recipientUserId, notification) {
  const io = getIo();
  if (!io) return;

  io.to(getUserRoom(recipientUserId)).emit("notification:new", notification);
}

export async function createNotification(payload) {
  const notification = await Notification.create({
    recipient_user_id: payload.recipientUserId,
    actor_user_id: payload.actorUserId ?? null,
    type: payload.type,
    title: payload.title,
    message: payload.message ?? null,
    task_id: payload.taskId ?? null,
    project_id: payload.projectId ?? null,
    metadata: payload.metadata ?? null,
    is_read: false,
    read_at: null,
    created_at: now(),
  });

  const fullNotification = await Notification.findByPk(
    notification.notification_id,
    {
      include: [actorInclude, taskInclude],
    },
  );

  const publicNotification = toPublicNotification(fullNotification);
  emitNotification(payload.recipientUserId, publicNotification);
  return publicNotification;
}

export async function createNotifications(payloads) {
  const results = [];
  for (const payload of payloads) {
    if (Number(payload.recipientUserId) === Number(payload.actorUserId)) {
      continue;
    }
    results.push(await createNotification(payload));
  }
  return results;
}

export async function listNotifications(
  userId,
  { limit = 20, offset = 0, unreadOnly = false } = {},
) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  const where = {
    recipient_user_id: userId,
    ...(unreadOnly ? { is_read: false } : {}),
  };

  const { rows, count } = await Notification.findAndCountAll({
    where,
    include: [actorInclude, taskInclude],
    order: [["created_at", "DESC"]],
    limit: safeLimit,
    offset: safeOffset,
  });

  return {
    notifications: rows.map(toPublicNotification),
    total: count,
    limit: safeLimit,
    offset: safeOffset,
  };
}

export async function getUnreadCount(userId) {
  const count = await Notification.count({
    where: {
      recipient_user_id: userId,
      is_read: false,
    },
  });

  return { unread_count: count };
}

export async function markNotificationRead(userId, notificationId) {
  const notification = await Notification.findOne({
    where: {
      notification_id: notificationId,
      recipient_user_id: userId,
    },
    include: [actorInclude, taskInclude],
  });

  if (!notification) {
    throw new ApiError(httpStatus.NOT_FOUND, "Notification not found");
  }

  if (!notification.is_read) {
    await notification.update({
      is_read: true,
      read_at: now(),
    });
    await notification.reload({ include: [actorInclude, taskInclude] });
  }

  return toPublicNotification(notification);
}

export async function markAllNotificationsRead(userId) {
  const [updatedCount] = await Notification.update(
    {
      is_read: true,
      read_at: now(),
    },
    {
      where: {
        recipient_user_id: userId,
        is_read: false,
      },
    },
  );

  return { updated_count: updatedCount };
}
