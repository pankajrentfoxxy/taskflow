import express from "express";
import Joi from "joi";
import auth from "../middlewares/auth.js";
import validate from "../middlewares/validate.js";
import * as tasksController from "../controllers/tasksController.js";

const router = express.Router();

router.use(auth());

router.get("/", tasksController.listTasks);

router.get("/template-data", tasksController.getTemplateData);

router.post(
  "/import",
  validate({
    body: Joi.object({
      rows: Joi.array()
        .min(1)
        .max(200)
        .items(
          Joi.object({
            title: Joi.string().required(),
            assigneeLabel: Joi.string().allow("").required(),
            taskTypeName: Joi.string().allow("").optional(),
            dueAtLabel: Joi.string().required(),
            priority: Joi.string().allow("").optional(),
            projectName: Joi.string().allow("").optional(),
            description: Joi.string().allow("").optional(),
          })
        )
        .required(),
    }),
  }),
  tasksController.importTasks
);

router.post(
  "/",
  validate({
    body: Joi.object({
      title: Joi.string(),
      description: Joi.string().allow(""),
      assigneeId: Joi.number().integer().allow(null),
      teamId: Joi.number().integer().allow(null),
      priority: Joi.string().valid("LOW", "NORMAL", "HIGH", "URGENT"),
      dueAt: Joi.number().integer().required(),
      projectId: Joi.number().integer().allow(null),
      parentId: Joi.number().integer().allow(null),
      multiple: Joi.boolean(),
      lines: Joi.array().items(Joi.string()),
      attachmentIds: Joi.array().items(Joi.number().integer()),
      boardId: Joi.number().integer().allow(null),
      taskTypeId: Joi.number().integer().allow(null),
    }),
  }),
  tasksController.createTask
);

router.get("/:id", tasksController.getTask);

router.patch(
  "/:id",
  validate({
    body: Joi.object({
      action: Joi.string().required(),
      etaAt: Joi.number().integer(),
      dueAt: Joi.number().integer(),
      reason: Joi.string(),
      overrideReason: Joi.string(),
    }).unknown(true),
  }),
  tasksController.patchTask
);

router.delete("/:id", tasksController.deleteTask);

router.get("/:id/comments", tasksController.listComments);

router.post(
  "/:id/comments",
  validate({
    body: Joi.object({
      content: Joi.string(),
      body: Joi.string(),
      parentCommentId: Joi.number().integer().allow(null),
    }),
  }),
  tasksController.createComment
);

router.post(
  "/:id/comments/:commentId/reactions",
  validate({
    body: Joi.object({
      emoji: Joi.string().max(32).required(),
    }),
  }),
  tasksController.toggleReaction
);

router.post(
  "/:id/escalation",
  validate({
    body: Joi.object({
      explanation: Joi.string(),
      proposedEtaAt: Joi.number().integer(),
      review: Joi.string().valid("ACCEPTED", "REJECTED"),
      newDueAt: Joi.number().integer(),
    }).unknown(true),
  }),
  tasksController.handleEscalation
);

export default router;
