const Product = require('../models/Product');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { createAuditLog } = require('../middleware/auditLogger');

/** GET /api/v1/products */
const getProducts = catchAsync(async (req, res) => {
  const filter = {};
  if (req.query.category) filter.category = req.query.category;
  if (req.query.available === 'true') filter.isAvailable = true;

  const products = await Product.find(filter).sort({ category: 1, sortOrder: 1, flavour: 1 });
  res.status(200).json({ success: true, count: products.length, products });
});

/** POST /api/v1/products */
const createProduct = catchAsync(async (req, res, next) => {
  const { name, category, flavour, sellingPricePaise, costPricePaise, stockUnit, lowStockThreshold, sortOrder, initialStock = 50 } = req.body;

  if (!category || !flavour || sellingPricePaise === undefined) {
    return next(new AppError('Category, flavour/item name, and selling price are required.', 400));
  }

  const existing = await Product.findOne({ category: category.trim(), flavour: flavour.trim() });
  if (existing) {
    return next(new AppError(`An item named "${flavour}" already exists in the "${category}" category.`, 409));
  }

  const product = await Product.create({
    name: name || `${flavour} ${category}`,
    category: category.trim(),
    flavour: flavour.trim(),
    sellingPricePaise: Math.round(Number(sellingPricePaise)),
    costPricePaise: Math.round(Number(costPricePaise || 0)),
    stockUnit: stockUnit || 'piece',
    lowStockThreshold: Number(lowStockThreshold || 10),
    sortOrder: Number(sortOrder || 0),
    isAvailable: true,
  });

  // Automatically record opening stock so the item is immediately salable
  const initialStockQty = Math.max(0, parseInt(initialStock, 10) || 50);
  if (initialStockQty > 0) {
    const InventoryMovement = require('../models/InventoryMovement');
    await InventoryMovement.create({
      productId: product._id,
      movementType: 'opening',
      quantity: initialStockQty,
      performedBy: req.user.id,
      unitCostPaise: product.costPricePaise,
      notes: 'Initial opening stock upon item creation',
    });
  }

  await createAuditLog({
    action: 'product.create',
    entity: 'Product',
    entityId: product._id,
    description: `Product created: ${product.name} (₹${product.sellingPricePaise / 100}) with ${initialStockQty} units initial stock`,
    performedBy: req.user.id,
    ipAddress: req.ip,
  });

  res.status(201).json({ success: true, product });
});

/** PATCH /api/v1/products/:id */
const updateProduct = catchAsync(async (req, res, next) => {
  const allowed = ['name', 'sellingPricePaise', 'costPricePaise', 'lowStockThreshold', 'stockUnit', 'sortOrder'];
  const updates = {};
  allowed.forEach((field) => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });

  const previous = await Product.findById(req.params.id);
  if (!previous) return next(new AppError('Product not found.', 404));

  const product = await Product.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  });

  // Audit price changes specifically
  if (updates.sellingPricePaise !== undefined && updates.sellingPricePaise !== previous.sellingPricePaise) {
    await createAuditLog({
      action: 'product.price_change',
      entity: 'Product',
      entityId: product._id,
      changes: {
        sellingPricePaise: { from: previous.sellingPricePaise, to: updates.sellingPricePaise },
      },
      description: `Price changed for ${product.name}`,
      performedBy: req.user.id,
      ipAddress: req.ip,
    });
  }

  res.status(200).json({ success: true, product });
});

/** PATCH /api/v1/products/:id/status */
const toggleProductStatus = catchAsync(async (req, res, next) => {
  const product = await Product.findById(req.params.id);
  if (!product) return next(new AppError('Product not found.', 404));

  product.isAvailable = !product.isAvailable;
  await product.save();

  await createAuditLog({
    action: product.isAvailable ? 'product.enable' : 'product.disable',
    entity: 'Product',
    entityId: product._id,
    description: `Product ${product.name} ${product.isAvailable ? 'enabled' : 'disabled'}`,
    performedBy: req.user.id,
    ipAddress: req.ip,
  });

  res.status(200).json({ success: true, product });
});

/** PUT /api/v1/products/batch-prices — Update selling prices for all/multiple products */
const updateBatchPrices = catchAsync(async (req, res, next) => {
  const { prices } = req.body;
  if (!prices || !Array.isArray(prices)) {
    return next(new AppError('Prices array is required.', 400));
  }

  const updatedProducts = [];
  for (const item of prices) {
    if (!item.id) continue;
    const update = {};
    if (item.sellingPricePaise !== undefined) {
      update.sellingPricePaise = Math.round(Number(item.sellingPricePaise));
    }
    if (item.costPricePaise !== undefined) {
      update.costPricePaise = Math.round(Number(item.costPricePaise));
    }

    const product = await Product.findByIdAndUpdate(item.id, update, {
      new: true,
      runValidators: true,
    });
    if (product) updatedProducts.push(product);
  }

  await createAuditLog({
    action: 'product.batch_price_change',
    entity: 'Product',
    description: `Batch updated prices for ${updatedProducts.length} products`,
    performedBy: req.user.id,
    ipAddress: req.ip,
  });

  res.status(200).json({ success: true, count: updatedProducts.length, products: updatedProducts });
});

module.exports = { getProducts, createProduct, updateProduct, toggleProductStatus, updateBatchPrices };
