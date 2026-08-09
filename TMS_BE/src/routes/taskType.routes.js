import { Router } from "express";
import Joi from "joi";
import validate from "../middlewares/validate.js";
import { auth } from "../middlewares/auth.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  createTaskType,
  listTaskTypes,
  getTaskType,
  updateTaskType,
  deleteTaskType,
} from "../controllers/taskTypeController.js";

const router = Router();

const taskTypeIdParam = Joi.object({
  taskTypeId: Joi.number().integer().positive().required(),
});

const createTaskTypeSchema = {
  body: Joi.object({
    name: Joi.string().trim().min(1).max(100).required(),
    description: Joi.string().allow("", null),
    team_id: Joi.number().integer().positive().allow(null),
    alias: Joi.string().trim().max(100).allow("", null),
  }),
};

const updateTaskTypeSchema = {
  params: taskTypeIdParam,
  body: Joi.object({
    name: Joi.string().trim().min(1).max(100).optional(),
    description: Joi.string().allow("", null),
    team_id: Joi.number().integer().positive().allow(null),
    alias: Joi.string().trim().max(100).allow("", null),
  }).min(1),
};

router.get("/", auth(), asyncHandler(listTaskTypes));
router.post(
  "/",
  auth(),
  validate(createTaskTypeSchema),
  asyncHandler(createTaskType),
);
router.get(
  "/:taskTypeId",
  auth(),
  validate({ params: taskTypeIdParam }),
  asyncHandler(getTaskType),
);
router.patch(
  "/:taskTypeId",
  auth(),
  validate(updateTaskTypeSchema),
  asyncHandler(updateTaskType),
);
router.delete(
  "/:taskTypeId",
  auth(),
  validate({ params: taskTypeIdParam }),
  asyncHandler(deleteTaskType),
);

export default router;
