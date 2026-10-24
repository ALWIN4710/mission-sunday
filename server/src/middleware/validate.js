const { validationResult } = require('express-validator');
const AppError = require('../utils/AppError');

/**
 * Runs after express-validator chains.
 * If there are validation errors, responds with 422 Unprocessable Entity.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map((e) => `${e.path}: ${e.msg}`);
    return next(new AppError(`Validation failed: ${messages.join('; ')}`, 422, errors.array()));
  }
  next();
};

module.exports = { validate };
