import httpStatus from "http-status";
import sequelize from "../config/db.js";
import ApiError from "../utils/ApiError.js";

export async function executeRawQuery({ query, replacements = null }) {
  const sql = String(query || "").trim();

  if (!sql) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Query is required");
  }

  const options = {};

  if (replacements != null) {
    options.replacements = replacements;
  }

  const result = await sequelize.query(sql, options);

  if (Array.isArray(result) && result.length === 2) {
    return {
      results: result[0],
      metadata: result[1],
    };
  }

  return {
    results: result,
    metadata: null,
  };
}
