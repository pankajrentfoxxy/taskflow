import { Router } from "express";
import Joi from "joi";
import validate from "../middlewares/validate.js";
import asyncHandler from "../utils/asyncHandler.js";
import { listErrorLogs } from "../controllers/errorLogController.js";

const router = Router();

const listErrorLogsSchema = {
  query: Joi.object({
    limit: Joi.number().integer().min(1).max(200).optional(),
    offset: Joi.number().integer().min(0).optional(),
  }),
};

router.get("/", validate(listErrorLogsSchema), asyncHandler(listErrorLogs));

export default router;
