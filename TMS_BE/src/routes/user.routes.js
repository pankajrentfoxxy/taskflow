import { Router } from "express";
import Joi from "joi";
import validate from "../middlewares/validate.js";
import { auth } from "../middlewares/auth.js";
import asyncHandler from "../utils/asyncHandler.js";
import { listUsers, createUser } from "../controllers/userController.js";

const router = Router();

const createUserSchema = {
  body: Joi.object({
    full_name: Joi.string().trim().min(1).max(255).required(),
    email: Joi.string().email().required(),
    phone_number: Joi.string().trim().min(5).max(20).required(),
    password: Joi.string().min(6).max(100).required(),
    role_id: Joi.number().integer().positive().optional(),
    team_id: Joi.number().integer().positive().optional(),
  }),
};

router.get("/", auth(), asyncHandler(listUsers));
router.post("/", auth(), validate(createUserSchema), asyncHandler(createUser));

export default router;
