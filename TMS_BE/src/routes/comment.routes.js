import { Router } from "express";
import Joi from "joi";
import validate from "../middlewares/validate.js";
import { auth } from "../middlewares/auth.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  createComment,
  listComments,
  getComment,
  updateComment,
  deleteComment,
  toggleCommentReaction,
} from "../controllers/commentController.js";

const router = Router({ mergeParams: true });

const taskParams = Joi.object({
  projectId: Joi.number().integer().positive().required(),
  taskId: Joi.number().integer().positive().required(),
});

const commentParams = Joi.object({
  projectId: Joi.number().integer().positive().required(),
  taskId: Joi.number().integer().positive().required(),
  commentId: Joi.number().integer().positive().required(),
});

const createCommentSchema = {
  params: taskParams,
  body: Joi.object({
    content: Joi.string().trim().min(1).required(),
    parent_comment_id: Joi.number().integer().positive().allow(null),
  }),
};

const updateCommentSchema = {
  params: commentParams,
  body: Joi.object({
    content: Joi.string().trim().min(1).required(),
  }),
};

const toggleReactionSchema = {
  params: commentParams,
  body: Joi.object({
    emoji: Joi.string().trim().min(1).max(32).required(),
  }),
};

router.get("/", auth(), validate({ params: taskParams }), asyncHandler(listComments));
router.post(
  "/",
  auth(),
  validate(createCommentSchema),
  asyncHandler(createComment),
);
router.get(
  "/:commentId",
  auth(),
  validate({ params: commentParams }),
  asyncHandler(getComment),
);
router.patch(
  "/:commentId",
  auth(),
  validate(updateCommentSchema),
  asyncHandler(updateComment),
);
router.delete(
  "/:commentId",
  auth(),
  validate({ params: commentParams }),
  asyncHandler(deleteComment),
);
router.post(
  "/:commentId/reactions/toggle",
  auth(),
  validate(toggleReactionSchema),
  asyncHandler(toggleCommentReaction),
);

export default router;
