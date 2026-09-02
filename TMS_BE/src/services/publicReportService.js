import fs from "fs";
import path from "path";
import httpStatus from "http-status";
import Meta from "../models/Meta.js";
import ApiError from "../utils/ApiError.js";
import { getReportsDir } from "./ceoReportService.js";
function tokenMetaKey(token) {
  return `ceo_report_token_${token}`;
}

export async function getReportMetaByToken(token) {
  const clean = String(token || "").trim();
  if (!clean || clean.length < 16) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid report link");
  }

  const row = await Meta.findByPk(tokenMetaKey(clean));
  if (!row?.value) {
    throw new ApiError(httpStatus.NOT_FOUND, "Report not found or link expired");
  }

  let meta;
  try {
    meta = JSON.parse(row.value);
  } catch {
    throw new ApiError(httpStatus.NOT_FOUND, "Report not found");
  }

  const filePath = path.join(getReportsDir(), meta.filename);
  if (!fs.existsSync(filePath)) {
    throw new ApiError(httpStatus.NOT_FOUND, "Report file not available");
  }

  return { token: clean, ...meta, filePath };
}

export async function getPublicReportInfo(token) {
  const meta = await getReportMetaByToken(token);
  return {
    dateKey: meta.dateKey,
    taskCount: meta.taskCount ?? null,
    filename: meta.filename,
  };
}

export async function streamPublicReportDownload(token, res) {
  const meta = await getReportMetaByToken(token);
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="${meta.filename}"`);
  fs.createReadStream(meta.filePath).pipe(res);
}

export default { getPublicReportInfo, streamPublicReportDownload, getReportMetaByToken };
