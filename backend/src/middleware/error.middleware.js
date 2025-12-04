const ApiError = require("../utils/api-error");
const logger = require("../utils/logger");

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const response = {
    message: err.message || "Внутренняя ошибка сервера",
  };

  if (err.details) {
    response.details = err.details;
  }

  logger.error("Request error", {
    statusCode,
    path: req.originalUrl,
    method: req.method,
    message: err.message,
    stack: err.stack,
  });

  if (statusCode === 500 && process.env.NODE_ENV !== "production") {
    response.stack = err.stack;
  }

  if (!(err instanceof ApiError) && statusCode === 500) {
    response.message = "Внутренняя ошибка сервера";
  }

  res.status(statusCode).json(response);
};

module.exports = errorHandler;

