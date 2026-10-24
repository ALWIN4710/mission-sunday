const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const Expense = require('../models/Expense');
const InventoryMovement = require('../models/InventoryMovement');
const Product = require('../models/Product');
const catchAsync = require('../utils/catchAsync');

function buildDateFilter(startDate, endDate) {
  const filter = {};
  if (startDate) filter.$gte = new Date(startDate);
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    filter.$lte = end;
  }
  return Object.keys(filter).length ? filter : undefined;
}

/** GET /api/v1/dashboard/summary */
const getDashboardSummary = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;
  const dateFilter = buildDateFilter(startDate, endDate);

  const saleMatch = { status: { $in: ['completed', 'partially_refunded'] } };
  if (dateFilter) saleMatch.createdAt = dateFilter;

  const expenseMatch = {};
  if (dateFilter) expenseMatch.date = dateFilter;

  const [saleSummary, expenseSummary, stockLow, recentSales] = await Promise.all([
    // Sales aggregation
    Sale.aggregate([
      { $match: saleMatch },
      {
        $group: {
          _id: null,
          grossSalesPaise: { $sum: '$subtotalPaise' },
          discountsPaise: { $sum: '$discountPaise' },
          refundsPaise: { $sum: '$refundedAmountPaise' },
          netSalesPaise: { $sum: '$totalPaise' },
          costOfGoodsPaise: {
            $sum: {
              $reduce: {
                input: '$items',
                initialValue: 0,
                in: { $add: ['$$value', { $multiply: ['$$this.costPricePaise', '$$this.quantity'] }] },
              },
            },
          },
          transactionCount: { $sum: 1 },
          unitsSold: { $sum: { $reduce: { input: '$items', initialValue: 0, in: { $add: ['$$value', '$$this.quantity'] } } } },
          cashPaise: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'cash'] }, '$totalPaise', 0] } },
          upiPaise: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'upi'] }, '$totalPaise', 0] } },
          otherPaise: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'other'] }, '$totalPaise', 0] } },
        },
      },
    ]),
    // Expense total
    Expense.aggregate([
      { $match: expenseMatch },
      { $group: { _id: null, total: { $sum: '$amountPaise' } } },
    ]),
    // Low stock
    (async () => {
      const products = await Product.find().lean();
      const balances = await InventoryMovement.aggregate([
        { $group: { _id: '$productId', balance: { $sum: '$quantity' } } },
      ]);
      const balanceMap = {};
      balances.forEach((b) => { balanceMap[b._id.toString()] = b.balance; });
      return products.filter((p) => (balanceMap[p._id.toString()] || 0) <= p.lowStockThreshold);
    })(),
    // Recent sales
    Sale.find(saleMatch)
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .limit(10),
  ]);

  const s = saleSummary[0] || {};
  const grossSales = s.grossSalesPaise || 0;
  const netSales = s.netSalesPaise || 0;
  const cogs = s.costOfGoodsPaise || 0;
  const grossProfit = netSales - cogs;
  const opExpenses = expenseSummary[0]?.total || 0;
  const netProfit = grossProfit - opExpenses;
  const txnCount = s.transactionCount || 0;

  res.status(200).json({
    success: true,
    summary: {
      grossSalesPaise: grossSales,
      discountsPaise: s.discountsPaise || 0,
      refundsPaise: s.refundsPaise || 0,
      netSalesPaise: netSales,
      costOfGoodsPaise: cogs,
      grossProfitPaise: grossProfit,
      operatingExpensesPaise: opExpenses,
      netProfitPaise: netProfit,
      transactionCount: txnCount,
      unitsSold: s.unitsSold || 0,
      averageOrderValuePaise: txnCount > 0 ? Math.round(netSales / txnCount) : 0,
      paymentBreakdown: {
        cashPaise: s.cashPaise || 0,
        upiPaise: s.upiPaise || 0,
        otherPaise: s.otherPaise || 0,
      },
      lowStockProducts: stockLow,
    },
    recentSales,
  });
});

/** POST /api/v1/dashboard/reset — Clear all sales, refunds, expenses and restore opening inventory */
const resetDashboard = catchAsync(async (req, res) => {
  const Refund = require('../models/Refund');
  const DailyClosing = require('../models/DailyClosing');
  const { createAuditLog } = require('../middleware/auditLogger');

  // 1. Wipe transactions, refunds, expenses, and daily closings
  await Promise.all([
    Sale.deleteMany({}),
    Refund.deleteMany({}),
    Expense.deleteMany({}),
    DailyClosing.deleteMany({}),
    InventoryMovement.deleteMany({}),
  ]);

  // 2. Re-seed 50 units opening stock for each existing product
  const products = await Product.find();
  for (const prod of products) {
    await InventoryMovement.create({
      productId: prod._id,
      movementType: 'opening',
      quantity: 50,
      performedBy: req.user.id,
      unitCostPaise: prod.costPricePaise || 0,
      notes: 'Reset event opening balance',
    });
  }

  // 3. Audit log
  await createAuditLog({
    action: 'dashboard.reset',
    entity: 'System',
    description: 'All sales transactions, refunds, expenses and inventory movements were reset by admin',
    performedBy: req.user.id,
    ipAddress: req.ip,
  });

  res.status(200).json({
    success: true,
    message: 'Dashboard metrics, sales, expenses, and inventory have been successfully reset to initial event opening state.',
  });
});

module.exports = { getDashboardSummary, resetDashboard };
