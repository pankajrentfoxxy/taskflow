import { Router } from "express";
import Joi from "joi";
import validate from "../middlewares/validate.js";
import { auth } from "../middlewares/auth.js";
import asyncHandler from "../utils/asyncHandler.js";
import { getReports, getMyDashboard } from "../controllers/dashboardController.js";

const router = Router();

const reportsQuerySchema = {
  query: Joi.object({
    team_id: Joi.number().integer().positive().optional(),
    period: Joi.string()
      .valid("all", "week", "month", "this_week")
      .default("all"),
  }),
};

router.get(
  "/reports",
  auth(),
  validate(reportsQuerySchema),
  asyncHandler(getReports),
);

router.get("/me", auth(), asyncHandler(getMyDashboard));

export default router;
