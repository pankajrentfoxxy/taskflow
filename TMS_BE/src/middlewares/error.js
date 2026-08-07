import httpStatus from "http-status";
import config from "../config/config.js";
import logger from "../config/logger.js";
import ApiError from "../utils/ApiError.js";
import { logErrorFromRequest } from "../services/errorLogService.js";

const errorConverter = (err, req, res, next) => {
  let error = err;

  if (
    err.name === "SequelizeUniqueConstraintError" ||
    err.name === "SequelizeDatabaseError" ||
    err.name === "SequelizeValidationError"
  ) {
    const dbMessage =
      err.errors?.[0]?.message ||
      err.original?.detail ||
      err.message ||
      "Database error";
    error = new ApiError(httpStatus.BAD_REQUEST, dbMessage, false, err.stack);
  }

  if (!(error instanceof ApiError)) {
    const statusCode =
      err.statusCode || err.status || httpStatus.INTERNAL_SERVER_ERROR;
    const message = err.message || httpStatus[statusCode];
    error = new ApiError(statusCode, message, false, err.stack);
  }

  next(error);
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let { statusCode, message } = err;

  if (config.env === "production" && !err.isOperational) {
    statusCode = httpStatus.INTERNAL_SERVER_ERROR;
    message = httpStatus[httpStatus.INTERNAL_SERVER_ERROR];
  }

  res.locals.errorMessage = err.message;

  logErrorFromRequest(err, req, statusCode).catch(() => {});

  const response = {
    message,
    ...(config.env === "development" && { stack: err.stack }),
  };

  if (config.env === "development") {
    logger.error(err);
  }

  res.status(statusCode).send(response);
};

export { errorConverter, errorHandler };
