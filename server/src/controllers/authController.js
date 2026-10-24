const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { createAuditLog } = require('../middleware/auditLogger');

const isProd = process.env.NODE_ENV === 'production';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProd || process.env.COOKIE_SECURE === 'true',
  sameSite: isProd ? 'none' : (process.env.COOKIE_SAME_SITE || 'lax'),
  maxAge: 8 * 60 * 60 * 1000, // 8 hours
};

function signToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });
}

/** POST /api/v1/auth/login */
const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new AppError('Email and password are required.', 400));
  }

  // Support login via full email or username
  let queryEmail = email.toLowerCase().trim();
  if (!queryEmail.includes('@')) {
    queryEmail = `${queryEmail}@missionsunday.church`;
  }

  // Need passwordHash so must explicitly select it
  const user = await User.findOne({ email: queryEmail }).select('+passwordHash');

  if (!user || !(await user.comparePassword(password))) {
    return next(new AppError('Invalid email or password.', 401));
  }

  if (!user.isActive) {
    return next(new AppError('Your account has been deactivated. Contact an administrator.', 403));
  }

  // Update last login timestamp
  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  const token = signToken(user._id);
  res.cookie('jwt_token', token, COOKIE_OPTIONS);

  await createAuditLog({
    action: 'auth.login',
    entity: 'User',
    entityId: user._id,
    description: `User ${user.email} logged in`,
    performedBy: user._id,
    ipAddress: req.ip,
  });

  res.status(200).json({
    success: true,
    message: 'Logged in successfully.',
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
});

/** POST /api/v1/auth/logout */
const logout = catchAsync(async (req, res) => {
  res.clearCookie('jwt_token', { httpOnly: true, sameSite: 'lax' });

  if (req.user) {
    await createAuditLog({
      action: 'auth.logout',
      entity: 'User',
      entityId: req.user.id,
      description: `User ${req.user.email} logged out`,
      performedBy: req.user.id,
      ipAddress: req.ip,
    });
  }

  res.status(200).json({ success: true, message: 'Logged out successfully.' });
});

/** GET /api/v1/auth/me */
const getMe = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  if (!user) return next(new AppError('User not found.', 404));

  res.status(200).json({ success: true, user });
});

module.exports = { login, logout, getMe };
