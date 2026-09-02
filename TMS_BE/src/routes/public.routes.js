import express from "express";
import * as publicReportController from "../controllers/publicReportController.js";

const router = express.Router();

router.get("/reports/:token", publicReportController.getReportInfo);
router.get("/reports/:token/download", publicReportController.downloadReport);

export default router;
