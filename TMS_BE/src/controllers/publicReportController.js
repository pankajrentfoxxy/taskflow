import catchAsync from "../utils/catchAsync.js";
import * as publicReportService from "../services/publicReportService.js";

export const getReportInfo = catchAsync(async (req, res) => {
  res.json(await publicReportService.getPublicReportInfo(req.params.token));
});

export const downloadReport = catchAsync(async (req, res) => {
  await publicReportService.streamPublicReportDownload(req.params.token, res);
});

export default { getReportInfo, downloadReport };
