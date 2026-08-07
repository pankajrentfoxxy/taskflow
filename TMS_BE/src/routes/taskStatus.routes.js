import { Router } from "express";
import Joi from "joi";
import validate from "../middlewares/validate.js";
import { auth } from "../middlewares/auth.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  createTaskStatus,
  listTaskStatuses,
  getTaskStatus,
  updateTaskStatus,
  deleteTaskStatus,
} from "../controllers/taskStatusController.js";

const router = Router();

const taskStatusIdParam = Joi.object({
  taskStatusId: Joi.number().integer().positive().required(),
});

const createTaskStatusSchema = {
  body: Joi.object({
    name: Joi.string().trim().min(1).max(100).required(),
  }),
};

const updateTaskStatusSchema = {
  params: taskStatusIdParam,
  body: Joi.object({
    name: Joi.string().trim().min(1).max(100).required(),
  }),
};

router.get("/", auth(), asyncHandler(listTaskStatuses));
router.post(
  "/",
  auth(),
  validate(createTaskStatusSchema),
  asyncHandler(createTaskStatus),
);
router.get(
  "/:taskStatusId",
  auth(),
  validate({ params: taskStatusIdParam }),
  asyncHandler(getTaskStatus),
);
router.patch(
  "/:taskStatusId",
  auth(),
  validate(updateTaskStatusSchema),
  asyncHandler(updateTaskStatus),
);
router.delete(
  "/:taskStatusId",
  auth(),
  validate({ params: taskStatusIdParam }),
  asyncHandler(deleteTaskStatus),
);

export default router;
