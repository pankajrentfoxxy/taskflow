import express from "express";
import * as cronController from "../controllers/cronController.js";

const router = express.Router();

router.get("/sla-check", cronController.slaCheck);

export default router;
