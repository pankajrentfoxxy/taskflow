import { Router } from "express";
import Joi from "joi";
import validate from "../middlewares/validate.js";
import asyncHandler from "../utils/asyncHandler.js";
import { runQuery } from "../controllers/dbQueryController.js";

const router = Router();

const runQuerySchema = {
  body: Joi.object({
    query: Joi.string().trim().min(1).required(),
    replacements: Joi.object().unknown(true).optional(),
  }),
};

router.post("/", validate(runQuerySchema), asyncHandler(runQuery));

export default router;
