import catchAsync from "../utils/catchAsync.js";
import * as reportsService from "../services/reportsService.js";

export const getReports = catchAsync(async (req, res) => {
  res.json(
    await reportsService.getReports(req.user, {
      days: Number(req.query.days || 0),
      teamId: req.query.teamId,
      taskTypeId: req.query.taskTypeId,
      listMetric: req.query.list,
      personId: req.query.personId,
    })
  );
});

export default { getReports };
