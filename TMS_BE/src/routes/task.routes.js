import { Router } from "express";
import Joi from "joi";
import validate from "../middlewares/validate.js";
import { auth } from "../middlewares/auth.js";
import asyncHandler from "../utils/asyncHandler.js";
import { TASK_PRIORITIES } from "../config/taskPriorities.js";
import {
  createTask,
  listTasks,
  getTask,
  updateTask,
  deleteTask,
} from "../controllers/taskController.js";
import commentRoutes from "./comment.routes.js";
import subtaskRoutes from "./subtask.routes.js";

const router = Router({ mergeParams: true });

const projectIdParam = Joi.object({
  projectId: Joi.number().integer().positive().required(),
});

const taskIdParam = Joi.object({
  projectId: Joi.number().integer().positive().required(),
  taskId: Joi.number().integer().positive().required(),
});

const timelineSchema = Joi.object({
  start_date: Joi.number().integer().positive().allow(null),
  end_date: Joi.number().integer().positive().allow(null),
});

const taskBodyFields = {
  name: Joi.string().trim().min(1).max(255),
  description: Joi.string().allow("", null),
  task_status_id: Joi.number().integer().positive(),
  task_type_id: Joi.number().integer().positive().allow(null),
  parent_task_id: Joi.number().integer().positive().allow(null),
  assignee_ids: Joi.array()
    .items(Joi.number().integer().positive())
    .unique()
    .optional(),
  due_date: Joi.number().integer().positive().allow(null),
  priority: Joi.string().valid(...TASK_PRIORITIES),
  timeline: timelineSchema,
};

const listTasksSchema = {
  params: projectIdParam,
  query: Joi.object({
    limit: Joi.number().integer().min(1).max(200).optional(),
    order: Joi.string().valid("asc", "desc").optional(),
    parent_task_id: Joi.alternatives()
      .try(Joi.number().integer().positive(), Joi.valid("null"))
      .optional(),
    include_subtasks: Joi.boolean().optional(),
  }),
};

const createTaskSchema = {
  params: projectIdParam,
  body: Joi.object({
    name: taskBodyFields.name.required(),
    description: taskBodyFields.description,
    task_status_id: taskBodyFields.task_status_id.required(),
    task_type_id: taskBodyFields.task_type_id,
    parent_task_id: taskBodyFields.parent_task_id,
    assignee_ids: taskBodyFields.assignee_ids,
    due_date: taskBodyFields.due_date,
    priority: taskBodyFields.priority,
    timeline: taskBodyFields.timeline,
  }),
};

const updateTaskSchema = {
  params: taskIdParam,
  body: Joi.object({
    name: taskBodyFields.name,
    description: taskBodyFields.description,
    task_status_id: taskBodyFields.task_status_id,
    task_type_id: taskBodyFields.task_type_id,
    parent_task_id: taskBodyFields.parent_task_id,
    assignee_ids: taskBodyFields.assignee_ids,
    due_date: taskBodyFields.due_date,
    priority: taskBodyFields.priority,
    timeline: taskBodyFields.timeline,
  }).min(1),
};

router.get(
  "/",
  auth(),
  validate(listTasksSchema),
  asyncHandler(listTasks),
);
router.post(
  "/",
  auth(),
  validate(createTaskSchema),
  asyncHandler(createTask),
);
router.use("/:taskId/subtasks", subtaskRoutes);
router.use("/:taskId/comments", commentRoutes);
router.get(
  "/:taskId",
  auth(),
  validate({ params: taskIdParam }),
  asyncHandler(getTask),
);
router.patch(
  "/:taskId",
  auth(),
  validate(updateTaskSchema),
  asyncHandler(updateTask),
);
router.delete(
  "/:taskId",
  auth(),
  validate({ params: taskIdParam }),
  asyncHandler(deleteTask),
);

export default router;
