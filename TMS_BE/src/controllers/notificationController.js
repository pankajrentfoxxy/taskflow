import * as notificationService from "../services/notificationService.js";

export const listNotifications = async (req, res) => {
  const result = await notificationService.listNotifications(req.user.user_id, {
    limit: req.query.limit,
    offset: req.query.offset,
    unreadOnly: req.query.unread_only === "true",
  });
  res.json(result);
};

export const getUnreadCount = async (req, res) => {
  const result = await notificationService.getUnreadCount(req.user.user_id);
  res.json(result);
};

export const markNotificationRead = async (req, res) => {
  const notification = await notificationService.markNotificationRead(
    req.user.user_id,
    req.params.notificationId,
  );
  res.json({ notification });
};

export const markAllNotificationsRead = async (req, res) => {
  const result = await notificationService.markAllNotificationsRead(
    req.user.user_id,
  );
  res.json(result);
};
