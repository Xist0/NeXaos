class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = "Некорректный запрос", details) {
    return new ApiError(400, message, details);
  }

  static unauthorized(message = "Неавторизовано") {
    return new ApiError(401, message);
  }

  static forbidden(message = "Доступ запрещён") {
    return new ApiError(403, message);
  }

  static notFound(message = "Ресурс не найден") {
    return new ApiError(404, message);
  }

  static conflict(message = "Конфликт данных", details) {
    return new ApiError(409, message, details);
  }

  static internal(message = "Внутренняя ошибка сервера") {
    return new ApiError(500, message);
  }
}

module.exports = ApiError;

