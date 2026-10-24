const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const InventoryMovement = require('../models/InventoryMovement');
const Refund = require('../models/Refund');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { createAuditLog } = require('../middleware/auditLogger');

/**
 * Compute current inventory level for a product.
 * Returns integer unit count.
 */
async function getCurrentStock(productId, session) {
  const pipeline = [
    { $match: { productId: new mongoose.Types.ObjectId(productId) } },
    { $group: { _id: null, balance: { $sum: '$quantity' } } },
  ];
  const opts = session ? { session } : {};
  const [result] = await InventoryMovement.aggregate(pipeline, opts);
  return result ? result.balance : 0;
}

/** POST /api/v1/sales — Atomic checkout */
const createSale = catchAsync(async (req, res, next) => {
  const { items, paymentMethod, upiReference, notes, discountPaise = 0, idempotencyKey } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return next(new AppError('At least one item is required.', 400));
  }

  // Check idempotency
  if (idempotencyKey) {
    const existing = await Sale.findOne({ idempotencyKey });
    if (existing) {
      return res.status(200).json({ success: true, sale: existing, duplicate: true });
    }
  }

  // Validate products and build sale items with server-computed prices
  const saleItems = [];
  for (const item of items) {
    if (!item.productId || !item.quantity || item.quantity < 1) {
      return next(new AppError('Each item must have a valid productId and quantity.', 400));
    }

    const product = await Product.findById(item.productId);
    if (!product) return next(new AppError(`Product ${item.productId} not found.`, 404));
    if (!product.isAvailable) return next(new AppError(`${product.name} is currently unavailable.`, 409));

    const lineTotalPaise = product.sellingPricePaise * item.quantity;
    saleItems.push({
      productId: product._id,
      productName: product.name || `${product.flavour} ${product.category}`,
      category: product.category,
      flavour: product.flavour,
      sellingPricePaise: product.sellingPricePaise,
      costPricePaise: product.costPricePaise || 0,
      quantity: item.quantity,
      lineTotalPaise,
    });
  }

  // Server-computed totals
  const subtotalPaise = saleItems.reduce((sum, i) => sum + i.lineTotalPaise, 0);
  const safeDiscountPaise = Math.min(Math.abs(discountPaise), subtotalPaise);
  const totalPaise = subtotalPaise - safeDiscountPaise;

  // Helper to execute sale creation & inventory deduction
  const execute = async (sess) => {
    const opts = sess ? { session: sess } : {};
    const saleId = new mongoose.Types.ObjectId();

    // Check stock for each item before writing
    for (const saleItem of saleItems) {
      const stock = await getCurrentStock(saleItem.productId, sess);
      if (stock < saleItem.quantity) {
        throw new AppError(
          `Insufficient stock for ${saleItem.productName}. Available: ${stock}, requested: ${saleItem.quantity}.`,
          409
        );
      }
    }

    // Deduct stock for each item
    for (const saleItem of saleItems) {
      await InventoryMovement.create(
        [
          {
            productId: saleItem.productId,
            movementType: 'sale',
            quantity: -saleItem.quantity, // negative = stock out
            referenceId: saleId,
            referenceType: 'Sale',
            notes: `Sale deduction`,
            performedBy: req.user.id,
            unitCostPaise: saleItem.costPricePaise,
          },
        ],
        opts
      );
    }

    // Create the Sale document
    const [sale] = await Sale.create(
      [
        {
          _id: saleId,
          items: saleItems,
          subtotalPaise,
          discountPaise: safeDiscountPaise,
          totalPaise,
          paymentMethod,
          upiReference,
          notes,
          status: 'completed',
          createdBy: req.user.id,
          idempotencyKey: idempotencyKey || uuidv4(),
        },
      ],
      opts
    );

    return sale;
  };

  // Determine if deployment supports transactions (requires ReplicaSet or Sharded)
  let sale;
  let useTransactions = false;
  try {
    const topologyType = mongoose.connection?.client?.topology?.description?.type;
    useTransactions = topologyType === 'ReplicaSetWithPrimary' || topologyType === 'Sharded';
  } catch {
    useTransactions = false;
  }

  if (useTransactions) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        sale = await execute(session);
      });
    } catch (txErr) {
      if (txErr.message && txErr.message.includes('replica set')) {
        sale = await execute(null);
      } else {
        throw txErr;
      }
    } finally {
      await session.endSession();
    }
  } else {
    // Standalone deployment fallback (e.g. local dev server)
    sale = await execute(null);
  }

  await createAuditLog({
    action: 'sale.create',
    entity: 'Sale',
    entityId: sale._id,
    description: `Sale ${sale.transactionId} — ₹${(totalPaise / 100).toFixed(2)} via ${paymentMethod}`,
    performedBy: req.user.id,
    ipAddress: req.ip,
  });

  res.status(201).json({ success: true, sale: await sale.populate('createdBy', 'name email') });
});

