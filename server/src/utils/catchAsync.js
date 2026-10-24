/**
 * Wraps async route handlers to avoid try-catch boilerplate.
 * Passes any error to Express's next() function.
 */
const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = catchAsync;
