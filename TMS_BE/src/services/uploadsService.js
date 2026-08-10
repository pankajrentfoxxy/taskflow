import fs from "fs";
import path from "path";
import httpStatus from "http-status";
import { Attachment } from "../models/index.js";
import ApiError from "../utils/ApiError.js";
import { now } from "../lib/time.js";

export const getAttachment = async (attachmentId) => {
  const att = await Attachment.findByPk(attachmentId);
  if (!att) throw new ApiError(httpStatus.NOT_FOUND, "Not found");
  return att;
};

export const createAttachment = async (user, file, projectId = null) => {
  const att = await Attachment.create({
    uploader_id: user.id,
    file_name: file.originalname || "file",
    mime_type: file.mimetype || "application/octet-stream",
    size: file.size,
    file_path: file.path,
    project_id: projectId,
    created_at: now(),
  });

  return {
    id: att.id,
    fileName: att.file_name,
    mimeType: att.mime_type,
    size: att.size,
  };
};

export const streamAttachment = (att, res) => {
  if (!fs.existsSync(att.file_path)) {
    throw new ApiError(httpStatus.NOT_FOUND, "File not found on disk");
  }

  res.set({
    "Content-Type": att.mime_type,
    "Content-Disposition": `inline; filename="${encodeURIComponent(att.file_name)}"`,
    "Cache-Control": "private, max-age=3600",
  });

  fs.createReadStream(att.file_path).pipe(res);
};

export default { getAttachment, createAttachment, streamAttachment };
