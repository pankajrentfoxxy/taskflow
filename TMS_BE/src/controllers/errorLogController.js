import * as errorLogService from "../services/errorLogService.js";

export const listErrorLogs = async (req, res) => {
  const result = await errorLogService.listErrorLogs({
    limit: req.query.limit,
    offset: req.query.offset,
  });

  res.json(result);
};
