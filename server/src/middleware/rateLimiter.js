const rateLimit = require('express-rate-limit');
const AppError = require('../utils/AppError');

const createLimiter = (windowMs, max, message) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next) => next(new AppError(message, 429)),
  });

// Strict limit for auth endpoints
const authLimiter = createLimiter(
  parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10) || 10,
  'Too many login attempts. Please try again in 15 minutes.'
);

// General API limit
const apiLimiter = createLimiter(
  parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  parseInt(process.env.RATE_LIMIT_MAX, 10) || 200,
  'Too many requests. Please slow down.'
);

module.exports = { authLimiter, apiLimiter };
