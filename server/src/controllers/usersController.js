const User = require('../models/User');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { createAuditLog } = require('../middleware/auditLogger');

/** GET /api/v1/users */
const getUsers = catchAsync(async (req, res) => {
  const rawUsers = await User.find().select('-passwordHash').sort({ createdAt: -1 });
  const users = rawUsers.map((u) => {
    const obj = u.toJSON();
    obj.username = u.email ? u.email.split('@')[0] : '';
    obj.status = u.isActive ? 'active' : 'inactive';
    obj.created_at = u.createdAt;
    return obj;
  });
  res.status(200).json({ success: true, count: users.length, users });
});

/** POST /api/v1/users */
const createUser = catchAsync(async (req, res, next) => {
  let { name, email, username, password, role } = req.body;

  if (!email && username) {
    email = username.includes('@') ? username : `${username}@missionsunday.church`;
  }

  if (!email || !password) {
    return next(new AppError('Email and password are required.', 400));
  }

  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    return next(new AppError('A user with this email or username already exists.', 409));
  }

  const user = await User.create({
    name,
    email: email.toLowerCase().trim(),
    passwordHash: password, // pre-save hook hashes it
    role: role || 'volunteer',
    isActive: true,
  });

  await createAuditLog({
    action: 'user.create',
    entity: 'User',
    entityId: user._id,
    description: `User created: ${user.email} (${user.role})`,
    performedBy: req.user.id,
    ipAddress: req.ip,
  });

  const resUser = user.toJSON();
  resUser.username = resUser.email.split('@')[0];
  resUser.status = resUser.isActive ? 'active' : 'inactive';
  resUser.created_at = resUser.createdAt;

  res.status(201).json({ success: true, user: resUser });
});

/** PATCH /api/v1/users/:id */
const updateUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  if (!user) return next(new AppError('User not found.', 404));

  if (req.body.name !== undefined) user.name = req.body.name;
  if (req.body.isActive !== undefined) user.isActive = Boolean(req.body.isActive);
  if (req.body.status !== undefined) user.isActive = req.body.status === 'active';
  if (req.body.role !== undefined) user.role = req.body.role;

  // Handle password reset
  if (req.body.newPassword) {
    user.passwordHash = req.body.newPassword; // triggers pre-save hash
  }

  await user.save();

  await createAuditLog({
    action: 'user.update',
    entity: 'User',
    entityId: user._id,
    description: `User updated: ${user.email}`,
    performedBy: req.user.id,
    ipAddress: req.ip,
  });

  const resUser = user.toJSON();
  resUser.username = resUser.email.split('@')[0];
  resUser.status = resUser.isActive ? 'active' : 'inactive';
  resUser.created_at = resUser.createdAt;

  res.status(200).json({ success: true, user: resUser });
});

module.exports = { getUsers, createUser, updateUser };
