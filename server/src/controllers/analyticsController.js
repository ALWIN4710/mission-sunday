const Sale = require('../models/Sale');
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

function saleMatch(startDate, endDate) {
  const match = { status: { $in: ['completed', 'partially_refunded'] } };
  const dateFilter = buildDateFilter(startDate, endDate);
  if (dateFilter) match.createdAt = dateFilter;
  return match;
}

/** GET /api/v1/analytics/sales — Daily trend */
const getSalesTrend = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;
  const match = saleMatch(startDate, endDate);

  const trend = await Sale.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } },
        revenue: { $sum: '$totalPaise' },
        cogs: {
          $sum: {
            $reduce: {
              input: '$items',
              initialValue: 0,
              in: { $add: ['$$value', { $multiply: ['$$this.costPricePaise', '$$this.quantity'] }] },
            },
          },
        },
        transactions: { $sum: 1 },
        units: { $sum: { $reduce: { input: '$items', initialValue: 0, in: { $add: ['$$value', '$$this.quantity'] } } } },
      },
    },
    { $addFields: { profit: { $subtract: ['$revenue', '$cogs'] } } },
    { $sort: { _id: 1 } },
  ]);

  res.status(200).json({ success: true, trend });
});

/** GET /api/v1/analytics/categories — Revenue by category */
const getCategoryAnalytics = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;
  const match = saleMatch(startDate, endDate);

  const data = await Sale.aggregate([
    { $match: match },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.category',
        revenue: { $sum: '$items.lineTotalPaise' },
        cogs: { $sum: { $multiply: ['$items.costPricePaise', '$items.quantity'] } },
        units: { $sum: '$items.quantity' },
        transactions: { $sum: 1 },
      },
    },
    { $addFields: { profit: { $subtract: ['$revenue', '$cogs'] } } },
    { $sort: { revenue: -1 } },
  ]);

  res.status(200).json({ success: true, categories: data });
});

/** GET /api/v1/analytics/products — Top products */
const getProductAnalytics = catchAsync(async (req, res) => {
  const { startDate, endDate, limit = 50 } = req.query;
  const match = saleMatch(startDate, endDate);

  const data = await Sale.aggregate([
    { $match: match },
    { $unwind: '$items' },
    {
      $group: {
        _id: { productId: '$items.productId', name: '$items.productName', flavour: '$items.flavour', category: '$items.category' },
        revenue: { $sum: '$items.lineTotalPaise' },
        cogs: { $sum: { $multiply: ['$items.costPricePaise', '$items.quantity'] } },
        units: { $sum: '$items.quantity' },
      },
    },
    {
      $project: {
        _id: '$_id.productId',
        productId: '$_id.productId',
        name: '$_id.name',
        flavour: '$_id.flavour',
        category: '$_id.category',
        revenue: 1,
        cogs: 1,
        units: 1,
        profit: { $subtract: ['$revenue', '$cogs'] },
      },
    },
    { $sort: { revenue: -1 } },
    { $limit: Number(limit) },
  ]);

  res.status(200).json({ success: true, products: data });
});

/** GET /api/v1/analytics/hourly — Sales by hour */
const getHourlyAnalytics = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;
  const match = saleMatch(startDate, endDate);

  const data = await Sale.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $hour: { date: '$createdAt', timezone: 'Asia/Kolkata' } },
        revenue: { $sum: '$totalPaise' },
        transactions: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Fill missing hours with zeros
  const hourMap = {};
  data.forEach((d) => { hourMap[d._id] = d; });
  const hourly = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    revenue: hourMap[h]?.revenue || 0,
    transactions: hourMap[h]?.transactions || 0,
  }));

  res.status(200).json({ success: true, hourly });
});

/** GET /api/v1/analytics/volunteers — Sales by volunteer */
const getVolunteerAnalytics = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;
  const match = saleMatch(startDate, endDate);

  const data = await Sale.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$createdBy',
        revenue: { $sum: '$totalPaise' },
        transactions: { $sum: 1 },
        units: { $sum: { $reduce: { input: '$items', initialValue: 0, in: { $add: ['$$value', '$$this.quantity'] } } } },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user',
        pipeline: [{ $project: { name: 1, email: 1 } }],
      },
    },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    { $sort: { revenue: -1 } },
  ]);

  res.status(200).json({ success: true, volunteers: data });
});

module.exports = {
  getSalesTrend,
  getCategoryAnalytics,
  getProductAnalytics,
  getHourlyAnalytics,
  getVolunteerAnalytics,
};
