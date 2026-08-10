import catchAsync from "../utils/catchAsync.js";
import * as notificationsService from "../services/notificationsService.js";

export const listNotifications = catchAsync(async (req, res) => {
  res.json(await notificationsService.listNotifications(req.user));
});

export const markRead = catchAsync(async (req, res) => {
  res.json(await notificationsService.markNotificationsRead(req.user, req.body));
});

export default { listNotifications, markRead };
