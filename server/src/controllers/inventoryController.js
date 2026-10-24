const mongoose = require('mongoose');
const InventoryMovement = require('../models/InventoryMovement');
const StockPurchase = require('../models/StockPurchase');
const Product = require('../models/Product');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { createAuditLog } = require('../middleware/auditLogger');

/**
 * GET /api/v1/inventory
 * Returns current stock balance per product via aggregation.
 */
const getInventory = catchAsync(async (req, res) => {
  const products = await Product.find().lean();

  // Aggregate stock balance per product
  const stockBalances = await InventoryMovement.aggregate([
    { $group: { _id: '$productId', balance: { $sum: '$quantity' } } },
  ]);

  const balanceMap = {};
  stockBalances.forEach((b) => { balanceMap[b._id.toString()] = b.balance; });

  const inventory = products.map((p) => ({
    ...p,
    currentStock: balanceMap[p._id.toString()] || 0,
    isLowStock: (balanceMap[p._id.toString()] || 0) <= p.lowStockThreshold,
  }));

  res.status(200).json({ success: true, inventory });
});

/**
 * GET /api/v1/inventory/movements
 * Paginated movement history, filterable by product and type.
 */
const getMovements = catchAsync(async (req, res) => {
  const { page = 1, limit = 30, productId, movementType, startDate, endDate } = req.query;

  const filter = {};
  if (productId) filter.productId = productId;
  if (movementType) filter.movementType = movementType;
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [movements, total] = await Promise.all([
    InventoryMovement.find(filter)
      .populate('productId', 'name category flavour')
      .populate('performedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    InventoryMovement.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit)),
    movements,
  });
});

/**
 * POST /api/v1/inventory/movements
 * Manual adjustment or wastage record.
 */
const createMovement = catchAsync(async (req, res, next) => {
  const { productId, movementType, quantity, notes } = req.body;
  const allowedTypes = ['opening', 'wastage', 'adjustment_add', 'adjustment_remove', 'refund_return'];

  if (!allowedTypes.includes(movementType)) {
    return next(new AppError(`movementType must be one of: ${allowedTypes.join(', ')}`, 400));
  }

  const product = await Product.findById(productId);
  if (!product) return next(new AppError('Product not found.', 404));

  // Determine sign
  const positiveTypes = ['opening', 'adjustment_add', 'refund_return'];
  const signedQty = positiveTypes.includes(movementType) ? Math.abs(quantity) : -Math.abs(quantity);

  // Check for negative stock (prevent going below zero unless admin)
  if (signedQty < 0) {
    const currentStock = await InventoryMovement.aggregate([
      { $match: { productId: new mongoose.Types.ObjectId(productId) } },
      { $group: { _id: null, balance: { $sum: '$quantity' } } },
    ]);
    const balance = currentStock[0]?.balance || 0;
    if (balance + signedQty < 0 && req.user.role !== 'admin') {
      return next(new AppError('This adjustment would result in negative stock. Contact an administrator.', 409));
    }
  }

  const movement = await InventoryMovement.create({
    productId,
    movementType,
    quantity: signedQty,
    notes,
    referenceType: 'ManualAdjustment',
    performedBy: req.user.id,
  });

  await createAuditLog({
    action: `inventory.${movementType}`,
    entity: 'InventoryMovement',
    entityId: movement._id,
    description: `Manual ${movementType} of ${Math.abs(quantity)} units for ${product.name}`,
    performedBy: req.user.id,
    ipAddress: req.ip,
  });

  res.status(201).json({ success: true, movement });
});

/**
 * POST /api/v1/inventory/purchases
 * Record a bulk stock purchase.
 */
const createPurchase = catchAsync(async (req, res, next) => {
  const { vendor, date, items, paymentMethod, notes } = req.body;

  if (!items || items.length === 0) {
    return next(new AppError('At least one item is required.', 400));
  }

  const purchaseItems = [];
  let totalAmountPaise = 0;

  for (const item of items) {
    const product = await Product.findById(item.productId);
    if (!product) return next(new AppError(`Product ${item.productId} not found.`, 404));

    const qty = Math.abs(item.quantity);
    const unitCost = Math.abs(item.unitCostPaise || 0);
    const lineCost = qty * unitCost;
    totalAmountPaise += lineCost;

    purchaseItems.push({
      productId: product._id,
      productName: product.name,
      quantity: qty,
      unitCostPaise: unitCost,
      totalCostPaise: lineCost,
    });
  }

  const purchase = await StockPurchase.create({
    vendor,
    date: date || new Date(),
    items: purchaseItems,
    totalAmountPaise,
    paymentMethod,
    notes,
    recordedBy: req.user.id,
  });

  // Create inventory movements for each purchase item
  const movements = purchaseItems.map((item) => ({
    productId: item.productId,
    movementType: 'purchase',
    quantity: item.quantity,
    referenceId: purchase._id,
    referenceType: 'StockPurchase',
    performedBy: req.user.id,
    unitCostPaise: item.unitCostPaise,
    notes: vendor ? `Purchase from ${vendor}` : 'Stock purchase',
  }));
  await InventoryMovement.insertMany(movements);

  res.status(201).json({ success: true, purchase });
});

module.exports = { getInventory, getMovements, createMovement, createPurchase };
