const ApiError = require("../utils/api-error");
const logger = require("../utils/logger");

const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  const requestId = req.requestId;
  const statusCode = err.statusCode || 500;
  let finalStatusCode = statusCode;
  const response = {
    message: err.message || "Внутренняя ошибка сервера",
  };

  if (requestId) {
    response.requestId = requestId;
  }

  if (err && err.type === "entity.parse.failed") {
    finalStatusCode = 400;
    response.message = "Некорректный JSON";
  }

  if (err && (err.isJoi || err.name === "ValidationError")) {
    finalStatusCode = 400;
    response.message = "Ошибка валидации";
    response.details = err.details;
  }

  if (err && (err.code === "LIMIT_FILE_SIZE" || err.code === "LIMIT_UNEXPECTED_FILE")) {
    finalStatusCode = 400;
    response.message = err.message || "Ошибка загрузки файла";
  }

  if (err && typeof err.code === "string") {
    if (err.code === "23505") {
      finalStatusCode = 409;
      response.message = "Конфликт данных";
    }
    if (err.code === "22P02") {
      finalStatusCode = 400;
      response.message = "Некорректный запрос";
    }
    if (err.code === "23503") {
      finalStatusCode = 409;
      response.message = "Конфликт данных";
    }
  }

  if (err.details) {
    response.details = err.details;
  }

  logger.error("Request error", {
    statusCode: finalStatusCode,
    path: req.originalUrl,
    method: req.method,
    message: err.message,
    stack: err.stack,
    requestId,
  });

  if (finalStatusCode === 500 && process.env.NODE_ENV !== "production") {
    response.stack = err.stack;
  }

  if (!(err instanceof ApiError) && finalStatusCode === 500) {
    response.message = "Внутренняя ошибка сервера";
    delete response.details;
  }

  res.status(finalStatusCode).json(response);
};

module.exports = errorHandler;

