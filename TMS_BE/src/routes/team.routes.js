import { Router } from "express";
import Joi from "joi";
import validate from "../middlewares/validate.js";
import { auth } from "../middlewares/auth.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  createTeam,
  listTeams,
  getTeam,
  updateTeam,
  deleteTeam,
  listTeamMembers,
  addTeamMember,
  getTeamMember,
  updateTeamMember,
  deleteTeamMember,
} from "../controllers/teamController.js";

const router = Router();

const teamIdParam = Joi.object({
  teamId: Joi.number().integer().positive().required(),
});

const memberIdParam = Joi.object({
  teamId: Joi.number().integer().positive().required(),
  memberId: Joi.number().integer().positive().required(),
});

const createTeamSchema = {
  body: Joi.object({
    name: Joi.string().trim().min(1).max(255).required(),
    description: Joi.string().allow("", null),
    member_ids: Joi.array()
      .items(Joi.number().integer().positive())
      .unique()
      .optional(),
  }),
};

const updateTeamSchema = {
  params: teamIdParam,
  body: Joi.object({
    name: Joi.string().trim().min(1).max(255).optional(),
    description: Joi.string().allow("", null),
  }).min(1),
};

const addMemberSchema = {
  params: teamIdParam,
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

router.get("/", auth(), asyncHandler(listTeams));
router.post("/", auth(), validate(createTeamSchema), asyncHandler(createTeam));

router.get(
  "/:teamId/members",
  auth(),
  validate({ params: teamIdParam }),
  asyncHandler(listTeamMembers),
);
router.post(
  "/:teamId/members",
  auth(),
  validate(addMemberSchema),
  asyncHandler(addTeamMember),
);
router.get(
  "/:teamId/members/:memberId",
  auth(),
  validate({ params: memberIdParam }),
  asyncHandler(getTeamMember),
);
router.patch(
  "/:teamId/members/:memberId",
  auth(),
  validate(updateMemberSchema),
  asyncHandler(updateTeamMember),
);
router.delete(
  "/:teamId/members/:memberId",
  auth(),
  validate({ params: memberIdParam }),
  asyncHandler(deleteTeamMember),
);

router.get(
  "/:teamId",
  auth(),
  validate({ params: teamIdParam }),
  asyncHandler(getTeam),
);
router.patch(
  "/:teamId",
  auth(),
  validate(updateTeamSchema),
  asyncHandler(updateTeam),
);
router.delete(
  "/:teamId",
  auth(),
  validate({ params: teamIdParam }),
  asyncHandler(deleteTeam),
);

export default router;
