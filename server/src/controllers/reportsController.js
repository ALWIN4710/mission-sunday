const Sale = require('../models/Sale');
const Expense = require('../models/Expense');
const InventoryMovement = require('../models/InventoryMovement');
const Product = require('../models/Product');
const catchAsync = require('../utils/catchAsync');

function buildDateRange(startDate, endDate) {
  const filter = {};
  if (startDate) filter.$gte = new Date(startDate);
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    filter.$lte = end;
  }
  return Object.keys(filter).length ? filter : undefined;
}

/** GET /api/v1/reports/sales */
const getSalesReport = catchAsync(async (req, res) => {
  const { startDate, endDate, paymentMethod, createdBy } = req.query;
  const match = { status: { $in: ['completed', 'partially_refunded', 'fully_refunded'] } };
  const dr = buildDateRange(startDate, endDate);
  if (dr) match.createdAt = dr;
  if (paymentMethod) match.paymentMethod = paymentMethod;
  if (createdBy) match.createdBy = createdBy;

  const sales = await Sale.find(match)
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 });

  // Compute summary metrics & daily breakdown
  let grossSalesPaise = 0;
  let netSalesPaise = 0;
  let discountsPaise = 0;
  let refundsPaise = 0;
  let unitsSold = 0;
  const dailyMap = {};

  sales.forEach((s) => {
    grossSalesPaise += s.subtotalPaise || 0;
    netSalesPaise += s.totalPaise || 0;
    discountsPaise += s.discountPaise || 0;
    refundsPaise += s.refundedAmountPaise || 0;
    const saleUnits = (s.items || []).reduce((u, item) => u + (item.quantity || 0), 0);
    unitsSold += saleUnits;

    // Daily breakdown formatted in IST (YYYY-MM-DD)
    const dateStr = new Date(s.createdAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    if (!dailyMap[dateStr]) {
      dailyMap[dateStr] = {
        date: dateStr,
        transactionCount: 0,
        grossSalesPaise: 0,
        discountsPaise: 0,
        refundsPaise: 0,
        netSalesPaise: 0,
        unitsSold: 0,
      };
    }
    dailyMap[dateStr].transactionCount += 1;
    dailyMap[dateStr].grossSalesPaise += s.subtotalPaise || 0;
    dailyMap[dateStr].discountsPaise += s.discountPaise || 0;
    dailyMap[dateStr].refundsPaise += s.refundedAmountPaise || 0;
    dailyMap[dateStr].netSalesPaise += s.totalPaise || 0;
    dailyMap[dateStr].unitsSold += saleUnits;
  });

  const daily = Object.values(dailyMap).sort((a, b) => b.date.localeCompare(a.date));
  const transactionCount = sales.length;
  const avgOrderValuePaise = transactionCount > 0 ? Math.round(netSalesPaise / transactionCount) : 0;

  const summary = {
    grossSalesPaise,
    netSalesPaise,
    transactionCount,
    unitsSold,
    avgOrderValuePaise,
    discountsPaise,
    refundsPaise,
  };

  res.status(200).json({
    success: true,
    count: sales.length,
    summary,
    daily,
    sales,
  });
});

/** GET /api/v1/reports/profit-loss */
const getProfitLossReport = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;
  const dr = buildDateRange(startDate, endDate);

  const saleMatch = { status: { $in: ['completed', 'partially_refunded'] } };
  if (dr) saleMatch.createdAt = dr;

  const expenseMatch = {};
  if (dr) expenseMatch.date = dr;

  const [saleSummary, expenseBreakdown, saleTotals] = await Promise.all([
    Sale.aggregate([
      { $match: saleMatch },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.category',
          revenue: { $sum: '$items.lineTotalPaise' },
          cogs: { $sum: { $multiply: ['$items.costPricePaise', '$items.quantity'] } },
          units: { $sum: '$items.quantity' },
        },
      },
      { $addFields: { grossProfit: { $subtract: ['$revenue', '$cogs'] } } },
      { $sort: { revenue: -1 } },
    ]),
    Expense.aggregate([
      { $match: expenseMatch },
      { $group: { _id: '$category', total: { $sum: '$amountPaise' } } },
      { $sort: { total: -1 } },
    ]),
    Sale.aggregate([
      { $match: saleMatch },
      {
        $group: {
          _id: null,
          grossSales: { $sum: '$subtotalPaise' },
          discounts: { $sum: '$discountPaise' },
          refunds: { $sum: '$refundedAmountPaise' },
          netRevenue: { $sum: '$totalPaise' },
        },
      },
    ]),
  ]);

  const totalCOGS = saleSummary.reduce((s, c) => s + c.cogs, 0);
  const grossSalesPaise = saleTotals[0]?.grossSales || 0;
  const discountsPaise = saleTotals[0]?.discounts || 0;
  const refundsPaise = saleTotals[0]?.refunds || 0;
  const netRevenuePaise = saleTotals[0]?.netRevenue || Math.max(0, grossSalesPaise - discountsPaise - refundsPaise);

  const grossProfit = netRevenuePaise - totalCOGS;
  const totalExpenses = expenseBreakdown.reduce((s, c) => s + c.total, 0);
  const netProfit = grossProfit - totalExpenses;

  const expensesList = expenseBreakdown.map((e) => ({
    category: e._id,
    amountPaise: e.total,
  }));

  res.status(200).json({
    success: true,
    report: {
      period: { startDate, endDate },
      grossSalesPaise,
      discountsPaise,
      refundsPaise,
      netRevenuePaise,
      cogsPaise: totalCOGS,
      grossProfitPaise: grossProfit,
      expenses: expensesList,
      totalExpensesPaise: totalExpenses,
      netProfitPaise: netProfit,
      revenue: { totalPaise: netRevenuePaise, byCategory: saleSummary },
      cogs: { totalPaise: totalCOGS },
    },
  });
});