/** GET /api/v1/sales */
const getSales = catchAsync(async (req, res) => {
  const { page = 1, limit = 20, status, paymentMethod, startDate, endDate, search, createdBy } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (paymentMethod) filter.paymentMethod = paymentMethod;
  if (createdBy) filter.createdBy = createdBy;
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }
  if (search && search.trim()) {
    const safeSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { transactionId: { $regex: safeSearch, $options: 'i' } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [sales, total] = await Promise.all([
    Sale.find(filter)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Sale.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit)),
    sales,
  });
});

/** GET /api/v1/sales/:id */
const getSaleById = catchAsync(async (req, res, next) => {
  const sale = await Sale.findById(req.params.id).populate('createdBy', 'name email');
  if (!sale) return next(new AppError('Sale not found.', 404));
  res.status(200).json({ success: true, sale });
});

/** POST /api/v1/sales/:id/refunds */
const createRefund = catchAsync(async (req, res, next) => {
  const sale = await Sale.findById(req.params.id);
  if (!sale) return next(new AppError('Sale not found.', 404));

  if (['cancelled', 'fully_refunded'].includes(sale.status)) {
    return next(new AppError(`Cannot refund a ${sale.status} sale.`, 409));
  }

  const { amountPaise, reason, paymentMethod = 'cash' } = req.body;

  const maxRefundable = sale.totalPaise - (sale.refundedAmountPaise || 0);
  if (amountPaise > maxRefundable) {
    return next(
      new AppError(
        `Refund amount (₹${(amountPaise / 100).toFixed(2)}) exceeds maximum refundable (₹${(maxRefundable / 100).toFixed(2)}).`,
        400
      )
    );
  }

  const refund = await Refund.create({
    saleId: sale._id,
    amountPaise,
    reason,
    paymentMethod,
    refundedBy: req.user.id,
    status: 'approved',
  });

  // Update sale totals
  const newRefundedAmount = (sale.refundedAmountPaise || 0) + amountPaise;
  sale.refundedAmountPaise = newRefundedAmount;
  sale.status = newRefundedAmount >= sale.totalPaise ? 'fully_refunded' : 'partially_refunded';
  await sale.save();

  await createAuditLog({
    action: 'refund.create',
    entity: 'Refund',
    entityId: refund._id,
    description: `Refund ₹${(amountPaise / 100).toFixed(2)} for sale ${sale.transactionId}: ${reason}`,
    performedBy: req.user.id,
    ipAddress: req.ip,
  });

  res.status(201).json({ success: true, refund, sale });
});

/** GET /api/v1/sales/export — Export sales to CSV */
const exportSalesCSV = catchAsync(async (req, res) => {
  const { status, paymentMethod, startDate, endDate, search, createdBy } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (paymentMethod) filter.paymentMethod = paymentMethod;
  if (createdBy) filter.createdBy = createdBy;
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }
  if (search && search.trim()) {
    const safeSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { transactionId: { $regex: safeSearch, $options: 'i' } },
    ];
  }

  const sales = await Sale.find(filter)
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 })
    .limit(5000);

  const headers = [
    'Transaction ID',
    'Date & Time (IST)',
    'Cashier / Volunteer',
    'Items',
    'Item Count',
    'Subtotal (INR)',
    'Discount (INR)',
    'Refunded (INR)',
    'Net Total (INR)',
    'Payment Method',
    'UPI Reference',
    'Status',
  ];

  const escapeCSV = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = [headers.map(escapeCSV).join(',')];

  sales.forEach((s) => {
    const itemsStr = (s.items || []).map((i) => `${i.productName} (${i.quantity})`).join('; ');
    const totalQty = (s.items || []).reduce((q, i) => q + i.quantity, 0);
    const istDate = new Date(s.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    const row = [
      s.transactionId,
      istDate,
      s.createdBy?.name || '',
      itemsStr,
      totalQty,
      (s.subtotalPaise / 100).toFixed(2),
      (s.discountPaise / 100).toFixed(2),
      (s.refundedAmountPaise / 100).toFixed(2),
      (s.totalPaise / 100).toFixed(2),
      s.paymentMethod,
      s.upiReference || '',
      s.status,
    ];
    rows.push(row.map(escapeCSV).join(','));
  });

  const filename = `sales-history-${new Date().toISOString().split('T')[0]}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send('\uFEFF' + rows.join('\r\n'));
});

module.exports = { createSale, getSales, getSaleById, createRefund, exportSalesCSV };
