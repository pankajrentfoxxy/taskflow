import { Router } from "express";
import Joi from "joi";
import validate from "../middlewares/validate.js";
import { auth } from "../middlewares/auth.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "../controllers/notificationController.js";

const router = Router();

const notificationIdParam = Joi.object({
  notificationId: Joi.number().integer().positive().required(),
});

const listNotificationsSchema = {
  query: Joi.object({
    limit: Joi.number().integer().min(1).max(100).optional(),
    offset: Joi.number().integer().min(0).optional(),
    unread_only: Joi.string().valid("true", "false").optional(),
  }),
};

router.get("/", auth(), validate(listNotificationsSchema), asyncHandler(listNotifications));
router.get("/unread-count", auth(), asyncHandler(getUnreadCount));
router.patch(
  "/read-all",
  auth(),
  asyncHandler(markAllNotificationsRead),
);
router.patch(
  "/:notificationId/read",
  auth(),
  validate({ params: notificationIdParam }),
  asyncHandler(markNotificationRead),
);

export default router;
