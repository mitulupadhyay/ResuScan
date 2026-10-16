class ApiError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, details) {
    return new ApiError(400, message, details);
  }
  static unauthorized(message = "Unauthorized") {
    return new ApiError(401, message);
  }
  static forbidden(message = "Forbidden") {
    return new ApiError(403, message);
  }
  static notFound(message = "Not found") {
    return new ApiError(404, message);
  }
  static conflict(message, details) {
    return new ApiError(409, message, details);
  }
  static tooMany(message = "Too many requests") {
    return new ApiError(429, message);
  }
  static internal(message = "Internal server error") {
    return new ApiError(500, message);
  }
}

module.exports = ApiError;