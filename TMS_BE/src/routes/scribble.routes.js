import { Router } from "express";
import Joi from "joi";
import validate from "../middlewares/validate.js";
import { auth } from "../middlewares/auth.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  listScribbles,
  createScribble,
  getScribbleById,
  updateScribble,
  deleteScribble,
} from "../controllers/scribbleController.js";

const router = Router();

const scribbleIdParam = Joi.object({
  scribbleId: Joi.number().integer().positive().required(),
});

const sceneSchema = Joi.object({
  elements: Joi.array().required(),
  appState: Joi.object().unknown(true),
  files: Joi.object().unknown(true),
});

const createScribbleSchema = {
  body: Joi.object({
    scene: sceneSchema.required(),
    name: Joi.string().trim().max(255).optional(),
  }),
};

const getScribbleSchema = {
  params: scribbleIdParam,
};

const updateScribbleSchema = {
  params: scribbleIdParam,
  body: Joi.object({
    scene: sceneSchema.required(),
    name: Joi.string().trim().max(255).optional(),
  }),
};

const deleteScribbleSchema = {
  params: scribbleIdParam,
};

router.get("/", auth(), asyncHandler(listScribbles));
router.post("/", auth(), validate(createScribbleSchema), asyncHandler(createScribble));
router.get("/:scribbleId", auth(), validate(getScribbleSchema), asyncHandler(getScribbleById));
router.put(
  "/:scribbleId",
  auth(),
  validate(updateScribbleSchema),
  asyncHandler(updateScribble),
);
router.delete(
  "/:scribbleId",
  auth(),
  validate(deleteScribbleSchema),
  asyncHandler(deleteScribble),
);

export default router;