/** GET /api/v1/reports/reconciliation */
const getReconciliationReport = catchAsync(async (req, res) => {
  const { date, startDate, endDate } = req.query;
  
  const match = {
    status: { $in: ['completed', 'partially_refunded', 'fully_refunded'] },
  };

  if (startDate || endDate) {
    const dr = buildDateRange(startDate, endDate);
    if (dr) match.createdAt = dr;
  } else {
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);
    match.createdAt = { $gte: targetDate, $lte: endOfDay };
  }

  const [data, upiSales] = await Promise.all([
    Sale.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$paymentMethod',
          totalPaise: { $sum: '$totalPaise' },
          count: { $sum: 1 },
          refundsPaise: { $sum: '$refundedAmountPaise' },
        },
      },
    ]),
    Sale.find({
      ...match,
      paymentMethod: 'upi',
      upiReference: { $exists: true, $ne: '' },
    }).select('upiReference').lean(),
  ]);

  let cashPaise = 0, cashCount = 0;
  let upiPaise = 0, upiCount = 0;
  let otherPaise = 0, otherCount = 0;

  data.forEach((item) => {
    if (item._id === 'cash') {
      cashPaise = item.totalPaise;
      cashCount = item.count;
    } else if (item._id === 'upi') {
      upiPaise = item.totalPaise;
      upiCount = item.count;
    } else {
      otherPaise += item.totalPaise;
      otherCount += item.count;
    }
  });

  const upiReferences = upiSales.map((s) => s.upiReference).filter(Boolean);

  res.status(200).json({
    success: true,
    cashPaise,
    cashCount,
    upiPaise,
    upiCount,
    otherPaise,
    otherCount,
    upiReferences,
    breakdown: data,
  });
});

/** GET /api/v1/reports/inventory */
const getInventoryReport = catchAsync(async (req, res) => {
  const products = await Product.find().lean();
  const balances = await InventoryMovement.aggregate([
    { $group: { _id: '$productId', balance: { $sum: '$quantity' } } },
  ]);
  const bmap = {};
  balances.forEach((b) => { bmap[b._id.toString()] = b.balance; });

  const report = products.map((p) => ({
    productId: p._id,
    name: p.name,
    category: p.category,
    flavour: p.flavour,
    currentStock: bmap[p._id.toString()] || 0,
    stockUnit: p.stockUnit,
    lowStockThreshold: p.lowStockThreshold,
    costPricePaise: p.costPricePaise,
    stockValuePaise: (bmap[p._id.toString()] || 0) * p.costPricePaise,
    isLowStock: (bmap[p._id.toString()] || 0) <= p.lowStockThreshold,
  }));

  const totalValuePaise = report.reduce((s, r) => s + r.stockValuePaise, 0);
  res.status(200).json({
    success: true,
    items: report,
    products: report,
    totalStockValuePaise: totalValuePaise,
  });
});

/** GET /api/v1/reports/:type/download */
const downloadReportCSV = catchAsync(async (req, res) => {
  const { type } = req.params;
  const { startDate, endDate, date } = req.query;

  let csvRows = [];
  const filename = `${type}-report-${startDate || date || 'all'}-to-${endDate || date || 'today'}.csv`;

  if (type === 'sales') {
    const match = { status: { $in: ['completed', 'partially_refunded', 'fully_refunded'] } };
    const dr = buildDateRange(startDate, endDate);
    if (dr) match.createdAt = dr;

    const sales = await Sale.find(match).populate('createdBy', 'name').sort({ createdAt: -1 });
    csvRows.push(['Transaction ID', 'Date & Time (IST)', 'Cashier', 'Payment Method', 'UPI Ref', 'Items', 'Total Qty', 'Subtotal (INR)', 'Discount (INR)', 'Refunded (INR)', 'Total (INR)', 'Status']);

    sales.forEach((s) => {
      const itemsStr = (s.items || []).map((i) => `${i.productName} x ${i.quantity}`).join('; ');
      const totalQty = (s.items || []).reduce((q, i) => q + i.quantity, 0);
      const istDate = new Date(s.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      csvRows.push([
        s.transactionId,
        istDate,
        s.createdBy?.name || '',
        s.paymentMethod,
        s.upiReference || '',
        itemsStr,
        totalQty,
        (s.subtotalPaise / 100).toFixed(2),
        (s.discountPaise / 100).toFixed(2),
        (s.refundedAmountPaise / 100).toFixed(2),
        (s.totalPaise / 100).toFixed(2),
        s.status,
      ]);
    });
  } else if (type === 'profit-loss') {
    csvRows.push(['Section', 'Line Item', 'Amount (INR)']);
    // We can output P&L rows
    csvRows.push(['Header', `Profit & Loss Statement (${startDate || ''} to ${endDate || ''})`, '']);
  }

  // Format CSV with quotes
  const csvContent = '\uFEFF' + csvRows.map((r) => r.map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(csvContent);
});

module.exports = {
  getSalesReport,
  getProfitLossReport,
  getReconciliationReport,
  getInventoryReport,
  downloadReportCSV,
};
