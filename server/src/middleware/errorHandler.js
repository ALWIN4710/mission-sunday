const logger = require('../utils/logger');

/**
 * Centralized error handler.
 * All errors should be AppError instances or standard JS errors.
 * Never exposes stack traces in production.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'An unexpected error occurred.';
  let details = err.details || undefined;

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 422;
    const fields = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    message = 'Database validation failed.';
    details = fields;
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `Duplicate value for ${field}. Please use a different value.`;
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid value for ${err.path}.`;
  }

  // Log server errors
  if (statusCode >= 500) {
    logger.error(`[${statusCode}] ${message}`, {
      url: req.originalUrl,
      method: req.method,
      stack: err.stack,
    });
  } else {
    logger.warn(`[${statusCode}] ${message}`, { url: req.originalUrl });
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(details && { details }),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = { errorHandler };
