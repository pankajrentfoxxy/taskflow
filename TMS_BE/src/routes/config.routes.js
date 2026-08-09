import { Router } from "express";
import asyncHandler from "../utils/asyncHandler.js";
import { getConfig } from "../controllers/configController.js";

const router = Router();

router.get("/", asyncHandler(getConfig));

export default router;
