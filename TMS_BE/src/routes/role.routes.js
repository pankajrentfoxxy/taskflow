import { Router } from "express";
import { auth } from "../middlewares/auth.js";
import asyncHandler from "../utils/asyncHandler.js";
import { listRoles } from "../controllers/roleController.js";

const router = Router();

router.get("/", auth(), asyncHandler(listRoles));

export default router;
