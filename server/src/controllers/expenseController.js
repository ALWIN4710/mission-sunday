const Expense = require('../models/Expense');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { createAuditLog } = require('../middleware/auditLogger');

/** GET /api/v1/expenses */
const getExpenses = catchAsync(async (req, res) => {
  const { page = 1, limit = 20, category, startDate, endDate } = req.query;

  const filter = {};
  if (category) filter.category = category;
  if (startDate || endDate) {
    filter.date = {};
    if (startDate) filter.date.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.date.$lte = end;
    }
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [expenses, total, categoryTotals] = await Promise.all([
    Expense.find(filter)
      .populate('createdBy', 'name')
      .sort({ date: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Expense.countDocuments(filter),
    Expense.aggregate([
      { $match: filter },
      { $group: { _id: '$category', total: { $sum: '$amountPaise' } } },
      { $sort: { total: -1 } },
    ]),
  ]);

  const grandTotal = categoryTotals.reduce((sum, c) => sum + c.total, 0);

  res.status(200).json({
    success: true,
    total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit)),
    expenses,
    categoryTotals,
    grandTotalPaise: grandTotal,
  });
});

/** POST /api/v1/expenses */
const createExpense = catchAsync(async (req, res) => {
  const expense = await Expense.create({ ...req.body, createdBy: req.user.id });

  await createAuditLog({
    action: 'expense.create',
    entity: 'Expense',
    entityId: expense._id,
    description: `Expense created: ${expense.description} — ₹${(expense.amountPaise / 100).toFixed(2)}`,
    performedBy: req.user.id,
    ipAddress: req.ip,
  });

  res.status(201).json({ success: true, expense });
});

/** PATCH /api/v1/expenses/:id */
const updateExpense = catchAsync(async (req, res, next) => {
  const expense = await Expense.findById(req.params.id);
  if (!expense) return next(new AppError('Expense not found.', 404));

  const previousValues = expense.toObject();
  const allowed = ['description', 'category', 'amountPaise', 'date', 'paymentMethod', 'vendor', 'notes', 'status'];
  const updates = {};
  allowed.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

  Object.assign(expense, updates);
  expense.editHistory.push({
    editedAt: new Date(),
    editedBy: req.user.id,
    previousValues,
  });
  await expense.save();

  await createAuditLog({
    action: 'expense.edit',
    entity: 'Expense',
    entityId: expense._id,
    changes: updates,
    description: `Expense updated: ${expense.description}`,
    performedBy: req.user.id,
    ipAddress: req.ip,
  });

  res.status(200).json({ success: true, expense });
});

module.exports = { getExpenses, createExpense, updateExpense };
