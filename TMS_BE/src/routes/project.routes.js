import { Router } from "express";
import Joi from "joi";
import validate from "../middlewares/validate.js";
import { auth } from "../middlewares/auth.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  createProject,
  listProjects,
  getProject,
  updateProject,
  deleteProject,
  listProjectMembers,
  addProjectMember,
  getProjectMember,
  updateProjectMember,
  deleteProjectMember,
} from "../controllers/projectController.js";
import taskRoutes from "./task.routes.js";

const router = Router();

const projectIdParam = Joi.object({
  projectId: Joi.number().integer().positive().required(),
});

const memberIdParam = Joi.object({
  projectId: Joi.number().integer().positive().required(),
  memberId: Joi.number().integer().positive().required(),
});

const createProjectSchema = {
  body: Joi.object({
    name: Joi.string().trim().min(1).max(255).required(),
    description: Joi.string().allow("", null),
    is_active: Joi.boolean().optional(),
  }),
};

const updateProjectSchema = {
  params: projectIdParam,
  body: Joi.object({
    name: Joi.string().trim().min(1).max(255).optional(),
    description: Joi.string().allow("", null),
    is_active: Joi.boolean().optional(),
  }).min(1),
};

const addMemberSchema = {
  params: projectIdParam,
  body: Joi.object({
    user_id: Joi.number().integer().positive().required(),
  }),
};

const updateMemberSchema = {
  params: memberIdParam,
  body: Joi.object({
    user_id: Joi.number().integer().positive().required(),
  }),
};

router.get("/", auth(), asyncHandler(listProjects));
router.post("/", auth(), validate(createProjectSchema), asyncHandler(createProject));

router.get(
  "/:projectId/members",
  auth(),
  validate({ params: projectIdParam }),
  asyncHandler(listProjectMembers),
);
router.post(
  "/:projectId/members",
  auth(),
  validate(addMemberSchema),
  asyncHandler(addProjectMember),
);
router.get(
  "/:projectId/members/:memberId",
  auth(),
  validate({ params: memberIdParam }),
  asyncHandler(getProjectMember),
);
router.patch(
  "/:projectId/members/:memberId",
  auth(),
  validate(updateMemberSchema),
  asyncHandler(updateProjectMember),
);
router.delete(
  "/:projectId/members/:memberId",
  auth(),
  validate({ params: memberIdParam }),
  asyncHandler(deleteProjectMember),
);

router.use("/:projectId/tasks", taskRoutes);

router.get(
  "/:projectId",
  auth(),
  validate({ params: projectIdParam }),
  asyncHandler(getProject),
);
router.patch(
  "/:projectId",
  auth(),
  validate(updateProjectSchema),
  asyncHandler(updateProject),
);
router.delete(
  "/:projectId",
  auth(),
  validate({ params: projectIdParam }),
  asyncHandler(deleteProject),
);

export default router;
