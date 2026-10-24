const AppError = require('../utils/AppError');

/**
 * Role-based access control factory.
 * Usage: router.get('/admin-only', protect, authorize('admin'), handler)
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required.', 401));
    }
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError(
          `Access denied. This action requires one of: ${roles.join(', ')} role.`,
          403
        )
      );
    }
    next();
  };
};

module.exports = { authorize };
