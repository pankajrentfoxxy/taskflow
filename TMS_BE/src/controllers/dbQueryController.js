import * as dbQueryService from "../services/dbQueryService.js";

export const runQuery = async (req, res) => {
  const response = await dbQueryService.executeRawQuery({
    query: req.body.query,
    replacements: req.body.replacements,
  });

  res.json(response);
};
