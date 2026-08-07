import { Router } from "express";
import Joi from "joi";
import validate from "../middlewares/validate.js";
import { auth } from "../middlewares/auth.js";
import asyncHandler from "../utils/asyncHandler.js";
import { TASK_PRIORITIES } from "../config/taskPriorities.js";
import {
  createSubtask,
  listSubtasks,
} from "../controllers/taskController.js";

const router = Router({ mergeParams: true });

const taskParams = Joi.object({
  projectId: Joi.number().integer().positive().required(),
  taskId: Joi.number().integer().positive().required(),
});

const timelineSchema = Joi.object({
  start_date: Joi.number().integer().positive().allow(null),
  end_date: Joi.number().integer().positive().allow(null),
});

const subtaskBodyFields = {
  name: Joi.string().trim().min(1).max(255),
  description: Joi.string().allow("", null),
  task_status_id: Joi.number().integer().positive(),
  task_type_id: Joi.number().integer().positive().allow(null),
  assignee_ids: Joi.array()
    .items(Joi.number().integer().positive())
    .unique()
    .optional(),
  due_date: Joi.number().integer().positive().allow(null),
  priority: Joi.string().valid(...TASK_PRIORITIES),
  timeline: timelineSchema,
};

const listSubtasksSchema = {
  params: taskParams,
  query: Joi.object({
    limit: Joi.number().integer().min(1).max(200).optional(),
    order: Joi.string().valid("asc", "desc").optional(),
  }),
};

const createSubtaskSchema = {
  params: taskParams,
  body: Joi.object({
    name: subtaskBodyFields.name.required(),
    description: subtaskBodyFields.description,
    task_status_id: subtaskBodyFields.task_status_id.required(),
    task_type_id: subtaskBodyFields.task_type_id,
    assignee_ids: subtaskBodyFields.assignee_ids,
    due_date: subtaskBodyFields.due_date,
    priority: subtaskBodyFields.priority,
    timeline: subtaskBodyFields.timeline,
  }),
};

router.get(
  "/",
  auth(),
  validate(listSubtasksSchema),
  asyncHandler(listSubtasks),
);
router.post(
  "/",
  auth(),
  validate(createSubtaskSchema),
  asyncHandler(createSubtask),
);

export default router;
