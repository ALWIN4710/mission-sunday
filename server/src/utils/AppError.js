/**
 * Custom application error class.
 * statusCode < 500 = operational/user errors (shown to client)
 * statusCode >= 500 = programming errors (generic message shown to client)
 */
class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
